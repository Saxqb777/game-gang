import { describe, expect, it } from 'vitest';
import { BUTTON_RAMP_S, TILT_FULL_LOCK_DEG, rampSteer, tiltAngle, tiltToSteer } from './steering';

/** DeviceOrientation (beta, gamma) for a phone held upright, rotated clockwise by `wheel` degrees. */
function uprightLandscape(screenAngle: 90 | 270, wheelDeg: number): [number, number] {
  // Build the "up" vector in screen coordinates, convert to device coordinates, then to beta/gamma.
  const w = (wheelDeg * Math.PI) / 180;
  const screenRight = -Math.sin(w);
  const screenUp = Math.cos(w);
  const a = (screenAngle * Math.PI) / 180;
  const ux = screenUp * Math.sin(a) + screenRight * Math.cos(a);
  const uy = screenUp * Math.cos(a) - screenRight * Math.sin(a);
  const beta = (Math.asin(uy) * 180) / Math.PI;
  const gamma = (Math.asin(-ux / Math.cos(Math.asin(uy))) * 180) / Math.PI;
  return [beta, gamma];
}

describe('tilt steering', () => {
  it('reads level as zero in both landscape directions', () => {
    for (const screen of [90, 270] as const) {
      const [beta, gamma] = uprightLandscape(screen, 0);
      expect(tiltAngle(beta, gamma, screen)).toBeCloseTo(0, 5);
    }
  });

  it('turning the phone clockwise steers right, anticlockwise steers left', () => {
    for (const screen of [90, 270] as const) {
      const [rb, rg] = uprightLandscape(screen, 25);
      expect(tiltAngle(rb, rg, screen)).toBeCloseTo(25, 3);
      const [lb, lg] = uprightLandscape(screen, -25);
      expect(tiltAngle(lb, lg, screen)).toBeCloseTo(-25, 3);
    }
  });

  it('maps angle to steer with a dead zone and full lock', () => {
    expect(tiltToSteer(1)).toBe(0);
    expect(tiltToSteer(TILT_FULL_LOCK_DEG)).toBe(1);
    expect(tiltToSteer(-90)).toBe(-1);
    expect(tiltToSteer(20)).toBeGreaterThan(0.4);
    expect(tiltToSteer(20)).toBeLessThan(0.6);
  });

  it('ignores a phone lying flat', () => {
    expect(tiltAngle(0, 0, 90)).toBeNull();
  });
});

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
});
