import { describe, expect, it } from 'vitest';
import { BUTTON_RAMP_S, rampSteer } from './steering';

describe('button steering', () => {
  it('ramps to full lock in ~150 ms and back to centre on release', () => {
    let steer = 0;
    const dt = 1 / 60;
    let frames = 0;
    while (steer < 1 && frames < 100) {
      steer = rampSteer(steer, false, true, dt);
      frames++;
    }
    expect(frames * dt).toBeCloseTo(BUTTON_RAMP_S, 1);
    for (let i = 0; i < 10; i++) steer = rampSteer(steer, false, false, dt);
    expect(steer).toBe(0);
  });

  it('switches straight through centre when changing direction', () => {
    let steer = 1;
    for (let i = 0; i < 30; i++) steer = rampSteer(steer, true, false, 1 / 60);
    expect(steer).toBe(-1);
  });

  it('holding both arrows steers straight', () => {
    let steer = 0.5;
    for (let i = 0; i < 30; i++) steer = rampSteer(steer, true, true, 1 / 60);
    expect(steer).toBe(0);
  });
});
