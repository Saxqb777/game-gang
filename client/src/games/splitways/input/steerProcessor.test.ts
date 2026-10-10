import { describe, expect, it } from 'vitest';
import { STEER_INPUT } from '../config';
import { SteerProcessor } from './steerProcessor';

const DT = 1 / 60;

function settle(processor: SteerProcessor, raw: number, seconds: number): number {
  let value = processor.value;
  for (let t = 0; t < seconds - 1e-9; t += DT) value = processor.process(raw, DT);
  return value;
}

describe('SteerProcessor', () => {
  it('settles a full-lock step within 5 time constants', () => {
    const processor = new SteerProcessor();
    const tau = STEER_INPUT.lowPassSeconds;
    // One step in, it is moving but not there yet: the low-pass is doing something.
    const first = processor.process(1, DT);
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(1);
    const value = settle(processor, 1, 5 * tau);
    expect(value).toBeGreaterThan(1 - Math.exp(-5) - 0.01);
    expect(settle(processor, 1, 0.5)).toBe(1);
  });

  it('returns to exactly 0 on release', () => {
    const processor = new SteerProcessor();
    settle(processor, -1, 0.5);
    expect(processor.value).toBe(-1);
    expect(settle(processor, 0, 0.5)).toBe(0);
  });

  it('holds the dead zone', () => {
    const processor = new SteerProcessor();
    expect(settle(processor, STEER_INPUT.deadZone * 0.9, 1)).toBe(0);
    expect(settle(processor, -STEER_INPUT.deadZone, 1)).toBe(0);
  });

  it('applies the response curve to partial inputs', () => {
    const processor = new SteerProcessor();
    const half = settle(processor, 0.5, 1);
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(0.5);
  });

  it('passes keyboard ±1 through the same path (gamma does nothing at full lock)', () => {
    const processor = new SteerProcessor();
    expect(settle(processor, 1, 1)).toBe(1);
  });

  it('reset centres immediately', () => {
    const processor = new SteerProcessor();
    settle(processor, 1, 1);
    processor.reset();
    expect(processor.value).toBe(0);
    expect(processor.process(0, DT)).toBe(0);
  });
});
