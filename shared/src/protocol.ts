/**
 * Wire protocol between the pads (phones) and the TV (host browser).
 *
 * Every message is JSON with a `type` discriminator, has a TypeScript type and a zod schema.
 * The receiving side validates with the schema and silently drops anything malformed.
 *
 * Messages are split in two families:
 *  - Hub messages: lobby, player slots, ready, votes. These know nothing about any game.
 *  - Game messages: currently Split Ways (input, race, results). A future game adds its own.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MAX_PLAYERS = 4;
export const NAME_MAX_LENGTH = 12;

/** Peer id the TV uses in signaling. Pads use random client ids. */
export const TV_PEER_ID = 'tv';

export const PLAYER_COLOURS = [
  { id: 'red', label: 'Inferno', hex: '#ff3b3b' },
  { id: 'orange', label: 'Blaze', hex: '#ff8a1f' },
  { id: 'yellow', label: 'Taxi', hex: '#ffd60a' },
  { id: 'lime', label: 'Venom', hex: '#9cff2e' },
  { id: 'cyan', label: 'Lagoon', hex: '#1fe0e6' },
  { id: 'blue', label: 'Electric', hex: '#2f7bff' },
  { id: 'purple', label: 'Ultra', hex: '#9b5cff' },
  { id: 'pink', label: 'Flamingo', hex: '#ff4fb0' },
] as const;

export type ColourId = (typeof PLAYER_COLOURS)[number]['id'];
const COLOUR_IDS = PLAYER_COLOURS.map((c) => c.id) as [ColourId, ...ColourId[]];

export function colourHex(id: ColourId): string {
  return PLAYER_COLOURS.find((c) => c.id === id)?.hex ?? '#ffffff';
}

export const GAME_IDS = ['splitways'] as const;
export type GameId = (typeof GAME_IDS)[number];

/** Hub phases. Games map their own state machines onto these. */
export const HUB_PHASES = ['lobby', 'playing', 'results'] as const;
export type HubPhase = (typeof HUB_PHASES)[number];

// ---------------------------------------------------------------------------
// Shared field schemas
// ---------------------------------------------------------------------------

export const colourSchema = z.enum(COLOUR_IDS);
export const roomCodeSchema = z.string().regex(/^[A-Z]{4}$/);
export const playerIdSchema = z.string().regex(/^[a-z0-9]{8,24}$/);
/** Names: 1-12 visible characters, no control characters. */
export const playerNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(NAME_MAX_LENGTH)
  .regex(/^[^\p{C}]+$/u);

const unit = z.number().min(0).max(1);
const signedUnit = z.number().min(-1).max(1);
const timestamp = z.number().nonnegative();

// ---------------------------------------------------------------------------
// Pad -> TV
// ---------------------------------------------------------------------------

/** Join (or update name/colour after joining). */
export const joinSchema = z.object({
  type: z.literal('join'),
  room: roomCodeSchema,
  name: playerNameSchema,
  colour: colourSchema,
});

/** Split Ways driving input. Sent on the unreliable channel, newest `t` wins. */
export const inputSchema = z.object({
  type: z.literal('input'),
  steer: signedUnit,
  throttle: unit,
  brake: unit,
  handbrake: z.boolean(),
  horn: z.boolean(),
  t: timestamp,
});

export const readySchema = z.object({
  type: z.literal('ready'),
  ready: z.boolean(),
});

export const voteSchema = z.object({
  type: z.literal('vote'),
  choice: z.literal('again'),
});

/** Reply to a TV ping, echoing its timestamp so the TV can measure round trip time. */
export const pongSchema = z.object({
  type: z.literal('pong'),
  t: timestamp,
});

export const padMessageSchema = z.discriminatedUnion('type', [
  joinSchema,
  inputSchema,
  readySchema,
  voteSchema,
  pongSchema,
]);

export type JoinMessage = z.infer<typeof joinSchema>;
export type InputMessage = z.infer<typeof inputSchema>;
export type ReadyMessage = z.infer<typeof readySchema>;
export type VoteMessage = z.infer<typeof voteSchema>;
export type PadMessage = z.infer<typeof padMessageSchema>;

// ---------------------------------------------------------------------------
// TV -> Pad
// ---------------------------------------------------------------------------

