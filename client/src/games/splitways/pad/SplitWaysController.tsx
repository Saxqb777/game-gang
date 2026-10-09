import './controller.css';
import type { RaceMessage } from '@gamergang/shared';
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent,
  type RefObject,
} from 'react';
import type { PadControllerProps } from '../../../pad/controllers';
import { ITEM_ICONS, ITEM_NAMES, MYSTERY_ICON, rollingIcon } from '../itemIcons';
import { InputSender } from './inputSender';
import { TiltSteering, rampSteer } from './steering';

type Zone = 'gas' | 'brake' | 'handbrake' | 'horn' | 'left' | 'right';

function zoneAt(x: number, y: number): Zone | null {
  const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-zone]');
  return (element?.dataset.zone as Zone | undefined) ?? null;
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

function Wheel({ wheelRef }: { wheelRef: RefObject<SVGSVGElement | null> }) {
  return (
    <svg className="ctl-wheel" viewBox="-100 -100 200 200" ref={wheelRef} aria-hidden>
      <circle r="84" className="ctl-wheel-rim" />
      <circle r="84" className="ctl-wheel-grip" />
      <path d="M -82 -6 Q 0 -30 82 -6 L 82 14 Q 0 -6 -82 14 Z" className="ctl-wheel-spoke" />
      <path d="M -12 10 L 12 10 L 8 82 L -8 82 Z" className="ctl-wheel-spoke" />
      <circle r="26" className="ctl-wheel-hub" />
      <rect x="-7" y="-92" width="14" height="18" rx="4" className="ctl-wheel-marker" />
    </svg>
  );
}

function Pedal({ zone, label, hint }: { zone: Zone; label: string; hint: string }) {
  return (
    <div className={`ctl-pedal ctl-pedal--${zone}`} data-zone={zone}>
      <span className="ctl-pedal-ridges" aria-hidden />
      <strong>{label}</strong>
      <small>{hint}</small>
    </div>
  );
}

/** Items mode: shows the held item; a press uses it (sent reliably, so it can't get lost). */
function ItemButton({
  race,
  iconRef,
  onUse,
}: {
  race: RaceMessage | null;
  iconRef: RefObject<HTMLImageElement | null>;
  onUse: () => void;
}) {
  const item = race?.item ?? null;
  const rolling = race?.rolling ?? false;
  const charges = race?.charges ?? 0;
  const state = rolling ? 'rolling' : item ? 'ready' : 'empty';
  return (
    <button
      className={`ctl-item is-${state}`}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (state === 'ready') onUse();
      }}
      aria-label={item && !rolling ? `Use ${ITEM_NAMES[item]}` : 'Item'}
    >
      <img ref={iconRef} alt="" src={item && !rolling ? ITEM_ICONS[item] : MYSTERY_ICON} />
      {state === 'ready' && charges > 1 ? <b>×{charges}</b> : null}
      <small>{rolling ? 'Rolling...' : item ? ITEM_NAMES[item] : 'Grab a ? box'}</small>
    </button>
  );
}

function Button({ zone, label }: { zone: Zone; label: string }) {
  return (
    <div className={`ctl-btn ctl-btn--${zone}`} data-zone={zone}>
      {label}
    </div>
  );
}

/** If tilt mode gets no gyro readings for this long, offer a tap to (re-)enable motion access. */
const TILT_SILENCE_MS = 900;

