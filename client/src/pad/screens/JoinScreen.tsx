import {
  NAME_MAX_LENGTH,
  PLAYER_COLOURS,
  colourHex,
  type CarId,
  type ColourId,
  type LobbyMessage,
} from '@gamergang/shared';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { STEERING_MODES, type Profile, type SteeringMode } from '../profile';
import { CarPicker } from './CarPicker';
import { Brand } from './Simple';

const MODE_INFO: Record<SteeringMode, { label: string; hint: string; icon: ReactNode }> = {
  drag: {
    label: 'Drag steer',
    hint: 'Slide your left thumb',
    // A thumb pad on an arc, with arrows either way.
    icon: (
      <>
        <path d="M8 22 Q24 10 40 22" />
        <path d="M14 21.8 8 22l1.9-5.7M34 21.8l6 .2-1.9-5.7" />
        <circle cx="24" cy="16" r="4.5" />
      </>
    ),
  },
  buttons: {
    label: 'Buttons',
    hint: 'Hold left / right arrows',
    icon: <path d="M18 8l-8 8 8 8M30 8l8 8-8 8" />,
  },
};

export function ModePicker({
  mode,
  onChange,
}: {
  mode: SteeringMode;
  onChange: (mode: SteeringMode) => void;
}) {
  return (
    <div className="pad-modes" role="radiogroup" aria-label="Steering">
      {STEERING_MODES.map((id) => {
        const info = MODE_INFO[id];
        const on = mode === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            className={`pad-mode ${on ? 'is-on' : ''}`}
            onClick={() => onChange(id)}
          >
            <svg viewBox="0 0 48 32" aria-hidden>
              {info.icon}
            </svg>
            <strong>{info.label}</strong>
            <small>{info.hint}</small>
          </button>
        );
      })}
    </div>
  );
}

export function JoinScreen({
  room,
  lobby,
  myId,
  profile,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  room: string;
  lobby: LobbyMessage;
  myId: string;
  profile: Profile;
  submitLabel: string;
  /** Runs inside the tap, which fullscreen needs. */
  onSubmit: (profile: Profile) => void;
  /** Editing from the lobby: back without changes. */
  onCancel?: () => void;
}) {
  const others = lobby.players.filter((p) => p.id !== myId);
  const taken = new Set(others.map((p) => p.colour));
  const firstFree = PLAYER_COLOURS.find((c) => !taken.has(c.id))?.id ?? profile.colour;
  const [name, setName] = useState(profile.name);
  const [colour, setColour] = useState<ColourId>(
    taken.has(profile.colour) ? firstFree : profile.colour,
  );
  const [car, setCar] = useState<CarId>(profile.car);
  const [mode, setMode] = useState<SteeringMode>(profile.mode);
  const trimmed = name.trim();
  const effectiveColour = taken.has(colour) ? firstFree : colour;
  const paintLabel = PLAYER_COLOURS.find((c) => c.id === effectiveColour)?.label ?? '';
  const style = { '--accent': colourHex(effectiveColour) } as CSSProperties;
  const byCar = new Map<CarId, string[]>();
  for (const p of others) byCar.set(p.car, [...(byCar.get(p.car) ?? []), p.name]);

  return (
    <main className="pad-screen pad-join" style={style}>
      <Brand room={room} />
      <form
        className="pad-join-grid"
        onSubmit={(event) => {
          event.preventDefault();
          if (trimmed) onSubmit({ name: trimmed, colour: effectiveColour, car, mode });
        }}
      >
        <section className="pad-join-area pad-join-name">
          <label className="pad-label" htmlFor="pad-name">
            Your name
          </label>
          <input
            id="pad-name"
            className="pad-input"
            value={name}
            maxLength={NAME_MAX_LENGTH}
            onChange={(e) => setName(e.target.value)}
            placeholder="Driver name"
            autoComplete="nickname"
            autoCapitalize="words"
            enterKeyHint="done"
          />
        </section>
        <section className="pad-join-area pad-join-car">
          <span className="pad-label">Car</span>
          <CarPicker car={car} colour={effectiveColour} others={byCar} onChange={setCar} />
        </section>
        <section className="pad-join-area pad-join-paint">
          <span className="pad-label">
            Paint <b className="pad-paint-name">{paintLabel}</b>
          </span>
          <div className="pad-colours" role="radiogroup" aria-label="Paint">
            {PLAYER_COLOURS.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={c.id === effectiveColour}
                className={`pad-colour ${c.id === effectiveColour ? 'is-on' : ''}`}
                style={{ '--swatch': c.hex } as CSSProperties}
                disabled={taken.has(c.id)}
                aria-label={`${c.label}${taken.has(c.id) ? ' (taken)' : ''}`}
                onClick={() => setColour(c.id)}
              />
            ))}
          </div>
        </section>
        <section className="pad-join-area pad-join-steer">
          <span className="pad-label">Steering</span>
          <ModePicker mode={mode} onChange={setMode} />
        </section>
        <div className="pad-join-area pad-join-submit">
          {onCancel ? (
            <button type="button" className="pad-btn pad-btn--ghost" onClick={onCancel}>
              Back
            </button>
          ) : null}
          <button className="pad-btn pad-btn--big" disabled={!trimmed}>
            {submitLabel}
          </button>
        </div>
      </form>
    </main>
  );
}
