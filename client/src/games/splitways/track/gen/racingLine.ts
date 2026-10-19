/**
 * Step 8 of track generation: a racing line (lateral offset per station) by elastic-band
 * relaxation inside the asphalt, and the speed a car could carry along it (cornering limit, then a
 * braking pass backwards and an acceleration pass forwards, both periodic). Node-safe.
 */
import { CAR, ENGINE, RACING_LINE } from '../../config';
import { movingAverage } from './corridor';

export interface RacingLine {
  /** Lateral offset per station (m, + = right). */
  lateral: Float32Array;
  /** Speed profile along the line (m/s), planned with the reference car. */
  speed: Float32Array;
  /**
   * The line's own plan curvature per station (1/m, unsigned), for per-car speed profiles. Double
   * precision, so the reference limits reproduce `speed` bit for bit.
   */
  curvature: Float64Array;
}

/** What a speed profile plans with: the line's limits plus the car's engine curve. */
export interface SpeedLimits {
  /** Top speed the plan allows (m/s). */
  vMax: number;
  /** Cornering grip (m/s^2). */
  lateralAccel: number;
  /** Braking (m/s^2). */
  brakeDecel: number;
  /** Acceleration cap of the forward pass (m/s^2); the engine curve takes over above it. */
  accelCap: number;
  /** Engine: peak force (N), top speed (m/s), fall-off exponent and the car's mass (kg). */
  force: number;
  topSpeed: number;
  curve: number;
  mass: number;
}

/** The reference car's limits: the plan the generator stores and the tyre walls come from. */
export const REFERENCE_LIMITS: SpeedLimits = {
  vMax: RACING_LINE.vMax,
  lateralAccel: RACING_LINE.lateralAccel,
  brakeDecel: RACING_LINE.brakeDecel,
  accelCap: RACING_LINE.accelCap,
  force: ENGINE.force,
  topSpeed: ENGINE.topSpeed,
  curve: 2,
  mass: CAR.mass,
};

/** Stations either side used to measure the line's curvature. */
const CURVATURE_SPAN = RACING_LINE.span;

function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/**
 * `x`, `z`, `heading` are the centre line (heading: tangent = (sin h, 0, cos h)); `roadL`/`roadR`
 * the asphalt half widths per station.
 */
export function buildRacingLine(
  x: Float32Array,
  z: Float32Array,
  heading: Float32Array,
  roadL: Float32Array,
  roadR: Float32Array,
  spacing: number,
): RacingLine {
  const n = x.length;
  const at = (i: number) => ((i % n) + n) % n;
  // Right vector = tangent x up = (-cos h, 0, sin h).
  const rx = new Float32Array(n);
  const rz = new Float32Array(n);
  const lo = new Float32Array(n);
  const hi = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const h = heading[i] as number;
    rx[i] = -Math.cos(h);
    rz[i] = Math.sin(h);
    lo[i] = Math.min(0, -((roadL[i] as number) - RACING_LINE.edgeMargin));
    hi[i] = Math.max(0, (roadR[i] as number) - RACING_LINE.edgeMargin);
  }
  const lateral = new Float32Array(n);
  const span = RACING_LINE.span;
  // Gauss-Seidel in place: each point moves to the lateral that puts it on the midpoint of the
  // points `span` stations either side, then is clamped inside the asphalt.
  for (let iteration = 0; iteration < RACING_LINE.iterations; iteration++) {
    for (let i = 0; i < n; i++) {
      const a = at(i - span);
      const b = at(i + span);
      const mx =
        ((x[a] as number) +
          (rx[a] as number) * (lateral[a] as number) +
          (x[b] as number) +
          (rx[b] as number) * (lateral[b] as number)) /
        2;
      const mz =
        ((z[a] as number) +
          (rz[a] as number) * (lateral[a] as number) +
          (z[b] as number) +
          (rz[b] as number) * (lateral[b] as number)) /
        2;
      const target =
        (mx - (x[i] as number)) * (rx[i] as number) + (mz - (z[i] as number)) * (rz[i] as number);
      lateral[i] = Math.min(hi[i] as number, Math.max(lo[i] as number, target));
    }
  }

  // Points `span` apart form `span` separate chains under that update, so a short moving average
  // ties the chains together (no 1 m zig-zag), then the edge clamp is applied again.
  movingAverage(lateral, span + 1);
  for (let i = 0; i < n; i++) {
    lateral[i] = Math.min(hi[i] as number, Math.max(lo[i] as number, lateral[i] as number));
  }

  // Curvature of the line from the line points themselves.
  const px = new Float32Array(n);
  const pz = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    px[i] = (x[i] as number) + (rx[i] as number) * (lateral[i] as number);
    pz[i] = (z[i] as number) + (rz[i] as number) * (lateral[i] as number);
  }
  const curvature = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = at(i - CURVATURE_SPAN);
    const b = at(i + CURVATURE_SPAN);
    const ax = (px[i] as number) - (px[a] as number);
    const az = (pz[i] as number) - (pz[a] as number);
    const bx = (px[b] as number) - (px[i] as number);
    const bz = (pz[b] as number) - (pz[i] as number);
    const turn = wrapAngle(Math.atan2(bx, bz) - Math.atan2(ax, az));
    curvature[i] = Math.abs(turn) / Math.max(1e-6, (Math.hypot(ax, az) + Math.hypot(bx, bz)) / 2);
  }
  return { lateral, speed: speedProfile(curvature, spacing, REFERENCE_LIMITS), curvature };
}

