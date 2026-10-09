import './stage.css';
import { useEffect, useRef, useState } from 'react';
import type { Hub } from '../../../hub/hub';
import { SplitWaysGame } from '../game';

/** Mounts the Split Ways game for the players the hub put in this round. */
export default function SplitWaysStage({ hub }: { hub: Hub }) {
  const gameRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'running' | 'failed'>('loading');

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
      send: (playerId, message) => hub.send(playerId, message),
      rttMs: (playerId) => hub.rttMs(playerId),
    }).then(
      (created) => {
        if (cancelled) {
          created.dispose();
          return;
        }
        game = created;
        hub.attachSession({
          onInput: (playerId, input) => created.handleInput(playerId, input),
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
    </div>
  );
}
