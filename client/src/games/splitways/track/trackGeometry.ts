/**
 * Geometry derived from a Track. The corridor meshes, the physics surface and the wall hulls are
 * implemented in `gen/corridor.ts` and re-exported here, so scene and physics code import them from
 * one place. `buildStrip` stays for the interim road visuals; `TrackProximity` for nearest-station
 * queries. Node-safe (no WebGL), so the physics tests build exactly what the game drives on.
 */
import { Vector3 } from 'three';
import { TRACKGEN } from '../config';
import type { Track } from './track';

export {
  corridorChunks,
  corridorPhysicsMesh,
  wallHulls,
  type BandMesh,
  type BandName,
  type CorridorChunk,
  type PhysicsSurfaceMesh,
  type PropInstance,
} from './gen/corridor';

export interface Strip {
  /** xyz per vertex. */
  positions: Float32Array;
  /** uv per vertex: u across the strip, v along the road in metres / tile length. */
  uvs: Float32Array;
  indices: Uint32Array;
}

/** Wall height above the wall foot (invisible collision walls; the visible barrier is lower). */
export const WALL_HEIGHT = TRACKGEN.wallHeight;

const point = new Vector3();

/**
 * A strip of quads following the track between two lateral offsets (negative = left of centre).
 * UVs are in metres divided by `tile` (u across the road, v along it), so textures keep their
 * real-world scale on any width.
 */
export function buildStrip(
  track: Track,
  fromLateral: number,
  toLateral: number,
  tile: number,
  lift = 0,
): Strip {
  const n = track.samples.length;
  // One extra ring closes the loop with its own UVs so the texture doesn't jump at the seam.
  const rings = n + 1;
  const positions = new Float32Array(rings * 2 * 3);
  const uvs = new Float32Array(rings * 2 * 2);
  for (let i = 0; i < rings; i++) {
    const v = (i === n ? track.length : track.sample(i).distance) / tile;
    for (let side = 0; side < 2; side++) {
      const lateral = side === 0 ? fromLateral : toLateral;
      const o = (i * 2 + side) * 3;
      // On the banked cross-section, so the interim visuals follow the generated surface.
      track.lateralPoint(i, lateral, point, lift);
      positions[o] = point.x;
      positions[o + 1] = point.y;
      positions[o + 2] = point.z;
      const t = (i * 2 + side) * 2;
      uvs[t] = lateral / tile;
      uvs[t + 1] = v;
    }
  }
  const indices = new Uint32Array(n * 6);
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    // Counter-clockwise seen from above, so faces point up.
    indices.set([a, b, c, b, d, c], i * 6);
  }
  return { positions, uvs, indices };
}

/**
 * Nearest-sample lookup on a coarse grid, for terrain generation (hundreds of thousands of queries).
 */
export class TrackProximity {
  private readonly cells = new Map<number, number[]>();

  constructor(
    private readonly track: Track,
    private readonly cellSize = 24,
  ) {
    track.samples.forEach((s, i) => {
      const key = this.key(
        Math.floor(s.position.x / cellSize),
        Math.floor(s.position.z / cellSize),
      );
      const list = this.cells.get(key);
      if (list) list.push(i);
      else this.cells.set(key, [i]);
    });
  }

  /** Distance (XZ) to the centre line and the nearest sample index (-1 if nothing within reach). */
  nearest(x: number, z: number, maxDistance: number): { distance: number; index: number } {
    const cs = this.cellSize;
    const reach = Math.ceil(maxDistance / cs);
    const cx = Math.floor(x / cs);
    const cz = Math.floor(z / cs);
    let best = -1;
    let bestSq = Infinity;
    // Search outward ring by ring and stop once no closer sample can exist.
    for (let ring = 0; ring <= reach; ring++) {
      const ringStart = Math.max(0, ring - 1) * cs;
      if (best >= 0 && ringStart * ringStart > bestSq) break;
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dz = -ring; dz <= ring; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
          const list = this.cells.get(this.key(cx + dx, cz + dz));
          if (!list) continue;
          for (const i of list) {
            const p = (this.track.samples[i] as { position: Vector3 }).position;
            const d = (p.x - x) ** 2 + (p.z - z) ** 2;
            if (d < bestSq) {
              bestSq = d;
              best = i;
            }
          }
        }
      }
    }
    return { distance: best < 0 ? Infinity : Math.sqrt(bestSq), index: best };
  }

  private key(cx: number, cz: number): number {
    // Numeric keys: this runs hundreds of thousands of times while building terrain.
    return (cx + 32768) * 65536 + (cz + 32768);
  }
}
