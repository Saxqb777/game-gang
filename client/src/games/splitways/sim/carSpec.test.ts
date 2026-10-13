import { CAR_IDS, PLAYER_COLOURS, type CarId } from '@gamergang/shared';
import { describe, expect, it } from 'vitest';
import {
  ASSISTS,
  BRAKES,
  CAR,
  CAR_DERIVE,
  CARS,
  DRIFT,
  ENGINE,
  PAINTS,
  TYRES,
  WHEELS,
} from '../config';
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

  it('is not what the line-up drives with', () => {
    for (const id of CAR_IDS) expect(resolveCarSpec(id)).not.toBe(REFERENCE_SPEC);
  });
});

describe('per-car spec', () => {
  it.each(CAR_IDS)('%s: wheels, collider and mass terms come from CARS', (id) => {
    const c = CARS[id];
    const g = c.geometry;
    const spec = resolveCarSpec(id);
    const massScale = c.mass / CAR.mass;
    expect(spec.id).toBe(id);
    expect(spec.mass).toBe(c.mass);
    expect(spec.massScale).toBeCloseTo(massScale, 12);
    expect(spec.geometry).toEqual(g);
    expect(spec.wheels).toEqual([
      {
        x: g.halfTrackFront,
        z: g.wheelbaseHalf,
        radius: g.radiusFront,
        centreHeight: g.radiusFront,
      },
      {
        x: -g.halfTrackFront,
        z: g.wheelbaseHalf,
        radius: g.radiusFront,
        centreHeight: g.radiusFront,
      },
      { x: g.halfTrackRear, z: -g.wheelbaseHalf, radius: g.radiusRear, centreHeight: g.radiusRear },
      {
        x: -g.halfTrackRear,
        z: -g.wheelbaseHalf,
        radius: g.radiusRear,
        centreHeight: g.radiusRear,
      },
    ]);
    expect(spec.chassis.halfExtents.x).toBeCloseTo(g.width * CAR_DERIVE.colliderHalfWidth, 12);
    expect(spec.chassis.halfExtents.y).toBeCloseTo(g.height * CAR_DERIVE.colliderHalfHeight, 12);
    expect(spec.chassis.halfExtents.z).toBeCloseTo(g.length * CAR_DERIVE.colliderHalfLength, 12);
    expect(spec.chassis.centreHeight).toBeCloseTo(g.height * CAR_DERIVE.colliderCentreHeight, 12);
    expect(spec.com).toEqual({ height: c.comHeight, forward: c.comForward });
    expect(spec.engine.force).toBe(c.force);
    expect(spec.engine.topSpeed).toBe(c.topSpeed);
    expect(spec.engine.curve).toBe(c.curve);
    expect(spec.engine.frontShare).toBe(c.frontShare);
    expect(spec.engine.drag).toBeCloseTo(ENGINE.drag * c.drag, 12);
    expect(spec.engine.reverseForce).toBeCloseTo(ENGINE.reverseForce * massScale, 9);
    expect(spec.engine.rollingResistance).toBeCloseTo(ENGINE.rollingResistance * massScale, 9);
    expect(spec.tyres).toEqual({
      frontGrip: c.frontGrip,
      rearGrip: c.rearGrip,
      sideStiffness: TYRES.sideStiffness,
    });
    expect(spec.brakes.impulse).toBeCloseTo(BRAKES.impulse * massScale * c.brake, 9);
    expect(spec.brakes.frontBias).toBe(BRAKES.frontBias);
    expect(spec.brakes.handbrakeImpulse).toBeCloseTo(DRIFT.handbrakeImpulse * massScale, 9);
    expect(spec.downforce).toBeCloseTo(ASSISTS.downforce * massScale * c.downforce, 9);
  });

  it('scales inertia with mass, body size squared and the car factor', () => {
    const size = (l: number, w: number) => (l * l + w * w) / (4.4 * 4.4 + 1.84 * 1.84);
    for (const id of CAR_IDS) {
      const c = CARS[id];
      const spec = resolveCarSpec(id);
      const expected =
        CAR.inertia.yaw *
        (c.mass / CAR.mass) *
        size(c.geometry.length, c.geometry.width) *
        c.inertia;
      expect(spec.inertia.yaw).toBeCloseTo(expected, 6);
    }
    expect(CAR_DERIVE.inertiaLength).toBe(4.4);
    expect(CAR_DERIVE.inertiaWidth).toBe(1.84);
  });

  it('keeps the line-up characters (spec 4.2)', () => {
    const spec = (id: CarId) => resolveCarSpec(id);
    const top = (id: CarId) => spec(id).engine.topSpeed;
    const grip = (id: CarId) => spec(id).tyres.frontGrip + spec(id).tyres.rearGrip;
    // Haymaker and Zanna fastest on top speed, Scree slowest.
    for (const id of CAR_IDS) {
      if (id !== 'haymaker' && id !== 'zanna') {
        expect(top('haymaker')).toBeGreaterThan(top(id));
        expect(top('zanna')).toBeGreaterThan(top(id));
      }
      if (id !== 'scree') expect(top('scree')).toBeLessThan(top(id));
    }
    // Scree and Sagitta have the best traction.
    for (const id of ['nightjar', 'haymaker', 'zanna'] as const) {
      expect(grip('scree')).toBeGreaterThan(grip(id));
      expect(grip('sagitta')).toBeGreaterThan(grip(id));
    }
  });
});
