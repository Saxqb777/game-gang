/**
 * Per-wheel ground surfaces: a registered collider changes what the wheels feel (grip and rolling
 * drag), checked on flat planes like the car-feel tests.
 */
import { describe, expect, it } from 'vitest';
import { SURFACE, type SurfaceId } from '../track/surfaces';
import type { Car } from './car';
import { Simulation } from './simulation';
import { PhysicsWorld } from './world';

const STEP = 1 / 60;

async function plane(surface: SurfaceId | null): Promise<{ sim: Simulation; car: Car }> {
  const physics = await PhysicsWorld.create();
  const ground = physics.addBox({ x: 0, y: -0.5, z: 0 }, { x: 2000, y: 0.5, z: 2000 });
  if (surface !== null) physics.registerSurface(ground, surface);
  const sim = new Simulation(physics);
  const car = sim.addCar({ x: 0, y: 0.3, z: 0, yaw: 0 });
  for (let i = 0; i < 30; i++) sim.step();
  return { sim, car };
}

function run(sim: Simulation, seconds: number, onStep?: () => void): void {
  for (let t = 0; t < seconds; t += STEP) {
    sim.step();
    onStep?.();
  }
}

/** Starts the car rolling straight ahead at `speed` m/s. */
function launch(car: Car, speed: number): void {
  car.body.setLinvel({ x: 0, y: 0, z: speed }, true);
}

/**
 * Peak lateral acceleration (m/s^2, yaw rate x speed) in a full-lock turn entered at 20 m/s with
 * steady part throttle. With every wheel on the same low-grip surface the front washes out first,
 * so the body slip angle gets smaller, not larger: the cornering force itself is the grip measure.
 */
function cornering(sim: Simulation, car: Car): number {
  launch(car, 20);
  Object.assign(car.input, { steer: 1, throttle: 0.5, brake: 0, handbrake: false });
  let peak = 0;
  run(sim, 2, () => {
    peak = Math.max(peak, Math.abs(car.body.angvel().y * car.velocity.length()));
  });
  return peak;
}

describe('ground surfaces', () => {
  it('reads the surface a plane was registered with', async () => {
    const { car } = await plane(SURFACE.grass);
    expect(Array.from(car.wheelSurface)).toEqual([2, 2, 2, 2]);
    expect(car.dominantSurface).toBe(SURFACE.grass);
  });

  it('treats an unregistered plane as asphalt', async () => {
    const { car } = await plane(null);
    expect(Array.from(car.wheelSurface)).toEqual([0, 0, 0, 0]);
    expect(car.dominantSurface).toBe(SURFACE.asphalt);
  });

  it('is slower and less grippy on grass than on asphalt', async () => {
    const speeds: number[] = [];
    for (const surface of [SURFACE.asphalt, SURFACE.grass]) {
      const { sim, car } = await plane(surface);
      car.input.throttle = 1;
      run(sim, 8);
      speeds.push(car.forwardSpeed);
    }
    expect(speeds[1]).toBeLessThan((speeds[0] as number) - 3);

    const asphalt = await plane(SURFACE.asphalt);
    const grass = await plane(SURFACE.grass);
    expect(cornering(grass.sim, grass.car)).toBeLessThan(
      0.75 * cornering(asphalt.sim, asphalt.car),
    );
  });

  it('stops a coasting car within 140 m of gravel from 30 m/s', async () => {
    const { sim, car } = await plane(SURFACE.gravel);
    launch(car, 30);
    const start = car.position.clone();
    run(sim, 20);
    expect(car.velocity.length()).toBeLessThan(0.5);
    expect(car.position.distanceTo(start)).toBeLessThan(140);
  });
});
