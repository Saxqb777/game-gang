import { MAX_PLAYERS, colourHex } from '@gamergang/shared';
import type { CSSProperties } from 'react';
import { GAME_LIST } from '../games/registry';
import type { HubPlayer, HubState } from '../hub/hub';
import { QrCode } from './QrCode';

function lobbyHint(players: readonly HubPlayer[]): string {
  const present = players.filter((p) => p.connected);
  if (present.length === 0) return 'Scan the code with your phone camera to grab a controller';
  const waiting = present.filter((p) => !p.ready).map((p) => p.name);
  if (waiting.length === 0) return 'Everyone is ready. Starting...';
  return `Waiting for ${waiting.join(', ')} to hit READY`;
}

function PlayerSlot({ slot, player }: { slot: number; player: HubPlayer | null }) {
  if (!player) {
    return (
      <div className="slot slot--empty">
        <span className="slot-number">P{slot + 1}</span>
        <span className="slot-waiting">Waiting for player</span>
      </div>
    );
  }
  const style = { '--slot-colour': colourHex(player.colour) } as CSSProperties;
  return (
    <div className={`slot ${player.ready ? 'is-ready' : ''}`} style={style}>
      <span className="slot-number">P{slot + 1}</span>
      <span
        className={`slot-dot ${player.connected ? 'is-connected' : ''}`}
        title={player.connected ? 'Connected' : 'Reconnecting'}
      />
      <span className="slot-name">{player.name}</span>
      <span className="slot-status">
        {player.connected ? (player.ready ? 'Ready' : 'Not ready') : 'Reconnecting...'}
        {player.local ? ' · keyboard' : ''}
      </span>
    </div>
  );
}

/** `selectedGame` is a plain string so the picker keeps working once there are several games. */
export function Lobby({ state, selectedGame }: { state: HubState; selectedGame: string }) {
  const { room, players } = state;
  const slots = Array.from(
    { length: MAX_PLAYERS },
    (_, slot) => players.find((p) => p.slot === slot) ?? null,
  );
  const shortUrl = room ? room.padUrl.replace(/^https?:\/\//, '').replace(/\?.*$/, '') : '';

  return (
    <div className="lobby">
      <section className="lobby-join">
        <h1 className="wordmark lobby-wordmark">
          Gamer <span>Gang</span>
        </h1>
        <div className="lobby-qr-card">
          {room ? (
            <QrCode url={room.padUrl} className="lobby-qr" />
          ) : (
            <div className="lobby-qr lobby-qr--loading">Opening room...</div>
          )}
        </div>
        <p className="lobby-scan">Scan to join</p>
        <div className="lobby-code" aria-label="Room code">
          {(room?.code ?? '····').split('').map((char, i) => (
            <b key={i}>{char}</b>
          ))}
        </div>
        <p className="lobby-url">
          or open <strong>{shortUrl || '...'}</strong> and type the code
        </p>
      </section>

      <section className="lobby-main">
        <h2 className="lobby-heading">Game</h2>
        <div className="lobby-games">
          {GAME_LIST.map((g) => (
            <article key={g.id} className={`game-card ${g.id === selectedGame ? 'is-selected' : ''}`}>
              <div className="game-card-art" style={{ background: g.art }}>
                <span className="game-card-badge">Selected</span>
              </div>
              <div className="game-card-body">
                <h3>{g.title}</h3>
                <p className="game-card-subtitle">{g.subtitle}</p>
                <p className="game-card-details">{g.details}</p>
              </div>
            </article>
          ))}
        </div>

        <h2 className="lobby-heading">
          Players{' '}
          <span>
            {players.length}/{MAX_PLAYERS}
          </span>
        </h2>
        <div className="lobby-slots">
          {slots.map((player, slot) => (
            <PlayerSlot key={slot} slot={slot} player={player} />
          ))}
        </div>
        <p className="lobby-hint">{lobbyHint(players)}</p>
      </section>
    </div>
  );
}