/** The phone as a steering wheel: tilt or button steering, gas, brake, handbrake and horn. */
export default function SplitWaysController({
  store,
  mode,
  colourHex,
  onSettings,
  onEnableTilt,
}: PadControllerProps) {
  const race = useSyncExternalStore(store.subscribe, () => store.getState().race);
  const itemsMode = useSyncExternalStore(
    store.subscribe,
    () => store.getState().lobby?.mode === 'items',
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<SVGSVGElement>(null);
  const itemIconRef = useRef<HTMLImageElement>(null);
  const useItem = () => {
    store.action('item');
    if (typeof navigator.vibrate === 'function') navigator.vibrate(12);
  };
  const pointers = useRef(new Map<number, Zone>());
  // iOS forgets motion access on reload: the wheel then needs one tap to wake up.
  const [needsTap, setNeedsTap] = useState(false);

  // Re-paint which zones are held without re-rendering React.
  const paintPressed = () => {
    const held = new Set(pointers.current.values());
    rootRef.current?.querySelectorAll<HTMLElement>('[data-zone]').forEach((element) => {
      element.classList.toggle('is-pressed', held.has(element.dataset.zone as Zone));
    });
  };

  const track = (event: PointerEvent<HTMLElement>) => {
    const zone = zoneAt(event.clientX, event.clientY);
    const previous = pointers.current.get(event.pointerId);
    if (zone === (previous ?? null)) return;
    if (zone) pointers.current.set(event.pointerId, zone);
    else pointers.current.delete(event.pointerId);
    if (zone && typeof navigator.vibrate === 'function') navigator.vibrate(8);
    paintPressed();
  };

  const release = (event: PointerEvent<HTMLElement>) => {
    if (pointers.current.delete(event.pointerId)) paintPressed();
  };

  useEffect(() => {
    const tilt = mode === 'tilt' ? new TiltSteering() : null;
    tilt?.start();
    const sender = new InputSender((input) => store.sendInput(input));
    let buttonSteer = 0;
    let last = performance.now();
    const mountedAt = last;
    let tapShown = false;
    let shownIcon = '';
    let frame = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const held = new Set(pointers.current.values());
      let steer: number;
      if (tilt) {
        steer = tilt.update(dt);
        const silent = !tilt.active && now - mountedAt > TILT_SILENCE_MS;
        if (silent !== tapShown) {
          tapShown = silent;
          setNeedsTap(silent);
        }
      } else {
        buttonSteer = rampSteer(buttonSteer, held.has('left'), held.has('right'), dt);
        steer = buttonSteer;
      }
      sender.update(
        {
          steer,
          throttle: held.has('gas') ? 1 : 0,
          brake: held.has('brake') ? 1 : 0,
          handbrake: held.has('handbrake'),
          horn: held.has('horn'),
        },
        now,
      );
      const wheel = wheelRef.current;
      if (wheel) {
        const degrees = tilt ? Math.max(-120, Math.min(120, tilt.angle)) : steer * 90;
        wheel.style.transform = `rotate(${degrees.toFixed(1)}deg)`;
      }
      // The item slot spins like a slot machine until the TV says it stopped.
      const icon = itemIconRef.current;
      if (icon && store.getState().race?.rolling) {
        const next = rollingIcon(now);
        if (next !== shownIcon) icon.src = shownIcon = next;
      } else {
        shownIcon = '';
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    // A phone that locks or switches app must not leave the gas held down.
    const onHide = () => {
      pointers.current.clear();
      paintPressed();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      cancelAnimationFrame(frame);
      tilt?.stop();
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [mode, store]);

  const countdown = race?.phase === 'countdown' && race.countdown > 0 ? race.countdown : null;
  const finished = race?.phase === 'finished' ? race : null;

  return (
    <main
      className={`ctl ctl--${mode}`}
      style={{ '--accent': colourHex } as CSSProperties}
      ref={rootRef}
      onPointerDown={(event) => {
        if (!zoneAt(event.clientX, event.clientY)) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        track(event);
      }}
      onPointerMove={(event) => {
        if (pointers.current.has(event.pointerId)) track(event);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(event) => event.preventDefault()}
    >
      {mode === 'tilt' ? (
        <>
          <section className="ctl-side ctl-side--left">
            <Button zone="handbrake" label="Handbrake" />
            <Pedal zone="brake" label="Brake" hint="hold to reverse" />
          </section>
          <section className="ctl-centre">
            <RaceHud race={race} />
            <div className="ctl-wheel-wrap">
              <Wheel wheelRef={wheelRef} />
              {/* Like a real car: the horn is the middle of the wheel. */}
              <div className="ctl-hub" data-zone="horn" aria-label="Horn" />
            </div>
          </section>
          <section className={`ctl-side ctl-side--right ${itemsMode ? 'ctl-side--items' : ''}`}>
            {itemsMode ? (
              <ItemButton race={race} iconRef={itemIconRef} onUse={useItem} />
            ) : (
              <Button zone="horn" label="Horn" />
            )}
            <Pedal zone="gas" label="Gas" hint="hold" />
          </section>
        </>
      ) : (
        <>
          <section className="ctl-steer">
            <div className="ctl-arrow ctl-arrow--left" data-zone="left">
              <svg viewBox="0 0 40 40" aria-hidden>
                <path d="M26 6 L10 20 L26 34" />
              </svg>
            </div>
            <div className="ctl-arrow ctl-arrow--right" data-zone="right">
              <svg viewBox="0 0 40 40" aria-hidden>
                <path d="M14 6 L30 20 L14 34" />
              </svg>
            </div>
          </section>
          <section className="ctl-drive">
            <div className={`ctl-drive-buttons ${itemsMode ? 'ctl-drive-buttons--items' : ''}`}>
              <Button zone="handbrake" label="Handbrake" />
              {itemsMode ? <ItemButton race={race} iconRef={itemIconRef} onUse={useItem} /> : null}
              <Button zone="horn" label="Horn" />
            </div>
            <div className="ctl-drive-pedals">
              <Pedal zone="brake" label="Brake" hint="hold to reverse" />
              <Pedal zone="gas" label="Gas" hint="hold" />
            </div>
          </section>
          <div className="ctl-topbar">
            <RaceHud race={race} />
          </div>
        </>
      )}
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
      {countdown !== null ? (
        <div className="ctl-overlay ctl-countdown" key={countdown}>
          {countdown}
        </div>
      ) : null}
      {mode === 'tilt' && needsTap ? (
        <button
          className="ctl-enable"
          onClick={onEnableTilt}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <svg viewBox="0 0 64 64" aria-hidden>
            <rect x="8" y="20" width="48" height="26" rx="5" />
            <path d="M4 14 A30 30 0 0 1 22 6 M60 14 A30 30 0 0 0 42 6" />
          </svg>
          <b>Tap to enable wheel</b>
          <small>Then turn your phone like a steering wheel</small>
        </button>
      ) : null}
      {finished ? (
        <div className="ctl-overlay ctl-finished">
          <small>Finished</small>
          <b>{ordinal(finished.position)}</b>
        </div>
      ) : null}
      <div className="ctl-rotate">
        <svg viewBox="0 0 64 64" aria-hidden>
          <rect x="20" y="8" width="24" height="44" rx="5" />
          <path d="M8 40 A26 26 0 0 0 30 58 M30 58 l-6 -1 M30 58 l-2 -6" />
        </svg>
        <p>Turn your phone sideways</p>
      </div>
    </main>
  );
}
