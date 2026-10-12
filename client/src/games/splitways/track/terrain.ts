/**
 * The land around a track as a heightfield. Inside the corridor it sits just under the generated
 * surface (so it never pokes through the road or run-off), it continues the run-off slope for 2 m
 * past each wall, then blends over a noisy shoulder into a natural forest floor of low hills.
 * Built by splatting stations onto the grid (each cell keeps its nearest station), so it costs one
 * pass over the stations instead of a nearest-station search per cell. Node-safe; the terrain
 * mesh, placements and scenery all read it.
 */
import { MathUtils } from 'three';
import { TRACKGEN } from '../config';
import { fbm } from './noise';
import type { Track, TrackSample } from './track';
import { TrackProximity } from './trackGeometry';

export interface TerrainField {
  minX: number;
  minZ: number;
  spacing: number;
  /** Vertices. */
  cols: number;
  rows: number;
  /** index = row * cols + col; x = minX + col * spacing, z = minZ + row * spacing. */
  heights: Float32Array;
  /** 0 at/inside the corridor edge -> 1 beyond the shoulder (splat weight). */
  wildness: Float32Array;
}

export interface RoadProximity {
  /** Distance to the centre line (m), capped at the search reach. */
  distance: number;
  /** Road height at the nearest point. */
  roadY: number;
  /**
   * True inside the loop (the track runs anticlockwise, so the infield is on the driver's left).
   * Only a hint for scenery placement; it does not change the height.
   */
  infield: boolean;
}

/**
 * The field continues the corridor's cross-section this far past the wall foot (m) before the
 * shoulder starts: 2 m, plus one grid cell so no terrain triangle touching the wall foot reaches
 * into the shoulder (on a 5 m grid one that did left the foot up to 0.35 m above the ground where
 * the hillside falls away, as at the Brow). Barriers, boards and posts stand on this band.
 */
const FLAT_PAST_WALL = 2 + TRACKGEN.terrainSpacing;
/** Below the corridor surface at the wall foot (m), and the extra depth deep inside it (m). */
const INSET_EDGE = 0.05;
const INSET_DEEP = 0.35;
/** Stations splat this far past the shoulder (m), so every shoulder cell is reached. */
const SPLAT_MARGIN = 5;
/** Corners tighter than this radius (m) keep a low sight line across their inside... */
const SIGHT_RADIUS = 200;
/** ...for this far beyond the inside wall (m), no higher than this above the road (m). */
const SIGHT_REACH = 60;
const SIGHT_HEIGHT = 2;
/** Natural ground: broad hills and small bumps (m, peak to peak) around the track's mean height. */
const HILLS = 14;
const BUMPS = 3;

export class Terrain {
  readonly field: TerrainField;
  private readonly proximity: TrackProximity;
  private readonly meanY: number;

  constructor(readonly track: Track) {
    this.proximity = new TrackProximity(track);
    let sum = 0;
    for (const s of track.samples) sum += s.position.y;
    this.meanY = sum / track.samples.length;
    this.field = this.build();
  }

  /** Height on the terrain mesh: linear on the cell's triangle (diagonal (col, row+1)-(col+1, row)). */
  heightAt(x: number, z: number): number {
    const { minX, minZ, spacing, cols, rows, heights } = this.field;
    const gx = MathUtils.clamp((x - minX) / spacing, 0, cols - 1);
    const gz = MathUtils.clamp((z - minZ) / spacing, 0, rows - 1);
    const col = Math.min(cols - 2, Math.floor(gx));
    const row = Math.min(rows - 2, Math.floor(gz));
    const fx = gx - col;
    const fz = gz - row;
    const i00 = row * cols + col;
    const h00 = heights[i00] as number;
    const h10 = heights[i00 + 1] as number;
    const h01 = heights[i00 + cols] as number;
    const h11 = heights[i00 + cols + 1] as number;
    if (fx + fz <= 1) return h00 + fx * (h10 - h00) + fz * (h01 - h00);
    return h11 + (1 - fx) * (h01 - h11) + (1 - fz) * (h10 - h11);
  }

  /** Where a point sits relative to the road. Points beyond `reach` count as outside the loop. */
  nearRoad(x: number, z: number, reach = 160): RoadProximity {
    const nearest = this.proximity.nearest(x, z, reach);
    if (nearest.index < 0) return { distance: reach, roadY: 0, infield: false };
    const sample = this.track.sample(nearest.index);
    const lateral =
      (x - sample.position.x) * sample.right.x + (z - sample.position.z) * sample.right.z;
    return {
      distance: Math.min(nearest.distance, reach),
      roadY: sample.position.y,
      infield: lateral < 0,
    };
  }

  /** The forest floor away from the track. */
  natural(x: number, z: number): number {
    return (
      this.meanY +
      HILLS * (fbm(x * 0.004, z * 0.004, 4) - 0.5) +
      BUMPS * (fbm(x * 0.02, z * 0.02, 2) - 0.5)
    );
  }

