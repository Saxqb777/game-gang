import { describe, expect, it } from 'vitest';
import { BUTTON_RAMP_S, BUTTON_RETURN_S, rampSteer } from './steering';

describe('button steering', () => {
  it('ramps to full lock in ~200 ms and back to centre in ~100 ms on release', () => {
    expect(BUTTON_RAMP_S).toBe(0.2);
    let steer = 0;
    const dt = 1 / 60;
    let frames = 0;
    while (steer < 1 && frames < 100) {
      steer = rampSteer(steer, false, true, dt);
      frames++;
    }
    expect(frames * dt).toBeCloseTo(BUTTON_RAMP_S, 1);
    let back = 0;
    while (steer > 0 && back < 100) {
      steer = rampSteer(steer, false, false, dt);
      back++;
    }
    expect(steer).toBe(0);
    expect(back * dt).toBeCloseTo(BUTTON_RETURN_S, 1);
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
