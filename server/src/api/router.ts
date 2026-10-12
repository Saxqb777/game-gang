import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import {
  TELEMETRY_MAX_BODY_BYTES,
  TV_PEER_ID,
  hostKeySchema,
  peerIdSchema,
  postLapsRequestSchema,
  postSignalRequestSchema,
  postTelemetryRequestSchema,
  roomCodeSchema,
  trackIdSchema,
  type CreateRoomResponse,
  type LeaderboardResponse,
  type RoomInfoResponse,
} from '@gamergang/shared';
import type { RoomStatus, Store } from '../db/store';
import type { ServerEnv } from '../env';
import { HttpError, readJsonBody, sendJson } from './http';

export interface ApiOptions {
  store: Store;
  env: ServerEnv;
  /** Origin phones should open, e.g. https://gamergang.vercel.app or https://192.168.1.23:4443 */
  padOrigin: (req: IncomingMessage) => string;
  /** Local dev hook, used to print the pad QR code in the terminal. */
  onRoomCreated?: (code: string, padUrl: string) => void;
}

export type ApiHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

const roomQuerySchema = z.object({ code: roomCodeSchema, key: hostKeySchema.optional() });
const signalQuerySchema = z.object({
  room: roomCodeSchema,
  peer: peerIdSchema,
  key: hostKeySchema.optional(),
});
const lapsQuerySchema = z.object({ track: trackIdSchema });

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, 'Invalid request');
  return result.data;
}

function assertRoomOk(status: RoomStatus): void {
  if (status === 'not-found') throw new HttpError(404, 'Room not found');
  if (status === 'forbidden') throw new HttpError(403, 'Wrong host key');
}

export function createApiHandler(options: ApiOptions): ApiHandler {
  const { store, env } = options;
  const padUrl = (req: IncomingMessage, code: string) =>
    `${env.publicUrl ?? options.padOrigin(req)}/pad?room=${code}`;

  return async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const query = Object.fromEntries(url.searchParams);
      const route = `${req.method ?? 'GET'} ${url.pathname.replace(/\/+$/, '')}`;

      switch (route) {
        case 'POST /api/room': {
          const { code, hostKey } = await store.createRoom();
          const body: CreateRoomResponse = {
            code,
            hostKey,
            padUrl: padUrl(req, code),
            iceServers: env.iceServers,
          };
          options.onRoomCreated?.(code, body.padUrl);
          sendJson(res, 201, body);
          return;
        }

        case 'GET /api/room': {
          const { code, key } = parse(roomQuerySchema, query);
          assertRoomOk(await store.touchRoom(code, key));
          const body: RoomInfoResponse = {
            code,
            padUrl: padUrl(req, code),
            iceServers: env.iceServers,
          };
          sendJson(res, 200, body);
          return;
        }

        case 'POST /api/signal': {
          const request = parse(postSignalRequestSchema, await readJsonBody(req));
          // Signals only ever flow between the TV and one pad.
          if ((request.from === TV_PEER_ID) === (request.to === TV_PEER_ID)) {
            throw new HttpError(400, 'Signals must go between the TV and a pad');
          }
          const status = await store.postSignal(request);
          if (status === 'inbox-full') throw new HttpError(429, 'Too many pending signals');
          assertRoomOk(status);
          sendJson(res, 200, { ok: true });
          return;
        }

        case 'GET /api/signal': {
          const { room, peer, key } = parse(signalQuerySchema, query);
          if (peer === TV_PEER_ID && !key) throw new HttpError(401, 'Host key required');
          const { status, messages } = await store.takeSignals(room, peer, key);
          assertRoomOk(status);
          sendJson(res, 200, { messages });
          return;
        }

        case 'POST /api/laps': {
          const request = parse(postLapsRequestSchema, await readJsonBody(req));
          assertRoomOk(await store.postLaps(request));
          sendJson(res, 200, { ok: true });
          return;
        }

        case 'GET /api/laps': {
          const { track } = parse(lapsQuerySchema, query);
          const body: LeaderboardResponse = { track, entries: await store.leaderboard(track) };
          sendJson(res, 200, body);
          return;
        }

        case 'POST /api/telemetry': {
          // TV performance samples. Host key only; there is deliberately no GET.
          const request = parse(
            postTelemetryRequestSchema,
            await readJsonBody(req, TELEMETRY_MAX_BODY_BYTES),
          );
          const status = await store.postTelemetry(request);
          if (status === 'rate-limited') throw new HttpError(429, 'Too many telemetry samples');
          assertRoomOk(status);
          sendJson(res, 200, { ok: true });
          return;
        }

        default:
          throw new HttpError(404, 'Not found');
      }
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(res, error.status, { error: error.message });
        return;
      }
      console.error('[api] unexpected error', error);
      sendJson(res, 500, { error: 'Internal error' });
    }
  };
}
