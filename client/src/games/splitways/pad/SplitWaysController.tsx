import './controller.css';
import { REVERSE_ARM_MS, type RaceMessage } from '@gamergang/shared';
import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent,
  type RefObject,
} from 'react';
import type { PadControllerProps } from '../../../pad/controllers';
import { DRAG, STUCK_HINTS, dragSteer, featherThrottle, shapeSteer } from '../input/controls';
import { InputSender } from './inputSender';
import { rampSteer } from './steering';

/**
 * What a finger does, fixed when it lands (sticky): sliding off a control never drops it. The one
 * exception is GAS <-> BRAKE·R, which swap when the finger slides from one pedal onto the other.
 */
type Role = 'steer' | 'left' | 'right' | 'gas' | 'brake' | 'handbrake' | 'horn' | 'reset' | 'none';
type Zone = Exclude<Role, 'none'>;

/** Hit-test order (the zones never overlap). Also each zone's bit in the held mask. */
const ZONES: readonly Zone[] = [
  'horn',
  'reset',
  'handbrake',
  'gas',
  'brake',
  'left',
  'right',
  'steer',
];

interface Contact {
  role: Role;
  /** Where the finger is now (client px). */
  x: number;
  y: number;
  /** Steer: horizontal origin. GAS: vertical origin. Both follow a finger that overshoots. */
  originX: number;
  originY: number;
  /** Steer: where the finger landed vertically (the ghost wheel sits there). */
  landY: number;
  /** Steer: full-lock basis (viewport height). GAS: pedal height. */
  travel: number;
  /** RESET: milliseconds held while a reset was available, and whether this press has fired. */
  heldMs: number;
  fired: boolean;
}

/** Input is also sampled on this timer, in case animation frames stall (ms). */
const PUMP_MS = 50;
/** Hold RESET this long to fire it (ms). */
const RESET_HOLD_MS = 600;
/** The arming ring fills a little faster than the TV arms, so it is full when reverse engages. */
const RING_FILL_MS = REVERSE_ARM_MS * 0.85;
/** Display-only copy of the TV's STEER_INPUT shaping, so the ghost wheel turns like the car does. */
const WHEEL_DEAD_ZONE = 0.05;
const WHEEL_GAMMA = 1.5;
/** Ghost wheel rotation at full lock (degrees). */
const WHEEL_MAX_DEG = 120;
/** Phone haptics (ms): reverse engaging, a reset firing. Android only; iPhone has no Vibration API. */
const BUZZ_REVERSE_MS = 12;
const BUZZ_RESET_MS = 8;

function buzz(ms: number): void {
  if (typeof navigator.vibrate === 'function') navigator.vibrate(ms);
}

function inside(rect: DOMRect | undefined, x: number, y: number): rect is DOMRect {
  return (
    rect !== undefined &&
    rect.width > 0 &&
    x >= rect.left &&
    x <= rect.right &&
    y >= rect.top &&
    y <= rect.bottom
  );
}

function ordinal(position: number): string {
  return ['1st', '2nd', '3rd', '4th'][position - 1] ?? `${position}th`;
}

function RaceHud({ race }: { race: RaceMessage | null }) {
  if (!race) return <div className="ctl-hud" />;
  return (
    <div className="ctl-hud">
      <span className="ctl-hud-pos">
        <b>{ordinal(race.position)}</b>
        <small>/{race.playerCount}</small>
      </span>
      <span className="ctl-hud-lap">
        {race.lap > 0
          ? `Lap ${Math.min(race.lap, race.totalLaps)}/${race.totalLaps}`
          : 'Free drive'}
      </span>
      <span className="ctl-hud-speed">
        <b>{Math.round(race.speedKph)}</b> km/h
      </span>
    </div>
  );
}

/** The steering wheel under the thumb while drag steering, with a full-lock rail above it. */
function GhostWheel({
  ghostRef,
  wheelRef,
  railRef,
  dotRef,
}: {
  ghostRef: RefObject<HTMLDivElement | null>;
  wheelRef: RefObject<SVGSVGElement | null>;
  railRef: RefObject<HTMLSpanElement | null>;
  dotRef: RefObject<HTMLSpanElement | null>;
}) {
  return (
    <div className="ctl-ghost" ref={ghostRef} aria-hidden>
      <span className="ctl-ghost-rail" ref={railRef}>
        <i />
        <span className="ctl-ghost-dot" ref={dotRef} />
      </span>
      <svg className="ctl-wheel" viewBox="-100 -100 200 200" ref={wheelRef}>
        <circle r="84" className="ctl-wheel-rim" />
        <circle r="84" className="ctl-wheel-grip" />
        <path d="M -82 -6 Q 0 -30 82 -6 L 82 14 Q 0 -6 -82 14 Z" className="ctl-wheel-spoke" />
        <path d="M -12 10 L 12 10 L 8 82 L -8 82 Z" className="ctl-wheel-spoke" />
        <circle r="26" className="ctl-wheel-hub" />
        <rect x="-7" y="-92" width="14" height="18" rx="4" className="ctl-wheel-marker" />
      </svg>
    </div>
  );
}

