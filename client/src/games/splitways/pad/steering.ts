/** Phone steering: tilt (gyro) and button modes both produce steer in -1 (left) .. +1 (right). */

/** Turning the phone this far (degrees) from level is full lock. */
export const TILT_FULL_LOCK_DEG = 38;
/** Ignore tiny wobbles within this many degrees of level. */
export const TILT_DEAD_ZONE_DEG = 2;
/** Smoothing time constant for the sensor (seconds). Small: responsive but not jittery. */
const TILT_SMOOTHING_S = 0.035;
/** Buttons: time to go from centre to full lock, and back to centre on release (seconds). */
export const BUTTON_RAMP_S = 0.15;
export const BUTTON_RETURN_S = 0.1;

const DEG = Math.PI / 180;

/**
 * Wheel angle (degrees, clockwise positive) of a phone held like a steering wheel, from a
 * DeviceOrientation reading and the current screen rotation. Returns null when the phone lies
 * nearly flat, where the angle is meaningless.
 */
export function tiltAngle(
  betaDeg: number,
  gammaDeg: number,
  screenAngleDeg: number,
): number | null {
  const b = betaDeg * DEG;
  const g = gammaDeg * DEG;
  // "Up" (against gravity) in device coordinates, projected onto the screen plane.
  const ux = -Math.sin(g) * Math.cos(b);
  const uy = Math.sin(b);
  const a = screenAngleDeg * DEG;
  const screenUp = ux * Math.sin(a) + uy * Math.cos(a);
  const screenRight = ux * Math.cos(a) - uy * Math.sin(a);
  if (Math.hypot(screenUp, screenRight) < 0.25) return null;
  // Rotating the phone clockwise swings "up" towards the left edge of the screen.
  return Math.atan2(-screenRight, screenUp) / DEG;
}

/** Wheel angle -> steer with a small dead zone and full lock at TILT_FULL_LOCK_DEG. */
export function tiltToSteer(angleDeg: number): number {
  const magnitude = Math.abs(angleDeg);
  if (magnitude <= TILT_DEAD_ZONE_DEG) return 0;
  const t = Math.min(
    1,
    (magnitude - TILT_DEAD_ZONE_DEG) / (TILT_FULL_LOCK_DEG - TILT_DEAD_ZONE_DEG),
  );
  return Math.sign(angleDeg) * t;
}

/** Hold-to-steer buttons: ramps to full over BUTTON_RAMP_S, back to centre over BUTTON_RETURN_S. */
export function rampSteer(current: number, left: boolean, right: boolean, dt: number): number {
  const target = (right ? 1 : 0) - (left ? 1 : 0);
  const towardsCentre = target === 0 || Math.sign(target) !== Math.sign(current);
  const rate = towardsCentre && current !== 0 ? 1 / BUTTON_RETURN_S : 1 / BUTTON_RAMP_S;
  const delta = rate * dt;
  if (current < target) return Math.min(current + delta, target);
  return Math.max(current - delta, target);
}

function screenAngle(): number {
  const orientation = (screen as Partial<Screen>).orientation;
  if (orientation) return orientation.angle;
  const legacy = (window as { orientation?: number }).orientation;
  return typeof legacy === 'number' ? legacy : 0;
}

/** Listens to the gyro and keeps a smoothed steer value. */
export class TiltSteering {
  /** Smoothed steer, -1..1. */
  steer = 0;
  /** Raw wheel angle in degrees (for the wheel graphic). */
  angle = 0;
  /** True once the sensor has produced a usable reading. */
  active = false;
  private target = 0;

  start(): void {
    window.addEventListener('deviceorientation', this.onOrientation);
  }

  stop(): void {
    window.removeEventListener('deviceorientation', this.onOrientation);
  }

  update(dt: number): number {
    this.steer += (this.target - this.steer) * (1 - Math.exp(-dt / TILT_SMOOTHING_S));
    return this.steer;
  }

  private readonly onOrientation = (event: DeviceOrientationEvent) => {
    if (event.beta === null || event.gamma === null) return;
    const angle = tiltAngle(event.beta, event.gamma, screenAngle());
    if (angle === null) return;
    this.angle = angle;
    this.target = tiltToSteer(angle);
    this.active = true;
  };
}
