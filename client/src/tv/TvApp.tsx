import './tv.css';
import { Suspense, useEffect, useSyncExternalStore } from 'react';
import type { Hub, HubState } from '../hub/hub';
import { useSoundOn } from './audio';
import { GAME_STAGES } from './gameStages';
import { Lobby } from './Lobby';
import { getHub } from './runtime';

/** Up to two people can play on the TV keyboard (WASD and arrows), mostly for testing without phones. */
const KEYBOARD_PLAYERS = [
  { id: 'keyboard01', name: 'Keys WASD' },
  { id: 'keyboard02', name: 'Keys Arrows' },
];

function handleTvKey(hub: Hub, state: HubState, event: KeyboardEvent): void {
  if (event.target instanceof HTMLInputElement) return;
  switch (event.code) {
    case 'KeyF':
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen().catch(() => undefined);
      return;
    case 'Escape':
      hub.returnToLobby();
      return;
  }
  if (state.phase !== 'lobby') return;
  const localPlayers = state.players.filter((p) => p.local);
  switch (event.code) {
    case 'KeyK': {
      const next = KEYBOARD_PLAYERS.find((k) => !state.players.some((p) => p.id === k.id));
      if (next) hub.addLocalPlayer(next.id, next.name);
      return;
    }
    case 'Backspace': {
      const last = localPlayers.at(-1);
      if (last) hub.removeLocalPlayer(last.id);
      return;
    }
    case 'Enter':
      for (const player of localPlayers) hub.toggleLocalReady(player.id);
      return;
  }
}

function KeyHints({ phase }: { phase: HubState['phase'] }) {
  return (
    <div className={`tv-keys ${phase === 'lobby' ? '' : 'tv-keys--game'}`}>
      {phase === 'lobby' ? (
        <>
          <kbd>K</kbd> keyboard player · <kbd>Enter</kbd> ready · <kbd>F</kbd> fullscreen
        </>
      ) : (
        <>
          <kbd>Esc</kbd> back to lobby · <kbd>`</kbd> debug · <kbd>F</kbd> fullscreen
        </>
      )}
    </div>
  );
}

export default function TvApp() {
  const hub = getHub();
  const state = useSyncExternalStore(hub.subscribe, hub.getState);
  const Stage = GAME_STAGES[hub.game];
  const soundOn = useSoundOn();

  useEffect(() => {
    document.title = 'Gamer Gang · TV';
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => handleTvKey(hub, hub.getState(), event);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hub]);

  return (
    <div className="tv">
      {state.phase === 'lobby' ? (
        <Lobby state={state} selectedGame={hub.game} />
      ) : (
        <Suspense fallback={null}>
          <Stage hub={hub} />
        </Suspense>
      )}
      <KeyHints phase={state.phase} />
      {soundOn ? null : <div className="tv-sound">Sound is off · click or press any key</div>}
    </div>
  );
}
