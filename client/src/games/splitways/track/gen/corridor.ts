/**
 * The corridor: everything between the two collision walls.
 *
 * Generation side (steps 6 and 9): the per-station side profile (asphalt, kerb, run-off, barrier)
 * from the resampled layout, and tyre walls where the speed profile drops hard into a corner.
 *
 * Geometry side (consumed by the scene and physics): the visual bands in chunks, the physics
 * triangles with one surface per triangle, and the invisible wall hulls. Every vertex comes from
 * `Track.lateralPoint`, so visuals, physics and terrain agree on the banked cross-section.
 * `trackGeometry.ts` re-exports the geometry functions. Node-safe.
 */
import { MathUtils, Vector3 } from 'three';
import { TRACKGEN } from '../../config';
import { BARRIER, SURFACE, type BarrierId, type SurfaceId } from '../surfaces';
import type { Track } from '../track';
import type { ExtraKerb, LayoutSegment } from './layout';
import type { BrakingZone } from './racingLine';

// ---------------------------------------------------------------------------------------------
// Generation: side profiles.

export interface StationSides {
  road: Float32Array; // asphalt half width on this side (m, > 0)
  kerb: Float32Array; // kerb width beyond the asphalt edge (m, >= 0)
  kerbHeight: Float32Array;
  runoff: Float32Array; // run-off width beyond the kerb (m, >= 0)
  runoffSurface: Uint8Array; // SurfaceId
  barrier: Uint8Array; // BarrierId
}

export function createSides(count: number): StationSides {
  return {
    road: new Float32Array(count),
    kerb: new Float32Array(count),
    kerbHeight: new Float32Array(count),
    runoff: new Float32Array(count),
    runoffSurface: new Uint8Array(count),
    barrier: new Uint8Array(count),
  };
}

/** Periodic centred moving average over `window` stations (in place). */
export function movingAverage(values: Float32Array, window: number): void {
  const n = values.length;
  const half = Math.floor(window / 2);
  if (half < 1 || n === 0) return;
  const source = Float32Array.from(values);
  const width = 2 * half + 1;
  let sum = 0;
  for (let k = -half; k <= half; k++) sum += source[((k % n) + n) % n] as number;
  for (let i = 0; i < n; i++) {
    values[i] = sum / width;
    sum += (source[(i + half + 1) % n] as number) - (source[(((i - half) % n) + n) % n] as number);
  }
}

export interface ProfileInput {
  segments: readonly LayoutSegment[];
  /** Per station: the segment it lies in, and how far into it (m). */
  segment: Uint16Array;
  offset: Float32Array;
  /** Per station plan curvature (1/m, + = left). */
  curvature: Float32Array;
  extraKerbs: readonly ExtraKerb[];
}

export interface CorridorProfile {
  left: StationSides;
  right: StationSides;
  warnings: string[];
}

/**
 * Step 6. Road, kerb and run-off per station and side from the layout (run-off widths linear over
 * each segment). The asphalt edge and the wall line get a TRACKGEN.smoothWindow moving average so
 * neither ever steps where a segment changes width; kerbs keep their hard start and end. Extra kerb
 * spans take their width out of the run-off, so the wall stays put. Then the inside wall is kept
 * under 0.9 / |curvature| by shrinking that side's run-off.
 */
