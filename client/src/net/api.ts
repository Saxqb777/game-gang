import { z } from 'zod';
import {
  createRoomResponseSchema,
  leaderboardResponseSchema,
  pollSignalResponseSchema,
  roomInfoResponseSchema,
  type CreateRoomResponse,
  type LeaderboardResponse,
  type PostLapsRequest,
  type PostSignalRequest,
  type PostTelemetryRequest,
  type RoomInfoResponse,
  type SignalMessage,
} from '@gamergang/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const okSchema = z.object({ ok: z.literal(true) });

async function request<T>(schema: z.ZodType<T>, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: 'no-store',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && 'error' in body
        ? String(body.error)
        : 'Request failed';
    throw new ApiError(response.status, message);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError(502, 'Unexpected response from server');
  return parsed.data;
}

function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value !== undefined) search.set(key, value);
  return search.toString();
}

export const api = {
  createRoom(): Promise<CreateRoomResponse> {
    return request(createRoomResponseSchema, '/api/room', { method: 'POST' });
  },
  roomInfo(code: string, key?: string): Promise<RoomInfoResponse> {
    return request(roomInfoResponseSchema, `/api/room?${query({ code, key })}`);
  },
  async postSignal(body: PostSignalRequest): Promise<void> {
    await request(okSchema, '/api/signal', { method: 'POST', body: JSON.stringify(body) });
  },
  async pollSignals(room: string, peer: string, key?: string): Promise<SignalMessage[]> {
    const response = await request(
      pollSignalResponseSchema,
      `/api/signal?${query({ room, peer, key })}`,
    );
    return response.messages;
  },
  /** Fire-and-forget signal that survives page unload. */
  beaconSignal(body: PostSignalRequest): void {
    navigator.sendBeacon(
      '/api/signal',
      new Blob([JSON.stringify(body)], { type: 'application/json' }),
    );
  },
  async postLaps(body: PostLapsRequest): Promise<void> {
    await request(okSchema, '/api/laps', { method: 'POST', body: JSON.stringify(body) });
  },
  leaderboard(track: string): Promise<LeaderboardResponse> {
    return request(leaderboardResponseSchema, `/api/laps?${query({ track })}`);
  },
  /** Performance samples from the TV. `keepalive` lets a post finish while the page closes. */
  async postTelemetry(body: PostTelemetryRequest): Promise<void> {
    await request(okSchema, '/api/telemetry', {
      method: 'POST',
      body: JSON.stringify(body),
      keepalive: true,
    });
  },
  /** On pagehide only: a plain-text beacon (no preflight, no response). False if the browser refused it. */
  beaconTelemetry(body: PostTelemetryRequest): boolean {
    return navigator.sendBeacon('/api/telemetry', JSON.stringify(body));
  },
};
