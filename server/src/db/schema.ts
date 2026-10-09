import { q, type SqlQuery } from './sql';

/**
 * The whole database. Kept tiny on purpose.
 *  rooms   - one row per TV, deleted 10 minutes after its last API call
 *  signals - pending WebRTC handshake messages, deleted when the recipient polls them
 *  laps    - best lap per player per race, for the all-time leaderboard
 */
export const SCHEMA: SqlQuery[] = [
  q(`CREATE TABLE IF NOT EXISTS rooms (
    code text PRIMARY KEY,
    host_key text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen timestamptz NOT NULL DEFAULT now()
  )`),
  q(`CREATE INDEX IF NOT EXISTS rooms_last_seen_idx ON rooms (last_seen)`),
  q(`CREATE TABLE IF NOT EXISTS signals (
    id bigserial PRIMARY KEY,
    room text NOT NULL REFERENCES rooms (code) ON DELETE CASCADE,
    from_peer text NOT NULL,
    to_peer text NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`),
  q(`CREATE INDEX IF NOT EXISTS signals_inbox_idx ON signals (room, to_peer)`),
  q(`CREATE INDEX IF NOT EXISTS signals_created_idx ON signals (created_at)`),
  q(`CREATE TABLE IF NOT EXISTS laps (
    room text NOT NULL,
    player_name text NOT NULL,
    track text NOT NULL,
    best_lap_ms integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`),
  q(`CREATE INDEX IF NOT EXISTS laps_track_idx ON laps (track, best_lap_ms)`),
];
