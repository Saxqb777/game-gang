import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ROOM_CODE_ALPHABET,
  TV_PEER_ID,
  type PostTelemetryRequest,
  type SignalPayload,
  type TelemetrySample,
} from '@gamergang/shared';
import { createPgliteRunner } from './pglite';
import { q, type SqlRunner } from './sql';
import { createStore, type Store } from './store';

const PAD = 'pad0000000000001';
const PGLITE_START_MS = 60_000;
const offer: SignalPayload = { kind: 'offer', session: 'sess01', sdp: 'v=0' };

describe('store', () => {
  let runner: SqlRunner;
  let store: Store;

  // PGlite (Postgres in WASM) can take well over the default 10 s to start on a busy machine.
  beforeEach(async () => {
    runner = await createPgliteRunner();
    store = createStore(runner);
  }, PGLITE_START_MS);

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
    expect(await store.postSignal({ room: code, from: PAD, to: TV_PEER_ID, payload: offer })).toBe(
      'ok',
    );
    const candidate: SignalPayload = {
      kind: 'candidate',
      session: 'sess01',
      candidate: {
        candidate: 'candidate:1 1 udp 1 1.2.3.4 5 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0,
      },
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
    expect(
      await store.postSignal({
        room: code,
        from: TV_PEER_ID,
        to: PAD,
        key: wrongKey,
        payload: answer,
      }),
    ).toBe('forbidden');
    expect(
      await store.postSignal({
        room: code,
        from: TV_PEER_ID,
        to: PAD,
        key: hostKey,
        payload: answer,
      }),
    ).toBe('ok');
    await store.postSignal({ room: code, from: PAD, to: TV_PEER_ID, payload: offer });
    const stolen = await store.takeSignals(code, TV_PEER_ID, wrongKey);
    expect(stolen).toEqual({ status: 'forbidden', messages: [] });
    expect((await store.takeSignals(code, TV_PEER_ID, hostKey)).messages).toHaveLength(1);
    expect((await store.takeSignals(code, PAD)).messages).toEqual([
      { from: TV_PEER_ID, payload: answer },
    ]);
  });

  it('caps a flooded inbox', async () => {
    const { code } = await store.createRoom();
    for (let i = 0; i < 64; i++) {
      expect(
        await store.postSignal({ room: code, from: PAD, to: TV_PEER_ID, payload: offer }),
      ).toBe('ok');
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
    expect(await store.postLaps({ room: code, key: hostKey, track: 'kestrel-pines', laps })).toBe(
      'ok',
    );
    await store.postLaps({
      room: code,
      key: hostKey,
      track: 'kestrel-pines',
      laps: [{ name: 'sara', bestLapMs: 57_000 }],
    });
    expect(
      await store.postLaps({ room: code, key: '1'.repeat(32), track: 'kestrel-pines', laps }),
    ).toBe('forbidden');

    const board = await store.leaderboard('kestrel-pines');
    expect(board.map((e) => [e.name, e.bestLapMs])).toEqual([
      ['sara', 57_000],
      ['Omar', 58_500],
    ]);
  });
});

const sample: TelemetrySample = {
  kind: 'flythrough',
  scenario: 'fly-4-low',
  track: 'kestrel-pines',
  viewports: 4,
  preset: 'low',
  durationMs: 20_000,
  frames: 1200,
  fpsAvg: 60,
  frameMsP50: 16.7,
  frameMsP95: 16.8,
  frameMsP99: 17.1,
  frameMsMax: 18.3,
  cpuMsP99: 6.2,
  gpuMsAvg: null,
  gpuMsP95: null,
  gpuMsP99: null,
  missedFrames: 0,
  internalWidth: 816,
  internalHeight: 459,
  outputWidth: 958,
  outputHeight: 538,
  scaleAvg: 0.85,
  scaleMin: 0.8,
  drawCallsAvg: 612,
  trianglesAvg: 1_900_000,
  presetDrops: 0,
};

