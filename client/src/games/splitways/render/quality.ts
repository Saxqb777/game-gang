/**
 * Quality presets and the session memory that picks the next race's preset. Node-safe.
 *
 * Each race mounts a new game and a new WebGL renderer, so what the last race learned (it ran at the
 * resolution floor, or missed frames) lives here at module level, mirrored to sessionStorage so a
 * reload of the TV page keeps it. Presets only change before a race starts, never during one.
 */
import type { RenderPreset } from '@gamergang/shared';
import { PRESETS, RESOLUTION } from '../config';

export type PresetId = RenderPreset;

export interface QualityPreset {
  id: PresetId;
  /** Cap on the summed internal pixels of all viewports at scale 1. */
  maxInternalPixels: number;
  /** Dynamic-resolution floor (linear). */
  minScale: number;
  msaa: 0 | 2 | 4;
  bloomLevels: 3 | 4;
  shadow:
    | { kind: 'sun'; mapSize: 1024 | 2048; far: number }
    | { kind: 'focus'; mapSize: 1024 | 2048; extent: number };
  shadowRadius: number;
  anisotropy: number;
  /** Upscale sharpening in stops: 0 = strongest, each +1 halves it. Off is a renderer uniform. */
  sharpness: number;
  /** Share of placed pines drawn, 0..1. */
  vegetationDensity: number;
  pineShadows: boolean;
  /** Chase and overview camera far plane (m). */
  cameraFar: number;
}

export interface RaceRenderOutcome {
  atFloorShare: number;
  missedShare: number;
}

export const PRESET_ORDER: readonly PresetId[] = ['high', 'medium', 'low'];

const PRESET_TABLE: Record<PresetId, QualityPreset> = {
  high: { id: 'high', ...PRESETS.high },
  medium: { id: 'medium', ...PRESETS.medium },
  low: { id: 'low', ...PRESETS.low },
};

export function getPreset(id: PresetId): QualityPreset {
  return PRESET_TABLE[id];
}

/** One step down; low stays low. */
export function lowerPreset(id: PresetId): PresetId {
  const index = PRESET_ORDER.indexOf(id);
  return PRESET_ORDER[Math.min(index + 1, PRESET_ORDER.length - 1)] ?? 'low';
}

/** 1 player high, 2 medium, 3-4 low. The 3-player overview cell does not count as a player. */
export function presetForPlayers(count: number): PresetId {
  if (count <= 1) return 'high';
  if (count === 2) return 'medium';
  return 'low';
}

const STORAGE_KEY = 'gamergang.splitways.quality';

interface SessionMemory {
  playerCount: number;
  drops: number;
}

let memory: SessionMemory | null = null;

function storage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    // Blocked storage (privacy settings) throws on access.
    return null;
  }
}

function load(): SessionMemory {
  if (memory) return memory;
  memory = { playerCount: 0, drops: 0 };
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SessionMemory>;
      if (typeof parsed.playerCount === 'number' && typeof parsed.drops === 'number') {
        memory = {
          playerCount: parsed.playerCount,
          drops: Math.max(0, Math.min(PRESET_ORDER.length - 1, Math.round(parsed.drops))),
        };
      }
    }
  } catch {
    // Unreadable memory just means a fresh start.
  }
  return memory;
}

function save(state: SessionMemory): void {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota or privacy errors: the memory still works for this page load.
  }
}

/** The memory for this player count; a different count starts again from zero drops. */
function memoryFor(count: number): SessionMemory {
  const state = load();
  if (state.playerCount !== count) {
    state.playerCount = count;
    state.drops = 0;
    save(state);
  }
  return state;
}

function lowered(id: PresetId, steps: number): PresetId {
  let preset = id;
  for (let i = 0; i < steps; i++) preset = lowerPreset(preset);
  return preset;
}

/** The preset for players by count, lowered by the drops this session has earned. */
export function startingPreset(count: number): PresetId {
  return lowered(presetForPlayers(count), memoryFor(count).drops);
}

/** Counts a drop only if it changes the preset (a session already on low never counts one). */
function addDrop(count: number): void {
  const state = memoryFor(count);
  if (startingPreset(count) === 'low') return;
  state.drops++;
  save(state);
}

/** After a race: the next race starts one preset lower if this one struggled. */
export function recordRaceOutcome(count: number, outcome: RaceRenderOutcome): void {
  if (
    outcome.atFloorShare > RESOLUTION.dropIfFloorShare ||
    outcome.missedShare > RESOLUTION.dropIfMissedShare
  ) {
    addDrop(count);
  } else {
    memoryFor(count);
  }
}

/** The loading benchmark dropped one preset (never below low). */
export function noteLoadingDrop(count: number): void {
  addDrop(count);
}

/** Effective drops for the current player count. */
export function sessionDrops(): number {
  return load().drops;
}

/** Forget everything (tests). */
export function resetQualitySession(): void {
  memory = { playerCount: 0, drops: 0 };
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to forget.
  }
}
