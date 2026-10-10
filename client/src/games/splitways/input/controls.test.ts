import { describe, expect, it } from 'vitest';
import { DRAG, dragSteer, featherThrottle, quantiseThrottle, shapeSteer } from './controls';

describe('dragSteer', () => {
  const height = 390;

  it('reaches full lock after a quarter of the screen height', () => {
    expect(DRAG.fullLockTravel).toBe(0.25);
    expect(dragSteer(0.25 * height, height)).toBe(1);
    expect(dragSteer(-0.25 * height, height)).toBe(-1);
  });

  it('is linear and signed: right is positive', () => {
    expect(dragSteer(0, height)).toBe(0);
    expect(dragSteer(0.125 * height, height)).toBeCloseTo(0.5, 10);
    expect(dragSteer(-0.05 * height, height)).toBeCloseTo(-0.2, 10);
  });

  it('clamps beyond full lock', () => {
    expect(dragSteer(height, height)).toBe(1);
    expect(dragSteer(-height, height)).toBe(-1);
  });

  it('honours a custom travel share and survives a zero height', () => {
    expect(dragSteer(50, 100, 0.5)).toBe(1);
    expect(dragSteer(10, 0)).toBe(0);
  });
});

describe('shapeSteer', () => {
  const dz = 0.05;
  const gamma = 1.5;

  it('is zero inside the dead zone', () => {
    for (const x of [0, 0.01, -0.03, dz, -dz]) expect(shapeSteer(x, dz, gamma)).toBe(0);
  });

  it('is continuous at the dead-zone edge', () => {
    expect(shapeSteer(dz + 1e-6, dz, gamma)).toBeLessThan(1e-6);
    expect(shapeSteer(-(dz + 1e-6), dz, gamma)).toBeGreaterThan(-1e-6);
  });

  it('is monotonic and odd', () => {
    let previous = -Infinity;
    for (let x = -1; x <= 1.0001; x += 0.01) {
      const y = shapeSteer(x, dz, gamma);
      expect(y).toBeGreaterThanOrEqual(previous);
      expect(shapeSteer(-x, dz, gamma)).toBeCloseTo(-y, 12);
      previous = y;
    }
  });

  it('reaches ±1 at the ends and stays there', () => {
    expect(shapeSteer(1, dz, gamma)).toBe(1);
    expect(shapeSteer(-1, dz, gamma)).toBe(-1);
    expect(shapeSteer(1.4, dz, gamma)).toBe(1);
  });

  it('is softer than linear around the centre with gamma above 1', () => {
    expect(shapeSteer(0.5, dz, gamma)).toBeLessThan(0.5);
  });
});

describe('featherThrottle', () => {
  const pedal = 240;

  it('is full throttle where the thumb lands, and above it', () => {
    expect(featherThrottle(0, pedal)).toBe(1);
    expect(featherThrottle(-60, pedal)).toBe(1);
  });

  it('lifts off completely after 30% of the pedal height', () => {
    expect(DRAG.featherTravel).toBe(0.3);
    expect(featherThrottle(0.3 * pedal, pedal)).toBe(0);
    expect(featherThrottle(pedal, pedal)).toBe(0);
  });

  it('is about half at 15% travel', () => {
    expect(featherThrottle(0.15 * pedal, pedal)).toBe(0.5);
  });

  it('only returns 0.05 steps, and snaps less than one step to off', () => {
    for (let dy = 0; dy <= 0.3 * pedal; dy += 0.37) {
      const value = featherThrottle(dy, pedal);
      expect(Math.abs(value * 20 - Math.round(value * 20))).toBeLessThan(1e-9);
      expect(String(value).length).toBeLessThanOrEqual(4);
    }
    // 1 - 0.97 = 0.03: under one step, so off rather than rounded up.
    expect(featherThrottle(0.97 * 0.3 * pedal, pedal)).toBe(0);
  });

  it('quantises exactly', () => {
    expect(quantiseThrottle(0.35)).toBe(0.35);
    expect(quantiseThrottle(0.37)).toBe(0.35);
    expect(quantiseThrottle(1.2)).toBe(1);
    expect(quantiseThrottle(-0.1)).toBe(0);
  });
});