function telemetry(room: string, key: string, count = 1): PostTelemetryRequest {
  return {
    room,
    key,
    session: 'session0000000001',
    build: 'abc123',
    device: {
      userAgent: 'test',
      gpu: 'SwiftShader',
      cores: 4,
      memoryGb: null,
      screenWidth: 1920,
      screenHeight: 1080,
      devicePixelRatio: 1,
      refreshHz: 60,
      timerQuery: false,
    },
    samples: Array.from({ length: count }, () => sample),
  };
}

describe('store telemetry', () => {
  let runner: SqlRunner;

  // One database for these tests (PGlite takes a while to start); each starts with no samples.
  beforeAll(async () => {
    runner = await createPgliteRunner();
    await createStore(runner).createRoom();
  }, PGLITE_START_MS);
  beforeEach(async () => {
    await runner.batch([q(`DELETE FROM telemetry`)]);
  });

  async function rows(): Promise<number> {
    const [result] = await runner.batch([q(`SELECT count(*)::int AS n FROM telemetry`)]);
    return Number(result?.[0]?.n);
  }

  it('stores a batch for the room host, one row per sample', async () => {
    const store = createStore(runner);
    const { code, hostKey } = await store.createRoom();
    expect(await store.postTelemetry(telemetry(code, hostKey, 3))).toBe('ok');
    expect(await rows()).toBe(3);
    const [stored] = await runner.batch([
      q(
        `SELECT room, kind, scenario, preset, viewports, fps_avg, gpu_ms_avg, device, sample FROM telemetry LIMIT 1`,
      ),
    ]);
    const row = stored?.[0];
    expect(row?.room).toBe(code);
    expect(row?.kind).toBe('flythrough');
    expect(row?.scenario).toBe('fly-4-low');
    expect(row?.viewports).toBe(4);
    expect(row?.fps_avg).toBe(60);
    expect(row?.gpu_ms_avg).toBeNull();
    expect((row?.device as { gpu: string }).gpu).toBe('SwiftShader');
    expect((row?.sample as TelemetrySample).frameMsP99).toBe(17.1);
  });

  it('refuses a wrong key and an unknown room', async () => {
    const store = createStore(runner);
    const { code } = await store.createRoom();
    expect(await store.postTelemetry(telemetry(code, 'f'.repeat(32)))).toBe('forbidden');
    expect(await store.postTelemetry(telemetry('ZZZZ', 'f'.repeat(32)))).toBe('not-found');
    expect(await rows()).toBe(0);
  });

  it('caps rows per room (all of a batch or none) and per hour overall', async () => {
    const store = createStore(runner, { telemetry: { roomMaxRows: 3, globalMaxRowsPerHour: 5 } });
    const a = await store.createRoom();
    expect(await store.postTelemetry(telemetry(a.code, a.hostKey, 2))).toBe('ok');
    expect(await store.postTelemetry(telemetry(a.code, a.hostKey, 2))).toBe('rate-limited');
    expect(await store.postTelemetry(telemetry(a.code, a.hostKey, 1))).toBe('ok');
    expect(await rows()).toBe(3);
    const b = await store.createRoom();
    expect(await store.postTelemetry(telemetry(b.code, b.hostKey, 2))).toBe('ok');
    // 5 rows this hour: the global cap stops everyone.
    expect(await store.postTelemetry(telemetry(b.code, b.hostKey, 1))).toBe('rate-limited');
    expect(await rows()).toBe(5);
  });

  it('deletes rows older than 90 days on the next post', async () => {
    const store = createStore(runner);
    const { code, hostKey } = await store.createRoom();
    await store.postTelemetry(telemetry(code, hostKey, 2));
    await runner.batch([
      q(
        `UPDATE telemetry SET created_at = now() - interval '91 days' WHERE id = (SELECT min(id) FROM telemetry)`,
      ),
    ]);
    expect(await store.postTelemetry(telemetry(code, hostKey, 1))).toBe('ok');
    expect(await rows()).toBe(2);
    const [old] = await runner.batch([
      q(`SELECT count(*)::int AS n FROM telemetry WHERE created_at < now() - interval '90 days'`),
    ]);
    expect(Number(old?.[0]?.n)).toBe(0);
  });
});
