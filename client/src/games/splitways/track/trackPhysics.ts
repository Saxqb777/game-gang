import { SURFACE_FRICTION, type PhysicsWorld } from '../sim/world';
import type { Track } from './track';
import { drivableSurface, wallSegments } from './trackGeometry';

/** Colliders for a track: the drivable surface as a trimesh, invisible walls, and a safety floor. */
export function buildTrackPhysics(physics: PhysicsWorld, track: Track): void {
  const surface = drivableSurface(track);
  physics.addTrimesh(surface.positions, surface.indices);
  for (const wall of wallSegments(track)) {
    physics.addBox(wall.centre, wall.half, wall.yaw, SURFACE_FRICTION.wall);
  }
  // Anything that escapes lands here and gets respawned.
  let lowest = Infinity;
  for (const s of track.samples) lowest = Math.min(lowest, s.position.y);
  physics.addBox({ x: 0, y: lowest - 6, z: 0 }, { x: 2000, y: 1, z: 2000 });
}
