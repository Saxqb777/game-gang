import { randomBytes, randomInt } from 'node:crypto';
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROOM_TTL_SECONDS,
  TV_PEER_ID,
  signalPayloadSchema,
  type LeaderboardEntry,
  type PostLapsRequest,
  type PostSignalRequest,
  type SignalMessage,
} from '@gamergang/shared';
import { SCHEMA } from './schema';
import { isMissingTableError, q, type Row, type SqlQuery, type SqlRunner } from './sql';

/** Handshakes finish in seconds; anything older than this is junk from an abandoned attempt. */
const SIGNAL_TTL_SECONDS = 120;
/** Protects a peer's inbox from being flooded. A handshake needs well under 20 messages. */
const MAX_PENDING_SIGNALS = 64;

export type RoomStatus = 'ok' | 'not-found' | 'forbidden';

export interface Store {
  createRoom(): Promise<{ code: string; hostKey: string }>;
  touchRoom(code: string, hostKey?: string): Promise<RoomStatus>;
  postSignal(request: PostSignalRequest): Promise<RoomStatus | 'inbox-full'>;
  takeSignals(
    room: string,
    peer: string,
    hostKey?: string,
  ): Promise<{ status: RoomStatus; messages: SignalMessage[] }>;
  postLaps(request: PostLapsRequest): Promise<RoomStatus>;
  leaderboard(track: string): Promise<LeaderboardEntry[]>;
}

/** Runs before every request: expired rooms (and their signals, via cascade) disappear. */
const CLEANUP: SqlQuery[] = [
  q(`DELETE FROM rooms WHERE last_seen < now() - make_interval(secs => $1)`, ROOM_TTL_SECONDS),
  q(`DELETE FROM signals WHERE created_at < now() - make_interval(secs => $1)`, SIGNAL_TTL_SECONDS),
];

const touch = (code: string): SqlQuery =>
  q(`UPDATE rooms SET last_seen = now() WHERE code = $1 RETURNING host_key`, code);

function roomStatus(touched: Row[] | undefined, hostKey: string | undefined): RoomStatus {
  const row = touched?.[0];
  if (!row) return 'not-found';
  if (hostKey !== undefined && row.host_key !== hostKey) return 'forbidden';
  return 'ok';
}

function randomRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET.charAt(randomInt(ROOM_CODE_ALPHABET.length));
  }
  return code;
}

function toIsoString(value: unknown): string {
  return (value instanceof Date ? value : new Date(String(value))).toISOString();
}

function toSignalMessage(row: Row): SignalMessage | null {
  const raw: unknown = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
  const payload = signalPayloadSchema.safeParse(raw);
  if (!payload.success || typeof row.from_peer !== 'string') return null;
  return { from: row.from_peer, payload: payload.data };
}

export function createStore(sql: SqlRunner): Store {
  async function run(queries: SqlQuery[]): Promise<Row[][]> {
    try {
      return await sql.batch(queries);
    } catch (error) {
      if (!isMissingTableError(error)) throw error;
      // First request against an empty database: create the tables and try again.
      await sql.batch(SCHEMA);
      return sql.batch(queries);
    }
  }

  return {
    async createRoom() {
      for (let attempt = 0; attempt < 12; attempt++) {
        const code = randomRoomCode();
        const hostKey = randomBytes(16).toString('hex');
        const results = await run([
          ...CLEANUP,
          q(
            `INSERT INTO rooms (code, host_key) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING RETURNING code`,
            code,
            hostKey,
          ),
        ]);
        if (results.at(-1)?.length) return { code, hostKey };
      }
      throw new Error('Could not allocate a free room code');
    },

    async touchRoom(code, hostKey) {
      const results = await run([...CLEANUP, touch(code)]);
      return roomStatus(results.at(-1), hostKey);
    },

    async postSignal({ room, from, to, key, payload }) {
      // Only the TV (proven by its host key) may send as the TV.
      const requiredKey = from === TV_PEER_ID ? (key ?? '') : null;
      const results = await run([
        ...CLEANUP,
        touch(room),
        q(
          `INSERT INTO signals (room, from_peer, to_peer, payload)
           SELECT $1, $2, $3, $4::jsonb
           WHERE EXISTS (SELECT 1 FROM rooms WHERE code = $1 AND ($5::text IS NULL OR host_key = $5))
             AND (SELECT count(*) FROM signals WHERE room = $1 AND to_peer = $3) < $6
           RETURNING 1 AS ok`,
          room,
          from,
          to,
          JSON.stringify(payload),
          requiredKey,
          MAX_PENDING_SIGNALS,
        ),
      ]);
      const status = roomStatus(results.at(-2), requiredKey ?? undefined);
      if (status !== 'ok') return status;
      return results.at(-1)?.length ? 'ok' : 'inbox-full';
    },

    async takeSignals(room, peer, hostKey) {
      const requiredKey = peer === TV_PEER_ID ? (hostKey ?? '') : null;
      const results = await run([
        ...CLEANUP,
        touch(room),
        q(
          `WITH taken AS (
             DELETE FROM signals
             WHERE room = $1 AND to_peer = $2
               AND EXISTS (SELECT 1 FROM rooms WHERE code = $1 AND ($3::text IS NULL OR host_key = $3))
             RETURNING id, from_peer, payload
           )
           SELECT from_peer, payload FROM taken ORDER BY id`,
          room,
          peer,
          requiredKey,
        ),
      ]);
      const status = roomStatus(results.at(-2), requiredKey ?? undefined);
      if (status !== 'ok') return { status, messages: [] };
      const messages = (results.at(-1) ?? [])
        .map(toSignalMessage)
        .filter((m): m is SignalMessage => m !== null);
      return { status, messages };
    },

    async postLaps({ room, key, track, laps }) {
      const results = await run([
        ...CLEANUP,
        touch(room),
        q(
          `INSERT INTO laps (room, player_name, track, best_lap_ms)
           SELECT $1, x.name, $3, x."bestLapMs"
           FROM jsonb_to_recordset($4::jsonb) AS x(name text, "bestLapMs" integer)
           WHERE EXISTS (SELECT 1 FROM rooms WHERE code = $1 AND host_key = $2)`,
          room,
          key,
          track,
          JSON.stringify(laps),
        ),
      ]);
      return roomStatus(results.at(-2), key);
    },

    async leaderboard(track) {
      const results = await run([
        q(
          `SELECT name, best_lap_ms, created_at FROM (
             SELECT DISTINCT ON (lower(player_name)) player_name AS name, best_lap_ms, created_at
             FROM laps WHERE track = $1
             ORDER BY lower(player_name), best_lap_ms
           ) best
           ORDER BY best_lap_ms
           LIMIT 10`,
          track,
        ),
      ]);
      return (results[0] ?? []).map((row) => ({
        name: String(row.name),
        bestLapMs: Number(row.best_lap_ms),
        at: toIsoString(row.created_at),
      }));
    },
  };
}
