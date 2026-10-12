/**
 * HTTP API contracts for the signaling + room service (/api/*).
 * The API only brokers WebRTC handshakes and stores lap times. Gameplay never touches it.
 */
import { z } from 'zod';
import {
  MAX_PLAYERS,
  NAME_MAX_LENGTH,
  TV_PEER_ID,
  playerNameSchema,
  roomCodeSchema,
} from './protocol';

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
  z.object({
    kind: z.literal('candidate'),
    session: sessionIdSchema,
    candidate: iceCandidateSchema,
  }),
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
export const TRACK_IDS = ['kestrel-pines'] as const;
export const trackIdSchema = z.enum(TRACK_IDS);
export type TrackId = z.infer<typeof trackIdSchema>;
/** A lap under 45 s or over 10 min is not a real Kestrel Pines lap. */
export const MIN_LAP_MS = 45_000;
export const MAX_LAP_MS = 600_000;
export const postLapsRequestSchema = z.object({
  room: roomCodeSchema,
  key: hostKeySchema,
  track: trackIdSchema,
  laps: z
    .array(
      z.object({
        name: playerNameSchema,
        bestLapMs: z.number().int().min(MIN_LAP_MS).max(MAX_LAP_MS),
      }),
    )
    .min(1)
    .max(4),
});
export type PostLapsRequest = z.infer<typeof postLapsRequestSchema>;

// GET /api/laps?track=kestrel-pines -> all-time top 10
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

// POST /api/telemetry -> TV-only performance samples (host key required); no GET exists.
export const RENDER_PRESETS = ['high', 'medium', 'low'] as const;
export const renderPresetSchema = z.enum(RENDER_PRESETS);
export type RenderPreset = z.infer<typeof renderPresetSchema>;
export const TELEMETRY_KINDS = ['loading-benchmark', 'flythrough', 'race', 'soak'] as const;
/** Per request; the client splits bigger batches (the matrix benchmark sends 9). */
export const TELEMETRY_MAX_SAMPLES = 8;
export const TELEMETRY_MAX_BODY_BYTES = 16 * 1024;
const telemetryMs = z.number().min(0).max(10_000);
const telemetryPx = z.number().int().min(1).max(16_384);
export const telemetryDeviceSchema = z.object({
  userAgent: z.string().max(512),
  gpu: z.string().max(256).nullable(),
  cores: z.number().int().min(1).max(256).nullable(),
  memoryGb: z.number().min(0).max(1024).nullable(),
  screenWidth: telemetryPx,
  screenHeight: telemetryPx,
  devicePixelRatio: z.number().min(0.25).max(8),
  refreshHz: z.number().min(1).max(500).nullable(),
  timerQuery: z.boolean(),
});
export const telemetrySampleSchema = z.object({
  kind: z.enum(TELEMETRY_KINDS),
  /** For example fly-4-low, race, soak-07, soak-total, loading. */
  scenario: z.string().regex(/^[a-z0-9-]{1,32}$/),
  track: trackIdSchema.nullable(),
  viewports: z.number().int().min(1).max(MAX_PLAYERS),
  preset: renderPresetSchema,
  durationMs: z
    .number()
    .int()
    .min(0)
    .max(4 * 3_600_000),
  frames: z.number().int().min(0).max(10_000_000),
  fpsAvg: z.number().min(0).max(1000),
  frameMsP50: telemetryMs,
  frameMsP95: telemetryMs,
  frameMsP99: telemetryMs,
  frameMsMax: telemetryMs,
  cpuMsP99: telemetryMs,
  gpuMsAvg: telemetryMs.nullable(),
  gpuMsP95: telemetryMs.nullable(),
  gpuMsP99: telemetryMs.nullable(),
  missedFrames: z.number().int().min(0).max(10_000_000),
  internalWidth: telemetryPx,
  internalHeight: telemetryPx,
  outputWidth: telemetryPx,
  outputHeight: telemetryPx,
  scaleAvg: z.number().min(0).max(2),
  scaleMin: z.number().min(0).max(2),
  drawCallsAvg: z.number().min(0).max(100_000),
  trianglesAvg: z.number().min(0).max(100_000_000),
  presetDrops: z.number().int().min(0).max(10),
});
export type TelemetrySample = z.infer<typeof telemetrySampleSchema>;
export type TelemetryDevice = z.infer<typeof telemetryDeviceSchema>;
export const postTelemetryRequestSchema = z.object({
  room: roomCodeSchema,
  key: hostKeySchema,
  session: z.string().regex(/^[a-z0-9]{8,32}$/),
  build: z
    .string()
    .regex(/^[A-Za-z0-9._-]{1,40}$/)
    .nullable(),
  device: telemetryDeviceSchema,
  samples: z.array(telemetrySampleSchema).min(1).max(TELEMETRY_MAX_SAMPLES),
});
export type PostTelemetryRequest = z.infer<typeof postTelemetryRequestSchema>;
