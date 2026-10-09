import { colourHex, type LobbyMessage, type ResultsMessage } from '@gamergang/shared';
import type { CSSProperties } from 'react';
import { TopBar } from './LobbyScreen';

const ORDINALS = ['1st', '2nd', '3rd', '4th'];

function time(ms: number | null): string {
  if (ms === null) return 'DNF';
  const total = ms / 1000;
  const minutes = Math.floor(total / 60);
  return `${minutes}:${(total - minutes * 60).toFixed(2).padStart(5, '0')}`;
}

export function ResultsScreen({
  lobby,
  results,
  myId,
  room,
  onVote,
  onSettings,
}: {
  lobby: LobbyMessage;
  results: ResultsMessage | null;
  myId: string;
  room: string;
  onVote: () => void;
  onSettings: () => void;
}) {
  const me = lobby.players.find((p) => p.id === myId);
  const mine = results?.standings.find((s) => s.id === myId);
  const voted = lobby.votes.includes(myId);
  const style = { '--accent': me ? colourHex(me.colour) : undefined } as CSSProperties;

  return (
    <main className="pad-screen pad-results" style={style}>
      <TopBar name={me?.name ?? ''} room={room} onSettings={onSettings} />
      <section className="pad-results-grid">
        <div className="pad-results-me">
          {mine ? (
            <>
              <small>You finished</small>
              <strong>{ORDINALS[mine.place - 1] ?? `${mine.place}th`}</strong>
              <span>
                {time(mine.totalMs)} · best lap{' '}
                {mine.bestLapMs === null ? '-' : time(mine.bestLapMs)}
              </span>
            </>
          ) : (
            <>
              <small>Race over</small>
              <strong>Results</strong>
              <span>Check the TV</span>
            </>
          )}
        </div>
        <ol className="pad-results-list">
          {results?.standings.map((s) => (
            <li key={s.id} style={{ '--swatch': colourHex(s.colour) } as CSSProperties}>
              <b>{s.place}</b>
              <i />
              <span>{s.name}</span>
              <em>{time(s.totalMs)}</em>
            </li>
          ))}
        </ol>
      </section>
      <button className={`pad-ready ${voted ? 'is-ready' : ''}`} onClick={onVote} disabled={voted}>
        {voted ? 'Voted!' : 'Play again'}
      </button>
      <p className="pad-hint">
        {lobby.votes.length}/{lobby.votesNeeded} votes to go back to the lobby
      </p>
    </main>
  );
}
