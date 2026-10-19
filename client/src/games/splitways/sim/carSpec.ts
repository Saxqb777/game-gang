/**
 * Per-car physics spec. Every car is the M8 reference car (D-C3) plus the per-car values in
 * `CARS`. The `Car` reads its mass, geometry, engine, tyres and brakes from one of these.
 * Node-safe: no DOM, canvas or WebGL.
 */
import type { CarId } from '@gamergang/shared';
import { ASSISTS, BRAKES, CAR, CAR_DERIVE, CARS, DRIFT, ENGINE, TYRES, WHEELS } from '../config';

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

function wheel(x: number, z: number, radius: number): WheelSpec {
  // Real cars sit with the hub one tyre radius above the ground, so the car origin is at road level.
  return { x, z, radius, centreHeight: radius };
}

/**
 * The spec a car drives with: the reference car plus `CARS.<id>`. Geometry places the wheels and
 * sizes the collider and inertia; the brake impulse, downforce, rolling resistance, reverse force and
 * the assist torques scale with mass so every car decelerates and steadies like the reference; the
 * per-car factors sit on top.
 */
export function resolveCarSpec(id: CarId): CarSpec {
  const c = CARS[id];
  const g = c.geometry;
  const massScale = c.mass / CAR.mass;
  const lengthSq = g.length * g.length;
  const widthSq = g.width * g.width;
  const refLengthSq = CAR_DERIVE.inertiaLength * CAR_DERIVE.inertiaLength;
  const refWidthSq = CAR_DERIVE.inertiaWidth * CAR_DERIVE.inertiaWidth;
  // A box's inertia grows with mass times size squared: pitch with length, roll with width, yaw both.
  const inertia = massScale * c.inertia;
  return {
    id,
    mass: c.mass,
    inertia: {
      pitch: CAR.inertia.pitch * inertia * (lengthSq / refLengthSq),
      yaw: CAR.inertia.yaw * inertia * ((lengthSq + widthSq) / (refLengthSq + refWidthSq)),
      roll: CAR.inertia.roll * inertia * (widthSq / refWidthSq),
    },
    com: { height: c.comHeight, forward: c.comForward },
    chassis: {
      halfExtents: {
        x: g.width * CAR_DERIVE.colliderHalfWidth,
        y: g.height * CAR_DERIVE.colliderHalfHeight,
        z: g.length * CAR_DERIVE.colliderHalfLength,
      },
      centreHeight: g.height * CAR_DERIVE.colliderCentreHeight,
    },
    wheels: [
      wheel(g.halfTrackFront, g.wheelbaseHalf, g.radiusFront),
      wheel(-g.halfTrackFront, g.wheelbaseHalf, g.radiusFront),
      wheel(g.halfTrackRear, -g.wheelbaseHalf, g.radiusRear),
      wheel(-g.halfTrackRear, -g.wheelbaseHalf, g.radiusRear),
    ],
    engine: {
      force: c.force,
      topSpeed: c.topSpeed,
      curve: c.curve,
      frontShare: c.frontShare,
      reverseForce: ENGINE.reverseForce * massScale,
      reverseTopSpeed: ENGINE.reverseTopSpeed,
      drag: ENGINE.drag * c.drag,
      rollingResistance: ENGINE.rollingResistance * massScale,
    },
    tyres: { frontGrip: c.frontGrip, rearGrip: c.rearGrip, sideStiffness: TYRES.sideStiffness },
    brakes: {
      impulse: BRAKES.impulse * massScale * c.brake,
      frontBias: BRAKES.frontBias,
      handbrakeImpulse: DRIFT.handbrakeImpulse * massScale,
    },
    massScale,
    downforce: ASSISTS.downforce * massScale * c.downforce,
    geometry: { ...g },
  };
}
