import { describe, expect, it } from 'vitest';
import type { Car, Spawn } from '../sim/car';
import { Simulation } from '../sim/simulation';
import { PhysicsWorld } from '../sim/world';
import { Slipstream } from './slipstream';

const FRONT: Spawn = { x: 0, y: 0.3, z: 20, yaw: 0 };
const BACK: Spawn = { x: 0, y: 0.3, z: 11, yaw: 0 };

/** A big flat floor with cars on it, no track. */
async function flatWorld(spawns: readonly Spawn[]): Promise<{ sim: Simulation; cars: Car[] }> {
  const physics = await PhysicsWorld.create();
  physics.addBox({ x: 0, y: -0.5, z: 0 }, { x: 2000, y: 0.5, z: 2000 });
  const sim = new Simulation(physics);
  return { sim, cars: spawns.map((spawn) => sim.addCar(spawn)) };
}

/** Full throttle, straight ahead, for `seconds`, with the slipstream updated after every step. */
function floor(
  sim: Simulation,
  slipstream: Slipstream,
  seconds: number,
  onStep?: () => void,
): void {
  for (let t = 0; t < seconds; t += sim.dt) {
    for (const car of sim.cars) {
      Object.assign(car.input, { steer: 0, throttle: 1, brake: 0, handbrake: false, horn: false });
    }
    sim.step();
    slipstream.update(sim.dt, true);
    onStep?.();
  }
}

describe('slipstream', () => {
  it('builds behind another car and never in front of it', async () => {
    const { sim, cars } = await flatWorld([FRONT, BACK]);
    const [front, back] = cars as [Car, Car];
    const slipstream = new Slipstream(cars);
    let backMax = 0;
    let frontMax = 0;
    floor(sim, slipstream, 4, () => {
      backMax = Math.max(backMax, back.draft);
      frontMax = Math.max(frontMax, front.draft);
    });
    expect(backMax).toBeGreaterThan(0.4);
    expect(frontMax).toBeLessThan(0.05);
  });

  it('only cuts drag, so the drafting car ends up a little faster than one in clean air', async () => {
    const pair = await flatWorld([FRONT, BACK]);
    const pairSlipstream = new Slipstream(pair.cars);
    const solo = await flatWorld([BACK]);
    const soloSlipstream = new Slipstream(solo.cars);
    floor(pair.sim, pairSlipstream, 6);
    floor(solo.sim, soloSlipstream, 6);
    const drafting = pair.cars[1] as Car;
    const clean = solo.cars[0] as Car;
    expect(clean.draft).toBe(0);
    expect(drafting.forwardSpeed - clean.forwardSpeed).toBeGreaterThanOrEqual(0.1);
  });

  it('switches off outside racing', async () => {
    const { sim, cars } = await flatWorld([FRONT, BACK]);
    const slipstream = new Slipstream(cars);
    floor(sim, slipstream, 4);
    expect((cars[1] as Car).draft).toBeGreaterThan(0.2);
    slipstream.update(sim.dt, false);
    for (const car of cars) expect(car.draft).toBe(0);
  });
});
