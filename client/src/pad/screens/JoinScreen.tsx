import {
  NAME_MAX_LENGTH,
  PLAYER_COLOURS,
  colourHex,
  type ColourId,
  type LobbyMessage,
} from '@gamergang/shared';
import { useState, type CSSProperties } from 'react';
import type { Profile, SteeringMode } from '../profile';
import { Brand } from './Simple';

export function ModePicker({
  mode,
  onChange,
}: {
  mode: SteeringMode;
  onChange: (mode: SteeringMode) => void;
}) {
  return (
    <div className="pad-modes" role="radiogroup" aria-label="Steering">
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'tilt'}
        className={`pad-mode ${mode === 'tilt' ? 'is-on' : ''}`}
        onClick={() => onChange('tilt')}
      >
        <svg viewBox="0 0 48 32" aria-hidden>
          <rect x="6" y="6" width="36" height="20" rx="4" transform="rotate(-14 24 16)" />
          <path d="M4 26c3 3 7 4 11 4M44 6c-3-3-7-4-11-4" />
        </svg>
        <strong>Tilt</strong>
        <small>Turn the phone like a wheel</small>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'buttons'}
        className={`pad-mode ${mode === 'buttons' ? 'is-on' : ''}`}
        onClick={() => onChange('buttons')}
      >
        <svg viewBox="0 0 48 32" aria-hidden>
          <path d="M18 8l-8 8 8 8M30 8l8 8-8 8" />
        </svg>
        <strong>Buttons</strong>
        <small>Hold left / right arrows</small>
      </button>
    </div>
  );
}

export function JoinScreen({
  room,
  lobby,
  myId,
  profile,
  note,
  submitLabel,
  onSubmit,
}: {
  room: string;
  lobby: LobbyMessage;
  myId: string | null;
  profile: Profile;
  note: string | null;
  submitLabel: string;
  /** Runs inside the tap, so it may ask for motion permission. */
  onSubmit: (profile: Profile) => void;
}) {
  const taken = new Set(lobby.players.filter((p) => p.id !== myId).map((p) => p.colour));
  const firstFree = PLAYER_COLOURS.find((c) => !taken.has(c.id))?.id ?? profile.colour;
  const [name, setName] = useState(profile.name);
  const [colour, setColour] = useState<ColourId>(
    taken.has(profile.colour) ? firstFree : profile.colour,
  );
  const [mode, setMode] = useState<SteeringMode>(profile.mode);
  const trimmed = name.trim();
  const effectiveColour = taken.has(colour) ? firstFree : colour;
  const style = { '--accent': colourHex(effectiveColour) } as CSSProperties;

  return (
    <main className="pad-screen pad-join" style={style}>
      <Brand room={room} />
      <form
        className="pad-join-grid"
        onSubmit={(event) => {
          event.preventDefault();
          if (trimmed) onSubmit({ name: trimmed, colour: effectiveColour, mode });
        }}
      >
        <section className="pad-join-col">
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
          <span className="pad-label">Car colour</span>
          <div className="pad-colours">
            {PLAYER_COLOURS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`pad-colour ${c.id === effectiveColour ? 'is-on' : ''}`}
                style={{ '--swatch': c.hex } as CSSProperties}
                disabled={taken.has(c.id)}
                aria-label={`${c.label}${taken.has(c.id) ? ' (taken)' : ''}`}
                onClick={() => setColour(c.id)}
              />
            ))}
          </div>
        </section>
        <section className="pad-join-col">
          <span className="pad-label">Steering</span>
          <ModePicker mode={mode} onChange={setMode} />
          {note ? <p className="pad-note">{note}</p> : null}
          <button className="pad-btn pad-btn--big" disabled={!trimmed}>
            {submitLabel}
          </button>
        </section>
      </form>
    </main>
  );
}
