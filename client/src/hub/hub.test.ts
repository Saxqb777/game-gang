import type { ColourId, PadMessage, TvMessage } from '@gamergang/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostTransportEvents, HostTransportPort } from '../net/hostTransport';
import { Hub, type GameSessionHandlers } from './hub';

const A = 'padaaaaaaaa';
const B = 'padbbbbbbbb';
const C = 'padcccccccc';

/** Stands in for WebRTC: tests open, message and close peers by hand. */
class FakeTransport implements HostTransportPort {
  readonly sent: { peerId: string; message: TvMessage }[] = [];
  constructor(readonly events: HostTransportEvents) {}
  start(): void {
    this.events.onRoom({ code: 'ABCD', padUrl: 'https://example.test/pad?room=ABCD' });
  }
  stop(): void {}
  send(peerId: string, message: TvMessage): boolean {
    this.sent.push({ peerId, message });
    return true;
  }
  setIdlePollMs(): void {}
  credentials(): null {
    return null;
  }
  joined(peerId: string): Extract<TvMessage, { type: 'joined' }> | undefined {
    return this.sent
      .filter((s) => s.peerId === peerId)
      .map((s) => s.message)
      .filter((m) => m.type === 'joined')
      .at(-1);
  }
}

let transport: FakeTransport;
let hub: Hub;
let onInput: ReturnType<typeof vi.fn<GameSessionHandlers['onInput']>>;
let onPlayerConnection: ReturnType<typeof vi.fn<GameSessionHandlers['onPlayerConnection']>>;

function send(peerId: string, message: PadMessage): void {
  transport.events.onPeerMessage(peerId, message);
}

/** Joins like a real pad: with the seat key from the last `joined` this peer id received. */
function join(peerId: string, name: string, colour: ColourId, rejoin?: boolean): void {
  const seatKey = transport.joined(peerId)?.seatKey;
  send(peerId, {
    type: 'join',
    room: 'ABCD',
    name,
    colour,
    ...(rejoin ? { rejoin } : {}),
    ...(seatKey ? { seatKey } : {}),
  });
}

function connectAndJoin(peerId: string, name: string, colour: ColourId): void {
  transport.events.onPeerOpen(peerId);
  join(peerId, name, colour);
}

/** What a page reload looks like to the hub: the old link closes, a new one opens. */
function reload(peerId: string): void {
  transport.events.onPeerClose(peerId);
  transport.events.onPeerOpen(peerId);
}

function startRace(...peers: string[]): void {
  for (const peer of peers) send(peer, { type: 'ready', ready: true });
  expect(hub.getState().phase).toBe('playing');
}

beforeEach(() => {
  vi.useFakeTimers();
  hub = new Hub('splitways', (events) => (transport = new FakeTransport(events)));
  hub.start();
  onInput = vi.fn();
  onPlayerConnection = vi.fn();
  hub.onStart = () => {
    hub.attachSession({ onInput, onAction: vi.fn(), onPlayerConnection });
  };
});

afterEach(() => {
  hub.stop();
  vi.useRealTimers();
});