export const joinedSchema = z.object({
  type: z.literal('joined'),
  playerId: playerIdSchema,
  colour: colourSchema,
  slot: z
    .number()
    .int()
    .min(0)
    .max(MAX_PLAYERS - 1),
});

export const lobbyPlayerSchema = z.object({
  id: playerIdSchema,
  name: playerNameSchema,
  colour: colourSchema,
  ready: z.boolean(),
  connected: z.boolean(),
  /** Has a role in the game currently being played (late joiners wait for the next round). */
  inGame: z.boolean(),
  slot: z
    .number()
    .int()
    .min(0)
    .max(MAX_PLAYERS - 1),
});

export const lobbySchema = z.object({
  type: z.literal('lobby'),
  room: roomCodeSchema,
  game: z.enum(GAME_IDS),
  state: z.enum(HUB_PHASES),
  players: z.array(lobbyPlayerSchema).max(MAX_PLAYERS),
  /** Player ids that voted to play again (results phase only). */
  votes: z.array(playerIdSchema).max(MAX_PLAYERS),
});

/** Split Ways per-player race status, sent at 5 Hz while playing. */
export const raceSchema = z.object({
  type: z.literal('race'),
  phase: z.enum(['countdown', 'racing', 'finished']),
  /** Seconds left in the countdown (3, 2, 1) or 0 once racing. */
  countdown: z.number().int().min(0).max(9),
  position: z.number().int().min(1).max(MAX_PLAYERS),
  playerCount: z.number().int().min(1).max(MAX_PLAYERS),
  lap: z.number().int().min(0).max(99),
  totalLaps: z.number().int().min(1).max(99),
  speedKph: z.number().min(0).max(999),
});

export const standingSchema = z.object({
  id: playerIdSchema,
  name: playerNameSchema,
  colour: colourSchema,
  place: z.number().int().min(1).max(MAX_PLAYERS),
  totalMs: z.number().int().nonnegative().nullable(),
  bestLapMs: z.number().int().nonnegative().nullable(),
});

/** Split Ways final standings, sent once when the race ends. */
export const resultsSchema = z.object({
  type: z.literal('results'),
  standings: z.array(standingSchema).max(MAX_PLAYERS),
});

export const hapticSchema = z.object({
  type: z.literal('haptic'),
  pattern: z.enum(['collision', 'start', 'finish']),
});

export const kickedSchema = z.object({
  type: z.literal('kicked'),
  reason: z.enum(['full']),
});

export const pingSchema = z.object({
  type: z.literal('ping'),
  t: timestamp,
});

export const tvMessageSchema = z.discriminatedUnion('type', [
  joinedSchema,
  lobbySchema,
  raceSchema,
  resultsSchema,
  hapticSchema,
  kickedSchema,
  pingSchema,
]);

export type JoinedMessage = z.infer<typeof joinedSchema>;
export type LobbyPlayer = z.infer<typeof lobbyPlayerSchema>;
export type LobbyMessage = z.infer<typeof lobbySchema>;
export type RaceMessage = z.infer<typeof raceSchema>;
export type Standing = z.infer<typeof standingSchema>;
export type ResultsMessage = z.infer<typeof resultsSchema>;
export type HapticPattern = z.infer<typeof hapticSchema>['pattern'];
export type KickReason = z.infer<typeof kickedSchema>['reason'];
export type TvMessage = z.infer<typeof tvMessageSchema>;

// ---------------------------------------------------------------------------
// TV-internal hub events (what the old relay server used to forward to the TV)
// ---------------------------------------------------------------------------

export type HubEvent =
  | { type: 'playerJoined'; playerId: string }
  | { type: 'playerLeft'; playerId: string }
  | { type: 'playerInput'; playerId: string; input: InputMessage }
  | { type: 'playerReady'; playerId: string; ready: boolean }
  | { type: 'playerVote'; playerId: string };

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function parseJson(raw: unknown): unknown {
  if (typeof raw !== 'string' || raw.length > 4096) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Parse a raw data channel payload from a pad. Returns null for anything malformed. */
export function parsePadMessage(raw: unknown): PadMessage | null {
  const result = padMessageSchema.safeParse(parseJson(raw));
  return result.success ? result.data : null;
}

/** Parse a raw data channel payload from the TV. Returns null for anything malformed. */
export function parseTvMessage(raw: unknown): TvMessage | null {
  const result = tvMessageSchema.safeParse(parseJson(raw));
  return result.success ? result.data : null;
}
