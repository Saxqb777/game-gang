import { describe, expect, it } from 'vitest';
import { fbm, valueNoise } from './noise';

describe('noise', () => {
  it('is deterministic and stays in 0..1', () => {
    for (let i = 0; i < 200; i++) {
      const x = i * 13.37 - 900;
      const z = i * -7.91 + 450;
      const v = fbm(x * 0.01, z * 0.01, 4);
      expect(v).toBe(fbm(x * 0.01, z * 0.01, 4));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is smooth: nearby points have nearby values', () => {
    for (let i = 0; i < 50; i++) {
      const x = i * 0.73;
      expect(Math.abs(valueNoise(x, 2.5) - valueNoise(x + 0.001, 2.5))).toBeLessThan(0.01);
    }
  });
});
