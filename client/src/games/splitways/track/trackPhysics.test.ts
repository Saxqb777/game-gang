import { describe, expect, it } from 'vitest';
import { Simulation } from '../sim/simulation';
import { PhysicsWorld } from '../sim/world';
import { CORNICHE_RUN } from './cornicheRun';
import { Track } from './track';
import { buildTrackPhysics } from './trackPhysics';

describe('Corniche Run', () => {
  const track = new Track(CORNICHE_RUN);

  it('is a ~1.2 km loop with room for the road at the tightest corner', () => {
    expect(track.length).toBeGreaterThan(1100);
    expect(track.length).toBeLessThan(1300);
    expect(track.minimumRadius()).toBeGreaterThan(track.halfDrivable + 1);
    expect(track.checkpoints).toHaveLength(8);
  });

  it('cars sit on the road at the grid and stay inside the walls when driving straight into one', async () => {
    const physics = await PhysicsWorld.create();
    buildTrackPhysics(physics, track);
    const sim = new Simulation(physics);
    const cars = track.gridSpawns(4).map((spawn) => sim.addCar(spawn));
    for (let i = 0; i < 90; i++) sim.step();
    for (const car of cars) {
      expect(car.groundedWheels).toBe(4);
      const projection = track.project(car.position, -1, { index: 0, distance: 0, lateral: 0 });
      expect(Math.abs(projection.lateral)).toBeLessThan(track.halfRoad);
    }
    // Floor it with full right lock: the wall must keep the car on the track.
    const car = cars[0];
    if (!car) throw new Error('no car');
    car.input.throttle = 1;
    car.input.steer = 1;
    for (let i = 0; i < 240; i++) sim.step();
    const after = track.project(car.position, -1, { index: 0, distance: 0, lateral: 0 });
    expect(Math.abs(after.lateral)).toBeLessThan(track.halfDrivable + 0.5);
    expect(car.position.y).toBeGreaterThan(-1);
  });
});
