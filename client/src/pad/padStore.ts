/** Pad-side state: link status plus the latest hub/game messages from the TV. */
import type {
  ColourId,
  InputMessage,
  JoinedMessage,
  KickReason,
  LobbyMessage,
  RaceMessage,
  ResultsMessage,
  TvMessage,
} from '@gamergang/shared';
import { PadTransport, type PadLinkStatus } from '../net/padTransport';
import { vibrate } from './device';
import { clientId } from './profile';

export interface PadState {
  room: string | null;
  status: PadLinkStatus | 'idle';
  lobby: LobbyMessage | null;
  me: JoinedMessage | null;
  kicked: KickReason | null;
  race: RaceMessage | null;
  results: ResultsMessage | null;
}

const INITIAL: PadState = {
  room: null,
  status: 'idle',
  lobby: null,
  me: null,
  kicked: null,
  race: null,
  results: null,
};

export class PadStore {
  private state: PadState = INITIAL;
  private readonly listeners = new Set<() => void>();
  private transport: PadTransport | null = null;
  private joinRequest: { name: string; colour: ColourId } | null = null;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getState = (): PadState => this.state;

  connect(room: string): void {
    if (this.state.room === room && this.transport) return;
    this.transport?.stop();
    this.joinRequest = null;
    this.update({ ...INITIAL, room, status: 'connecting' });
    this.transport = new PadTransport(room, clientId(), {
      onStatus: (status) => this.handleStatus(status),
      onMessage: (message) => this.handleMessage(message),
    });
    this.transport.start();
  }

  leaveRoom(): void {
    this.transport?.stop();
    this.transport = null;
    this.joinRequest = null;
    this.update(INITIAL);
  }

  join(name: string, colour: ColourId): void {
    this.joinRequest = { name, colour };
    this.sendJoin();
  }

  setReady(ready: boolean): void {
    this.transport?.send({ type: 'ready', ready });
  }

  voteAgain(): void {
    this.transport?.send({ type: 'vote', choice: 'again' });
  }

  sendInput(input: Omit<InputMessage, 'type'>): boolean {
    return this.transport?.send({ type: 'input', ...input }) ?? false;
  }

  private sendJoin(): void {
    const { room } = this.state;
    if (room && this.joinRequest) this.transport?.send({ type: 'join', room, ...this.joinRequest });
  }

  private handleStatus(status: PadLinkStatus): void {
    this.update({ status });
    // After a reconnect the TV only knows us again once we re-send join (same id, same car).
    if (status === 'open') this.sendJoin();
  }

  private handleMessage(message: TvMessage): void {
    switch (message.type) {
      case 'joined':
        this.update({ me: message, kicked: null });
        return;
      case 'lobby':
        this.update(
          message.state === 'lobby'
            ? { lobby: message, race: null, results: null }
            : { lobby: message },
        );
        return;
      case 'race':
        this.update({ race: message });
        return;
      case 'results':
        this.update({ results: message });
        return;
      case 'haptic':
        vibrate(message.pattern);
        return;
      case 'kicked':
        this.joinRequest = null;
        this.update({ kicked: message.reason, me: null });
        return;
      case 'ping':
        return; // Answered by the transport.
    }
  }

  private update(patch: Partial<PadState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
}

let store: PadStore | null = null;

/** One store per pad page, created outside React so remounts never open a second connection. */
export function getPadStore(): PadStore {
  store ??= new PadStore();
  return store;
}
