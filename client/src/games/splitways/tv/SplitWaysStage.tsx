import './stage.css';
import { MAX_LAP_MS, MIN_LAP_MS, colourHex, type LeaderboardEntry } from '@gamergang/shared';
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import type { Hub } from '../../../hub/hub';
import { api } from '../../../net/api';
import { audioContext } from '../../../tv/audio';
import { SplitWaysGame, type RaceResult } from '../game';
import { formatTime } from '../hud/viewportHud';
import { TRACK_1 } from '../track/tracks';

/** Posts this race's best laps (host only) and fetches the all-time board for the results screen. */
async function syncLeaderboard(
  hub: Hub,
  results: readonly RaceResult[],
): Promise<LeaderboardEntry[]> {
  const credentials = hub.roomCredentials();
  // The API rejects the whole post if any lap is out of range, so drop those first.
  const laps = results
    .filter(
      (r): r is RaceResult & { bestLapMs: number } =>
        r.bestLapMs !== null && r.bestLapMs >= MIN_LAP_MS && r.bestLapMs <= MAX_LAP_MS,
    )
    .map((r) => ({ name: r.name, bestLapMs: r.bestLapMs }));
  if (credentials && laps.length > 0) {
    await api
      .postLaps({ room: credentials.code, key: credentials.hostKey, track: TRACK_1.id, laps })
      .catch((error: unknown) => console.warn('[splitways] could not save lap times', error));
  }
  const board = await api.leaderboard(TRACK_1.id);
  return board.entries;
}

function ResultsPanel({
  hub,
  results,
  leaderboard,
}: {
  hub: Hub;
  results: readonly RaceResult[];
  leaderboard: readonly LeaderboardEntry[] | null;
}) {
  const state = useSyncExternalStore(hub.subscribe, hub.getState);
  const voters = state.players.filter((p) => p.connected && !p.local).length;
  const needed = Math.floor(voters / 2) + 1;
  const names = new Set(results.map((r) => r.name.toLowerCase()));
  return (
    <div className="sw-results">
      <section className="sw-results-card">
        <h2>Results</h2>
        <ol className="sw-results-list">
          {results.map((r) => (
            <li key={r.id} style={{ '--player': colourHex(r.colour) } as CSSProperties}>
              <span className={`sw-results-place p${r.place}`}>{r.place}</span>
              <span className="sw-results-name">{r.name}</span>
              <span className="sw-results-time">
                {r.totalMs === null ? 'DNF' : formatTime(r.totalMs)}
              </span>
              <span className="sw-results-best">
                best {r.bestLapMs === null ? '-' : formatTime(r.bestLapMs)}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <section className="sw-results-card sw-results-board">
        <h2>All-time best laps · {TRACK_1.name}</h2>
        {leaderboard === null ? (
          <p className="sw-results-muted">Loading...</p>
        ) : leaderboard.length === 0 ? (
          <p className="sw-results-muted">No laps on the board yet.</p>
        ) : (
          <ol className="sw-board-list">
            {leaderboard.slice(0, 8).map((entry, i) => (
              <li
                key={`${entry.name}-${i}`}
                className={names.has(entry.name.toLowerCase()) ? 'is-new' : ''}
              >
                <span>{i + 1}</span>
                <span>{entry.name}</span>
                <span>{formatTime(entry.bestLapMs)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <footer className="sw-results-vote">
        {voters > 0 ? (
          <>
            Tap <b>PLAY AGAIN</b> on your phone · {state.votes.length}/{needed} votes
          </>
        ) : (
          <>
            Press <b>Esc</b> to go back to the lobby
          </>
        )}
      </footer>
    </div>
  );
}

/** Mounts the Split Ways game for the players the hub put in this round. */
export default function SplitWaysStage({ hub }: { hub: Hub }) {
  const gameRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'running' | 'failed'>('loading');
  const [results, setResults] = useState<RaceResult[] | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    const container = gameRef.current;
    if (!container) return;
    let game: SplitWaysGame | null = null;
    let cancelled = false;
    const players = hub
      .getState()
      .players.filter((p) => p.inGame)
      .map(({ id, name, colour, slot, local }) => ({ id, name, colour, slot, local }));

    SplitWaysGame.create(container, players, {
      send: (playerId, message) => {
        hub.send(playerId, message);
      },
      rttMs: (playerId) => hub.rttMs(playerId),
      audio: audioContext(),
      onResults: (final) => {
        hub.finishGame();
        setResults(final);
        syncLeaderboard(hub, final).then(
          (entries) => {
            if (!cancelled) setLeaderboard(entries);
          },
          () => {
            if (!cancelled) setLeaderboard([]);
          },
        );
      },
    }).then(
      (created) => {
        if (cancelled) {
          created.dispose();
          return;
        }
        game = created;
        hub.attachSession({
          onInput: (playerId, input) => created.handleInput(playerId, input),
          onAction: (playerId, action) => created.handleAction(playerId, action),
          onPlayerConnection: (playerId, connected) => created.setConnected(playerId, connected),
        });
        setStatus('running');
      },
      (error: unknown) => {
        console.error('[splitways] failed to start', error);
        if (!cancelled) setStatus('failed');
      },
    );

    return () => {
      cancelled = true;
      hub.attachSession(null);
      game?.dispose();
    };
  }, [hub]);

  return (
    <div className="sw-stage">
      <div className="sw-game" ref={gameRef} />
      {status === 'loading' ? (
        <div className="sw-loading">
          <div className="sw-loading-spinner" />
          <span>Warming up the tyres...</span>
        </div>
      ) : null}
      {status === 'failed' ? (
        <div className="sw-loading">
          <span>Could not start the game. Press Esc to go back to the lobby.</span>
        </div>
      ) : null}
      {results ? <ResultsPanel hub={hub} results={results} leaderboard={leaderboard} /> : null}
    </div>
  );
}
