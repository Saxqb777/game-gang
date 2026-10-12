import { describe, expect, it } from 'vitest';
import { RESOLUTION } from '../config';
import { frameIntervalMs } from './frameStats';
import { getPreset } from './quality';
import { ResolutionController } from './resolution';

const FRAME = 1000 / 60;
const INTERVAL_60 = frameIntervalMs(60);

/** Runs `frames` frames of a GPU-timed controller from `start`; returns the time after the last. */
function runGpu(
  controller: ResolutionController,
  start: number,
  frames: number,
  gpuMs: number,
  intervalMs = INTERVAL_60,
): number {
  let now = start;
  for (let i = 0; i < frames; i++) {
    now += FRAME;
    controller.update(now, gpuMs, FRAME, intervalMs);
  }
  return now;
}

/** Fallback (no timer) frames with the given rAF delta. */
function runRaf(controller: ResolutionController, start: number, frames: number, rafMs: number) {
  let now = start;
  for (let i = 0; i < frames; i++) {
    now += rafMs;
    controller.update(now, null, rafMs, INTERVAL_60);
  }
  return now;
}

describe('ResolutionController with a GPU timer', () => {
  it('drops towards the target in one quantised step and holds within the hysteresis band', () => {
    const c = new ResolutionController(getPreset('high'));
    // 16 ms GPU at 60 Hz: above 0.88 x 16.7 = 14.7. Target 0.78 x 16.7 = 13 ms:
    // 1 x sqrt(13 / 16) = 0.901 -> 0.9.
    let now = runGpu(c, 0, 8, 16);
    expect(c.scale).toBeCloseTo(0.9, 5);
    // Still slow, but within 250 ms of the change: no second drop yet.
    now = runGpu(c, now, 10, 16);
    expect(c.scale).toBeCloseTo(0.9, 5);
    // Past 250 ms: 0.9 x sqrt(13 / 16) = 0.81 -> 0.8.
    now = runGpu(c, now, 10, 16);
    expect(c.scale).toBeCloseTo(0.8, 5);
    // 12 ms is between the raise (10.8) and drop (14.7) thresholds: holds for good.
    runGpu(c, now, 600, 12);
    expect(c.scale).toBeCloseTo(0.8, 5);
  });

  it('drops at least one step even when barely over budget, never below the floor', () => {
    const c = new ResolutionController(getPreset('low'));
    // 14.8 ms: sqrt(13 / 14.8) = 0.937 -> quantised 0.9 (more than one step).
    runGpu(c, 0, 8, 14.8);
    expect(c.scale).toBeCloseTo(0.9, 5);
    // Hopelessly slow: floor at low.minScale = 0.7.
    runGpu(c, 1000, 600, 40);
    expect(c.scale).toBeCloseTo(getPreset('low').minScale, 5);
  });

  it('raises one step only after 2 s continuously under the raise threshold', () => {
    const c = new ResolutionController(getPreset('high'));
    let now = runGpu(c, 0, 8, 20);
    const dropped = c.scale;
    expect(dropped).toBeLessThan(1);
    // 1.5 s fast, then one slow-ish frame burst inside the band resets the timer.
    now = runGpu(c, now, 90, 8);
    expect(c.scale).toBe(dropped);
    now = runGpu(c, now, 8, 12);
    now = runGpu(c, now, 100, 8);
    expect(c.scale).toBe(dropped);
    // A full 2 s under 10.8 ms: one step up.
    now = runGpu(c, now, 30, 8);
    expect(c.scale).toBeCloseTo(dropped + RESOLUTION.step, 5);
    // And another after 2 more seconds, up to 1.
    runGpu(c, now, 600, 8);
    expect(c.scale).toBe(1);
  });

  it('budgets 16.7 ms on a 120 Hz display: steady 60 fps is neither missed nor over budget', () => {
    const c = new ResolutionController(getPreset('high'));
    const interval = frameIntervalMs(120);
    expect(interval).toBeCloseTo(16.667, 3);
    // 12 ms GPU would be over an 8.3 ms (120 Hz) budget, but not over 16.7 ms.
    runGpu(c, 0, 600, 12, interval);
    expect(c.scale).toBe(1);
    expect(c.missedShare()).toBe(0);
  });

  it('pins the scale at 1 while disabled', () => {
    const c = new ResolutionController(getPreset('high'));
    runGpu(c, 0, 8, 20);
    expect(c.scale).toBeLessThan(1);
    c.enabled = false;
    expect(c.update(1000, 20, FRAME, INTERVAL_60)).toBe(true);
    runGpu(c, 1000, 120, 30);
    expect(c.scale).toBe(1);
  });
});

describe('ResolutionController without a timer', () => {
  it('drops a step after 3 missed frames in 60 and raises after 4 s without one', () => {
    const c = new ResolutionController(getPreset('medium'));
    let now = runRaf(c, 0, 60, FRAME);
    expect(c.scale).toBe(1);
    // Two misses (34 ms > 25 ms) are tolerated, the third drops.
    now = runRaf(c, now, 2, 34);
    expect(c.scale).toBe(1);
    now = runRaf(c, now, 1, 34);
    expect(c.scale).toBeCloseTo(0.95, 5);
    // Smooth 60 fps: one step back up after 4 s, not before.
    now = runRaf(c, now, 200, FRAME);
    expect(c.scale).toBeCloseTo(0.95, 5);
    runRaf(c, now, 60, FRAME);
    expect(c.scale).toBe(1);
  });

  it('waits 500 ms between drops and stops at the floor', () => {
    const c = new ResolutionController(getPreset('low'));
    // Every frame missed at 30 fps.
    let now = runRaf(c, 0, 3, 34);
    expect(c.scale).toBeCloseTo(0.95, 5);
    now = runRaf(c, now, 3, 34);
    expect(c.scale).toBeCloseTo(0.95, 5);
    runRaf(c, now, 600, 34);
    expect(c.scale).toBeCloseTo(getPreset('low').minScale, 5);
  });

  it('tracks the share of frames at the floor and missed since resetStats', () => {
    const c = new ResolutionController(getPreset('low'));
    const now = runRaf(c, 0, 600, 34);
    expect(c.missedShare()).toBe(1);
    expect(c.atFloorShare()).toBeGreaterThan(0.5);
    c.resetStats();
    expect(c.missedShare()).toBe(0);
    expect(c.atFloorShare()).toBe(0);
    // Smooth again, but not yet for the 4 s it takes to raise: still at the floor.
    runRaf(c, now, 10, FRAME);
    expect(c.missedShare()).toBe(0);
    expect(c.atFloorShare()).toBe(1);
  });
});
