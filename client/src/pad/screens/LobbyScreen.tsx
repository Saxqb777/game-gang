import { colourHex, type LobbyMessage } from '@gamergang/shared';
import type { CSSProperties } from 'react';
import { GAMES } from '../../games/registry';
import type { SteeringMode } from '../profile';
import { ModePicker } from './JoinScreen';

export function TopBar({
  name,
  room,
  onSettings,
}: {
  name: string;
  room: string;
  onSettings: () => void;
}) {
  return (
    <header className="pad-topbar">
      <span className="pad-me">
        <i className="pad-me-dot" />
        {name}
      </span>
      <span className="pad-room-chip">Room {room}</span>
      <button className="pad-icon-btn" onClick={onSettings} aria-label="Settings">
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm8.4 4.6l1.8 1.4-2 3.4-2.1-.8a7.6 7.6 0 0 1-2 1.2l-.3 2.2h-4l-.3-2.2a7.6 7.6 0 0 1-2-1.2l-2.1.8-2-3.4 1.8-1.4a7.7 7.7 0 0 1 0-2.2L1.4 9.5l2-3.4 2.1.8a7.6 7.6 0 0 1 2-1.2L7.8 3.5h4l.3 2.2a7.6 7.6 0 0 1 2 1.2l2.1-.8 2 3.4-1.8 1.4a7.7 7.7 0 0 1 0 2.2z" />
        </svg>
      </button>
    </header>
  );
}

export function LobbyScreen({
  lobby,
  myId,
  room,
  onReady,
  onSettings,
}: {
  lobby: LobbyMessage;
  myId: string;
  room: string;
  onReady: (ready: boolean) => void;
  onSettings: () => void;
}) {
  const me = lobby.players.find((p) => p.id === myId);
  const ready = me?.ready ?? false;
  const game = GAMES[lobby.game];
  const style = { '--accent': me ? colourHex(me.colour) : undefined } as CSSProperties;

  return (
    <main className="pad-screen pad-lobby" style={style}>
      <TopBar name={me?.name ?? ''} room={room} onSettings={onSettings} />
      <section className="pad-lobby-grid">
        <div className="pad-game-card" style={{ background: game.art }}>
          <small>Up next</small>
          <strong>{game.title}</strong>
          <span>{game.subtitle}</span>
        </div>
        <ul className="pad-players">
          {lobby.players.map((p) => (
            <li
              key={p.id}
              className={`${p.ready ? 'is-ready' : ''} ${p.connected ? '' : 'is-away'}`}
              style={{ '--swatch': colourHex(p.colour) } as CSSProperties}
            >
              <i />
              <span>{p.name}</span>
              <em>{p.connected ? (p.ready ? 'ready' : '...') : 'away'}</em>
            </li>
          ))}
        </ul>
      </section>
      <button className={`pad-ready ${ready ? 'is-ready' : ''}`} onClick={() => onReady(!ready)}>
        {ready ? 'Ready!' : 'Ready up'}
      </button>
      <p className="pad-hint">
        {ready
          ? 'Waiting for everyone else. Tap again to cancel.'
          : 'The race starts when everyone is ready.'}
      </p>
    </main>
  );
}

export function SettingsSheet({
  mode,
  onMode,
  onEditProfile,
  onClose,
}: {
  mode: SteeringMode;
  onMode: (mode: SteeringMode) => void;
  onEditProfile: (() => void) | null;
  onClose: () => void;
}) {
  return (
    <div className="pad-sheet-backdrop" onClick={onClose}>
      <div className="pad-sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Steering</h2>
        <ModePicker mode={mode} onChange={onMode} />
        <div className="pad-sheet-actions">
          {onEditProfile ? (
            <button className="pad-btn pad-btn--ghost" onClick={onEditProfile}>
              Change name / colour
            </button>
          ) : null}
          <button className="pad-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
