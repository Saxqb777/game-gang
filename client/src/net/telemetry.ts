/**
 * Performance telemetry from the TV: frame-time samples plus a description of the machine, posted to
 * /api/telemetry with the room's host key. Node-safe at import time (no DOM access outside
 * functions), so the sanitiser and chunking are unit-tested in Node.
 */
import {
  TELEMETRY_MAX_SAMPLES,
  type PostTelemetryRequest,
  type TelemetryDevice,
  type TelemetrySample,
} from '@gamergang/shared';
import { api } from './api';

/** What the game's renderer knows about this machine. */
export interface RendererInfo {
  refreshHz: number;
  timerQuery: boolean;
  gpu: string | null;
}

export interface TelemetryClient {
  /** Posts the samples now (in chunks of TELEMETRY_MAX_SAMPLES), or keeps them until the room is known. */
  sendSamples(samples: readonly TelemetrySample[]): void;
  /** Keeps samples for the next send or beacon without posting them. */
  queue(samples: readonly TelemetrySample[]): void;
  /** The page is closing: whatever is still queued goes out by sendBeacon. */
  flushBeacon(): void;
}

interface Range {
  min: number;
  max: number;
  int?: boolean;
}

/** zod rejects NaN, Infinity, fractional ints and out-of-range values, and one bad sample fails the request. */
function num(value: number, range: Range): number;
function num(value: number | null, range: Range, nullable: true): number | null;
function num(value: number | null, range: Range, nullable = false): number | null {
  if (value === null || !Number.isFinite(value)) return nullable ? null : clamp(0, range);
  return clamp(range.int ? Math.round(value) : value, range);
}

function clamp(value: number, range: Range): number {
  return Math.min(range.max, Math.max(range.min, value));
}

const MS: Range = { min: 0, max: 10_000 };
const PX: Range = { min: 1, max: 16_384, int: true };
const COUNT: Range = { min: 0, max: 10_000_000, int: true };

export function sanitiseSample(raw: TelemetrySample): TelemetrySample {
  const scenario = raw.scenario
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .slice(0, 32);
  return {
    kind: raw.kind,
    scenario: scenario.length > 0 ? scenario : 'unknown',
    track: raw.track,
    viewports: num(raw.viewports, { min: 1, max: 4, int: true }),
    preset: raw.preset,
    durationMs: num(raw.durationMs, { min: 0, max: 4 * 3_600_000, int: true }),
    frames: num(raw.frames, COUNT),
    fpsAvg: num(raw.fpsAvg, { min: 0, max: 1000 }),
    frameMsP50: num(raw.frameMsP50, MS),
    frameMsP95: num(raw.frameMsP95, MS),
    frameMsP99: num(raw.frameMsP99, MS),
    frameMsMax: num(raw.frameMsMax, MS),
    cpuMsP99: num(raw.cpuMsP99, MS),
    gpuMsAvg: num(raw.gpuMsAvg, MS, true),
    gpuMsP95: num(raw.gpuMsP95, MS, true),
    gpuMsP99: num(raw.gpuMsP99, MS, true),
    missedFrames: num(raw.missedFrames, COUNT),
    internalWidth: num(raw.internalWidth, PX),
    internalHeight: num(raw.internalHeight, PX),
    outputWidth: num(raw.outputWidth, PX),
    outputHeight: num(raw.outputHeight, PX),
    scaleAvg: num(raw.scaleAvg, { min: 0, max: 2 }),
    scaleMin: num(raw.scaleMin, { min: 0, max: 2 }),
    drawCallsAvg: num(raw.drawCallsAvg, { min: 0, max: 100_000 }),
    trianglesAvg: num(raw.trianglesAvg, { min: 0, max: 100_000_000 }),
    presetDrops: num(raw.presetDrops, { min: 0, max: 10, int: true }),
  };
}

export function sanitiseDevice(raw: TelemetryDevice): TelemetryDevice {
  return {
    userAgent: raw.userAgent.slice(0, 512),
    gpu: raw.gpu === null ? null : raw.gpu.slice(0, 256),
    cores: num(raw.cores, { min: 1, max: 256, int: true }, true),
    memoryGb: num(raw.memoryGb, { min: 0, max: 1024 }, true),
    screenWidth: num(raw.screenWidth, PX),
    screenHeight: num(raw.screenHeight, PX),
    devicePixelRatio: num(raw.devicePixelRatio, { min: 0.25, max: 8 }),
    refreshHz: num(raw.refreshHz, { min: 1, max: 500 }, true),
    timerQuery: raw.timerQuery,
  };
}

/** Splits a batch into requests of at most `size` samples (the API's per-request cap). */
export function chunkSamples<T>(
  samples: readonly T[],
  size: number = TELEMETRY_MAX_SAMPLES,
): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < samples.length; i += size) chunks.push(samples.slice(i, i + size));
  return chunks;
}

/** The commit this build came from (client/vite.config.ts), if it is a valid id. */
export function buildId(value: string | undefined = import.meta.env.VITE_BUILD_ID): string | null {
  return value !== undefined && /^[A-Za-z0-9._-]{1,40}$/.test(value) ? value : null;
}

let sessionId: string | null = null;

/** One random id per page load, so one TV session's samples can be read together. */
function session(): string {
  if (sessionId) return sessionId;
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  sessionId = Array.from(bytes, (b) => alphabet.charAt(b % alphabet.length)).join('');
  return sessionId;
}

/** This machine, in device pixels. Browser only. */
function describeDevice(info: RendererInfo): TelemetryDevice {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const dpr = window.devicePixelRatio || 1;
  return sanitiseDevice({
    userAgent: nav.userAgent,
    gpu: info.gpu,
    cores: nav.hardwareConcurrency || null,
    memoryGb: nav.deviceMemory ?? null,
    screenWidth: screen.width * dpr,
    screenHeight: screen.height * dpr,
    devicePixelRatio: dpr,
    refreshHz: info.refreshHz,
    timerQuery: info.timerQuery,
  });
}

export function createTelemetryClient(
  hub: { roomCredentials(): { code: string; hostKey: string } | null },
  rendererInfo: () => RendererInfo | null,
): TelemetryClient {
  let pending: TelemetrySample[] = [];
  let device: TelemetryDevice | null = null;

  /** Credentials are read at send time: the room can change after a lost-room recovery. */
  function requests(): PostTelemetryRequest[] {
    const credentials = hub.roomCredentials();
    if (!credentials || pending.length === 0) return [];
    const info = rendererInfo();
    if (!device && info) device = describeDevice(info);
    if (!device) return [];
    const base = { room: credentials.code, key: credentials.hostKey, session: session() };
    const build = buildId();
    const out = chunkSamples(pending).map((samples) => ({
      ...base,
      build,
      device: device as TelemetryDevice,
      samples,
    }));
    pending = [];
    return out;
  }

  return {
    sendSamples(samples) {
      pending.push(...samples.map(sanitiseSample));
      for (const body of requests()) {
        api.postTelemetry(body).catch((error: unknown) => {
          console.warn('[telemetry] could not send samples', error);
        });
      }
    },
    queue(samples) {
      pending.push(...samples.map(sanitiseSample));
    },
    flushBeacon() {
      for (const body of requests()) api.beaconTelemetry(body);
    },
  };
}
