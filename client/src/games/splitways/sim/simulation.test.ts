import { describe, expect, it } from 'vitest';
import { Simulation, type Impact } from './simulation';
import { PhysicsWorld } from './world';

describe('simulation', () => {
  it('reports car-to-car collisions and both cars bounce off', async () => {
    const physics = await PhysicsWorld.create();
    physics.addBox({ x: 0, y: -0.5, z: 0 }, { x: 200, y: 0.5, z: 200 });
    const sim = new Simulation(physics);
    const a = sim.addCar({ x: 0, y: 0.3, z: -12, yaw: 0 });
    const b = sim.addCar({ x: 0.4, y: 0.3, z: 12, yaw: Math.PI });
    for (let i = 0; i < 60; i++) sim.step(); // settle

    const impacts: Impact[] = [];
    a.input.throttle = 1;
    b.input.throttle = 1;
    for (let i = 0; i < 180; i++) {
      sim.step();
      sim.drainImpacts((impact) => impacts.push(impact));
    }
    const carHits = impacts.filter((i) => i.other !== null);
    expect(carHits.some((i) => i.car === a && i.other === b)).toBe(true);
    expect(carHits.some((i) => i.car === b && i.other === a)).toBe(true);
    expect(Math.max(...carHits.map((i) => i.force))).toBeGreaterThan(50_000);
    // Head-on with full throttle: neither car drove through the other.
    expect(a.position.z).toBeLessThan(b.position.z);
  });

  it('removes cars cleanly', async () => {
    const physics = await PhysicsWorld.create();
    const sim = new Simulation(physics);
    const car = sim.addCar({ x: 0, y: 1, z: 0, yaw: 0 });
    sim.removeCar(car);
    expect(sim.cars).toHaveLength(0);
    sim.step();
  });
});