describe('hub rejoin', () => {
  it('gives a pad that reloads mid-race its own seat, car and colour back', () => {
    connectAndJoin(A, 'Ana', 'red');
    connectAndJoin(B, 'Bo', 'blue');
    startRace(A, B);

    reload(B);
    expect(hub.player(B)?.connected).toBe(false);
    expect(onPlayerConnection).toHaveBeenLastCalledWith(B, false);

    // The pad's stored colour is stale here on purpose: the TV's paint must still win.
    join(B, 'Bo', 'lime', true);
    expect(hub.getState().players).toHaveLength(2);
    expect(hub.player(B)).toMatchObject({
      name: 'Bo',
      colour: 'blue',
      slot: 1,
      connected: true,
      inGame: true,
    });
    expect(onPlayerConnection).toHaveBeenLastCalledWith(B, true);
    expect(transport.joined(B)).toMatchObject({
      type: 'joined',
      playerId: B,
      colour: 'blue',
      slot: 1,
    });

    send(B, {
      type: 'input',
      steer: 0.5,
      throttle: 1,
      brake: 0,
      handbrake: false,
      horn: false,
      t: 1,
    });
    expect(onInput).toHaveBeenCalledWith(B, expect.objectContaining({ steer: 0.5 }));
  });

  it('never repaints a car in the race, even for a plain join', () => {
    connectAndJoin(A, 'Ana', 'red');
    startRace(A);
    reload(A);
    join(A, 'Someone', 'lime');
    expect(hub.player(A)).toMatchObject({ name: 'Ana', colour: 'red', connected: true });
  });

  it('matches by player id, so two phones with the same name keep their own seats', () => {
    connectAndJoin(A, 'Sam', 'red');
    connectAndJoin(B, 'Sam', 'blue');
    startRace(A, B);
    reload(B);
    join(B, 'Sam', 'blue', true);
    expect(hub.getState().players.map((p) => [p.id, p.colour, p.slot])).toEqual([
      [A, 'red', 0],
      [B, 'blue', 1],
    ]);
    expect(hub.player(A)?.connected).toBe(true);
  });

  it('keeps a reloaded pad in the lobby past the grace period once it rejoins', () => {
    connectAndJoin(A, 'Ana', 'red');
    reload(A);
    vi.advanceTimersByTime(5_000);
    join(A, 'Ana', 'red', true);
    vi.advanceTimersByTime(20_000);
    expect(hub.getState().players).toHaveLength(1);
    expect(hub.player(A)).toMatchObject({ colour: 'red', slot: 0, connected: true });
  });

  it('lets a reloaded pad vote on the results screen', () => {
    connectAndJoin(A, 'Ana', 'red');
    connectAndJoin(B, 'Bo', 'blue');
    startRace(A, B);
    hub.finishGame();
    reload(B);
    // A stale stored colour: the pre-fix hub would have repainted B to lime here.
    join(B, 'Bo', 'lime', true);
    send(A, { type: 'vote', choice: 'again' });
    send(B, { type: 'vote', choice: 'again' });
    expect(hub.getState().phase).toBe('lobby');
    expect(hub.player(B)).toMatchObject({ colour: 'blue', slot: 1 });
  });

  it('does not start the race without a pad that is reloading in the lobby', () => {
    connectAndJoin(A, 'Ana', 'red');
    connectAndJoin(B, 'Bo', 'blue');
    send(B, { type: 'ready', ready: true });
    reload(B);
    send(A, { type: 'ready', ready: true });
    expect(hub.getState().phase).toBe('lobby');

    // B comes back still ready, so the race starts with both cars.
    join(B, 'Bo', 'blue', true);
    expect(hub.getState().phase).toBe('playing');
    expect(hub.getState().players.map((p) => [p.id, p.inGame])).toEqual([
      [A, true],
      [B, true],
    ]);
  });

  it('starts without a dropped pad once its grace runs out', () => {
    connectAndJoin(A, 'Ana', 'red');
    connectAndJoin(B, 'Bo', 'blue');
    reload(B);
    send(A, { type: 'ready', ready: true });
    expect(hub.getState().phase).toBe('lobby');
    vi.advanceTimersByTime(20_000);
    expect(hub.getState().phase).toBe('playing');
    expect(hub.getState().players.map((p) => p.id)).toEqual([A]);
  });

  it('treats a rejoin from an id it does not know as an ordinary join', () => {
    connectAndJoin(A, 'Ana', 'red');
    transport.events.onPeerOpen(C);
    join(C, 'Cy', 'red', true);
    expect(hub.getState().players).toHaveLength(2);
    expect(hub.player(C)?.colour).not.toBe('red');
    expect(hub.player(A)).toMatchObject({ colour: 'red', slot: 0 });
  });
});