export function corridorProfile(input: ProfileInput): CorridorProfile {
  const n = input.curvature.length;
  const left = createSides(n);
  const right = createSides(n);
  const wallL = new Float32Array(n);
  const wallR = new Float32Array(n);
  const warnings: string[] = [];
  for (let i = 0; i < n; i++) {
    const segment = input.segments[input.segment[i] as number] as LayoutSegment;
    const length = segmentSpan(segment);
    const t = Math.min(1, Math.max(0, (input.offset[i] as number) / length));
    for (const [sides, spec, wall] of [
      [left, segment.left, wallL],
      [right, segment.right, wallR],
    ] as const) {
      sides.road[i] = segment.roadWidth / 2;
      sides.kerb[i] = spec.kerbWidth;
      sides.kerbHeight[i] = spec.kerbWidth > 0 ? spec.kerbHeight : 0;
      sides.runoff[i] = spec.runoffStart + (spec.runoffEnd - spec.runoffStart) * t;
      sides.runoffSurface[i] = SURFACE[spec.runoffSurface];
      sides.barrier[i] = BARRIER[spec.barrier];
      wall[i] = (sides.road[i] as number) + (sides.kerb[i] as number) + (sides.runoff[i] as number);
    }
  }
  // Extra kerbs: by segment name and metres into it.
  for (const span of input.extraKerbs) {
    const index = input.segments.findIndex((s) => s.name === span.segment);
    if (index < 0) throw new Error(`Unknown segment "${span.segment}" in overrides.extraKerbs`);
    const sides = span.side === 'left' ? left : right;
    const width = span.width ?? TRACKGEN.extraKerbWidth;
    for (let i = 0; i < n; i++) {
      if (input.segment[i] !== index) continue;
      const u = input.offset[i] as number;
      if (u < span.start || u > span.start + span.length) continue;
      const added = Math.max(0, width - (sides.kerb[i] as number));
      if (added === 0) continue;
      if ((sides.kerb[i] as number) === 0) sides.kerbHeight[i] = TRACKGEN.extraKerbHeight;
      sides.kerb[i] = width;
      sides.runoff[i] = Math.max(0, (sides.runoff[i] as number) - added);
    }
  }
  // Smooth the asphalt edge and the wall line; run-off is whatever lies between kerb and wall.
  const window = Math.round(TRACKGEN.smoothWindow);
  for (const [sides, wall] of [
    [left, wallL],
    [right, wallR],
  ] as const) {
    for (let i = 0; i < n; i++) {
      wall[i] = (sides.road[i] as number) + (sides.kerb[i] as number) + (sides.runoff[i] as number);
    }
    movingAverage(sides.road, window);
    movingAverage(wall, window);
    for (let i = 0; i < n; i++) {
      sides.runoff[i] = Math.max(
        0,
        (wall[i] as number) - (sides.road[i] as number) - (sides.kerb[i] as number),
      );
    }
  }
  // The inside wall must stay well inside the centre of curvature or the corridor would fold.
  for (let i = 0; i < n; i++) {
    const k = input.curvature[i] as number;
    if (Math.abs(k) < 1e-9) continue;
    const limit = 0.9 / Math.abs(k);
    const sides = k > 0 ? left : right;
    const wall =
      (sides.road[i] as number) + (sides.kerb[i] as number) + (sides.runoff[i] as number);
    if (wall < limit) continue;
    const runoff = Math.max(
      0,
      limit * 0.999 - (sides.road[i] as number) - (sides.kerb[i] as number),
    );
    const segment = input.segments[input.segment[i] as number] as LayoutSegment;
    warnings.push(
      `station ${i} (${segment.name}): inside ${k > 0 ? 'left' : 'right'} run-off ${(sides.runoff[i] as number).toFixed(2)} -> ${runoff.toFixed(2)} m (wall ${wall.toFixed(2)} >= 0.9 R ${limit.toFixed(2)})`,
    );
    sides.runoff[i] = runoff;
  }
  return { left, right, warnings };
}

function segmentSpan(segment: LayoutSegment): number {
  if (segment.type === 'straight') return segment.length;
  if (segment.radiusStart === segment.radiusEnd) return segment.arc * segment.radiusStart;
  return (2 * segment.arc) / (1 / segment.radiusStart + 1 / segment.radiusEnd);
}

/** Metres past the slowest point that a tyre wall keeps going. */
const TYRES_PAST_APEX = 40;

/**
 * Step 9. Where the speed falls by more than TRACKGEN.tyreDropSpeed into a corner, the outside
 * barrier from the braking point to 40 m past the apex becomes a tyre wall. A pit wall or catch
 * fence that the layout placed on purpose is kept.
 */
