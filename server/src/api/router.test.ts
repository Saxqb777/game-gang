import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPgliteRunner } from '../db/pglite';
import { createStore } from '../db/store';
import { readEnv } from '../env';
import { createApiHandler } from './router';

describe('api router', () => {
  let server: Server;
  let base: string;
  const createdRooms: string[] = [];

  beforeAll(async () => {
    const api = createApiHandler({
      store: createStore(await createPgliteRunner()),
      env: readEnv({ TURN_URL: 'turn:relay.example:3478', TURN_USER: 'u', TURN_PASS: 'p' }),
      padOrigin: () => 'https://pads.example',
      onRoomCreated: (code) => createdRooms.push(code),
    });
    server = createServer((req, res) => void api(req, res));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    // PGlite (Postgres in WASM) can take well over the default 10 s to start on a busy machine.
  }, 60_000);

  afterAll(() => {
    server.close();
  });

  const post = (path: string, body: unknown) =>
    fetch(base + path, { method: 'POST', body: JSON.stringify(body) });

  it('creates a room with pad url and ICE servers (STUN + TURN from env)', async () => {
    const response = await fetch(`${base}/api/room`, { method: 'POST' });
    expect(response.status).toBe(201);
    const room = (await response.json()) as { code: string; padUrl: string; iceServers: unknown[] };
    expect(room.padUrl).toBe(`https://pads.example/pad?room=${room.code}`);
    expect(room.iceServers).toEqual([
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
      { urls: ['turn:relay.example:3478'], username: 'u', credential: 'p' },
    ]);
    expect(createdRooms).toContain(room.code);
    expect((await fetch(`${base}/api/room?code=${room.code}`)).status).toBe(200);
    expect((await fetch(`${base}/api/room?code=QQQQ`)).status).toBe(404);
  });

  it('rejects malformed and misrouted signals', async () => {
    const room = (await (await fetch(`${base}/api/room`, { method: 'POST' })).json()) as {
      code: string;
    };
    const payload = { kind: 'offer', session: 'abcdef', sdp: 'v=0' };
    expect(
      (await post('/api/signal', { room: room.code, from: 'tv', to: 'tv', payload })).status,
    ).toBe(400);
    expect(
      (
        await post('/api/signal', {
          room: room.code,
          from: 'aaaaaaaaaa',
          to: 'bbbbbbbbbb',
          payload,
        })
      ).status,
    ).toBe(400);
    expect(
      (await post('/api/signal', { room: room.code, from: 'aaaaaaaaaa', to: 'tv', payload: {} }))
        .status,
    ).toBe(400);
    expect(
      (await post('/api/signal', { room: room.code, from: 'aaaaaaaaaa', to: 'tv', payload }))
        .status,
    ).toBe(200);
    expect((await fetch(`${base}/api/signal?room=${room.code}&peer=tv`)).status).toBe(401);
    expect((await fetch(`${base}/api/nope`)).status).toBe(404);
  });

  it('serves the leaderboard', async () => {
    const response = await fetch(`${base}/api/laps?track=kestrel-pines`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ track: 'kestrel-pines', entries: [] });
    expect((await fetch(`${base}/api/laps?track=moon`)).status).toBe(400);
  });

  describe('POST /api/telemetry', () => {
    const sample = {
      kind: 'race',
      scenario: 'race',
      track: 'kestrel-pines',
      viewports: 1,
      preset: 'high',
      durationMs: 95_000,
      frames: 5700,
      fpsAvg: 60,
      frameMsP50: 16.7,
      frameMsP95: 16.8,
      frameMsP99: 17,
      frameMsMax: 21,
      cpuMsP99: 7,
      gpuMsAvg: 9.5,
      gpuMsP95: 10.1,
      gpuMsP99: 11,
      missedFrames: 2,
      internalWidth: 2560,
      internalHeight: 1440,
      outputWidth: 3840,
      outputHeight: 2160,
      scaleAvg: 1,
      scaleMin: 1,
      drawCallsAvg: 540,
      trianglesAvg: 2_100_000,
      presetDrops: 0,
    };
    const device = {
      userAgent: 'test',
      gpu: null,
      cores: 8,
      memoryGb: 8,
      screenWidth: 3840,
      screenHeight: 2160,
      devicePixelRatio: 2,
      refreshHz: 60,
      timerQuery: true,
    };
    let room: { code: string; hostKey: string };
    const body = (overrides: Record<string, unknown> = {}) => ({
      room: room.code,
      key: room.hostKey,
      session: 'abcdefgh12345678',
      build: '0123456789ab',
      device,
      samples: [sample],
      ...overrides,
    });

    beforeAll(async () => {
      room = (await (await fetch(`${base}/api/room`, { method: 'POST' })).json()) as {
        code: string;
        hostKey: string;
      };
    });

    it('accepts a valid batch from the host', async () => {
      const response = await post('/api/telemetry', body());
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
    });

    it('rejects malformed batches', async () => {
      const missingField: Partial<typeof sample> = { ...sample };
      delete missingField.fpsAvg;
      expect((await post('/api/telemetry', body({ samples: [missingField] }))).status).toBe(400);
      expect(
        (await post('/api/telemetry', body({ samples: [{ ...sample, fpsAvg: '60' }] }))).status,
      ).toBe(400);
      const nine = Array.from({ length: 9 }, () => sample);
      expect((await post('/api/telemetry', body({ samples: nine }))).status).toBe(400);
    });

    it('needs the host key of an existing room', async () => {
      expect((await post('/api/telemetry', body({ key: 'f'.repeat(32) }))).status).toBe(403);
      expect((await post('/api/telemetry', body({ room: 'QQQQ' }))).status).toBe(404);
    });

    it('refuses bodies over 16 KiB', async () => {
      const response = await post('/api/telemetry', body({ padding: 'x'.repeat(20_000) }));
      expect(response.status).toBe(413);
    });

    it('has no GET', async () => {
      expect((await fetch(`${base}/api/telemetry`)).status).toBe(404);
    });
  });

  it('deploys every API route as a Vercel function (API_ROUTES in scripts/build-vercel.mjs)', () => {
    const router = readFileSync(new URL('./router.ts', import.meta.url), 'utf8');
    const build = readFileSync(
      new URL('../../../scripts/build-vercel.mjs', import.meta.url),
      'utf8',
    );
    const names = new Set(
      [...router.matchAll(/case '(?:GET|POST|PUT|PATCH|DELETE) \/api\/([a-z-]+)'/g)].map(
        (m) => m[1],
      ),
    );
    const list = /const API_ROUTES = \[([^\]]*)\]/.exec(build)?.[1] ?? '';
    const routes = new Set([...list.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]));
    expect(names.size).toBeGreaterThanOrEqual(4);
    for (const name of names) expect(routes, `API_ROUTES lacks '${String(name)}'`).toContain(name);
  });
});
