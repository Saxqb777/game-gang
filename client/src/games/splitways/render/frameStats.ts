/**
 * Frame-time statistics for the overlay, the benchmarks and telemetry. Node-safe and
 * allocation-free while recording: fixed histograms give exact percentiles over whole races and
 * 30-minute soaks without keeping a ring of frames.
 */
import { RESOLUTION } from '../config';

export interface FrameWindow {
  frames: number;
  /** Sum of the recorded rAF deltas (fractional ms). */
  durationMs: number;
  fpsAvg: number;
  /** Raw rAF delta percentiles and maximum (ms). */
  frameMsP50: number;
  frameMsP95: number;
  frameMsP99: number;
  frameMsMax: number;
  cpuMsP99: number;
  /** Null when no GPU timer sample was recorded. */
  gpuMsAvg: number | null;
  gpuMsP95: number | null;
  gpuMsP99: number | null;
  /** Frames whose rAF delta was above RESOLUTION.missedFactor intervals (1000 / min(60, refresh)). */
  missedFrames: number;
  scaleAvg: number;
  scaleMin: number;
  drawCallsAvg: number;
  trianglesAvg: number;
}

/** 0.1 ms buckets from 0 to 50 ms, plus one overflow bucket. */
const BUCKETS_PER_MS = 10;
const BUCKET_COUNT = 50 * BUCKETS_PER_MS;

/** A cumulative histogram with its count, sum and maximum. */
class Histogram {
  readonly counts = new Uint32Array(BUCKET_COUNT + 1);
  count = 0;
  sum = 0;
  max = 0;

  add(ms: number): void {
    const bucket = Math.min(BUCKET_COUNT, Math.max(0, Math.floor(ms * BUCKETS_PER_MS)));
    this.counts[bucket] = (this.counts[bucket] ?? 0) + 1;
    this.count++;
    this.sum += ms;
    if (ms > this.max) this.max = ms;
  }

  /**
   * The upper edge of the bucket holding the p-th sample, never above the maximum (so the value is
   * an upper bound that is still tight). A percentile in the overflow bucket reports the maximum.
   */
  percentile(p: number): number {
    if (this.count === 0) return 0;
    const rank = Math.max(1, Math.ceil(p * this.count));
    let seen = 0;
    for (let i = 0; i < BUCKET_COUNT; i++) {
      seen += this.counts[i] ?? 0;
      if (seen >= rank) return Math.min((i + 1) / BUCKETS_PER_MS, this.max);
    }
    return this.max;
  }

  clear(): void {
    this.counts.fill(0);
    this.count = 0;
    this.sum = 0;
    this.max = 0;
  }
}

class Accumulator {
  readonly raf = new Histogram();
  readonly cpu = new Histogram();
  readonly gpu = new Histogram();
  missed = 0;
  scaleSum = 0;
  scaleMin = Infinity;
  drawCallsSum = 0;
  trianglesSum = 0;

  record(
    rafMs: number,
    cpuMs: number,
    gpuMs: number | null,
    missed: boolean,
    scale: number,
    drawCalls: number,
    triangles: number,
  ): void {
    this.raf.add(rafMs);
    this.cpu.add(cpuMs);
    if (gpuMs !== null) this.gpu.add(gpuMs);
    if (missed) this.missed++;
    this.scaleSum += scale;
    if (scale < this.scaleMin) this.scaleMin = scale;
    this.drawCallsSum += drawCalls;
    this.trianglesSum += triangles;
  }

  snapshot(): FrameWindow {
    const frames = this.raf.count;
    const gpu = this.gpu;
    return {
      frames,
      durationMs: this.raf.sum,
      fpsAvg: this.raf.sum > 0 ? (frames * 1000) / this.raf.sum : 0,
      frameMsP50: this.raf.percentile(0.5),
      frameMsP95: this.raf.percentile(0.95),
      frameMsP99: this.raf.percentile(0.99),
      frameMsMax: this.raf.max,
      cpuMsP99: this.cpu.percentile(0.99),
      gpuMsAvg: gpu.count > 0 ? gpu.sum / gpu.count : null,
      gpuMsP95: gpu.count > 0 ? gpu.percentile(0.95) : null,
      gpuMsP99: gpu.count > 0 ? gpu.percentile(0.99) : null,
      missedFrames: this.missed,
      scaleAvg: frames > 0 ? this.scaleSum / frames : 0,
      scaleMin: frames > 0 ? this.scaleMin : 0,
      drawCallsAvg: frames > 0 ? this.drawCallsSum / frames : 0,
      trianglesAvg: frames > 0 ? this.trianglesSum / frames : 0,
    };
  }

  clear(): void {
    this.raf.clear();
    this.cpu.clear();
    this.gpu.clear();
    this.missed = 0;
    this.scaleSum = 0;
    this.scaleMin = Infinity;
    this.drawCallsSum = 0;
    this.trianglesSum = 0;
  }
}

/** Frame budget in ms: never shorter than 1/60 s, so a 120 Hz display still budgets 16.7 ms. */
export function frameIntervalMs(refreshHz: number): number {
  return 1000 / Math.min(60, Math.max(1, refreshHz));
}

/**
 * Two accumulators: the window (since resetWindow(), e.g. since GO) and the total (since
 * resetTotal(), e.g. a whole soak). Frames with a delta above RESOLUTION.hiccupMs (tab switches,
 * loads) are not recorded at all.
 */
export class FrameStats {
  private readonly window = new Accumulator();
  private readonly total = new Accumulator();
  private refresh = 60;

  record(
    rafMs: number,
    cpuMs: number,
    gpuMs: number | null,
    scale: number,
    drawCalls: number,
    triangles: number,
  ): void {
    if (!(rafMs > 0) || rafMs > RESOLUTION.hiccupMs) return;
    const missed = rafMs > RESOLUTION.missedFactor * frameIntervalMs(this.refresh);
    this.window.record(rafMs, cpuMs, gpuMs, missed, scale, drawCalls, triangles);
    this.total.record(rafMs, cpuMs, gpuMs, missed, scale, drawCalls, triangles);
  }

  snapshot(): FrameWindow {
    return this.window.snapshot();
  }

  snapshotTotal(): FrameWindow {
    return this.total.snapshot();
  }

  resetWindow(): void {
    this.window.clear();
  }

  resetTotal(): void {
    this.total.clear();
  }

  /** The display refresh, measured once on an idle page (measureRefreshHz in renderer.ts). */
  setRefreshHz(hz: number): void {
    if (hz > 0 && Number.isFinite(hz)) this.refresh = hz;
  }

  refreshHz(): number {
    return this.refresh;
  }
}

const COMMON_REFRESH_HZ = [30, 50, 60, 75, 90, 100, 120, 144];

/** Snap a median rAF delta to 30/50/60/75/90/100/120/144 Hz within 4%, else round(1000 / ms). */
export function snapRefreshHz(medianDeltaMs: number): number {
  if (!(medianDeltaMs > 0) || !Number.isFinite(medianDeltaMs)) return 60;
  const hz = 1000 / medianDeltaMs;
  for (const common of COMMON_REFRESH_HZ) {
    if (Math.abs(hz - common) <= common * 0.04) return common;
  }
  return Math.round(hz);
}
