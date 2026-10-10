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
  });

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
});
