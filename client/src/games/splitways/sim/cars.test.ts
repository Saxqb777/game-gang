/**
 * Per-car feel (C3.5): every car of the line-up on the flat world of `car.test.ts`. Each one has to
 * settle, launch, top out, stop and turn like a sibling of the reference car, and the phone's stat
 * bars must rank the cars the way the physics does.
 */
import { CAR_IDS, CAR_INFO, type CarId } from '@gamergang/shared';
import { Vector3 } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { ASSISTS } from '../config';
import {
  flatWorld,
  measureBraking,
  measureLaunch,
  plannedTopSpeed,
  type Launch,
} from '../race/balance';
import type { Car } from './car';
import { REFERENCE_SPEC, resolveCarSpec } from './carSpec';
import type { DriveInput } from './input';
import type { Simulation } from './simulation';

function upDot(car: Car): number {
  return new Vector3(0, 1, 0).applyQuaternion(car.quaternion).y;
}

function yawRate(car: Car): number {
  return car.body.angvel().y;
}

/** Holds `input` for `seconds`; `throttleTo` (km/h) replaces the throttle with a speed holder. */
function hold(
  sim: Simulation,
  car: Car,
  input: Partial<DriveInput>,
  seconds: number,
  throttleTo?: number,
): number {
  Object.assign(
    car.input,
    { steer: 0, throttle: 0, brake: 0, handbrake: false, horn: false },
    input,
  );
  let minUp = 1;
  for (let t = 0; t < seconds; t += sim.dt) {
    if (throttleTo !== undefined) car.input.throttle = car.speedKph < throttleTo ? 1 : 0;
    sim.step();
    minUp = Math.min(minUp, upDot(car));
  }
  return minUp;
}

/** Full throttle until `kph`. */
function reach(sim: Simulation, car: Car, kph: number): void {
  Object.assign(car.input, { steer: 0, throttle: 1, brake: 0, handbrake: false });
  for (let i = 0; i < 60 * 20 && car.speedKph < kph; i++) sim.step();
}

const launches = new Map<CarId, Launch>();
let referenceBraking = 0;

beforeAll(async () => {
  for (const id of CAR_IDS) launches.set(id, await measureLaunch(resolveCarSpec(id)));
  referenceBraking = await measureBraking(REFERENCE_SPEC);
}, 60_000);

describe.each(CAR_IDS)('%s', (id) => {
  const spec = resolveCarSpec(id);

  it('settles level on all four wheels with its origin at road level', async () => {
    const { sim, car } = await flatWorld(spec);
    expect(car.groundedWheels).toBe(4);
    expect(upDot(car)).toBeGreaterThan(0.999);
    expect(Math.abs(car.position.y)).toBeLessThan(0.05);
    const before = car.position.clone();
    hold(sim, car, {}, 2);
    expect(car.position.distanceTo(before)).toBeLessThan(0.01);
    sim.dispose();
  });

  it('launches and tops out like the rest of the line-up', () => {
    const launch = launches.get(id) as Launch;
    expect(launch.zeroTo100).toBeGreaterThan(2.8);
    expect(launch.zeroTo100).toBeLessThan(4.6);
    expect(launch.topKph).toBeGreaterThan(165);
    expect(launch.topKph).toBeLessThan(205);
    const planned = plannedTopSpeed(spec) * 3.6;
    expect(Math.abs(launch.topKph - planned) / planned).toBeLessThan(0.04);
  });

  it('stops from 100 km/h within 12% of the reference car', async () => {
    const distance = await measureBraking(spec);
    expect(Math.abs(distance - referenceBraking) / referenceBraking).toBeLessThan(0.12);
  });

  it('stays upright and recovers its yaw from a full-lock turn at 60 km/h', async () => {
    const { sim, car } = await flatWorld(spec);
    reach(sim, car, 60);
    const minUp = hold(sim, car, { steer: 1 }, 3, 60);
    expect(minUp).toBeGreaterThan(0.5);
    expect(Math.abs(yawRate(car))).toBeLessThan(ASSISTS.maxYawRate);
    sim.dispose();
  });

  it('stays upright and recovers its yaw from a handbrake turn at 70 km/h', async () => {
    const { sim, car } = await flatWorld(spec);
    reach(sim, car, 70);
    let minUp = hold(sim, car, { steer: 1, handbrake: true }, 1.2);
    minUp = Math.min(minUp, hold(sim, car, { steer: -0.3, throttle: 0.4 }, 1));
    expect(minUp).toBeGreaterThan(0.5);
    expect(Math.abs(yawRate(car))).toBeLessThan(ASSISTS.maxYawRate);
    sim.dispose();
  });

  it('has a collider inside its body', () => {
    const { chassis, geometry } = spec;
    expect(chassis.halfExtents.x * 2).toBeLessThanOrEqual(geometry.width);
    expect(chassis.halfExtents.z * 2).toBeLessThanOrEqual(geometry.length);
    expect(chassis.centreHeight + chassis.halfExtents.y).toBeLessThanOrEqual(geometry.height);
    // Bottom above the hubs' lowest point, so it never drags on the road at rest.
    expect(chassis.centreHeight - chassis.halfExtents.y).toBeGreaterThan(0.25);
  });
});

/**
 * Bars rank the cars like the measurement: a car that measured more than 1% better than another has
 * the higher bar. Cars within 1% of each other may share a bar value (or swap).
 */
function expectBarsFollow(
  bar: (id: CarId) => number,
  value: (id: CarId) => number,
  higherIsBetter: boolean,
): void {
  for (const a of CAR_IDS) {
    for (const b of CAR_IDS) {
      const va = value(a);
      const vb = value(b);
      if (higherIsBetter ? va > vb * 1.01 : va < vb * 0.99) {
        expect(bar(a), `${a} measured better than ${b}`).toBeGreaterThan(bar(b));
      }
    }
  }
}

describe('stat bars', () => {
  it('rank Speed by measured top speed', () => {
    expectBarsFollow(
      (id) => CAR_INFO[id].stats.speed,
      (id) => (launches.get(id) as Launch).topKph,
      true,
    );
  });

  it('rank Acceleration by measured 0-100 km/h', () => {
    expectBarsFollow(
      (id) => CAR_INFO[id].stats.acceleration,
      (id) => (launches.get(id) as Launch).zeroTo100,
      false,
    );
  });

  it('prints the measurements', () => {
    for (const id of CAR_IDS) {
      const launch = launches.get(id) as Launch;
      console.info(
        '[cars]',
        id,
        `0-100 ${launch.zeroTo100.toFixed(2)} s`,
        `top ${launch.topKph.toFixed(1)} km/h`,
        `planned ${(plannedTopSpeed(resolveCarSpec(id)) * 3.6).toFixed(1)} km/h`,
      );
    }
    expect(launches.size).toBe(CAR_IDS.length);
  });
});
