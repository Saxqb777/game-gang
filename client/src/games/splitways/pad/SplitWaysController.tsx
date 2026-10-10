import './controller.css';
import type { RaceMessage } from '@gamergang/shared';
import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import type { PadControllerProps } from '../../../pad/controllers';
import { InputSender } from './inputSender';
import { rampSteer } from './steering';

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

function Pedal({ zone, label, hint }: { zone: Zone; label: string; hint: string }) {
  return (
    <div className={`ctl-pedal ctl-pedal--${zone}`} data-zone={zone}>
      <span className="ctl-pedal-ridges" aria-hidden />
      <strong>{label}</strong>
      <small>{hint}</small>
    </div>
  );
}

function Button({ zone, label }: { zone: Zone; label: string }) {
  return (
    <div className={`ctl-btn ctl-btn--${zone}`} data-zone={zone}>
      {label}
    </div>
  );
}

/** The phone as a race controller: steering arrows, gas, brake, handbrake and horn. */
export default function SplitWaysController({
  store,
  mode,
  colourHex,
  onSettings,
}: PadControllerProps) {
  const race = useSyncExternalStore(store.subscribe, () => store.getState().race);
  const rootRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Zone>());

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
    const sender = new InputSender((input) => store.sendInput(input));
    let steer = 0;
    let last = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const held = new Set(pointers.current.values());
      steer = rampSteer(steer, held.has('left'), held.has('right'), dt);
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
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [store]);

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
        <div className="ctl-drive-buttons">
          <Button zone="handbrake" label="Handbrake" />
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
