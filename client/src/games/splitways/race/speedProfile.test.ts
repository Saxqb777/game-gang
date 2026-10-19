/**
 * Per-car speed profiles (C3.3): the reference limits reproduce the generator's stored plan bit for
 * bit (so Kestrel Pines and its tyre walls are unchanged), and the plan responds the right way to
 * grip and top speed.
 */
import { CAR_IDS } from '@gamergang/shared';
import { describe, expect, it } from 'vitest';
import base from '../../../../../assets/tracks/kestrel-pines/base.layout.json';
import overrides from '../../../../../assets/tracks/kestrel-pines/overrides.json';
import { REFERENCE_SPEC, resolveCarSpec, type CarSpec } from '../sim/carSpec';
import { BARRIER } from '../track/surfaces';
import { REFERENCE_LIMITS, speedProfile, type SpeedLimits } from '../track/gen/racingLine';
import { buildTrack } from '../track/tracks';
import { carSpeedLimits, carSpeedProfile } from './speedProfile';

const track = buildTrack(base, overrides);
const { definition } = track;

/** Order-sensitive fingerprint of an array of numbers (rounded to 0.1 mm/s). */
function fingerprint(values: ArrayLike<number>): number {
  let hash = 0;
  for (let i = 0; i < values.length; i++) {
    hash = (hash * 31 + Math.round((values[i] as number) * 1e4)) % 2_147_483_647;
  }
  return hash;
}

/** How many stations carry a tyre wall, and where (fingerprint of their indices). */
function tyreWalls(barrier: Uint8Array): [number, number] {
  let count = 0;
  let hash = 0;
  barrier.forEach((b, i) => {
    if (b !== BARRIER.tyres) return;
    count++;
    hash = (hash * 31 + i) % 2_147_483_647;
  });
  return [count, hash];
}

function sum(values: Float32Array): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

function withLimits(change: Partial<SpeedLimits>): Float32Array {
  return speedProfile(definition.lineCurvature, definition.spacing, {
    ...REFERENCE_LIMITS,
    ...change,
  });
}

describe('speed profile', () => {
  it('reproduces the stored reference plan exactly from the reference limits', () => {
    expect(speedProfile(definition.lineCurvature, definition.spacing, REFERENCE_LIMITS)).toEqual(
      definition.speed,
    );
    expect(carSpeedLimits(REFERENCE_SPEC)).toEqual(REFERENCE_LIMITS);
    expect(carSpeedProfile(track, REFERENCE_SPEC)).toEqual(definition.speed);
  });

  // Fingerprints of the M8 generator's output (taken before the speed passes moved out of
  // buildRacingLine): the plan and the tyre walls planned from it must not move.
  it('leaves Kestrel Pines and its tyre walls as they were', () => {
    expect(definition.count).toBe(3359);
    expect(fingerprint(definition.speed)).toBe(682_200_233);
    expect(tyreWalls(definition.left.barrier)).toEqual([254, 212_588_401]);
    expect(tyreWalls(definition.right.barrier)).toEqual([614, 1_801_499_902]);
  });

  it('is faster everywhere with more grip or a higher top speed', () => {
    const reference = definition.speed;
    for (const faster of [
      withLimits({ lateralAccel: REFERENCE_LIMITS.lateralAccel * 1.05 }),
      withLimits({
        vMax: REFERENCE_LIMITS.vMax * 1.05,
        topSpeed: REFERENCE_LIMITS.topSpeed * 1.05,
      }),
    ]) {
      for (let i = 0; i < reference.length; i++) {
        expect(faster[i]).toBeGreaterThanOrEqual(reference[i] as number);
      }
      expect(sum(faster)).toBeGreaterThan(sum(reference));
    }
    const slower = withLimits({ lateralAccel: REFERENCE_LIMITS.lateralAccel * 0.95 });
    for (let i = 0; i < reference.length; i++) {
      expect(slower[i]).toBeLessThanOrEqual(reference[i] as number);
    }
  });

  it('plans each car with its own limits', () => {
    const spec = (id: (typeof CAR_IDS)[number]): CarSpec => resolveCarSpec(id);
    for (const id of CAR_IDS) {
      const limits = carSpeedLimits(spec(id));
      expect(limits.force).toBe(spec(id).engine.force);
      expect(limits.curve).toBe(spec(id).engine.curve);
      const profile = carSpeedProfile(track, spec(id));
      expect(profile).toHaveLength(definition.count);
      expect(profile.every((v) => Number.isFinite(v) && v > 0)).toBe(true);
    }
    // The planned top speed follows the car's engine.
    const vMax = (id: (typeof CAR_IDS)[number]) => carSpeedLimits(spec(id)).vMax;
    expect(vMax('haymaker')).toBeGreaterThan(vMax('nightjar'));
    expect(vMax('scree')).toBeLessThan(vMax('nightjar'));
  });
});
