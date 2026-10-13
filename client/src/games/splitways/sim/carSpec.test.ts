import { CAR_IDS, PLAYER_COLOURS } from '@gamergang/shared';
import { describe, expect, it } from 'vitest';
import { ASSISTS, BRAKES, CAR, CARS, DRIFT, ENGINE, PAINTS, TYRES, WHEELS } from '../config';
import { REFERENCE_SPEC, resolveCarSpec } from './carSpec';

describe('car config', () => {
  it('lists the cars in catalogue order', () => {
    expect(Object.keys(CARS)).toEqual([...CAR_IDS]);
  });

  it('has one paint per player colour, in order', () => {
    expect(Object.keys(PAINTS)).toEqual(PLAYER_COLOURS.map((c) => c.id));
  });
});

describe('reference spec', () => {
  it('is the M8 car exactly', () => {
    const spec = REFERENCE_SPEC;
    expect(spec.id).toBe('reference');
    expect(spec.mass).toBe(CAR.mass);
    expect(spec.inertia).toEqual(CAR.inertia);
    expect(spec.com).toEqual({ height: CAR.centreOfMassHeight, forward: CAR.centreOfMassForward });
    expect(spec.chassis).toEqual({
      halfExtents: CAR.chassisHalfExtents,
      centreHeight: CAR.chassisCentreHeight,
    });
    // Symmetric wheelbase, hubs at the M8 mount height (0.32), one radius.
    expect(spec.wheels).toEqual([
      { x: WHEELS.halfTrack, z: WHEELS.wheelbaseHalf, radius: WHEELS.radius, centreHeight: 0.32 },
      { x: -WHEELS.halfTrack, z: WHEELS.wheelbaseHalf, radius: WHEELS.radius, centreHeight: 0.32 },
      { x: WHEELS.halfTrack, z: -WHEELS.wheelbaseHalf, radius: WHEELS.radius, centreHeight: 0.32 },
      { x: -WHEELS.halfTrack, z: -WHEELS.wheelbaseHalf, radius: WHEELS.radius, centreHeight: 0.32 },
    ]);
    expect(WHEELS.centreHeight).toBe(0.32);
    expect(spec.engine).toEqual({
      force: ENGINE.force,
      topSpeed: ENGINE.topSpeed,
      curve: 2,
      frontShare: ENGINE.frontShare,
      reverseForce: ENGINE.reverseForce,
      reverseTopSpeed: ENGINE.reverseTopSpeed,
      drag: ENGINE.drag,
      rollingResistance: ENGINE.rollingResistance,
    });
    expect(spec.tyres).toEqual({
      frontGrip: TYRES.frontGrip,
      rearGrip: TYRES.rearGrip,
      sideStiffness: TYRES.sideStiffness,
    });
    expect(spec.brakes).toEqual({
      impulse: BRAKES.impulse,
      frontBias: BRAKES.frontBias,
      handbrakeImpulse: DRIFT.handbrakeImpulse,
    });
    expect(spec.massScale).toBe(1);
    expect(spec.downforce).toBe(ASSISTS.downforce);
    expect(spec.geometry).toEqual({
      wheelbaseHalf: WHEELS.wheelbaseHalf,
      halfTrackFront: WHEELS.halfTrack,
      halfTrackRear: WHEELS.halfTrack,
      radiusFront: WHEELS.radius,
      radiusRear: WHEELS.radius,
      length: CAR.chassisHalfExtents.z * 2,
      width: CAR.chassisHalfExtents.x * 2,
      height: 1.3,
    });
  });

  it('is what every car drives with until per-car specs land', () => {
    for (const id of CAR_IDS) expect(resolveCarSpec(id)).toBe(REFERENCE_SPEC);
  });
});
