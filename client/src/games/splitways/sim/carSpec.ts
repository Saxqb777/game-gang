/**
 * Per-car physics spec. Every car is the M8 reference car (D-C3) plus the per-car values in
 * `CARS`. The `Car` reads its mass, geometry, engine, tyres and brakes from one of these.
 * Node-safe: no DOM, canvas or WebGL.
 */
import type { CarId } from '@gamergang/shared';
import { ASSISTS, BRAKES, CAR, DRIFT, ENGINE, TYRES, WHEELS } from '../config';

export interface WheelSpec {
  /** Hub position in car space: +X is the car's left, +Z forward (m). */
  x: number;
  z: number;
  radius: number;
  /**
   * Hub height above the ground at rest (m). Equal to `radius` on the real cars; the reference car
   * keeps its M8 value (`WHEELS.centreHeight`) so its suspension mount stays byte-for-byte.
   */
  centreHeight: number;
}

/** The `CARS.<id>.geometry` block. */
export interface CarGeometry {
  wheelbaseHalf: number;
  halfTrackFront: number;
  halfTrackRear: number;
  radiusFront: number;
  radiusRear: number;
  length: number;
  width: number;
  height: number;
}

export interface CarSpec {
  id: CarId | 'reference';
  mass: number;
  inertia: { pitch: number; yaw: number; roll: number };
  com: { height: number; forward: number };
  chassis: { halfExtents: { x: number; y: number; z: number }; centreHeight: number };
  /** Front left, front right, rear left, rear right. */
  wheels: readonly [WheelSpec, WheelSpec, WheelSpec, WheelSpec];
  engine: {
    force: number;
    topSpeed: number;
    curve: number;
    frontShare: number;
    reverseForce: number;
    reverseTopSpeed: number;
    drag: number;
    rollingResistance: number;
  };
  tyres: { frontGrip: number; rearGrip: number; sideStiffness: number };
  brakes: { impulse: number; frontBias: number; handbrakeImpulse: number };
  /** mass / CAR.mass: scales downforce and the anti-roll, pitch and air-levelling torques. */
  massScale: number;
  /** ASSISTS.downforce * massScale * the car's factor. */
  downforce: number;
  /** The config block, for visuals (framing, tag height, blob size). */
  geometry: CarGeometry;
}

function referenceWheel(x: number, z: number): WheelSpec {
  return { x, z, radius: WHEELS.radius, centreHeight: WHEELS.centreHeight };
}

/** The M8 car exactly, built from the reference blocks in config. */
export const REFERENCE_SPEC: CarSpec = {
  id: 'reference',
  mass: CAR.mass,
  inertia: { ...CAR.inertia },
  com: { height: CAR.centreOfMassHeight, forward: CAR.centreOfMassForward },
  chassis: { halfExtents: { ...CAR.chassisHalfExtents }, centreHeight: CAR.chassisCentreHeight },
  wheels: [
    referenceWheel(WHEELS.halfTrack, WHEELS.wheelbaseHalf),
    referenceWheel(-WHEELS.halfTrack, WHEELS.wheelbaseHalf),
    referenceWheel(WHEELS.halfTrack, -WHEELS.wheelbaseHalf),
    referenceWheel(-WHEELS.halfTrack, -WHEELS.wheelbaseHalf),
  ],
  engine: {
    force: ENGINE.force,
    topSpeed: ENGINE.topSpeed,
    // M8's fall-off is 1 - (v / topSpeed) ** 2.
    curve: 2,
    frontShare: ENGINE.frontShare,
    reverseForce: ENGINE.reverseForce,
    reverseTopSpeed: ENGINE.reverseTopSpeed,
    drag: ENGINE.drag,
    rollingResistance: ENGINE.rollingResistance,
  },
  tyres: {
    frontGrip: TYRES.frontGrip,
    rearGrip: TYRES.rearGrip,
    sideStiffness: TYRES.sideStiffness,
  },
  brakes: {
    impulse: BRAKES.impulse,
    frontBias: BRAKES.frontBias,
    handbrakeImpulse: DRIFT.handbrakeImpulse,
  },
  massScale: 1,
  downforce: ASSISTS.downforce,
  geometry: {
    wheelbaseHalf: WHEELS.wheelbaseHalf,
    halfTrackFront: WHEELS.halfTrack,
    halfTrackRear: WHEELS.halfTrack,
    radiusFront: WHEELS.radius,
    radiusRear: WHEELS.radius,
    // The collision box's footprint; 1.3 m is the body height the chase camera was framed for.
    length: CAR.chassisHalfExtents.z * 2,
    width: CAR.chassisHalfExtents.x * 2,
    height: 1.3,
  },
};

/**
 * The spec a car drives with. Every car is still the reference car here; the per-car derivation
 * from `CARS` replaces this body (C3).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- every id is the reference car for now
export function resolveCarSpec(_id: CarId): CarSpec {
  return REFERENCE_SPEC;
}
