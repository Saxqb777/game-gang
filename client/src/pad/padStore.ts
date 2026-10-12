/** Pad-side state: link status plus the latest hub/game messages from the TV. */
import type {
  ColourId,
  GameAction,
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
import {
  clearSeat,
  clientId,
  loadSeat,
  saveSeat,
  type Profile,
  type SteeringMode,
} from './profile';

export interface PadState {
  room: string | null;
  status: PadLinkStatus | 'idle';
  lobby: LobbyMessage | null;
  me: JoinedMessage | null;
  kicked: KickReason | null;
  race: RaceMessage | null;
  results: ResultsMessage | null;
  /** This tab held a seat in the room before a reload and is claiming it back, with no tap. */
  rejoining: boolean;
}

/** How long a leaving pad keeps its link open so the TV receives the leave message. */
const LEAVE_FLUSH_MS = 300;

const INITIAL: PadState = {
  room: null,
  status: 'idle',
  lobby: null,
  me: null,
  kicked: null,
  race: null,
  results: null,
  rejoining: false,
};

export class PadStore {
  private state: PadState = INITIAL;
  private readonly listeners = new Set<() => void>();
  private transport: PadTransport | null = null;
  private joinRequest: { name: string; colour: ColourId; rejoin?: boolean } | null = null;
  /** Steering layout, remembered with the seat so a reload keeps it in this tab. */
  private mode: SteeringMode = 'drag';

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getState = (): PadState => this.state;

  connect(room: string): void {
    if (this.state.room === room && this.transport) return;
    this.transport?.stop();
    // A seat saved by this tab means a reload: join again on open, as the same player.
    const seat = loadSeat(room);
    this.joinRequest = seat ? { name: seat.name, colour: seat.colour, rejoin: true } : null;
    if (seat) this.mode = seat.mode;
    this.update({ ...INITIAL, room, status: 'connecting', rejoining: seat !== null });
    // Events from a transport this store already let go of (see leaveRoom) are ignored.
    const transport: PadTransport = new PadTransport(room, clientId(), {
      onStatus: (status) => {
        if (this.transport === transport) this.handleStatus(status);
      },
      onMessage: (message) => {
        if (this.transport === transport) this.handleMessage(message);
      },
    });
    this.transport = transport;
    transport.start();
  }

  /** Explicit leave: the TV frees the seat now and a reload no longer rejoins. */
  leaveRoom(): void {
    clearSeat();
    const transport = this.transport;
    this.transport = null;
    if (transport) {
      transport.send({ type: 'leave' });
      // Closing the peer at once can drop the message still queued on the data channel.
      setTimeout(() => {
        transport.stop();
      }, LEAVE_FLUSH_MS);
    }
    this.joinRequest = null;
    this.update(INITIAL);
  }

  join(name: string, colour: ColourId, mode: SteeringMode): void {
    this.joinRequest = { name, colour };
    this.mode = mode;
    this.sendJoin();
  }

  setMode(mode: SteeringMode): void {
    this.mode = mode;
    const { room, me } = this.state;
    if (room && me && this.joinRequest) saveSeat({ room, ...this.seatProfile(me.colour) });
  }

  setReady(ready: boolean): void {
    this.transport?.send({ type: 'ready', ready });
  }

  voteAgain(): void {
    this.transport?.send({ type: 'vote', choice: 'again' });
  }

  /** A one-shot button (e.g. reset), sent on the reliable channel so it can't get lost. */
  action(action: GameAction): void {
    this.transport?.send({ type: 'action', action });
  }

  sendInput(input: Omit<InputMessage, 'type'>): boolean {
    return this.transport?.send({ type: 'input', ...input }) ?? false;
  }

  private sendJoin(): void {
    const { room } = this.state;
    if (room && this.joinRequest) this.transport?.send({ type: 'join', room, ...this.joinRequest });
  }

  private seatProfile(colour: ColourId): Profile {
    return { name: this.joinRequest?.name ?? '', colour, mode: this.mode };
  }

  private handleStatus(status: PadLinkStatus): void {
    if (status === 'room-not-found') {
      clearSeat();
      this.joinRequest = null;
      this.update({ status, rejoining: false });
      return;
    }
    this.update({ status });
    // After a reconnect the TV only knows us again once we re-send join (same id, same car).
    if (status === 'open') this.sendJoin();
  }

  private handleMessage(message: TvMessage): void {
    switch (message.type) {
      case 'joined': {
        const { room } = this.state;
        if (room && this.joinRequest) {
          // The TV's colour wins. Later reconnects and reloads claim this exact seat back.
          this.joinRequest = { name: this.joinRequest.name, colour: message.colour, rejoin: true };
          saveSeat({ room, ...this.seatProfile(message.colour) });
        }
        this.update({ me: message, kicked: null, rejoining: false });
        return;
      }
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
        clearSeat();
        this.update({ kicked: message.reason, me: null, rejoining: false });
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
