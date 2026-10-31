import { describe, expect, it, vi } from 'vitest';
import { SURFACE } from '../track/surfaces';
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

  it('keeps collider lookups working with the per-step handle remap disabled', async () => {
    const physics = await PhysicsWorld.create();
    const sim = new Simulation(physics);
    for (let i = 0; i < 10; i++) sim.step();
    // Scenery and cars created after the world has been stepping must still resolve by handle.
    const ground = physics.addBox({ x: 0, y: -0.5, z: 0 }, { x: 200, y: 0.5, z: 200 });
    physics.registerSurface(ground, SURFACE.gravel);
    const wall = physics.addBox({ x: 0, y: 1, z: 25 }, { x: 10, y: 1, z: 0.5 });
    const dropped = sim.addCar({ x: 20, y: 0.3, z: 0, yaw: 0 });
    for (let i = 0; i < 10; i++) sim.step();
    sim.removeCar(dropped);
    const car = sim.addCar({ x: 0, y: 0.3, z: 0, yaw: 0 });
    for (let i = 0; i < 30; i++) sim.step();

    const world = physics.world;
    expect(world.getCollider(ground.handle)).toBe(ground);
    expect(world.getCollider(wall.handle)).toBe(wall);
    expect(world.getCollider(car.collider.handle)).toBe(car.collider);
    expect(world.getRigidBody(car.body.handle)).toBe(car.body);
    // The removed car is gone from the JS maps (Rapier reuses its slot for the new car).
    expect(world.colliders.len()).toBe(3);
    expect(world.bodies.len()).toBe(1);
    // Wheel ground lookups (vehicle controller -> collider by handle) see the registered surface.
    expect(Array.from(car.wheelSurface)).toEqual(Array(4).fill(SURFACE.gravel));

    // And the step itself no longer walks every collider handle.
    const remap = vi.spyOn(world.colliders, 'mapNewColliders');
    const impacts: Impact[] = [];
    car.input.throttle = 1;
    for (let i = 0; i < 240; i++) {
      sim.step();
      sim.drainImpacts((impact) => impacts.push(impact));
    }
    expect(impacts.some((i) => i.car === car && i.other === null)).toBe(true);
    expect(car.position.z).toBeLessThan(25);
    expect(remap).not.toHaveBeenCalled();
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