  private build(): TerrainField {
    const { track } = this;
    const samples: readonly TrackSample[] = track.samples;
    const spacing = TRACKGEN.terrainSpacing;
    const margin = TRACKGEN.terrainMargin;
    const b = track.bounds;
    const minX = Math.floor((b.minX - margin) / spacing) * spacing;
    const minZ = Math.floor((b.minZ - margin) / spacing) * spacing;
    const cols = Math.ceil((b.maxX + margin - minX) / spacing) + 1;
    const rows = Math.ceil((b.maxZ + margin - minZ) / spacing) + 1;
    const cells = cols * rows;
    const nearestSq = new Float32Array(cells).fill(Infinity);
    const station = new Int32Array(cells).fill(-1);
    const lateralOf = new Float32Array(cells);
    const cap = new Float32Array(cells).fill(Infinity);
    const range = (centre: number, reach: number, min: number, last: number) =>
      [
        Math.max(0, Math.ceil((centre - reach - min) / spacing)),
        Math.min(last, Math.floor((centre + reach - min) / spacing)),
      ] as const;

    // Splat: every station claims the cells within its reach on each side; the nearest one wins.
    samples.forEach((s, i) => {
      const reachL = s.sideL.wall + TRACKGEN.shoulderMax + SPLAT_MARGIN;
      const reachR = s.sideR.wall + TRACKGEN.shoulderMax + SPLAT_MARGIN;
      const reach = Math.max(reachL, reachR);
      const { x: px, z: pz } = s.position;
      const [c0, c1] = range(px, reach, minX, cols - 1);
      const [r0, r1] = range(pz, reach, minZ, rows - 1);
      for (let row = r0; row <= r1; row++) {
        const dz = minZ + row * spacing - pz;
        for (let col = c0; col <= c1; col++) {
          const dx = minX + col * spacing - px;
          const d2 = dx * dx + dz * dz;
          const cell = row * cols + col;
          if (d2 >= (nearestSq[cell] as number)) continue;
          const lateral = dx * s.right.x + dz * s.right.z;
          const sideReach = lateral < 0 ? reachL : reachR;
          if (d2 > sideReach * sideReach) continue;
          nearestSq[cell] = d2;
          station[cell] = i;
          lateralOf[cell] = lateral;
        }
      }
    });

    // Sight lines: keep the ground low across the inside of tight corners.
    for (const s of samples) {
      if (Math.abs(s.curvature) < 1 / SIGHT_RADIUS) continue;
      const inside = s.curvature > 0 ? -1 : 1;
      const wall = (inside < 0 ? s.sideL : s.sideR).wall;
      const qx = s.position.x + s.right.x * inside * wall;
      const qz = s.position.z + s.right.z * inside * wall;
      const limit = s.position.y + SIGHT_HEIGHT;
      const [c0, c1] = range(qx, SIGHT_REACH, minX, cols - 1);
      const [r0, r1] = range(qz, SIGHT_REACH, minZ, rows - 1);
      for (let row = r0; row <= r1; row++) {
        const z = minZ + row * spacing;
        for (let col = c0; col <= c1; col++) {
          const x = minX + col * spacing;
          if ((x - qx) ** 2 + (z - qz) ** 2 > SIGHT_REACH * SIGHT_REACH) continue;
          const lateral = (x - s.position.x) * s.right.x + (z - s.position.z) * s.right.z;
          if (lateral * inside < wall) continue;
          const cell = row * cols + col;
          cap[cell] = Math.min(cap[cell] as number, limit);
        }
      }
    }

    const heights = new Float32Array(cells);
    const wildness = new Float32Array(cells);
    const shoulderSpan = TRACKGEN.shoulderMax - TRACKGEN.shoulderMin;
    for (let row = 0; row < rows; row++) {
      const z = minZ + row * spacing;
      for (let col = 0; col < cols; col++) {
        const x = minX + col * spacing;
        const cell = row * cols + col;
        const natural = Math.min(cap[cell] as number, this.natural(x, z));
        const i = station[cell] as number;
        if (i < 0) {
          heights[cell] = natural;
          wildness[cell] = 1;
          continue;
        }
        const lateral = lateralOf[cell] as number;
        const side = lateral < 0 ? -1 : 1;
        const wall = track.side(i, side).wall;
        const centreY = (samples[i] as TrackSample).position.y;
        const a = Math.abs(lateral);
        if (a <= wall) {
          // Inside the corridor: under the surface, deepest well inside, 5 cm at the wall foot.
          const depth = MathUtils.clamp((wall - a) / (2 * spacing), 0, 1);
          heights[cell] =
            centreY + track.crossSectionY(i, lateral) - INSET_EDGE - INSET_DEEP * depth;
          wildness[cell] = 0;
        } else if (a <= wall + FLAT_PAST_WALL) {
          // The run-off slope carries on behind the wall, so the field has no step at its foot.
          heights[cell] = centreY + track.crossSectionY(i, lateral) - INSET_EDGE;
          wildness[cell] = 0;
        } else {
          const edge = side * (wall + FLAT_PAST_WALL);
          const edgeY = centreY + track.crossSectionY(i, edge) - INSET_EDGE;
          const shoulder = TRACKGEN.shoulderMin + shoulderSpan * fbm(x * 0.01, z * 0.01, 2);
          const w = MathUtils.smoothstep(a - wall - FLAT_PAST_WALL, 0, shoulder);
          heights[cell] = MathUtils.lerp(edgeY, natural, w);
          wildness[cell] = w;
        }
      }
    }
    return { minX, minZ, spacing, cols, rows, heights, wildness };
  }
}
