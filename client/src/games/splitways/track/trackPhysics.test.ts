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
  });

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
  });
});
