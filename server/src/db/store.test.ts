import { beforeEach, describe, expect, it } from 'vitest';
import { ROOM_CODE_ALPHABET, TV_PEER_ID, type SignalPayload } from '@gamergang/shared';
import { createPgliteRunner } from './pglite';
import { q, type SqlRunner } from './sql';
import { createStore, type Store } from './store';

const PAD = 'pad0000000000001';
const offer: SignalPayload = { kind: 'offer', session: 'sess01', sdp: 'v=0' };

describe('store', () => {
  let runner: SqlRunner;
  let store: Store;

  beforeEach(async () => {
    runner = await createPgliteRunner();
    store = createStore(runner);
  });

  it('creates rooms with consonant-only codes and checks the host key', async () => {
    const { code, hostKey } = await store.createRoom();
    expect(code).toMatch(new RegExp(`^[${ROOM_CODE_ALPHABET}]{4}$`));
    expect(hostKey).toMatch(/^[a-f0-9]{32}$/);
    expect(await store.touchRoom(code)).toBe('ok');
    expect(await store.touchRoom(code, hostKey)).toBe('ok');
    expect(await store.touchRoom(code, 'f'.repeat(32))).toBe('forbidden');
    expect(await store.touchRoom('ZZZZ')).toBe('not-found');
  });

  it('delivers signals once, in order, only to the addressed peer', async () => {
    const { code, hostKey } = await store.createRoom();
    expect(await store.postSignal({ room: code, from: PAD, to: TV_PEER_ID, payload: offer })).toBe('ok');
    const candidate: SignalPayload = {
      kind: 'candidate',
      session: 'sess01',
      candidate: { candidate: 'candidate:1 1 udp 1 1.2.3.4 5 typ host', sdpMid: '0', sdpMLineIndex: 0 },
    };
    await store.postSignal({ room: code, from: PAD, to: TV_PEER_ID, payload: candidate });

    expect((await store.takeSignals(code, PAD)).messages).toEqual([]);
    const first = await store.takeSignals(code, TV_PEER_ID, hostKey);
    expect(first.status).toBe('ok');
    expect(first.messages).toEqual([
      { from: PAD, payload: offer },
      { from: PAD, payload: candidate },
    ]);
    expect((await store.takeSignals(code, TV_PEER_ID, hostKey)).messages).toEqual([]);
  });

  it('only lets the key holder act as the TV', async () => {
    const { code, hostKey } = await store.createRoom();
    const answer: SignalPayload = { kind: 'answer', session: 'sess01', sdp: 'v=0' };
    const wrongKey = '0'.repeat(32);
    expect(await store.postSignal({ room: code, from: TV_PEER_ID, to: PAD, key: wrongKey, payload: answer })).toBe(
      'forbidden',
    );
    expect(await store.postSignal({ room: code, from: TV_PEER_ID, to: PAD, key: hostKey, payload: answer })).toBe(
      'ok',
    );
    await store.postSignal({ room: code, from: PAD, to: TV_PEER_ID, payload: offer });
    const stolen = await store.takeSignals(code, TV_PEER_ID, wrongKey);
    expect(stolen).toEqual({ status: 'forbidden', messages: [] });
    expect((await store.takeSignals(code, TV_PEER_ID, hostKey)).messages).toHaveLength(1);
    expect((await store.takeSignals(code, PAD)).messages).toEqual([{ from: TV_PEER_ID, payload: answer }]);
  });

  it('caps a flooded inbox', async () => {
    const { code } = await store.createRoom();
    for (let i = 0; i < 64; i++) {
      expect(await store.postSignal({ room: code, from: PAD, to: TV_PEER_ID, payload: offer })).toBe('ok');
    }
    expect(await store.postSignal({ room: code, from: PAD, to: TV_PEER_ID, payload: offer })).toBe(
      'inbox-full',
    );
  });

  it('expires rooms 10 minutes after their last activity', async () => {
    const { code } = await store.createRoom();
    await store.postSignal({ room: code, from: PAD, to: TV_PEER_ID, payload: offer });
    await runner.batch([q(`UPDATE rooms SET last_seen = now() - interval '11 minutes'`)]);
    expect(await store.touchRoom(code)).toBe('not-found');
    const [signals] = await runner.batch([q(`SELECT count(*)::int AS n FROM signals`)]);
    expect(signals?.[0]?.n).toBe(0);
  });

  it('keeps the best lap per driver on the leaderboard', async () => {
    const { code, hostKey } = await store.createRoom();
    const laps = [
      { name: 'Sara', bestLapMs: 61_000 },
      { name: 'Omar', bestLapMs: 58_500 },
    ];
    expect(await store.postLaps({ room: code, key: hostKey, track: 'corniche-run', laps })).toBe('ok');
    await store.postLaps({ room: code, key: hostKey, track: 'corniche-run', laps: [{ name: 'sara', bestLapMs: 57_000 }] });
    expect(
      await store.postLaps({ room: code, key: '1'.repeat(32), track: 'corniche-run', laps }),
    ).toBe('forbidden');

    const board = await store.leaderboard('corniche-run');
    expect(board.map((e) => [e.name, e.bestLapMs])).toEqual([
      ['sara', 57_000],
      ['Omar', 58_500],
    ]);
  });
});