/**
 * The speed a car with these limits could carry along a line of this curvature: the cornering
 * limit, then a braking pass backwards and an acceleration pass forwards, both periodic.
 */
export function speedProfile(
  curvature: ArrayLike<number>,
  spacing: number,
  limits: SpeedLimits,
): Float32Array {
  const n = curvature.length;
  const at = (i: number) => ((i % n) + n) % n;
  const speed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const k = curvature[i] as number;
    speed[i] = Math.min(limits.vMax, Math.sqrt(limits.lateralAccel / Math.max(k, 1e-9)));
  }
  // Braking backwards, then accelerating forwards; twice round so the lap seam is settled.
  for (let pass = 0; pass < 2 * n; pass++) {
    const i = at(-pass - 1);
    const next = speed[at(i + 1)] as number;
    speed[i] = Math.min(
      speed[i] as number,
      Math.sqrt(next * next + 2 * limits.brakeDecel * spacing),
    );
  }
  for (let pass = 0; pass < 2 * n; pass++) {
    const i = at(pass);
    const v = speed[i] as number;
    const accel = Math.min(
      limits.accelCap,
      (limits.force * Math.max(0, 1 - (v / limits.topSpeed) ** limits.curve)) / limits.mass,
    );
    const j = at(i + 1);
    speed[j] = Math.min(speed[j] as number, Math.sqrt(v * v + 2 * accel * spacing));
  }
  return speed;
}

export interface BrakingZone {
  /** Station where the speed starts to fall. */
  start: number;
  /** Last station of the slowest part of the corner. */
  apex: number;
  /** Speed lost from start to apex (m/s). */
  drop: number;
}

const EPS = 1e-4;
/** Rises smaller than this (m/s) on the way into a corner do not end its braking zone. */
const BUMP = 1;

/**
 * Every place the speed profile falls into a local minimum, with how much it falls from the last
 * peak before it. Small bumps in the braking zone do not split it: zones that share a peak are
 * merged and keep their slowest point.
 */
export function brakingZones(speed: Float32Array): BrakingZone[] {
  const n = speed.length;
  const v = (i: number) => speed[((i % n) + n) % n] as number;
  const byStart = new Map<number, BrakingZone>();
  for (let i = 0; i < n; i++) {
    // The end of a minimum plateau: no faster than the station before, slower than the next.
    if (!(v(i) <= v(i - 1) + EPS && v(i) < v(i + 1) - EPS)) continue;
    let peak = i;
    for (let j = i - 1, steps = 0; steps < n; j--, steps++) {
      if (v(j) > v(peak)) peak = j;
      else if (v(j) < v(peak) - BUMP) break;
    }
    const start = ((peak % n) + n) % n;
    const drop = v(start) - v(i);
    if (drop <= EPS) continue;
    const known = byStart.get(start);
    if (!known || v(i) < v(known.apex)) byStart.set(start, { start, apex: i, drop });
  }
  return [...byStart.values()].sort((a, b) => a.start - b.start);
}
