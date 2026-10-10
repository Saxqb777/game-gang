import { describe, expect, it } from 'vitest';
import { FrameStats, frameIntervalMs, snapRefreshHz } from './frameStats';

function feed(stats: FrameStats, count: number, raf: number, cpu = 4, gpu: number | null = 8) {
  for (let i = 0; i < count; i++) stats.record(raf, cpu, gpu, 1, 500, 1e6);
}

describe('FrameStats', () => {
  it('takes percentiles from the histogram (bucket upper edge, never above the maximum)', () => {
    const stats = new FrameStats();
    // 1, 2, ... 40 ms rAF; CPU and GPU a tenth of that.
    for (let ms = 1; ms <= 40; ms++) stats.record(ms, ms / 10, ms / 10, 1, 10, 100);
    const w = stats.snapshot();
    expect(w.frames).toBe(40);
    expect(w.frameMsP50).toBeCloseTo(20.1, 5);
    expect(w.frameMsP95).toBeCloseTo(38.1, 5);
    // The bucket edge (40.1) is above the largest frame, so the maximum is reported.
    expect(w.frameMsP99).toBe(40);
    expect(w.frameMsMax).toBe(40);
    expect(w.cpuMsP99).toBe(4);
    expect(w.gpuMsP95).toBeCloseTo(3.9, 5);
    expect(w.gpuMsAvg).toBeCloseTo(2.05, 5);
    expect(w.durationMs).toBe(820);
    expect(w.fpsAvg).toBeCloseTo(40 / 0.82, 5);
  });

  it('reports the maximum for a percentile in the overflow bucket (over 50 ms)', () => {
    const stats = new FrameStats();
    feed(stats, 98, 16.7);
    stats.record(80, 4, 8, 1, 1, 1);
    stats.record(120, 4, 8, 1, 1, 1);
    const w = stats.snapshot();
    // 16.7 ms sits in the 16.7-16.8 bucket: its upper edge is reported.
    expect(w.frameMsP50).toBeCloseTo(16.8, 5);
    expect(w.frameMsP99).toBe(120);
    expect(w.missedFrames).toBe(2);
  });

  it('gives exact p99 over a whole race when the slow frames all came first', () => {
    const stats = new FrameStats();
    // 3600 frames: the first 60 are slow on CPU and GPU, outside any "last 600 frames" window.
    for (let i = 0; i < 60; i++) stats.record(16.7, 14.2, 15.3, 1, 600, 2e6);
    for (let i = 0; i < 3540; i++) stats.record(16.7, 3.1, 7.4, 1, 600, 2e6);
    const w = stats.snapshot();
    expect(w.frames).toBe(3600);
    // 60 slow of 3600 = 1.67% > 1%, so p99 is a slow frame.
    expect(w.cpuMsP99).toBeCloseTo(14.2, 5);
    expect(w.gpuMsP99).toBeCloseTo(15.3, 5);
    expect(w.frameMsP99).toBeCloseTo(16.7, 5);
    expect(w.missedFrames).toBe(0);
  });

  it('reports null GPU stats without timer samples', () => {
    const stats = new FrameStats();
    feed(stats, 10, 16.7, 4, null);
    const w = stats.snapshot();
    expect(w.gpuMsAvg).toBeNull();
    expect(w.gpuMsP95).toBeNull();
    expect(w.gpuMsP99).toBeNull();
    expect(w.cpuMsP99).toBe(4);
  });

  it('resets the window and the total independently', () => {
    const stats = new FrameStats();
    feed(stats, 30, 16.7);
    stats.resetWindow();
    feed(stats, 10, 20);
    expect(stats.snapshot().frames).toBe(10);
    expect(stats.snapshotTotal().frames).toBe(40);
    stats.resetTotal();
    feed(stats, 5, 16.7);
    expect(stats.snapshot().frames).toBe(15);
    expect(stats.snapshotTotal().frames).toBe(5);
  });

  it('ignores hiccups (tab switches) and empty deltas', () => {
    const stats = new FrameStats();
    feed(stats, 5, 16.7);
    stats.record(400, 4, 8, 1, 1, 1);
    stats.record(0, 4, 8, 1, 1, 1);
    expect(stats.snapshot().frames).toBe(5);
    expect(stats.snapshot().frameMsMax).toBeCloseTo(16.7, 5);
  });

  it('counts missed frames against min(60, refresh): 25 ms at 60 Hz, 30 ms at 50 Hz', () => {
    const at60 = new FrameStats();
    at60.setRefreshHz(60);
    for (const raf of [16.7, 24.9, 25.1, 33.4]) at60.record(raf, 1, null, 1, 1, 1);
    expect(at60.snapshot().missedFrames).toBe(2);

    const at50 = new FrameStats();
    at50.setRefreshHz(50);
    for (const raf of [20, 25.1, 29.9, 30.1, 40]) at50.record(raf, 1, null, 1, 1, 1);
    expect(at50.snapshot().missedFrames).toBe(2);

    // A 120 Hz display still budgets 16.7 ms: steady 60 fps frames are not missed.
    const at120 = new FrameStats();
    at120.setRefreshHz(120);
    feed(at120, 100, 16.7);
    expect(at120.snapshot().missedFrames).toBe(0);
  });

  it('averages scale, draw calls and triangles and keeps the minimum scale', () => {
    const stats = new FrameStats();
    stats.record(16.7, 4, 8, 1, 400, 1e6);
    stats.record(16.7, 4, 8, 0.8, 600, 3e6);
    const w = stats.snapshot();
    expect(w.scaleAvg).toBeCloseTo(0.9, 5);
    expect(w.scaleMin).toBeCloseTo(0.8, 5);
    expect(w.drawCallsAvg).toBe(500);
    expect(w.trianglesAvg).toBe(2e6);
  });
});

describe('refresh rate', () => {
  it('snaps a median rAF delta to common display rates within 4%', () => {
    expect(snapRefreshHz(16.67)).toBe(60);
    expect(snapRefreshHz(16.3)).toBe(60);
    expect(snapRefreshHz(20.1)).toBe(50);
    expect(snapRefreshHz(8.33)).toBe(120);
    expect(snapRefreshHz(6.94)).toBe(144);
    expect(snapRefreshHz(33.4)).toBe(30);
    expect(snapRefreshHz(13.33)).toBe(75);
    // 1000 / 12.5 = 80 Hz is not a common rate: rounded.
    expect(snapRefreshHz(12.5)).toBe(80);
    expect(snapRefreshHz(0)).toBe(60);
  });

  it('never budgets for more than 60 Hz', () => {
    expect(frameIntervalMs(60)).toBeCloseTo(16.667, 3);
    expect(frameIntervalMs(120)).toBeCloseTo(16.667, 3);
    expect(frameIntervalMs(50)).toBeCloseTo(20, 5);
  });
});