describe('hub seat keys', () => {
  /** Another phone that copied B's public player id from the lobby list. */
  function impostor(peerId: string, rejoin: boolean): void {
    transport.events.onPeerOpen(peerId);
    send(peerId, { type: 'join', room: 'ABCD', name: 'Mal', colour: 'lime', rejoin });
  }

  it('gives each phone seat its own key, only in its own joined message', () => {
    connectAndJoin(A, 'Ana', 'red');
    connectAndJoin(B, 'Bo', 'blue');
    const keyA = transport.joined(A)?.seatKey;
    const keyB = transport.joined(B)?.seatKey;
    expect(keyA).toMatch(/^[a-z0-9]{24}$/);
    expect(keyB).toMatch(/^[a-z0-9]{24}$/);
    expect(keyA).not.toBe(keyB);
    const lobby = JSON.stringify(transport.sent.filter((s) => s.message.type === 'lobby'));
    expect(lobby).not.toContain(keyB);
  });

  it('refuses a join for an existing seat without its key', () => {
    connectAndJoin(A, 'Ana', 'red');
    connectAndJoin(B, 'Bo', 'blue');
    startRace(A, B);
    for (const rejoin of [true, false]) {
      // What a link takeover looks like to the hub: B's link closes, the impostor's opens.
      transport.events.onPeerClose(B);
      impostor(B, rejoin);
      expect(transport.sent.at(-1)).toEqual({
        peerId: B,
        message: { type: 'kicked', reason: 'taken' },
      });
      expect(hub.player(B)).toMatchObject({ name: 'Bo', colour: 'blue', connected: false });
    }
  });

  it('ignores inputs, votes and ready from a link that has not proved its seat', () => {
    connectAndJoin(A, 'Ana', 'red');
    connectAndJoin(B, 'Bo', 'blue');
    send(B, { type: 'ready', ready: true });
    send(A, { type: 'ready', ready: true });
    expect(hub.getState().phase).toBe('playing');
    reload(B);
    send(B, {
      type: 'input',
      steer: 1,
      throttle: 1,
      brake: 0,
      handbrake: false,
      horn: false,
      t: 1,
    });
    send(B, { type: 'leave' });
    expect(onInput).not.toHaveBeenCalled();
    expect(hub.player(B)).toBeDefined();

    // The real pad comes back with its key and drives again.
    join(B, 'Bo', 'blue', true);
    send(B, {
      type: 'input',
      steer: 1,
      throttle: 1,
      brake: 0,
      handbrake: false,
      horn: false,
      t: 2,
    });
    expect(onInput).toHaveBeenCalledWith(B, expect.objectContaining({ steer: 1 }));
  });

  it('refuses a phone claiming a keyboard player id', () => {
    hub.addLocalPlayer('localkeys1', 'Keys');
    impostor('localkeys1', true);
    expect(transport.sent.at(-1)?.message).toEqual({ type: 'kicked', reason: 'taken' });
    expect(hub.player('localkeys1')).toMatchObject({ local: true, connected: true });
  });
});

describe('hub leave', () => {
  it('frees a lobby seat at once', () => {
    connectAndJoin(A, 'Ana', 'red');
    connectAndJoin(B, 'Bo', 'blue');
    send(B, { type: 'leave' });
    expect(hub.getState().players.map((p) => p.id)).toEqual([A]);
    // The freed colour and slot go to the next phone.
    connectAndJoin(C, 'Cy', 'blue');
    expect(hub.player(C)).toMatchObject({ colour: 'blue', slot: 1 });
  });

  it('keeps the car on the grid without a driver mid-race', () => {
    connectAndJoin(A, 'Ana', 'red');
    connectAndJoin(B, 'Bo', 'blue');
    startRace(A, B);
    send(B, { type: 'leave' });
    expect(hub.player(B)).toMatchObject({ connected: false, inGame: true });
    expect(onPlayerConnection).toHaveBeenLastCalledWith(B, false);
    // The seat cannot be claimed back after a Leave, even by the same tab.
    join(B, 'Bo', 'blue', true);
    expect(transport.sent.at(-1)?.message).toEqual({ type: 'kicked', reason: 'taken' });
    // Back in the lobby the slot is freed at once (no grace), so A can start straight away.
    hub.returnToLobby();
    expect(hub.getState().players.map((p) => p.id)).toEqual([A]);
    send(A, { type: 'ready', ready: true });
    expect(hub.getState().phase).toBe('playing');
  });
});
