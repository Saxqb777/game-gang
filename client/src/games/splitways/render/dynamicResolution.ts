import { RENDER } from '../config';

/** A raise that is followed by a slow second this soon counts as a failed raise. */
const FAILED_RAISE_MS = 3000;
/** A gap this long between frames is a tab switch or a load, not the GPU struggling. */
const HICCUP_MS = 250;

/**
 * Holds 60 fps by lowering the 3D render scale when a second runs slow, and raising it again after
 * a stretch of smooth seconds. Raises that fail double the wait before the next try.
 */
export class DynamicResolution {
  scale = 1;
  enabled = true;
  private windowStart = 0;
  private frames = 0;
  private lastFrame = 0;
  private longestGap = 0;
  private smoothSince = 0;
  private raisedAt = -Infinity;
  private recoverMs = RENDER.dynamicResolution.recoverSeconds * 1000;

  /** Call once per frame. Returns true when the scale changed. */
  update(now: number): boolean {
    if (this.lastFrame > 0) this.longestGap = Math.max(this.longestGap, now - this.lastFrame);
    this.lastFrame = now;
    if (this.windowStart === 0) {
      this.windowStart = now;
      this.smoothSince = now;
      return false;
    }
    this.frames++;
    const elapsed = now - this.windowStart;
    if (elapsed < 1000) return false;
    const fps = (this.frames * 1000) / elapsed;
    const hiccup = this.longestGap > HICCUP_MS;
    this.windowStart = now;
    this.frames = 0;
    this.longestGap = 0;
    if (!this.enabled || hiccup) {
      this.smoothSince = now;
      return false;
    }

    const { minScale, step, lowFps } = RENDER.dynamicResolution;
    if (fps < lowFps) {
      this.smoothSince = now;
      if (now - this.raisedAt < FAILED_RAISE_MS)
        this.recoverMs = Math.min(this.recoverMs * 2, 60_000);
      if (this.scale <= minScale) return false;
      this.scale = Math.max(minScale, Math.round((this.scale - step) * 100) / 100);
      return true;
    }
    if (fps < 58) {
      this.smoothSince = now;
      return false;
    }
    if (this.scale < 1 && now - this.smoothSince >= this.recoverMs) {
      this.scale = Math.min(1, Math.round((this.scale + step) * 100) / 100);
      this.smoothSince = now;
      this.raisedAt = now;
      return true;
    }
    return false;
  }

  /** Back to full resolution (debug toggle). */
  reset(): void {
    this.scale = 1;
    this.smoothSince = this.lastFrame;
  }
}
