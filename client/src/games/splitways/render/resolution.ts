/**
 * Dynamic resolution: picks the linear scale of every 3D view (1 = the tile size at the preset's
 * base scale) so the GPU fits in the frame. Node-safe. The scale never reallocates GPU memory: the
 * renderer draws sub-rectangles of targets allocated at scale 1, so a change costs nothing.
 *
 * With a GPU timer it steers on the median GPU time of the last few frames; without one it steers
 * on missed frames (rAF deltas well above the frame interval).
 */
import { RESOLUTION } from '../config';
import type { QualityPreset } from './quality';

const EPSILON = 1e-6;

/** Rounds away float noise so scales read 0.85, not 0.8500000001. */
function tidy(scale: number): number {
  return Math.round(scale * 1000) / 1000;
}

/** Down to the step grid (0.05). */
function quantiseDown(scale: number): number {
  return tidy(Math.floor(scale / RESOLUTION.step + EPSILON) * RESOLUTION.step);
}

export class ResolutionController {
  scale = 1;
  /** False pins the scale at 1 (debug key R, the loading benchmark). */
  enabled = true;
  private minScale: number;
  private readonly gpuSamples = new Float64Array(RESOLUTION.sampleWindow);
  private readonly sorted = new Float64Array(RESOLUTION.sampleWindow);
  private gpuCount = 0;
  private gpuNext = 0;
  /** Once a GPU timer sample arrives the controller steers on GPU time for good. */
  private gpuMode = false;
  private lastChangeAt = -Infinity;
  /** When the GPU median went under the raise threshold (null while it is above). */
  private lowSince: number | null = null;
  /** Fallback mode: which of the last 60 frames missed. */
  private readonly missedRing = new Uint8Array(60);
  private missedNext = 0;
  private missedInRing = 0;
  private lastMissAt = -Infinity;
  private statFrames = 0;
  private statFloor = 0;
  private statMissed = 0;

  constructor(preset: QualityPreset) {
    this.minScale = preset.minScale;
  }

  setPreset(preset: QualityPreset): void {
    this.minScale = preset.minScale;
    this.scale = Math.max(this.scale, this.minScale);
    this.clearHistory();
  }

  get floor(): number {
    return this.minScale;
  }

  /**
   * Once per frame, with the newest GPU timer result (null when none arrived this frame), the raw
   * rAF delta and the frame interval. Returns true when the scale changed.
   */
  update(now: number, gpuMs: number | null, rafMs: number, intervalMs: number): boolean {
    const counted = rafMs > 0 && rafMs <= RESOLUTION.hiccupMs;
    const missed = counted && rafMs > RESOLUTION.missedFactor * intervalMs;
    if (counted) {
      this.statFrames++;
      if (this.scale <= this.minScale + EPSILON) this.statFloor++;
      if (missed) this.statMissed++;
    }

    if (!this.enabled) {
      this.clearHistory();
      if (this.scale === 1) return false;
      this.scale = 1;
      return true;
    }

    if (gpuMs !== null && Number.isFinite(gpuMs)) {
      this.gpuMode = true;
      this.gpuSamples[this.gpuNext] = gpuMs;
      this.gpuNext = (this.gpuNext + 1) % this.gpuSamples.length;
      this.gpuCount = Math.min(this.gpuCount + 1, this.gpuSamples.length);
    }
    if (this.gpuMode) return this.updateGpu(now, intervalMs);
    return counted ? this.updateFallback(now, missed) : false;
  }

  private updateGpu(now: number, intervalMs: number): boolean {
    if (this.gpuCount < this.gpuSamples.length) return false;
    const median = this.gpuMedian();
    if (median > RESOLUTION.dropAboveShare * intervalMs) {
      this.lowSince = null;
      if (now - this.lastChangeAt < RESOLUTION.minChangeMs || this.scale <= this.minScale) {
        return false;
      }
      // GPU time scales roughly with pixel count, i.e. with scale squared.
      const target = RESOLUTION.targetShare * intervalMs;
      const wanted = quantiseDown(this.scale * Math.sqrt(target / median));
      const next = Math.max(this.minScale, Math.min(wanted, tidy(this.scale - RESOLUTION.step)));
      return this.change(now, next);
    }
    if (median < RESOLUTION.raiseBelowShare * intervalMs) {
      this.lowSince ??= now;
      if (this.scale < 1 && now - this.lowSince >= RESOLUTION.raiseAfterMs) {
        return this.change(now, Math.min(1, tidy(this.scale + RESOLUTION.step)));
      }
      return false;
    }
    this.lowSince = null;
    return false;
  }

  private updateFallback(now: number, missed: boolean): boolean {
    const old = this.missedRing[this.missedNext] ?? 0;
    this.missedRing[this.missedNext] = missed ? 1 : 0;
    this.missedNext = (this.missedNext + 1) % this.missedRing.length;
    this.missedInRing += (missed ? 1 : 0) - old;
    if (missed) this.lastMissAt = now;

    if (
      this.missedInRing >= RESOLUTION.fallbackMissedPer60 &&
      now - this.lastChangeAt >= RESOLUTION.fallbackMinChangeMs &&
      this.scale > this.minScale
    ) {
      return this.change(now, Math.max(this.minScale, tidy(this.scale - RESOLUTION.step)));
    }
    if (
      this.scale < 1 &&
      now - Math.max(this.lastMissAt, this.lastChangeAt) >= RESOLUTION.fallbackRaiseAfterMs
    ) {
      return this.change(now, Math.min(1, tidy(this.scale + RESOLUTION.step)));
    }
    return false;
  }

  private change(now: number, next: number): boolean {
    if (Math.abs(next - this.scale) < EPSILON) return false;
    this.scale = next;
    this.lastChangeAt = now;
    this.lowSince = null;
    // The misses that caused this change say nothing about the new scale.
    this.missedRing.fill(0);
    this.missedInRing = 0;
    return true;
  }

  private gpuMedian(): number {
    const n = this.gpuCount;
    const sorted = this.sorted;
    for (let i = 0; i < n; i++) sorted[i] = this.gpuSamples[i] ?? 0;
    // Insertion sort: 8 values, no allocation.
    for (let i = 1; i < n; i++) {
      const value = sorted[i] ?? 0;
      let j = i - 1;
      while (j >= 0 && (sorted[j] ?? 0) > value) {
        sorted[j + 1] = sorted[j] ?? 0;
        j--;
      }
      sorted[j + 1] = value;
    }
    const mid = n >> 1;
    return n % 2 === 1 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  }

  private clearHistory(): void {
    this.gpuCount = 0;
    this.gpuNext = 0;
    this.lowSince = null;
    this.missedRing.fill(0);
    this.missedInRing = 0;
  }

  /** Share of frames spent at the floor scale since resetStats(). */
  atFloorShare(): number {
    return this.statFrames > 0 ? this.statFloor / this.statFrames : 0;
  }

  /** Share of missed frames since resetStats(). */
  missedShare(): number {
    return this.statFrames > 0 ? this.statMissed / this.statFrames : 0;
  }

  resetStats(): void {
    this.statFrames = 0;
    this.statFloor = 0;
    this.statMissed = 0;
  }
}
