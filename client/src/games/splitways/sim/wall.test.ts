/**
 * Wall hits (Kestrel Pines): a glancing hit at full speed must slide the car along the invisible
 * wall, never let the suspension climb it. Before the wheel rays skipped the wall hulls, these
 * exact hits (15-35 degrees at 50 m/s) put cars 5-20 m outside the wall.
 */
import { CAR_IDS } from '@gamergang/shared';
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import base from '../../../../../assets/tracks/kestrel-pines/base.layout.json';
import overrides from '../../../../../assets/tracks/kestrel-pines/overrides.json';
import { buildTrackPhysics } from '../track/trackPhysics';
import { buildTrack } from '../track/tracks';
import { resolveCarSpec } from './carSpec';
import { Simulation } from './simulation';
import { PhysicsWorld } from './world';

const kestrelPines = buildTrack(base, overrides);

/** Arc length (m), side (+1 right), angle into the wall (deg), speed (m/s). Far apart, so cars never meet. */
const HITS = [
  [320, 1, 15, 50],
  [1800, 1, 15, 50],
  [2040, -1, 35, 40],
  [280, -1, 35, 50],
] as const;

describe('wall hits (Kestrel Pines)', () => {
  it.each(CAR_IDS)(
    '%s stays inside the wall in glancing hits at 145-180 km/h',
    async (id) => {
      const track = kestrelPines;
      const physics = await PhysicsWorld.create();
      buildTrackPhysics(physics, track);
      const sim = new Simulation(physics);
      const runs = HITS.map(([d, side, angle, speed]) => {
        const index = track.indexAt(d);
        const spawn = track.spawnAt(d, side * Math.max(0, track.side(index, side).wall - 6));
        spawn.yaw += (-side * angle * Math.PI) / 180;
        const car = sim.addCar(spawn, resolveCarSpec(id));
        car.body.setLinvel(
          { x: Math.sin(spawn.yaw) * speed, y: 0, z: Math.cos(spawn.yaw) * speed },
          true,
        );
        car.input.throttle = 1;
        return { car, d, hint: index, maxOut: -Infinity };
      });
      const projection = { index: 0, distance: 0, lateral: 0 };
      for (let k = 0; k < 150; k++) {
        sim.step();
        for (const run of runs) {
          const p = track.project(run.car.position, run.hint, projection);
          run.hint = p.index;
          const wall = track.side(p.index, p.lateral < 0 ? -1 : 1).wall;
          run.maxOut = Math.max(run.maxOut, Math.abs(p.lateral) - wall);
        }
      }
      const up = new Vector3();
      for (const run of runs) {
        expect(run.maxOut, `${id} at ${run.d} m`).toBeLessThan(0.5);
        up.set(0, 1, 0).applyQuaternion(run.car.quaternion);
        expect(up.y, `${id} at ${run.d} m upright`).toBeGreaterThan(0.5);
      }
      sim.dispose();
    },
    30_000,
  );
});