export function applyTyreBarriers(
  zones: readonly BrakingZone[],
  curvature: Float32Array,
  left: StationSides,
  right: StationSides,
  spacing: number,
): void {
  const n = curvature.length;
  for (const zone of zones) {
    if (zone.drop <= TRACKGEN.tyreDropSpeed) continue;
    const outside = (curvature[zone.apex] as number) > 0 ? right : left;
    const end = zone.apex + Math.round(TYRES_PAST_APEX / spacing);
    let length = end - zone.start;
    if (length < 0) length += n;
    for (let k = 0; k <= length; k++) {
      const i = (zone.start + k) % n;
      const barrier = outside.barrier[i] as BarrierId;
      if (barrier === BARRIER.wall || barrier === BARRIER.fence) continue;
      outside.barrier[i] = BARRIER.tyres;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Geometry: visual bands, physics triangles and wall hulls.

export type BandName =
  'asphalt' | 'kerb' | 'grass' | 'gravel' | 'apron' | 'lines' | 'skirt' | 'armco';
export interface BandMesh {
  positions: Float32Array; // xyz
  normals: Float32Array; // xyz
  uvs: Float32Array; // metres: u = lateral (kerb: 0..1 across), v = distance along the lap
  indices: Uint32Array; // CCW from above (upward-facing bands)
  racingLine?: Float32Array; // asphalt only: racing-line lateral (m) per vertex
}
export interface PropInstance {
  x: number;
  y: number;
  z: number;
  yaw: number;
}
export interface CorridorChunk {
  index: number;
  from: number; // first station
  to: number; // one past the last station (shares its ring with the next chunk)
  centre: [number, number, number];
  radius: number; // bounding sphere
  bands: Partial<Record<BandName, BandMesh>>;
  tyreStacks: PropInstance[]; // one per metre of tyre wall, 2 rows
  armcoPosts: PropInstance[]; // every 4 m of armco
}
export interface PhysicsSurfaceMesh {
  positions: Float32Array;
  indices: Uint32Array;
  surfaceIds: Uint8Array; // one per triangle
}

/** Edge lines: lateral span inside each asphalt edge (m), and their lift (m). */
const LINE_INNER = 0.45;
const LINE_OUTER = 0.25;
const LINE_LIFT = 0.01;
/** Kerb ridges: one every 0.5 m along the lap, this high (m). */
const KERB_RIDGE = 0.02;
const KERB_RINGS = [0, 0.25, 0.5, 0.75] as const;
const KERB_RING_LIFT = [0, KERB_RIDGE, 0, KERB_RIDGE] as const;
/**
 * The ridges stop this far (fraction of the kerb width) short of its edges, which stay flat on the
 * station rings: the kerb then meets the asphalt and run-off edges vertex for vertex, with no slits
 * under lifted edges and no T-junctions.
 */
const KERB_BEVEL = 0.06;
/** Skirt below the run-off's outer edge (m). */
const SKIRT_DROP = 1;
/** Armco rail: bottom and top above the wall foot (m); posts stand this far behind the rail. */
const ARMCO_BOTTOM = 0.45;
const ARMCO_TOP = 0.8;
const ARMCO_POST_BACK = 0.12;
const ARMCO_POST_EVERY = 4;
/** Tyre stack rows: centre distance behind the wall face (m). */
const TYRE_ROWS = [0.33, 0.95] as const;
/** Wall hulls: stations per hull, overlap at each end (m), depth below the foot (m). */
const HULL_STATIONS = 4;
const HULL_OVERLAP = 0.6;
const HULL_BELOW = 1;
/** How far each hull's overlapping end sits behind its neighbour's face (m); more than any contact depth. */
const HULL_RECESS = 0.05;

/** Which visual band a run-off surface draws in. */
const RUNOFF_BAND: Record<SurfaceId, BandName> = {
  [SURFACE.asphalt]: 'apron',
  [SURFACE.kerb]: 'apron',
  [SURFACE.grass]: 'grass',
  [SURFACE.gravel]: 'gravel',
};

const pa = new Vector3();
const pb = new Vector3();
const pc = new Vector3();
const across = new Vector3();
const along = new Vector3();
const normal = new Vector3();
const e1 = new Vector3();
const e2 = new Vector3();

/** Unit normal of the cross-section piece between l0 and l1 at station i, smooth along the lap. */
function surfaceNormal(track: Track, i: number, l0: number, l1: number, l: number, out: Vector3) {
  const lo = Math.min(l0, l1);
  const hi = Math.max(l0, l1, lo + 0.01);
  track.lateralPoint(i, lo, pa);
  track.lateralPoint(i, hi, pb);
  across.subVectors(pb, pa);
  track.lateralPoint(i + 1, l, pb);
  track.lateralPoint(i - 1, l, pa);
  along.subVectors(pb, pa);
  out.crossVectors(across, along).normalize();
  if (out.y < 0) out.negate();
  return out;
}

class BandBuilder {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly uvs: number[] = [];
  readonly indices: number[] = [];
  readonly racing: number[] | null;
  private readonly keys = new Map<number, number>();

  constructor(withRacingLine = false) {
    this.racing = withRacingLine ? [] : null;
  }

  /** Adds (or reuses, by key) a vertex; returns its index. */
  vertex(key: number, p: Vector3, n: Vector3, u: number, v: number, racing = 0): number {
    const known = this.keys.get(key);
    if (known !== undefined) return known;
    const index = this.positions.length / 3;
    this.positions.push(p.x, p.y, p.z);
    this.normals.push(n.x, n.y, n.z);
    this.uvs.push(u, v);
    this.racing?.push(racing);
    this.keys.set(key, index);
    return index;
  }

  /** Quad a-b (this ring), c-d (next ring), wound so each triangle faces `facing`; skips slivers. */
  quad(a: number, b: number, c: number, d: number, facing: Vector3): void {
    this.triangle(a, b, c, facing);
    this.triangle(b, d, c, facing);
  }

  triangle(a: number, b: number, c: number, facing: Vector3): void {
    const area = triangleNormal(this.positions, a, b, c, normal);
    if (area < 1e-6) return;
    if (normal.dot(facing) >= 0) this.indices.push(a, b, c);
    else this.indices.push(a, c, b);
  }

  build(): BandMesh | null {
    if (this.indices.length === 0) return null;
    const mesh: BandMesh = {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      uvs: new Float32Array(this.uvs),
      indices: new Uint32Array(this.indices),
    };
    if (this.racing) mesh.racingLine = new Float32Array(this.racing);
    return mesh;
  }
}

/** Geometric normal of triangle (a, b, c) into `out`; returns twice its area. */
function triangleNormal(
  positions: readonly number[],
  a: number,
  b: number,
  c: number,
  out: Vector3,
) {
  pa.set(positions[a * 3] as number, positions[a * 3 + 1] as number, positions[a * 3 + 2]);
  pb.set(positions[b * 3] as number, positions[b * 3 + 1] as number, positions[b * 3 + 2]);
  pc.set(positions[c * 3] as number, positions[c * 3 + 1] as number, positions[c * 3 + 2]);
  e1.subVectors(pb, pa);
  e2.subVectors(pc, pa);
  out.crossVectors(e1, e2);
  const length = out.length();
  if (length > 0) out.divideScalar(length);
  return length;
}

const UP = new Vector3(0, 1, 0);
const facing = new Vector3();
const vp = new Vector3();
const vn = new Vector3();
const vq = new Vector3();

/** Lateral columns of one side at station i: asphalt edge, kerb edge, wall. */
function columns(track: Track, i: number, side: -1 | 1): [number, number, number] {
  const p = track.side(i, side);
  return [side * p.road, side * (p.road + p.kerb), side * p.wall];
}

/** Yaw that turns local +Z towards the road from a point on `side`. */
function yawToRoad(track: Track, i: number, side: -1 | 1): number {
  const r = track.sample(i).right;
  return Math.atan2(-side * r.x, -side * r.z);
}

/**
 * The visual corridor in chunks of `chunkLength` stations (chunks share their boundary ring; the
 * last one ends on the ring of station 0, at v = length).
 */
export function corridorChunks(
  track: Track,
  chunkLength: number = TRACKGEN.chunkLength,
): CorridorChunk[] {
  const count = track.samples.length;
  const per = Math.max(1, Math.round(chunkLength / track.spacing));
  const chunks: CorridorChunk[] = [];
  for (let from = 0, index = 0; from < count; from += per, index++) {
    chunks.push(buildChunk(track, index, from, Math.min(count, from + per)));
  }
  return chunks;
}

function buildChunk(track: Track, index: number, from: number, to: number): CorridorChunk {
  const spacing = track.spacing;
  const asphalt = new BandBuilder(true);
  const kerb = new BandBuilder();
  const lines = new BandBuilder();
  const skirt = new BandBuilder();
  const armco = new BandBuilder();
  const runoff: Partial<Record<BandName, BandBuilder>> = {};
  const tyreStacks: PropInstance[] = [];
  const armcoPosts: PropInstance[] = [];
  const v = (i: number) => i * spacing;
  const key = (i: number, column: number) => (i - from) * 64 + column;

  /** A ring vertex at station i and lateral l on a band. */
  const at = (
    band: BandBuilder,
    i: number,
    column: number,
    l: number,
    l0: number,
    l1: number,
    u: number,
    lift = 0,
  ) => {
    track.lateralPoint(i, l, vp, lift);
    surfaceNormal(track, i, l0, l1, l, vn);
    return band.vertex(key(i, column), vp, vn, u, v(i), track.sample(i).racingLine);
  };

  for (let i = from; i < to; i++) {
    const j = i + 1;
    const sample = track.sample(i);
    // Asphalt.
    const [rl0, kl0, wl0] = columns(track, i, -1);
    const [rr0, kr0, wr0] = columns(track, i, 1);
    const [rl1, kl1, wl1] = columns(track, j, -1);
    const [rr1, kr1, wr1] = columns(track, j, 1);
    asphalt.quad(
      at(asphalt, i, 0, rl0, rl0, rr0, rl0),
      at(asphalt, i, 1, rr0, rl0, rr0, rr0),
      at(asphalt, j, 0, rl1, rl1, rr1, rl1),
      at(asphalt, j, 1, rr1, rl1, rr1, rr1),
      UP,
    );
    // Edge lines, lifted.
    for (const side of [-1, 1] as const) {
      const road0 = track.side(i, side).road;
      const road1 = track.side(j, side).road;
      const c = side < 0 ? 0 : 2;
      const a0 = side * (road0 - LINE_INNER);
      const b0 = side * (road0 - LINE_OUTER);
      const a1 = side * (road1 - LINE_INNER);
      const b1 = side * (road1 - LINE_OUTER);
      lines.quad(
        at(lines, i, c, a0, rl0, rr0, a0, LINE_LIFT),
        at(lines, i, c + 1, b0, rl0, rr0, b0, LINE_LIFT),
        at(lines, j, c, a1, rl1, rr1, a1, LINE_LIFT),
        at(lines, j, c + 1, b1, rl1, rr1, b1, LINE_LIFT),
        UP,
      );
    }
    // Start/finish line: across the asphalt over the first metre of the lap.
    if (i === 0) {
      lines.quad(
        at(lines, i, 4, rl0, rl0, rr0, rl0, LINE_LIFT),
        at(lines, i, 5, rr0, rl0, rr0, rr0, LINE_LIFT),
        at(lines, j, 4, rl1, rl1, rr1, rl1, LINE_LIFT),
        at(lines, j, 5, rr1, rl1, rr1, rr1, LINE_LIFT),
        UP,
      );
    }
    for (const side of [-1, 1] as const) {
      const [r0, k0, w0] = side < 0 ? [rl0, kl0, wl0] : [rr0, kr0, wr0];
      const [r1, k1, w1] = side < 0 ? [rl1, kl1, wl1] : [rr1, kr1, wr1];
      const c = side < 0 ? 0 : 8;
      // Kerb with ridges: rings every quarter metre, ridge tops lifted.
      if (r0 !== k0 || r1 !== k1) addKerb(track, kerb, i, side, from, c);
      // Run-off, in the band of this station's surface.
      const p0 = track.side(i, side);
      const bandName = RUNOFF_BAND[p0.runoffSurface];
      const band = (runoff[bandName] ??= new BandBuilder());
      band.quad(
        at(band, i, c, k0, k0, w0, k0),
        at(band, i, c + 1, w0, k0, w0, w0),
        at(band, j, c, k1, k1, w1, k1),
        at(band, j, c + 1, w1, k1, w1, w1),
        UP,
      );
      // Skirt: straight down from the run-off's outer edge, facing outwards.
      facing.copy(sample.right).multiplyScalar(side);
      const s0 = vertical(skirt, track, i, w0, 0, key(i, c), facing, 0);
      const s1 = vertical(skirt, track, i, w0, -SKIRT_DROP, key(i, c + 1), facing, 1);
      const s2 = vertical(skirt, track, j, w1, 0, key(j, c), facing, 0);
      const s3 = vertical(skirt, track, j, w1, -SKIRT_DROP, key(j, c + 1), facing, 1);
      skirt.quad(s0, s1, s2, s3, facing);
      // Barriers.
      if (p0.barrier === BARRIER.armco) {
        facing.multiplyScalar(-1);
        const a0 = vertical(armco, track, i, w0, ARMCO_BOTTOM, key(i, c), facing, 0);
        const a1 = vertical(armco, track, i, w0, ARMCO_TOP, key(i, c + 1), facing, 1);
        const a2 = vertical(armco, track, j, w1, ARMCO_BOTTOM, key(j, c), facing, 0);
        const a3 = vertical(armco, track, j, w1, ARMCO_TOP, key(j, c + 1), facing, 1);
        armco.quad(a0, a1, a2, a3, facing);
        if (i % ARMCO_POST_EVERY === 0) {
          track.lateralPoint(i, side * (p0.wall + ARMCO_POST_BACK), vq);
          armcoPosts.push({ x: vq.x, y: vq.y, z: vq.z, yaw: yawToRoad(track, i, side) });
        }
      } else if (p0.barrier === BARRIER.tyres) {
        for (const row of TYRE_ROWS) {
          track.lateralPoint(i, side * (p0.wall + row), vq);
          tyreStacks.push({ x: vq.x, y: vq.y, z: vq.z, yaw: yawToRoad(track, i, side) });
        }
      }
    }
  }

  const bands: Partial<Record<BandName, BandMesh>> = {};
  const builders: [BandName, BandBuilder | undefined][] = [
    ['asphalt', asphalt],
    ['kerb', kerb],
    ['grass', runoff.grass],
    ['gravel', runoff.gravel],
    ['apron', runoff.apron],
    ['lines', lines],
    ['skirt', skirt],
    ['armco', armco],
  ];
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const [name, builder] of builders) {
    const mesh = builder?.build();
    if (!mesh) continue;
    bands[name] = mesh;
    const p = mesh.positions;
    for (let k = 0; k < p.length; k += 3) {
      minX = Math.min(minX, p[k] as number);
      maxX = Math.max(maxX, p[k] as number);
      minY = Math.min(minY, p[k + 1] as number);
      maxY = Math.max(maxY, p[k + 1] as number);
      minZ = Math.min(minZ, p[k + 2] as number);
      maxZ = Math.max(maxZ, p[k + 2] as number);
    }
  }
  const centre: [number, number, number] = [
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2,
  ];
  let radius = 0;
  for (const mesh of Object.values(bands)) {
    const p = mesh.positions;
    for (let k = 0; k < p.length; k += 3) {
      radius = Math.max(
        radius,
        Math.hypot(
          (p[k] as number) - centre[0],
          (p[k + 1] as number) - centre[1],
          (p[k + 2] as number) - centre[2],
        ),
      );
    }
  }
  return { index, from, to, centre, radius, bands, tyreStacks, armcoPosts };
}

/**
 * A vertex of a vertical band at station i, lateral l (on the wall line), `lift` above the corridor
 * surface. Its normal is horizontal and square to the wall line (central difference), so the
 * shading follows the wall where it flares.
 */
function vertical(
  band: BandBuilder,
  track: Track,
  i: number,
  l: number,
  lift: number,
  key: number,
  facingDir: Vector3,
  u: number,
): number {
  const side = l < 0 ? -1 : 1;
  track.lateralPoint(i + 1, side * track.side(i + 1, side).wall, vq);
  track.lateralPoint(i - 1, side * track.side(i - 1, side).wall, vn);
  vn.set(vq.z - vn.z, 0, vn.x - vq.x).normalize();
  if (vn.dot(facingDir) < 0) vn.negate();
  track.lateralPoint(i, l, vp, lift);
  return band.vertex(key, vp, vn, u, i * track.spacing);
}

/** The kerb band from station i to i + 1 on one side, with a ridge every 0.5 m. */
function addKerb(
  track: Track,
  band: BandBuilder,
  i: number,
  side: -1 | 1,
  from: number,
  column: number,
) {
  const j = i + 1;
  const [r0, k0] = columns(track, i, side);
  const [r1, k1] = columns(track, j, side);
  // Per station: inner vertices (slot * 2 + 0 near the road, + 1 near the wall), then the 2 edges.
  // Slot 0 of an interval is its station ring, shared with the previous interval's closing ring.
  const keyOf = (station: number) => (station - from) * 64 + 16 + column * 2;
  const vertex = (key: number, f: number, t: number, lift: number) => {
    // Stations are 1 m apart, so the quarter rings interpolate the two station points.
    const l0 = MathUtils.lerp(r0, k0, t);
    const l1 = MathUtils.lerp(r1, k1, t);
    track.lateralPoint(i, l0, vp, lift);
    track.lateralPoint(j, l1, vq, lift);
    vp.lerp(vq, f);
    if (f < 0.5) surfaceNormal(track, i, r0, k0, l0, vn);
    else surfaceNormal(track, j, r1, k1, l1, vn);
    return band.vertex(key, vp, vn, t, (i + f) * track.spacing);
  };
  const inner: [number, number][] = KERB_RINGS.map((f, slot) => {
    const lift = KERB_RING_LIFT[slot] as number;
    const key = keyOf(i) + slot * 2;
    return [vertex(key, f, KERB_BEVEL, lift), vertex(key + 1, f, 1 - KERB_BEVEL, lift)];
  });
  inner.push([vertex(keyOf(j), 1, KERB_BEVEL, 0), vertex(keyOf(j) + 1, 1, 1 - KERB_BEVEL, 0)]);
  const edges = KERB_RINGS.length * 2;
  const edge = (station: number, f: number, which: 0 | 1) =>
    vertex(keyOf(station) + edges + which, f, which, 0);
  for (let s = 0; s < inner.length - 1; s++) {
    const [a, b] = inner[s] as [number, number];
    const [c, d] = inner[s + 1] as [number, number];
    band.quad(a, b, c, d, UP);
  }
  // Each edge fans to its inner column: the first half from station i's edge, the rest from j's.
  const half = inner.length >> 1;
  for (const which of [0, 1] as const) {
    const e0 = edge(i, 0, which);
    const e1 = edge(j, 1, which);
    for (let s = 0; s < inner.length - 1; s++) {
      const p = (inner[s] as [number, number])[which];
      const q = (inner[s + 1] as [number, number])[which];
      band.triangle(s < half ? e0 : e1, p, q, UP);
    }
    band.triangle(e0, (inner[half] as [number, number])[which], e1, UP);
  }
}

/**
 * The drivable surface for physics: asphalt, kerbs and run-off on the station rings (no ridges, no
 * lines), one SurfaceId per triangle, triangles CCW from above. The loop is closed (the last
 * quads reuse station 0's vertices).
 */
export function corridorPhysicsMesh(track: Track): PhysicsSurfaceMesh {
  const count = track.samples.length;
  const columnsPer = 6;
  const positions = new Float32Array(count * columnsPer * 3);
  for (let i = 0; i < count; i++) {
    const [rl, kl, wl] = columns(track, i, -1);
    const [rr, kr, wr] = columns(track, i, 1);
    [wl, kl, rl, rr, kr, wr].forEach((l, c) => {
      track.lateralPoint(i, l, vp);
      positions.set([vp.x, vp.y, vp.z], (i * columnsPer + c) * 3);
    });
  }
  const indices: number[] = [];
  const surfaces: number[] = [];
  const flat = Array.from(positions);
  const add = (a: number, b: number, c: number, surface: SurfaceId) => {
    if (triangleNormal(flat, a, b, c, normal) < 1e-6) return;
    if (normal.y >= 0) indices.push(a, b, c);
    else indices.push(a, c, b);
    surfaces.push(surface);
  };
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    const ring = (s: number, c: number) => s * columnsPer + c;
    const left = track.side(i, -1);
    const right = track.side(i, 1);
    // Columns: 0 wall L, 1 kerb edge L, 2 asphalt edge L, 3 asphalt edge R, 4 kerb edge R, 5 wall R.
    const bands: [number, SurfaceId][] = [
      [0, left.runoffSurface],
      [1, SURFACE.kerb],
      [2, SURFACE.asphalt],
      [3, SURFACE.kerb],
      [4, right.runoffSurface],
    ];
    for (const [c, surface] of bands) {
      const a = ring(i, c);
      const b = ring(i, c + 1);
      const cc = ring(j, c);
      const d = ring(j, c + 1);
      add(a, b, cc, surface);
      add(b, d, cc, surface);
    }
  }
  return { positions, indices: new Uint32Array(indices), surfaceIds: new Uint8Array(surfaces) };
}

/**
 * Invisible collision walls: per side, one convex hull every 4 stations. The inner face runs along the
 * wall line from 1 m below its foot to TRACKGEN.wallHeight above it, and the hull is
 * TRACKGEN.wallThickness deep. Each end reaches 0.6 m past its station along the neighbouring hull's
 * line, set back HULL_RECESS behind that neighbour's face: neighbours overlap, but a car pressed
 * into one hull never meets the next hull's end cap (which would stop it dead), only a shallow ramp.
 * Every station has a wall, whatever barrier (if any) is drawn there.
 */
export function wallHulls(track: Track): Float32Array[] {
  const count = track.samples.length;
  const hulls: Float32Array[] = [];
  for (const side of [-1, 1] as const) {
    // Hull k runs from anchor k to anchor k + 1; the last anchor is station `count` (= station 0).
    const anchors: Vector3[] = [];
    for (let i = 0; i < count; i += HULL_STATIONS) {
      anchors.push(track.lateralPoint(i, side * track.side(i, side).wall, new Vector3()));
    }
    anchors.push(track.lateralPoint(count, side * track.side(count, side).wall, new Vector3()));
    const segments = anchors.length - 1;
    const dirs: Vector3[] = [];
    const outs: Vector3[] = [];
    for (let k = 0; k < segments; k++) {
      const a = anchors[k] as Vector3;
      const b = anchors[k + 1] as Vector3;
      const dir = new Vector3().subVectors(b, a).setY(0).normalize();
      // Outwards: horizontal, perpendicular to the face, away from the road.
      const out = new Vector3(-dir.z, 0, dir.x);
      const r = track.sample(k * HULL_STATIONS).right;
      if (out.x * r.x * side + out.z * r.z * side < 0) out.negate();
      dirs.push(dir);
      outs.push(out);
    }
    for (let k = 0; k < segments; k++) {
      const prev = (k + segments - 1) % segments;
      const next = (k + 1) % segments;
      const a = anchors[k] as Vector3;
      const b = anchors[k + 1] as Vector3;
      const out = outs[k] as Vector3;
      const aEnd = a
        .clone()
        .addScaledVector(dirs[prev] as Vector3, -HULL_OVERLAP)
        .addScaledVector(outs[prev] as Vector3, HULL_RECESS);
      const bEnd = b
        .clone()
        .addScaledVector(dirs[next] as Vector3, HULL_OVERLAP)
        .addScaledVector(outs[next] as Vector3, HULL_RECESS);
      const plan = [
        aEnd,
        a,
        b,
        bEnd,
        bEnd.clone().addScaledVector(out, TRACKGEN.wallThickness),
        aEnd.clone().addScaledVector(out, TRACKGEN.wallThickness),
      ];
      const points = new Float32Array(plan.length * 6);
      let n = 0;
      for (const p of plan) {
        for (const dy of [-HULL_BELOW, TRACKGEN.wallHeight]) {
          points[n++] = p.x;
          points[n++] = p.y + dy;
          points[n++] = p.z;
        }
      }
      hulls.push(points);
    }
  }
  return hulls;
}
