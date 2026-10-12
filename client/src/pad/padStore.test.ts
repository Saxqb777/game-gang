import type { PadMessage, TvMessage } from '@gamergang/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PadLinkStatus, PadTransportEvents } from '../net/padTransport';

/** Stands in for WebRTC: tests drive the link status and TV messages by hand. */
class FakePadTransport {
  static all: FakePadTransport[] = [];
  readonly sent: PadMessage[] = [];
  stopped = false;
  constructor(
    readonly room: string,
    readonly clientId: string,
    readonly events: PadTransportEvents,
  ) {
    FakePadTransport.all.push(this);
  }
  start(): void {
    this.events.onStatus('connecting');
  }
  stop(): void {
    this.stopped = true;
  }
  send(message: PadMessage): boolean {
    this.sent.push(message);
    return true;
  }
  status(status: PadLinkStatus): void {
    this.events.onStatus(status);
  }
  receive(message: TvMessage): void {
    this.events.onMessage(message);
  }
  joins(): PadMessage[] {
    return this.sent.filter((m) => m.type === 'join');
  }
}

vi.mock('../net/padTransport', () => ({ PadTransport: FakePadTransport }));
vi.mock('./device', () => ({ vibrate: () => undefined }));

const { PadStore } = await import('./padStore');
const { loadSeat } = await import('./profile');

const ROOM = 'ABCD';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => {
      data.clear();
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
}

function latest(): FakePadTransport {
  const transport = FakePadTransport.all.at(-1);
  if (!transport) throw new Error('no transport');
  return transport;
}

/** A tab that joins room ABCD and gets the TV's answer. */
function joinedTab(colourFromTv: 'red' | 'blue' = 'blue') {
  const store = new PadStore();
  store.connect(ROOM);
  const link = latest();
  link.status('open');
  store.join('Bo', 'red', 'buttons');
  link.receive({ type: 'joined', playerId: link.clientId, colour: colourFromTv, slot: 1 });
  return { store, link };
}

beforeEach(() => {
  FakePadTransport.all = [];
  vi.stubGlobal('sessionStorage', memoryStorage());
  vi.stubGlobal('localStorage', memoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('pad rejoin after a reload', () => {
  it('shows a fresh tab the join screen: nothing is sent until the player taps Join', () => {
    const store = new PadStore();
    store.connect(ROOM);
    latest().status('open');
    expect(store.getState().rejoining).toBe(false);
    expect(latest().joins()).toEqual([]);
  });

  it('remembers the seat with the colour the TV gave, and the steering mode', () => {
    joinedTab('blue');
    expect(loadSeat(ROOM)).toEqual({ room: ROOM, name: 'Bo', colour: 'blue', mode: 'buttons' });
  });

  it('rejoins on its own after a reload, as the same player with the same colour', () => {
    const first = joinedTab('blue');
    const clientId = first.link.clientId;

    // A reload: a brand new store in the same tab (same sessionStorage).
    const store = new PadStore();
    store.connect(ROOM);
    const link = latest();
    expect(link.clientId).toBe(clientId);
    expect(store.getState().rejoining).toBe(true);
    link.status('open');
    expect(link.joins()).toEqual([
      { type: 'join', room: ROOM, name: 'Bo', colour: 'blue', rejoin: true },
    ]);
    link.receive({ type: 'joined', playerId: clientId, colour: 'blue', slot: 1 });
    expect(store.getState()).toMatchObject({ rejoining: false, me: { colour: 'blue', slot: 1 } });
  });

  it('claims the same seat again after a plain link reconnect', () => {
    const { link } = joinedTab('blue');
    link.status('reconnecting');
    link.status('open');
    expect(link.joins().at(-1)).toEqual({
      type: 'join',
      room: ROOM,
      name: 'Bo',
      colour: 'blue',
      rejoin: true,
    });
  });

  it('keeps a steering change made after joining', () => {
    const { store } = joinedTab();
    store.setMode('drag');
    expect(loadSeat(ROOM)?.mode).toBe('drag');
  });

  it('does not rejoin a different room', () => {
    joinedTab();
    const store = new PadStore();
    store.connect('WXYZ');
    latest().status('open');
    expect(store.getState().rejoining).toBe(false);
    expect(latest().joins()).toEqual([]);
  });

  it('forgets the seat on an explicit leave and tells the TV before closing', () => {
    vi.useFakeTimers();
    const { store, link } = joinedTab();
    store.leaveRoom();
    expect(link.sent.at(-1)).toEqual({ type: 'leave' });
    expect(link.stopped).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(link.stopped).toBe(true);
    expect(store.getState().room).toBeNull();
    expect(loadSeat(ROOM)).toBeNull();

    const reloaded = new PadStore();
    reloaded.connect(ROOM);
    latest().status('open');
    expect(reloaded.getState().rejoining).toBe(false);
    expect(latest().joins()).toEqual([]);
  });

  it('ignores a leaving link that is still flushing', () => {
    vi.useFakeTimers();
    const { store, link } = joinedTab();
    store.leaveRoom();
    link.receive({ type: 'joined', playerId: link.clientId, colour: 'blue', slot: 1 });
    expect(store.getState().me).toBeNull();
    expect(loadSeat(ROOM)).toBeNull();
  });

  it('forgets the seat when the room is gone or full', () => {
    const { link } = joinedTab();
    link.receive({ type: 'kicked', reason: 'full' });
    expect(loadSeat(ROOM)).toBeNull();

    joinedTab();
    latest().status('room-not-found');
    expect(loadSeat(ROOM)).toBeNull();
  });
});
