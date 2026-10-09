import './pad.css';
import { colourHex } from '@gamergang/shared';
import { Suspense, useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { PAD_CONTROLLERS } from './controllers';
import {
  enterFullscreen,
  keepScreenAwake,
  probeTiltSensor,
  requestTiltPermission,
  tiltNeedsPrompt,
  type TiltPermission,
} from './device';
import { getPadStore } from './padStore';
import { loadProfile, saveProfile, type Profile, type SteeringMode } from './profile';
import { JoinScreen } from './screens/JoinScreen';
import { LobbyScreen, SettingsSheet } from './screens/LobbyScreen';
import { CodeEntryScreen, ConnectingScreen, MessageScreen } from './screens/Simple';

function roomFromUrl(): string | null {
  const code = new URLSearchParams(window.location.search).get('room')?.toUpperCase() ?? '';
  return /^[A-Z]{4}$/.test(code) ? code : null;
}

function tiltFallbackNote(permission: TiltPermission): string {
  if (permission === 'denied') {
    return 'Motion access was not allowed, so you are on buttons. Switch back any time in settings.';
  }
  if (!window.isSecureContext) return 'Tilt needs a secure (https) page, so you are on buttons.';
  return 'No tilt sensor found on this device, so you are on buttons.';
}

export default function PadApp() {
  const store = getPadStore();
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [note, setNote] = useState<string | null>(null);
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

  /** Checks tilt really works after a permission request; falls back to buttons with a note if not. */
  const verifyTilt = useCallback(
    async (permission: Promise<TiltPermission>, base: Profile) => {
      const result = await permission;
      if (result === 'granted' && (await probeTiltSensor())) {
        setNote(null);
        return;
      }
      commitProfile({ ...base, mode: 'buttons' });
      setNote(tiltFallbackNote(result));
    },
    [commitProfile],
  );

  // Both handlers below run synchronously inside a tap: iOS only prompts for motion access there,
  // and fullscreen needs the same user gesture.
  const submitJoin = (next: Profile) => {
    const permission = next.mode === 'tilt' ? requestTiltPermission() : null;
    if (!tiltNeedsPrompt()) enterFullscreen();
    keepScreenAwake();
    commitProfile(next);
    store.join(next.name, next.colour);
    setEditing(false);
    if (permission) void verifyTilt(permission, next);
  };

  const changeMode = (mode: SteeringMode) => {
    const next = { ...profile, mode };
    commitProfile(next);
    setNote(null);
    if (mode === 'tilt') void verifyTilt(requestTiltPermission(), next);
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
        note={note}
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
          note={note}
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
