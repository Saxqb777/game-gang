import { describe, expect, it } from 'vitest';
import {
  postTelemetryRequestSchema,
  type TelemetryDevice,
  type TelemetrySample,
} from '@gamergang/shared';
import { buildId, chunkSamples, sanitiseDevice, sanitiseSample } from './telemetry';

/** A sample as the game builds it from a FrameWindow: fractional sums and averages. */
function rawSample(overrides: Partial<TelemetrySample> = {}): TelemetrySample {
  return {
    kind: 'race',
    scenario: 'race',
    track: 'kestrel-pines',
    viewports: 4,
    preset: 'low',
    durationMs: 3 * 16.6667,
    frames: 3,
    fpsAvg: 59.99988,
    frameMsP50: 16.7,
    frameMsP95: 16.8,
    frameMsP99: 17.1,
    frameMsMax: 18.25,
    cpuMsP99: 4.2,
    gpuMsAvg: 9.81,
    gpuMsP95: 10.4,
    gpuMsP99: 11.2,
    missedFrames: 0,
    internalWidth: 816.4,
    internalHeight: 459.2,
    outputWidth: 958,
    outputHeight: 538,
    scaleAvg: 0.8512,
    scaleMin: 0.75,
    drawCallsAvg: 612.33,
    trianglesAvg: 1_912_345.5,
    presetDrops: 0,
    ...overrides,
  };
}

function rawDevice(overrides: Partial<TelemetryDevice> = {}): TelemetryDevice {
  return {
    userAgent: 'Mozilla/5.0 (Macintosh) Chrome/141',
    gpu: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)',
    cores: 8,
    memoryGb: 8,
    // screen.width 1707 x devicePixelRatio 1.5 (a 150% scaled 2560 px display).
    screenWidth: 1707 * 1.5,
    screenHeight: 960 * 1.5,
    devicePixelRatio: 1.5,
    refreshHz: 60,
    timerQuery: false,
    ...overrides,
  };
}

function request(samples: TelemetrySample[], device: TelemetryDevice) {
  return {
    room: 'BCDF',
    key: 'a'.repeat(32),
    session: 'abcdefgh12345678',
    build: buildId('0123456789ab'),
    device,
    samples,
  };
}

describe('telemetry sanitiser', () => {
  it('turns fractional ints and device pixels into a request the API accepts', () => {
    const raw = request([rawSample()], rawDevice());
    // zod rejects the raw values (fractional durationMs, internal size, screen width)...
    expect(postTelemetryRequestSchema.safeParse(raw).success).toBe(false);
    // ...and accepts them once sanitised.
    const clean = request([sanitiseSample(rawSample())], sanitiseDevice(rawDevice()));
    const parsed = postTelemetryRequestSchema.parse(clean);
    expect(parsed.samples[0]?.durationMs).toBe(50);
    expect(parsed.samples[0]?.internalWidth).toBe(816);
    expect(parsed.samples[0]?.fpsAvg).toBeCloseTo(59.99988, 5);
    expect(parsed.device.screenWidth).toBe(2561);
    expect(parsed.device.devicePixelRatio).toBe(1.5);
  });

  it('turns NaN and Infinity into null for nullable fields and 0 (then the range) otherwise', () => {
    const sample = sanitiseSample(
      rawSample({
        fpsAvg: Infinity,
        frameMsP99: NaN,
        gpuMsAvg: NaN,
        gpuMsP99: Infinity,
        internalWidth: NaN,
        drawCallsAvg: -Infinity,
      }),
    );
    expect(sample.fpsAvg).toBe(0);
    expect(sample.frameMsP99).toBe(0);
    expect(sample.gpuMsAvg).toBeNull();
    expect(sample.gpuMsP99).toBeNull();
    // 0 is below a pixel size's minimum of 1.
    expect(sample.internalWidth).toBe(1);
    expect(sample.drawCallsAvg).toBe(0);
    const device = sanitiseDevice(rawDevice({ refreshHz: NaN, memoryGb: Infinity, cores: NaN }));
    expect(device.refreshHz).toBeNull();
    expect(device.memoryGb).toBeNull();
    expect(device.cores).toBeNull();
    expect(postTelemetryRequestSchema.safeParse(request([sample], device)).success).toBe(true);
  });

  it('clamps out-of-range values and cleans the scenario name', () => {
    const sample = sanitiseSample(
      rawSample({ frameMsMax: 25_000, scaleAvg: 3, presetDrops: 14, scenario: 'Fly 4 LOW!' }),
    );
    expect(sample.frameMsMax).toBe(10_000);
    expect(sample.scaleAvg).toBe(2);
    expect(sample.presetDrops).toBe(10);
    expect(sample.scenario).toBe('fly-4-low-');
    const device = sanitiseDevice(rawDevice({ devicePixelRatio: 12, userAgent: 'x'.repeat(900) }));
    expect(device.devicePixelRatio).toBe(8);
    expect(device.userAgent).toHaveLength(512);
  });

  it('accepts only valid build ids', () => {
    expect(buildId('0123456789ab')).toBe('0123456789ab');
    expect(buildId(undefined)).toBeNull();
    expect(buildId('not a build id')).toBeNull();
    // Under Vitest the define from client/vite.config.ts is not applied.
    expect(buildId()).toBeNull();
  });
});

describe('telemetry chunking', () => {
  it('splits a 9-sample batch (the matrix benchmark) into requests of 8 and 1', () => {
    const samples = Array.from({ length: 9 }, (_, i) => rawSample({ scenario: `fly-${i}` }));
    const chunks = chunkSamples(samples);
    expect(chunks.map((c) => c.length)).toEqual([8, 1]);
    expect(chunks.flat()).toEqual(samples);
    expect(chunkSamples([])).toEqual([]);
    expect(chunkSamples(samples.slice(0, 8)).map((c) => c.length)).toEqual([8]);
  });
});
