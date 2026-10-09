import './tv.css';
import { useEffect, useSyncExternalStore } from 'react';
import { Lobby } from './Lobby';
import { getHub } from './runtime';

export default function TvApp() {
  const hub = getHub();
  const state = useSyncExternalStore(hub.subscribe, hub.getState);

  useEffect(() => {
    document.title = 'Gamer Gang · TV';
  }, []);

  return <div className="tv">{state.phase === 'lobby' && <Lobby state={state} selectedGame={hub.game} />}</div>;
}
