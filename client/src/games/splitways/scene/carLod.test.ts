import { describe, expect, it } from 'vitest';
import { CAR_LOD } from '../config';
import { chooseLod, projectedDiameterPx, type CarLod } from './carLod';

const { lod0MinPx: L0, lod1MinPx: L1, hysteresis: H } = CAR_LOD;

describe('chooseLod', () => {
  it('picks the level from the thresholds once clearly past them', () => {
    expect(chooseLod(2, L0 * 2, 0)).toBe(0);
    expect(chooseLod(2, (L0 + L1) / 2, 0)).toBe(1);
    expect(chooseLod(0, L1 / 2, 0)).toBe(2);
    expect(chooseLod(0, (L0 + L1) / 2, 0)).toBe(1);
    expect(chooseLod(1, L0 * 3, 0)).toBe(0);
  });

  it('steps to more detail only once the hysteresis share above a threshold', () => {
    expect(chooseLod(1, L0 * (1 + H) - 0.01, 0)).toBe(1);
    expect(chooseLod(1, L0 * (1 + H), 0)).toBe(0);
    expect(chooseLod(2, L1 * (1 + H) - 0.01, 0)).toBe(2);
    expect(chooseLod(2, L1 * (1 + H), 0)).toBe(1);
  });

  it('steps to less detail only once the hysteresis share below a threshold', () => {
    expect(chooseLod(0, L0 * (1 - H), 0)).toBe(0);
    expect(chooseLod(0, L0 * (1 - H) - 0.01, 0)).toBe(1);
    expect(chooseLod(1, L1 * (1 - H), 0)).toBe(1);
    expect(chooseLod(1, L1 * (1 - H) - 0.01, 0)).toBe(2);
  });

  it('never draws a level more detailed than the floor', () => {
    expect(chooseLod(2, L0 * 10, 1)).toBe(1);
    expect(chooseLod(0, L0 * 10, 1)).toBe(1);
    expect(chooseLod(1, L1 / 10, 1)).toBe(2);
    expect(chooseLod(0, L0 * 10, 0)).toBe(0);
  });

  it('does not flip every frame for a car exactly on a threshold', () => {
    for (const size of [L0, L1]) {
      for (const start of [0, 1, 2] as CarLod[]) {
        let level = chooseLod(start, size, 0);
        const settled = level;
        for (let frame = 0; frame < 10; frame++) {
          level = chooseLod(level, size, 0);
          expect(level).toBe(settled);
        }
      }
    }
    // Wobbling a little either side of a threshold keeps the level too.
    let level: CarLod = 1;
    for (let frame = 0; frame < 20; frame++) {
      level = chooseLod(level, L0 * (frame % 2 ? 1.05 : 0.95), 0);
      expect(level).toBe(1);
    }
  });
});

describe('projectedDiameterPx', () => {
  it('follows the spec formula and shrinks with distance', () => {
    const near = projectedDiameterPx(2.5, 6, 57, 1080);
    expect(near).toBeCloseTo((5 / (12 * Math.tan((57 * Math.PI) / 360))) * 1080, 6);
    expect(projectedDiameterPx(2.5, 12, 57, 1080)).toBeCloseTo(near / 2, 6);
  });
});
