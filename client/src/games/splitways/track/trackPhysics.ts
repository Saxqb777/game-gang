import { SURFACE_FRICTION, type PhysicsWorld } from '../sim/world';
import { SURFACE_NAMES, type SurfaceId } from './surfaces';
import type { Track } from './track';
import { corridorPhysicsMesh, wallHulls } from './trackGeometry';

/** Floor margin around the track bounds (m) and its drop below the lowest station (m). */
const FLOOR_MARGIN = 600;
const FLOOR_DROP = 6;

/**
 * Colliders for a track: the corridor surface as one trimesh per surface (each registered, so the
 * wheels know what they roll on), the invisible wall hulls, and a safety floor.
 */
export function buildTrackPhysics(physics: PhysicsWorld, track: Track): void {
  const mesh = corridorPhysicsMesh(track);
  for (let surface = 0; surface < SURFACE_NAMES.length; surface++) {
    // Re-index this surface's triangles into a compact vertex list.
    const remap = new Map<number, number>();
    const vertices: number[] = [];
    const indices: number[] = [];
    for (let t = 0; t < mesh.surfaceIds.length; t++) {
      if (mesh.surfaceIds[t] !== surface) continue;
      for (let k = 0; k < 3; k++) {
        const original = mesh.indices[t * 3 + k] as number;
        let index = remap.get(original);
        if (index === undefined) {
          index = vertices.length / 3;
          remap.set(original, index);
          vertices.push(
            mesh.positions[original * 3] as number,
            mesh.positions[original * 3 + 1] as number,
            mesh.positions[original * 3 + 2] as number,
          );
        }
        indices.push(index);
      }
    }
    if (indices.length === 0) continue;
    const collider = physics.addTrimesh(new Float32Array(vertices), new Uint32Array(indices));
    physics.registerSurface(collider, surface as SurfaceId);
  }
  for (const hull of wallHulls(track)) physics.addConvexHull(hull, SURFACE_FRICTION.wall);
  // Anything that escapes lands here and gets respawned.
  const b = track.bounds;
  physics.addBox(
    { x: (b.minX + b.maxX) / 2, y: b.minY - FLOOR_DROP - 1, z: (b.minZ + b.maxZ) / 2 },
    { x: (b.maxX - b.minX) / 2 + FLOOR_MARGIN, y: 1, z: (b.maxZ - b.minZ) / 2 + FLOOR_MARGIN },
  );
}
