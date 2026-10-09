/**
 * HTTP API contracts for the signaling + room service (/api/*).
 * The API only brokers WebRTC handshakes and stores lap times. Gameplay never touches it.
 */
import { z } from 'zod';
import { NAME_MAX_LENGTH, TV_PEER_ID, playerNameSchema, roomCodeSchema } from './protocol';

/** Consonants only, so random codes never spell words. */
export const ROOM_CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ';
export const ROOM_CODE_LENGTH = 4;
/** Rooms (and their pending signals) are deleted after this long without any API call. */
export const ROOM_TTL_SECONDS = 10 * 60;

export const peerIdSchema = z.union([z.literal(TV_PEER_ID), z.string().regex(/^[a-z0-9]{8,24}$/)]);
export const hostKeySchema = z.string().regex(/^[a-f0-9]{32}$/);
/** Identifies one handshake attempt so stale messages from an earlier attempt are ignored. */
export const sessionIdSchema = z.string().regex(/^[a-z0-9]{6,24}$/);

export const iceServerSchema = z.object({
  urls: z.union([z.string(), z.array(z.string())]),
  username: z.string().optional(),
  credential: z.string().optional(),
});
export type IceServer = z.infer<typeof iceServerSchema>;

export const iceCandidateSchema = z.object({
  candidate: z.string().max(1024),
  sdpMid: z.string().max(64).nullable().optional(),
  sdpMLineIndex: z.number().int().min(0).max(64).nullable().optional(),
  usernameFragment: z.string().max(256).nullable().optional(),
});

export const signalPayloadSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('offer'), session: sessionIdSchema, sdp: z.string().max(16_000) }),
  z.object({ kind: z.literal('answer'), session: sessionIdSchema, sdp: z.string().max(16_000) }),
  z.object({ kind: z.literal('candidate'), session: sessionIdSchema, candidate: iceCandidateSchema }),
  z.object({ kind: z.literal('bye'), session: sessionIdSchema }),
]);
export type SignalPayload = z.infer<typeof signalPayloadSchema>;

// POST /api/room -> create a room (TV)
export const createRoomResponseSchema = z.object({
  code: roomCodeSchema,
  hostKey: hostKeySchema,
  padUrl: z.string(),
  iceServers: z.array(iceServerSchema),
});
export type CreateRoomResponse = z.infer<typeof createRoomResponseSchema>;

// GET /api/room?code=XXXX[&key=...] -> check a room exists (pads, TV resume)
export const roomInfoResponseSchema = z.object({
  code: roomCodeSchema,
  padUrl: z.string(),
  iceServers: z.array(iceServerSchema),
});
export type RoomInfoResponse = z.infer<typeof roomInfoResponseSchema>;

// POST /api/signal -> queue a signaling message for one peer
export const postSignalRequestSchema = z.object({
  room: roomCodeSchema,
  from: peerIdSchema,
  to: peerIdSchema,
  key: hostKeySchema.optional(),
  payload: signalPayloadSchema,
});
export type PostSignalRequest = z.infer<typeof postSignalRequestSchema>;

// GET /api/signal?room=XXXX&peer=ID[&key=...] -> take all queued messages for a peer
export const signalMessageSchema = z.object({
  from: peerIdSchema,
  payload: signalPayloadSchema,
});
export type SignalMessage = z.infer<typeof signalMessageSchema>;
export const pollSignalResponseSchema = z.object({
  messages: z.array(signalMessageSchema),
});

// POST /api/laps -> TV stores the best laps of a finished race
export const TRACK_IDS = ['corniche-run'] as const;
export const trackIdSchema = z.enum(TRACK_IDS);
export const postLapsRequestSchema = z.object({
  room: roomCodeSchema,
  key: hostKeySchema,
  track: trackIdSchema,
  laps: z
    .array(
      z.object({
        name: playerNameSchema,
        // A lap under 20 s or over 10 min is not a real Corniche Run lap.
        bestLapMs: z.number().int().min(20_000).max(600_000),
      }),
    )
    .min(1)
    .max(4),
});
export type PostLapsRequest = z.infer<typeof postLapsRequestSchema>;

// GET /api/laps?track=corniche-run -> all-time top 10
export const leaderboardEntrySchema = z.object({
  name: z.string().max(NAME_MAX_LENGTH * 4),
  bestLapMs: z.number().int(),
  at: z.string(),
});
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;
export const leaderboardResponseSchema = z.object({
  track: trackIdSchema,
  entries: z.array(leaderboardEntrySchema),
});
export type LeaderboardResponse = z.infer<typeof leaderboardResponseSchema>;

export const apiErrorSchema = z.object({ error: z.string() });
