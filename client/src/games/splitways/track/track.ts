/**
 * A race track built from generated stations (trackgen v1, `gen/generate.ts`): about one station
 * per metre with the centre line, banking and the side profile of the corridor. Everything else
 * (road and run-off meshes, physics, walls, checkpoints, grid, terrain, minimap) derives from these
 * samples. Node-safe: no rendering.
 */
import { Vector3 } from 'three';
import { TRACKGEN } from '../config';
import type { Spawn } from '../sim/car';
import type { StationSides } from './gen/corridor';
import type { GeneratedTrack } from './gen/generate';
import { SURFACE, type BarrierId, type SurfaceId } from './surfaces';

export interface StationSide {
  road: number;
  kerb: number;
  kerbHeight: number;
  runoff: number;
  runoffSurface: SurfaceId;
  barrier: BarrierId;
  /** = road + kerb + runoff: lateral of the wall face (m, > 0). */
  wall: number;
}

export interface TrackSample {
  /** Centre line; y = road height at the centre. */
  position: Vector3;
  /** Unit direction of travel (horizontal). */
  tangent: Vector3;
  /** Unit vector to the driver's right (horizontal). */
  right: Vector3;
  /** i * spacing (m). */
  distance: number;
  /** Signed plan curvature (1/m): positive bends left. */
  curvature: number;
  /** Bank angle (rad): positive raises the right edge. */
  bank: number;
  /** Slope along the lap (dy/ds). */
  grade: number;
  sideL: StationSide;
  sideR: StationSide;
  /** Racing-line lateral offset (m, + = right). */
  racingLine: number;
  /** Speed the racing line can carry here (m/s). */
  targetSpeed: number;
}

export interface Checkpoint {
  index: number;
  /** Arc length along the loop (m). */
  distance: number;
  sample: TrackSample;
  /** Half extents of the trigger box: along the road, across it to each side, and vertically. */
  halfLength: number;
  halfWidthLeft: number;
  halfWidthRight: number;
  halfHeight: number;
}

export interface Projection {
  /** Index of the nearest sample. */
  index: number;
  /** Arc length of that sample (m). */
  distance: number;
  /** Signed distance from the centre line, positive to the right (m). */
  lateral: number;
}

export interface TrackBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

const UP = new Vector3(0, 1, 0);
const delta = new Vector3();
/** Gates reach this far beyond each wall (m), and this far up and down. */
const GATE_WIDTH_MARGIN = 1.5;
const GATE_HALF_HEIGHT = 6;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  if (sorted.length % 2) return sorted[mid] as number;
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

function stationSide(sides: StationSides, i: number): StationSide {
  const road = sides.road[i] as number;
  const kerb = sides.kerb[i] as number;
  const runoff = sides.runoff[i] as number;
  return {
    road,
    kerb,
    kerbHeight: sides.kerbHeight[i] as number,
    runoff,
    runoffSurface: sides.runoffSurface[i] as SurfaceId,
    barrier: sides.barrier[i] as BarrierId,
    wall: road + kerb + runoff,
  };
}

export class Track {
  readonly samples: TrackSample[];
  readonly length: number;
  readonly spacing: number;
  readonly checkpoints: Checkpoint[];
  /** Nominal: median asphalt half width (legacy callers). */
  readonly halfRoad: number;
  /** Nominal: median of min(sideL.wall, sideR.wall). */
  readonly halfDrivable: number;
  /** Plan extent of the corridor out to the walls, and the centre line's height range. */
  readonly bounds: TrackBounds;

