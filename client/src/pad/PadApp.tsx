import './pad.css';
import { colourHex } from '@gamergang/shared';
import { Suspense, useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { PAD_CONTROLLERS } from './controllers';
import { enterFullscreen, keepScreenAwake } from './device';
import { getPadStore } from './padStore';
import { loadProfile, saveProfile, type Profile, type SteeringMode } from './profile';
import { JoinScreen } from './screens/JoinScreen';
import { LobbyScreen, SettingsSheet } from './screens/LobbyScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { CodeEntryScreen, ConnectingScreen, MessageScreen } from './screens/Simple';

function roomFromUrl(): string | null {
  const code = new URLSearchParams(window.location.search).get('room')?.toUpperCase() ?? '';
  return /^[A-Z]{4}$/.test(code) ? code : null;
}

export default function PadApp() {
  const store = getPadStore();
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [editing, setEditing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    document.title = 'Gamer Gang · Pad';
    const room = roomFromUrl();
    if (room) store.connect(room);
  }, [store]);

  const commitProfile = useCallback((next: Profile) => {
    setProfile(next);
    saveProfile(next);
  }, []);

  // Runs synchronously inside the Join tap: fullscreen needs that user gesture.
  const submitJoin = (next: Profile) => {
    enterFullscreen();
    keepScreenAwake();
    commitProfile(next);
    store.join(next.name, next.colour);
    setEditing(false);
  };

  const changeMode = (mode: SteeringMode) => {
    commitProfile({ ...profile, mode });
  };

  const { room, status, lobby, me, kicked } = state;

  if (!room) {
    return (
      <CodeEntryScreen
        onSubmit={(code) => {
          window.history.replaceState(null, '', `/pad?room=${code}`);
          store.connect(code);
        }}
      />
    );
  }

  const leave = () => {
    window.history.replaceState(null, '', '/pad');
    store.leaveRoom();
  };

  if (status === 'room-not-found') {
    return (
      <MessageScreen title="Room not found" action={{ label: 'Enter a code', onClick: leave }}>
        Room {room} does not exist anymore. Check the code on the TV.
      </MessageScreen>
    );
  }
  if (kicked === 'full') {
    return (
      <MessageScreen title="Room is full" action={{ label: 'Try another room', onClick: leave }}>
        Four drivers are already in room {room}. Wait for someone to leave and scan again.
      </MessageScreen>
    );
  }
  if (!lobby) return <ConnectingScreen room={room} reconnecting={status === 'reconnecting'} />;

  const myPlayer = me ? lobby.players.find((p) => p.id === me.playerId) : undefined;
  let screen;
  if (!me || !myPlayer || editing) {
    screen = (
      <JoinScreen
        room={room}
        lobby={lobby}
        myId={me?.playerId ?? null}
        profile={profile}
        submitLabel={me ? 'Save' : 'Join'}
        onSubmit={submitJoin}
      />
    );
  } else if (lobby.state === 'lobby') {
    screen = (
      <LobbyScreen
        lobby={lobby}
        myId={me.playerId}
        room={room}
        onReady={(ready) => store.setReady(ready)}
        onSettings={() => setSettingsOpen(true)}
      />
    );
  } else if (lobby.state === 'playing' && myPlayer.inGame) {
    const Controller = PAD_CONTROLLERS[lobby.game];
    screen = (
      <Suspense fallback={<ConnectingScreen room={room} reconnecting={false} />}>
        <Controller
          store={store}
          mode={profile.mode}
          colourHex={colourHex(myPlayer.colour)}
          onSettings={() => setSettingsOpen(true)}
        />
      </Suspense>
    );
  } else if (lobby.state === 'results') {
    screen = (
      <ResultsScreen
        lobby={lobby}
        results={state.results}
        myId={me.playerId}
        room={room}
        onVote={() => store.voteAgain()}
        onSettings={() => setSettingsOpen(true)}
      />
    );
  } else {
    screen = (
      <MessageScreen title="Race in progress">
        You will be on the grid for the next race. Hang tight.
      </MessageScreen>
    );
  }

  return (
    <div className="pad">
      {screen}
      {settingsOpen ? (
        <SettingsSheet
          mode={profile.mode}
          onMode={changeMode}
          onEditProfile={
            lobby.state === 'lobby'
              ? () => {
                  setSettingsOpen(false);
                  setEditing(true);
                }
              : null
          }
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
      {status === 'reconnecting' ? <div className="pad-banner">Reconnecting...</div> : null}
    </div>
  );
}
