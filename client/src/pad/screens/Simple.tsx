import { useState, type ReactNode, type SyntheticEvent } from 'react';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@gamergang/shared';

export function Brand({ room }: { room?: string | null }) {
  return (
    <header className="pad-brand">
      <span className="wordmark">
        Gamer <span>Gang</span>
      </span>
      {room ? <span className="pad-room-chip">Room {room}</span> : null}
    </header>
  );
}

export function MessageScreen({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <main className="pad-screen pad-message">
      <Brand />
      <h1>{title}</h1>
      {children ? <p>{children}</p> : null}
      {action ? (
        <button className="pad-btn" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </main>
  );
}

export function ConnectingScreen({ room, reconnecting }: { room: string; reconnecting: boolean }) {
  return (
    <main className="pad-screen pad-message">
      <Brand room={room} />
      <div className="pad-spinner" aria-hidden />
      <h1>{reconnecting ? 'Reconnecting...' : 'Connecting to the TV...'}</h1>
      <p>Make sure the TV page is open and showing room {room}.</p>
    </main>
  );
}

const ALLOWED = new RegExp(`[^${ROOM_CODE_ALPHABET}]`, 'g');

export function CodeEntryScreen({ onSubmit }: { onSubmit: (code: string) => void }) {
  const [code, setCode] = useState('');
  const complete = code.length === ROOM_CODE_LENGTH;
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (complete) onSubmit(code);
  };
  return (
    <main className="pad-screen pad-message">
      <Brand />
      <form className="pad-code-form" onSubmit={submit}>
        <label htmlFor="room-code">Enter the room code shown on the TV</label>
        <input
          id="room-code"
          className="pad-code-input"
          value={code}
          onChange={(e) =>
            setCode(e.target.value.toUpperCase().replace(ALLOWED, '').slice(0, ROOM_CODE_LENGTH))
          }
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          placeholder="XXXX"
          inputMode="text"
        />
        <button className="pad-btn" disabled={!complete}>
          Join room
        </button>
      </form>
    </main>
  );
}