/** Thumb on an arc with arrows either way: the drag-steer symbol (also on the join screen). */
function DragIcon() {
  return (
    <svg viewBox="0 0 48 32" aria-hidden>
      <path d="M8 22 Q24 10 40 22" />
      <path d="M14 21.8 8 22l1.9-5.7M34 21.8l6 .2-1.9-5.7" />
      <circle cx="24" cy="16" r="4.5" />
    </svg>
  );
}

/**
 * The phone as a race controller: drag steer (or arrow buttons), feathered GAS, BRAKE·R with an
 * explicit reverse, a handbrake strip, horn and hold-to-reset. Touch only, Pointer Events, every
 * finger hit-tested geometrically and kept in refs so the hot path never re-renders React.
 */
export default function SplitWaysController({
  store,
  mode,
  colourHex,
  onSettings,
}: PadControllerProps) {
  const race = useSyncExternalStore(store.subscribe, () => store.getState().race);
  const rootRef = useRef<HTMLElement>(null);
  const contacts = useRef(new Map<number, Contact>());
  /** Zone rectangles, measured when a finger lands (the layout does not move mid-touch). */
  const rects = useRef(new Map<Zone, DOMRect>());
  const ghostRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<SVGSVGElement>(null);
  const railRef = useRef<HTMLSpanElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const gasRef = useRef<HTMLDivElement>(null);
  const resetRef = useRef<HTMLDivElement>(null);
  const reverseSeen = useRef<RaceMessage['reverse']>('off');

  // Every frame: turn the fingers into an input packet and paint the controls, without
  // re-rendering React. Restarts when the steering mode changes, which also drops held fingers.
  useEffect(() => {
    const root = rootRef.current;
    const ghost = ghostRef.current;
    const wheel = wheelRef.current;
    const rail = railRef.current;
    const dot = dotRef.current;
    const gas = gasRef.current;
    const reset = resetRef.current;
    if (!root || !ghost || !wheel || !rail || !dot || !gas || !reset) return;
    const fingers = contacts.current;
    fingers.clear();
    const sender = new InputSender((input) => store.sendInput(input));
    let buttonSteer = 0;
    let last = performance.now();
    let frame = 0;
    // What is on screen now, so the DOM is only written when something changed.
    let shownHeld = -1;
    let shownLevel = -1;
    let shownHold = -1;
    let shownGhost = '';
    let shownWheel = NaN;
    let shownDot = NaN;

    const paintHeld = (held: number) => {
      if (held === shownHeld) return;
      shownHeld = held;
      root.querySelectorAll<HTMLElement>('[data-zone]').forEach((element) => {
        const bit = 1 << ZONES.indexOf(element.dataset.zone as Zone);
        element.toggleAttribute('data-held', (held & bit) !== 0);
      });
    };

    const paintGhost = (finger: Contact | null, steer: number) => {
      if (!finger) {
        if (shownGhost !== '') {
          shownGhost = '';
          ghost.classList.remove('is-on');
        }
        return;
      }
      const x = Math.round(finger.originX);
      const y = Math.round(finger.landY);
      const position = `translate3d(${x}px, ${y}px, 0)`;
      if (position !== shownGhost) {
        if (shownGhost === '') {
          ghost.classList.add('is-on');
          rail.style.width = `${Math.round(2 * DRAG.fullLockTravel * finger.travel)}px`;
        }
        shownGhost = position;
        ghost.style.transform = position;
      }
      const angle = Math.round(shapeSteer(steer, WHEEL_DEAD_ZONE, WHEEL_GAMMA) * WHEEL_MAX_DEG);
      if (angle !== shownWheel) {
        shownWheel = angle;
        wheel.style.transform = `rotate(${angle}deg)`;
      }
      const offset = Math.round(steer * DRAG.fullLockTravel * finger.travel);
      if (offset !== shownDot) {
        shownDot = offset;
        dot.style.transform = `translateX(${offset}px)`;
      }
    };

    // The latest sample, for painting.
    let held = 0;
    let steer = 0;
    let steerFinger: Contact | null = null;
    let throttle = 0;
    let hold = 0;

    /** Reads the fingers into an input packet and hands it to the sender (which rate-limits). */
    const sample = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const status = store.getState().race;
      const resetReady = status?.phase === 'racing' && status.resetReady;
      held = 0;
      steer = 0;
      steerFinger = null;
      throttle = 0;
      hold = 0;
      let left = false;
      let right = false;
      let brake = 0;
      let handbrake = false;
      let horn = false;
      for (const finger of fingers.values()) {
        const { role } = finger;
        if (role === 'none') continue;
        if (role !== 'reset' || resetReady) held |= 1 << ZONES.indexOf(role);
        switch (role) {
          case 'steer':
            steerFinger = finger;
            steer = dragSteer(finger.x - finger.originX, finger.travel);
            break;
          case 'left':
            left = true;
            break;
          case 'right':
            right = true;
            break;
          case 'gas':
            throttle = Math.max(
              throttle,
              featherThrottle(finger.y - finger.originY, finger.travel),
            );
            break;
          case 'brake':
            brake = 1;
            break;
          case 'handbrake':
            handbrake = true;
            break;
          case 'horn':
            horn = true;
            break;
          case 'reset':
            // Only time held while a reset is available counts, and each press fires once.
            if (!resetReady || finger.fired) {
              finger.heldMs = 0;
              break;
            }
            finger.heldMs += dt * 1000;
            hold = Math.min(1, finger.heldMs / RESET_HOLD_MS);
            if (finger.heldMs >= RESET_HOLD_MS) {
              finger.fired = true;
              hold = 0;
              store.action('reset');
              buzz(BUZZ_RESET_MS);
            }
            break;
        }
      }
      if (mode === 'buttons') {
        buttonSteer = rampSteer(buttonSteer, left, right, dt);
        steer = buttonSteer;
      }
      sender.update({ steer, throttle, brake, handbrake, horn }, now);
    };

    const tick = () => {
      sample();
      paintHeld(held);
      if (throttle !== shownLevel) {
        shownLevel = throttle;
        gas.style.setProperty('--level', String(throttle));
      }
      const holdStep = Math.round(hold * 100) / 100;
      if (holdStep !== shownHold) {
        shownHold = holdStep;
        reset.style.setProperty('--hold', String(holdStep));
      }
      paintGhost(steerFinger, steer);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    // Frames can stall (a busy GPU, a system overlay) while the page still runs: keep the input
    // flowing on a timer too, or the TV would treat a held pedal as a lost pad.
    const pump = setInterval(sample, PUMP_MS);

    // A phone that locks or switches app must not leave the gas held down.
    const onHide = () => {
      fingers.clear();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(pump);
      document.removeEventListener('visibilitychange', onHide);
      fingers.clear();
    };
  }, [store, mode]);

  // Reverse engaging is felt as well as seen (on phones that can vibrate).
  const reverse = race?.reverse ?? 'off';
  useEffect(() => {
    if (reverse === 'on' && reverseSeen.current !== 'on') buzz(BUZZ_REVERSE_MS);
    reverseSeen.current = reverse;
  }, [reverse]);

  /** Geometric hit-test against the zones' rectangles, so overlays can never swallow a touch. */
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    const root = rootRef.current;
    if (!root) return;
    const measured = rects.current;
    measured.clear();
    root.querySelectorAll<HTMLElement>('[data-zone]').forEach((element) => {
      measured.set(element.dataset.zone as Zone, element.getBoundingClientRect());
    });
    const x = event.clientX;
    const y = event.clientY;
    const zone = ZONES.find((z) => inside(measured.get(z), x, y));
    if (!zone) return;
    const fingers = contacts.current;
    let role: Role = zone;
    // One steering thumb; a second finger in the zone does nothing.
    if (zone === 'steer' && [...fingers.values()].some((f) => f.role === 'steer')) role = 'none';
    const gasRect = measured.get('gas');
    fingers.set(event.pointerId, {
      role,
      x,
      y,
      originX: x,
      originY: y,
      landY: y,
      travel: role === 'gas' && gasRect ? gasRect.height : window.innerHeight,
      heldMs: 0,
      fired: false,
    });
    try {
      root.setPointerCapture(event.pointerId);
    } catch {
      // The pointer already ended; the release handlers clean up.
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const finger = contacts.current.get(event.pointerId);
    if (!finger) return;
    const x = event.clientX;
    const y = event.clientY;
    finger.x = x;
    finger.y = y;
    if (finger.role === 'gas' || finger.role === 'brake') {
      const other = finger.role === 'gas' ? 'brake' : 'gas';
      const rect = rects.current.get(other);
      if (inside(rect, x, y)) {
        finger.role = other;
        // Back on GAS: full throttle where the finger is now, feathering from here.
        finger.originY = y;
        finger.travel = rect.height;
      }
    }
    if (finger.role === 'steer') {
      // Past full lock the origin follows the thumb, so turning back answers at once.
      const full = DRAG.fullLockTravel * finger.travel;
      if (x - finger.originX > full) finger.originX = x - full;
      else if (finger.originX - x > full) finger.originX = x + full;
    } else if (finger.role === 'gas' && y < finger.originY) {
      // Slid up past the landing point: feathering counts from the highest point.
      finger.originY = y;
    }
  };

  const onRelease = (event: PointerEvent<HTMLElement>) => {
    contacts.current.delete(event.pointerId);
  };

  const phase = race?.phase ?? null;
  const countdown = phase === 'countdown' && race && race.countdown > 0 ? race.countdown : null;
  const finished = phase === 'finished' ? race : null;
  const racing = phase === 'racing';
  const resetReady = racing && (race?.resetReady ?? false);
  const hint = racing && race?.hint ? STUCK_HINTS[race.hint].pad : null;

  return (
    <main
      className={`ctl ctl--${mode}`}
      style={{ '--accent': colourHex, '--ring-ms': `${RING_FILL_MS}ms` } as CSSProperties}
      ref={rootRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onRelease}
      onPointerCancel={onRelease}
      onLostPointerCapture={onRelease}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="ctl-box">
        <header className="ctl-top">
          <button
            className="ctl-settings"
            onClick={onSettings}
            onPointerDown={(event) => event.stopPropagation()}
            aria-label="Settings"
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="12" r="3.2" />
              <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
            </svg>
          </button>
          <RaceHud race={race} />
          <div className="ctl-top-right">
            <div className="ctl-key ctl-horn" data-zone="horn">
              HORN
            </div>
            <span className="ctl-rchip" data-on={reverse === 'on' || undefined} aria-hidden>
              R
            </span>
            <div
              className="ctl-key ctl-reset"
              data-zone="reset"
              data-ready={resetReady || undefined}
              hidden={!racing}
              ref={resetRef}
              aria-label="Hold to reset"
              aria-disabled={!resetReady}
            >
              <span className="ctl-reset-fill" aria-hidden />
              <span className="ctl-reset-label">HOLD · RESET</span>
            </div>
          </div>
        </header>

        <section
          className="ctl-steer"
          data-zone={mode === 'drag' ? 'steer' : undefined}
          aria-label="Steering"
        >
          {mode === 'drag' ? (
            <div className="ctl-idle" aria-hidden>
              <DragIcon />
              <span>Drag to steer</span>
            </div>
          ) : (
            <>
              <div className="ctl-arrow" data-zone="left" aria-label="Steer left">
                <svg viewBox="0 0 40 40" aria-hidden>
                  <path d="M26 6 L10 20 L26 34" />
                </svg>
              </div>
              <div className="ctl-arrow" data-zone="right" aria-label="Steer right">
                <svg viewBox="0 0 40 40" aria-hidden>
                  <path d="M14 6 L30 20 L14 34" />
                </svg>
              </div>
            </>
          )}
          {hint ? (
            <div className="ctl-hint" key={race?.hint} role="status">
              {hint}
            </div>
          ) : null}
        </section>

        <div className="ctl-pedal ctl-handbrake" data-zone="handbrake" aria-label="Handbrake">
          <span className="ctl-ridges ctl-ridges--strip" aria-hidden />
          <strong>HANDBRAKE</strong>
        </div>

        <div
          className="ctl-pedal ctl-brake"
          data-zone="brake"
          data-reverse={reverse}
          aria-label="Brake, hold at a standstill to reverse"
        >
          <strong>{reverse === 'on' ? 'REVERSE' : 'BRAKE · R'}</strong>
          <svg className="ctl-ring" viewBox="0 0 100 100" aria-hidden>
            <circle className="ctl-ring-disc" cx="50" cy="50" r="33" />
            <circle className="ctl-ring-track" cx="50" cy="50" r="43" pathLength={100} />
            <circle className="ctl-ring-fill" cx="50" cy="50" r="43" pathLength={100} />
            <text x="50" y="51">
              R
            </text>
          </svg>
        </div>

        <div className="ctl-pedal ctl-gas" data-zone="gas" ref={gasRef} aria-label="Gas">
          <span className="ctl-gas-fill" aria-hidden />
          <span className="ctl-ridges" aria-hidden />
          <strong>GAS</strong>
        </div>
      </div>

      <GhostWheel ghostRef={ghostRef} wheelRef={wheelRef} railRef={railRef} dotRef={dotRef} />

      {countdown !== null ? (
        <div className="ctl-overlay ctl-countdown" key={countdown}>
          {countdown}
        </div>
      ) : null}
      {finished ? (
        <div className="ctl-overlay ctl-finished">
          <small>Finished</small>
          <b>{ordinal(finished.position)}</b>
        </div>
      ) : null}
      <div className="ctl-rotate" onPointerDown={(event) => event.stopPropagation()}>
        <svg viewBox="0 0 64 64" aria-hidden>
          <rect x="20" y="8" width="24" height="44" rx="5" />
          <path d="M8 40 A26 26 0 0 0 30 58 M30 58 l-6 -1 M30 58 l-2 -6" />
        </svg>
        <p>Turn your phone sideways</p>
      </div>
    </main>
  );
}
