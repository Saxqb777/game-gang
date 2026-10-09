/**
 * Driving-feel tests: the numbers a player feels (0-100, top speed, stopping, turning, drifting,
 * not flipping) checked headlessly against the real physics and config.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import type { Car } from './car';
import type { DriveInput } from './input';
import { Simulation } from './simulation';
import { PhysicsWorld } from './world';

const STEP = 1 / 60;

async function flatWorld(): Promise<{ sim: Simulation; car: Car }> {
  const physics = await PhysicsWorld.create();
  physics.addBox({ x: 0, y: -0.5, z: 0 }, { x: 2000, y: 0.5, z: 2000 });
  const sim = new Simulation(physics);
  const car = sim.addCar({ x: 0, y: 0.3, z: 0, yaw: 0 });
  return { sim, car };
}

function drive(
  sim: Simulation,
  car: Car,
  input: Partial<DriveInput>,
  seconds: number,
  onStep?: () => void,
) {
  Object.assign(
    car.input,
    { steer: 0, throttle: 0, brake: 0, handbrake: false, horn: false },
    input,
  );
  for (let t = 0; t < seconds; t += STEP) {
    sim.step();
    onStep?.();
  }
}

function heading(car: Car): number {
  const f = new Vector3(0, 0, 1).applyQuaternion(car.quaternion);
  return Math.atan2(f.x, f.z);
}

function upDot(car: Car): number {
  return new Vector3(0, 1, 0).applyQuaternion(car.quaternion).y;
}

describe('car feel', () => {
  let sim: Simulation;
  let car: Car;

  beforeEach(async () => {
    ({ sim, car } = await flatWorld());
    drive(sim, car, {}, 1.5); // settle on the suspension
  });

  it('settles level on its wheels at the modelled ride height and stays put', () => {
    expect(car.groundedWheels).toBe(4);
    expect(upDot(car)).toBeGreaterThan(0.999);
    expect(car.position.y).toBeGreaterThan(-0.05);
    expect(car.position.y).toBeLessThan(0.12);
    const before = car.position.clone();
    drive(sim, car, {}, 2);
    expect(car.position.distanceTo(before)).toBeLessThan(0.01);
  });

  it('does 0-100 km/h in about 3.5 s and tops out near 185 km/h', () => {
    let time100 = 0;
    let t = 0;
    drive(sim, car, { throttle: 1 }, 14, () => {
      t += STEP;
      if (!time100 && car.forwardSpeed >= 100 / 3.6) time100 = t;
    });
    expect(time100).toBeGreaterThan(2.6);
    expect(time100).toBeLessThan(4.4);
    expect(car.speedKph).toBeGreaterThan(165);
    expect(car.speedKph).toBeLessThan(195);
  });

  it('stops from 150 km/h in under 85 m and stays straight', () => {
    drive(sim, car, { throttle: 1 }, 7.2);
    expect(car.speedKph).toBeGreaterThan(148);
    const start = car.position.clone();
    const startHeading = heading(car);
    drive(sim, car, { brake: 1 }, 8, () => {
      if (car.forwardSpeed < 0.3) car.input.brake = 0; // release at a stop so it doesn't reverse
    });
    expect(car.position.distanceTo(start)).toBeLessThan(85);
    expect(Math.abs(heading(car) - startHeading)).toBeLessThan(0.1);
  });

  it('steers right for +1 and left for -1', () => {
    drive(sim, car, { throttle: 0.6 }, 2);
    drive(sim, car, { throttle: 0.6, steer: 1 }, 1);
    const right = new Vector3(-1, 0, 0);
    const travel = car.velocity.clone().normalize();
    expect(travel.dot(right)).toBeGreaterThan(0.3);

    drive(sim, car, { throttle: 0.6, steer: -1 }, 2.5);
    expect(car.velocity.clone().normalize().dot(right)).toBeLessThan(0);
  });

  it('turns tightly at low speed without spinning', () => {
    drive(sim, car, { throttle: 0.5 }, 1.5);
    let maxYaw = 0;
    drive(sim, car, { throttle: 0.5, steer: 1 }, 4, () => {
      maxYaw = Math.max(maxYaw, Math.abs(sim.cars[0]?.slipAngle ?? 0));
    });
    expect(maxYaw).toBeLessThan(0.35);
    expect(upDot(car)).toBeGreaterThan(0.95);
  });

  it('never rolls over with full lock at top speed', () => {
    drive(sim, car, { throttle: 1 }, 9);
    let minUp = 1;
    drive(sim, car, { throttle: 1, steer: 1 }, 5, () => {
      minUp = Math.min(minUp, upDot(car));
    });
    expect(minUp).toBeGreaterThan(0.8);
    expect(car.groundedWheels).toBeGreaterThanOrEqual(3);
  });

  it('handbrake swings the tail out much more than steering alone', () => {
    drive(sim, car, { throttle: 1 }, 3.5);
    const speed = car.speedKph;
    expect(speed).toBeGreaterThan(90);
    const snapshot = sim.cars[0];
    expect(snapshot).toBeDefined();

    let gripSlip = 0;
    drive(sim, car, { throttle: 0.3, steer: 0.6 }, 1.2, () => {
      gripSlip = Math.max(gripSlip, Math.abs(car.slipAngle));
    });

    // Fresh run with the handbrake.
    return flatWorld().then(({ sim: sim2, car: car2 }) => {
      drive(sim2, car2, {}, 1.5);
      drive(sim2, car2, { throttle: 1 }, 3.5);
      let driftSlip = 0;
      drive(sim2, car2, { throttle: 0.3, steer: 0.6, handbrake: true }, 1.2, () => {
        driftSlip = Math.max(driftSlip, Math.abs(car2.slipAngle));
      });
      expect(driftSlip).toBeGreaterThan(gripSlip * 2);
      expect(driftSlip).toBeGreaterThan(0.25);
      // ...and the drift can be caught: release and counter-steer, the car straightens up.
      drive(sim2, car2, { throttle: 0.6, steer: -0.3 }, 2);
      expect(Math.abs(car2.slipAngle)).toBeLessThan(0.15);
      expect(upDot(car2)).toBeGreaterThan(0.95);
    });
  });

  it('kicks the tail out when braking mid-corner (brake oversteer)', async () => {
    drive(sim, car, { throttle: 1 }, 3.5);
    let liftSlip = 0;
    drive(sim, car, { steer: 0.7 }, 0.8, () => {
      liftSlip = Math.max(liftSlip, Math.abs(car.slipAngle));
    });

    const { sim: sim2, car: car2 } = await flatWorld();
    drive(sim2, car2, {}, 1.5);
    drive(sim2, car2, { throttle: 1 }, 3.5);
    let brakeSlip = 0;
    drive(sim2, car2, { steer: 0.7, brake: 0.6 }, 0.8, () => {
      brakeSlip = Math.max(brakeSlip, Math.abs(car2.slipAngle));
    });
    expect(brakeSlip).toBeGreaterThan(liftSlip * 1.3);
  });

  it('reverses when holding brake at a standstill', () => {
    drive(sim, car, { brake: 1 }, 3);
    expect(car.forwardSpeed).toBeLessThan(-4);
    expect(car.forwardSpeed).toBeGreaterThan(-12);
  });
});
