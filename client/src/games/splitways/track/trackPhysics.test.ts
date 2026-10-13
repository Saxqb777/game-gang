import type { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import base from '../../../../../assets/tracks/kestrel-pines/base.layout.json';
import overrides from '../../../../../assets/tracks/kestrel-pines/overrides.json';
import { Simulation } from '../sim/simulation';
import { PhysicsWorld } from '../sim/world';
import { SURFACE } from './surfaces';
import { buildTrackPhysics } from './trackPhysics';
import { buildTrack } from './tracks';
import type { Projection } from './track';

const track = buildTrack(base, overrides);

async function world() {
  const physics = await PhysicsWorld.create();
  buildTrackPhysics(physics, track);
  return new Simulation(physics);
}

function project(position: Vector3): Projection {
  return track.project(position, -1, { index: 0, distance: 0, lateral: 0 });
}

describe('Kestrel Pines physics', () => {
  it('grounds the grid on the asphalt, and the wall keeps a full-lock car inside', async () => {
    const sim = await world();
    const cars = track.gridSpawns(4).map((spawn) => sim.addCar(spawn));
    for (let i = 0; i < 90; i++) sim.step();
    for (const car of cars) {
      expect(car.groundedWheels).toBe(4);
      const p = project(car.position);
      expect(Math.abs(p.lateral)).toBeLessThan(track.side(p.index, p.lateral < 0 ? -1 : 1).road);
      expect(car.dominantSurface).toBe(SURFACE.asphalt);
    }
    // Floor it with full right lock: the wall must keep the car on the track.
    const car = cars[0];
    if (!car) throw new Error('no car');
    car.input.throttle = 1;
    car.input.steer = 1;
    let widest = 0;
    for (let i = 0; i < 600; i++) {
      sim.step();
      const p = project(car.position);
      const side = p.lateral < 0 ? -1 : 1;
      widest = Math.max(widest, Math.abs(p.lateral) - track.side(p.index, side).wall);
    }
    expect(widest).toBeLessThan(0.5);
    expect(car.position.y).toBeGreaterThan(track.bounds.minY - 2);
  }, 30_000);

  it('walls are slippery: a car scraping one keeps most of its speed', async () => {
    const physics = await PhysicsWorld.create();
    buildTrackPhysics(physics, track);
    // Every wall hull uses the Min combine rule, so the car body meets the wall's low friction.
    let hulls = 0;
    physics.world.forEachCollider((collider) => {
      if (collider.shape.type !== physics.rapier.ShapeType.ConvexPolyhedron) return;
      hulls++;
      expect(collider.frictionCombineRule()).toBe(physics.rapier.CoefficientCombineRule.Min);
    });
    expect(hulls).toBeGreaterThan(1000);
    // The longest straight: start near its beginning, 2 m off the right wall, 10 deg into it.
    let best = 0;
    let bestStart = 0;
    for (let i = 0, run = 0; i < track.samples.length * 2; i++) {
      const sample = track.samples[i % track.samples.length];
      run = sample && Math.abs(sample.curvature) < 1 / 1500 ? run + 1 : 0;
      if (run > best) [best, bestStart] = [run, i - run + 1];
    }
    expect(best).toBeGreaterThan(150);
    const distance = (bestStart + 10) * track.spacing;
    const index = track.indexAt(distance);
    const spawn = track.spawnAt(distance, track.side(index, 1).wall - 2);
    spawn.yaw -= (10 * Math.PI) / 180; // a yaw decrease turns towards +right
    const sim = new Simulation(physics);
    const car = sim.addCar(spawn);
    for (let i = 0; i < 20; i++) sim.step();
    const speed = 30;
    car.body.setLinvel(
      { x: speed * Math.sin(spawn.yaw), y: 0, z: speed * Math.cos(spawn.yaw) },
      true,
    );
    car.input.throttle = 1;
    let touched = false;
    for (let i = 0; i < 90; i++) {
      sim.step();
      const p = project(car.position);
      touched ||= p.lateral > track.side(p.index, 1).wall - 1.2;
    }
    expect(touched).toBe(true);
    expect(car.velocity.length()).toBeGreaterThan(0.9 * speed);
  }, 30_000);

  it('reads kerb under wheels on a kerb', async () => {
    // A station in the middle of a long left kerb.
    let index = -1;
    for (let i = 10; i < track.samples.length - 10 && index < 0; i++) {
      let run = true;
      for (let k = -10; k <= 10; k++) run &&= track.side(i + k, -1).kerb > 1;
      if (run) index = i;
    }
    expect(index).toBeGreaterThan(0);
    const sim = await world();
    const road = track.side(index, -1).road;
    // Left wheels (0 and 2) on the middle of the kerb, right wheels on the asphalt.
    const spawn = track.spawnAt(index * track.spacing, -(road + 0.6) + 0.79);
    const car = sim.addCar(spawn);
    for (let i = 0; i < 40; i++) sim.step();
    expect(car.groundedWheels).toBe(4);
    expect(car.wheelSurface[0]).toBe(SURFACE.kerb);
    expect(car.wheelSurface[2]).toBe(SURFACE.kerb);
    expect(car.wheelSurface[1]).toBe(SURFACE.asphalt);
    expect(car.dominantSurface).toBe(SURFACE.kerb);
  }, 30_000);
});