  constructor(readonly definition: GeneratedTrack) {
    const n = definition.count;
    this.length = definition.length;
    this.spacing = definition.spacing;
    this.samples = [];
    for (let i = 0; i < n; i++) {
      const h = definition.heading[i] as number;
      const tangent = new Vector3(Math.sin(h), 0, Math.cos(h));
      const ahead = definition.y[(i + 1) % n] as number;
      const behind = definition.y[(i - 1 + n) % n] as number;
      this.samples.push({
        position: new Vector3(definition.x[i], definition.y[i], definition.z[i]),
        tangent,
        right: new Vector3().crossVectors(tangent, UP).normalize(),
        distance: i * this.spacing,
        curvature: definition.curvature[i] as number,
        bank: definition.bank[i] as number,
        grade: (ahead - behind) / (2 * this.spacing),
        sideL: stationSide(definition.left, i),
        sideR: stationSide(definition.right, i),
        racingLine: definition.racingLine[i] as number,
        targetSpeed: definition.speed[i] as number,
      });
    }
    const roads: number[] = [];
    const drivable: number[] = [];
    const bounds: TrackBounds = {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
      minZ: Infinity,
      maxZ: -Infinity,
    };
    for (const s of this.samples) {
      roads.push(s.sideL.road, s.sideR.road);
      drivable.push(Math.min(s.sideL.wall, s.sideR.wall));
      for (const [side, wall] of [
        [-1, s.sideL.wall],
        [1, s.sideR.wall],
      ] as const) {
        const x = s.position.x + s.right.x * side * wall;
        const z = s.position.z + s.right.z * side * wall;
        bounds.minX = Math.min(bounds.minX, x);
        bounds.maxX = Math.max(bounds.maxX, x);
        bounds.minZ = Math.min(bounds.minZ, z);
        bounds.maxZ = Math.max(bounds.maxZ, z);
      }
      bounds.minY = Math.min(bounds.minY, s.position.y);
      bounds.maxY = Math.max(bounds.maxY, s.position.y);
    }
    this.halfRoad = median(roads);
    this.halfDrivable = median(drivable);
    this.bounds = bounds;

    this.checkpoints = [];
    for (let k = 0; k < definition.checkpointCount; k++) {
      const sample = this.sampleAt(
        definition.startDistance + (k * this.length) / definition.checkpointCount,
      );
      this.checkpoints.push({
        index: k,
        distance: sample.distance,
        sample,
        // Long enough along the road that even a car at top speed can't skip it between two steps.
        halfLength: TRACKGEN.checkpointHalfLength,
        halfWidthLeft: sample.sideL.wall + GATE_WIDTH_MARGIN,
        halfWidthRight: sample.sideR.wall + GATE_WIDTH_MARGIN,
        halfHeight: GATE_HALF_HEIGHT,
      });
    }
  }

  get startLine(): Checkpoint {
    const start = this.checkpoints[0];
    if (!start) throw new Error('Track has no checkpoints');
    return start;
  }

  /** Arc length wrapped into [0, length). */
  wrap(distance: number): number {
    return ((distance % this.length) + this.length) % this.length;
  }

  /** Forward distance from `from` to `to` around the loop, in [0, length). */
  ahead(from: number, to: number): number {
    return this.wrap(to - from);
  }

  sample(index: number): TrackSample {
    const n = this.samples.length;
    return this.samples[((index % n) + n) % n] as TrackSample;
  }

  /** Index of the station nearest to an arc length. */
  indexAt(distance: number): number {
    return Math.round(this.wrap(distance) / this.spacing) % this.samples.length;
  }

  /** Nearest stored sample to an arc length. */
  sampleAt(distance: number): TrackSample {
    return this.sample(this.indexAt(distance));
  }

  /**
   * Nearest centre-line sample to a position (XZ), searching around a previous index so cars on two
   * nearby stretches of the lap are never confused. Pass -1 to search everything.
   */
  project(position: Vector3, hint: number, out: Projection, window = 40): Projection {
    const n = this.samples.length;
    let best = -1;
    let bestDistance = Infinity;
    const from = hint < 0 ? 0 : hint - window;
    const to = hint < 0 ? n - 1 : hint + window;
    for (let i = from; i <= to; i++) {
      const sample = this.sample(i);
      const dx = position.x - sample.position.x;
      const dz = position.z - sample.position.z;
      const d = dx * dx + dz * dz;
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    }
    const index = ((best % n) + n) % n;
    const sample = this.sample(index);
    delta.subVectors(position, sample.position);
    out.index = index;
    out.distance = sample.distance;
    out.lateral = delta.dot(sample.right);
    return out;
  }

  /** Starting grid behind the start line: pairs of slots, staggered, facing the direction of travel. */
  gridSpawns(count: number): Spawn[] {
    const spawns: Spawn[] = [];
    for (let slot = 0; slot < count; slot++) {
      const row = Math.floor(slot / 2);
      const side = slot % 2 === 0 ? -1 : 1;
      const back = 8 + row * 9 + (side > 0 ? 3 : 0);
      const distance = this.startLine.distance - back;
      const road = this.side(this.indexAt(distance), side).road;
      spawns.push(this.spawnAt(distance, side * road * 0.45));
    }
    return spawns;
  }

  /** A spawn at an arc length, offset sideways (+ = right), 0.5 m above the banked surface. */
  spawnAt(distance: number, lateral: number): Spawn {
    const index = this.indexAt(distance);
    const sample = this.sample(index);
    return {
      x: sample.position.x + sample.right.x * lateral,
      y: sample.position.y + this.crossSectionY(index, lateral) + 0.5,
      z: sample.position.z + sample.right.z * lateral,
      yaw: Math.atan2(sample.tangent.x, sample.tangent.z),
    };
  }

  /** Smallest turning radius along the track (m). */
  minimumRadius(): number {
    let maxCurvature = 0;
    for (const s of this.samples) maxCurvature = Math.max(maxCurvature, Math.abs(s.curvature));
    return maxCurvature > 0 ? 1 / maxCurvature : Infinity;
  }

  /** The side profile at a station: -1 left, +1 right. */
  side(index: number, side: -1 | 1): StationSide {
    const sample = this.sample(index);
    return side < 0 ? sample.sideL : sample.sideR;
  }

  /** Height of the corridor surface at a plan lateral offset (+ right), relative to the centre point. */
  crossSectionY(index: number, lateral: number): number {
    const sample = this.sample(index);
    const s = lateral < 0 ? -1 : 1;
    const a = Math.abs(lateral);
    const p = s < 0 ? sample.sideL : sample.sideR;
    const t = Math.tan(sample.bank);
    if (a <= p.road) return lateral * t;
    if (p.kerb > 0 && a <= p.road + p.kerb) {
      return lateral * t + (p.kerbHeight * (a - p.road)) / p.kerb;
    }
    const edge = p.road + p.kerb;
    const yEdge = s * edge * t + p.kerbHeight;
    const max = TRACKGEN.runoffMaxSlope;
    const slope = Math.min(max, Math.max(-max, s * t)) - TRACKGEN.runoffFall;
    return yEdge + (a - edge) * slope;
  }

  /** Centre + right * lateral, at crossSectionY + lift. Use for every placement relative to the road. */
  lateralPoint(index: number, lateral: number, out: Vector3, lift = 0): Vector3 {
    const sample = this.sample(index);
    return out.set(
      sample.position.x + sample.right.x * lateral,
      sample.position.y + this.crossSectionY(index, lateral) + lift,
      sample.position.z + sample.right.z * lateral,
    );
  }

  /** Ground surface at a lateral offset: asphalt, then kerb, then the run-off (also beyond the wall). */
  surfaceAt(index: number, lateral: number): SurfaceId {
    const sample = this.sample(index);
    const p = lateral < 0 ? sample.sideL : sample.sideR;
    const a = Math.abs(lateral);
    if (a <= p.road) return SURFACE.asphalt;
    if (a <= p.road + p.kerb) return SURFACE.kerb;
    return p.runoffSurface;
  }

  /** Problems found (empty = valid): inside wall >= 0.9 / |curvature|, wall <= road, NaNs. */
  validateCorridor(): string[] {
    const problems: string[] = [];
    this.samples.forEach((s, i) => {
      const values = [s.position.x, s.position.y, s.position.z, s.curvature, s.bank];
      values.push(s.racingLine, s.targetSpeed);
      for (const p of [s.sideL, s.sideR]) values.push(p.road, p.kerb, p.kerbHeight, p.runoff);
      if (values.some((v) => !Number.isFinite(v)))
        problems.push(`station ${i}: not a finite number`);
      for (const [name, p] of [
        ['left', s.sideL],
        ['right', s.sideR],
      ] as const) {
        if (!(p.wall > p.road))
          problems.push(`station ${i}: ${name} wall ${p.wall} <= road ${p.road}`);
      }
      if (Math.abs(s.curvature) > 1e-9) {
        const inside = s.curvature > 0 ? s.sideL : s.sideR;
        const limit = 0.9 / Math.abs(s.curvature);
        if (inside.wall >= limit) {
          problems.push(
            `station ${i}: inside wall ${inside.wall.toFixed(2)} >= 0.9 R ${limit.toFixed(2)}`,
          );
        }
      }
    });
    return problems;
  }
}
