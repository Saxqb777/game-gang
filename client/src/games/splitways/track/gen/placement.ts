/**
 * Trackside placements: pines on a jittered grid (dense near the circuit, noisy clearings further
 * out, clear sight lines across tight corners and around the start), distance boards before the
 * big braking zones, and marshal posts round the lap. Deterministic: all randomness comes from a
 * mulberry32 stream seeded with the track id. Tyre walls are part of the corridor, not placements.
 * Node-safe.
 */
import { MathUtils } from 'three';
import { TRACKGEN } from '../../config';
import { fbm } from '../noise';
import type { Terrain } from '../terrain';
import type { Track } from '../track';
import { TrackProximity } from '../trackGeometry';
import { brakingZones } from './racingLine';

export type PlacementKind = 'pine' | 'board300' | 'board200' | 'board100' | 'marshal';
export interface Placement {
  kind: PlacementKind;
  x: number;
  z: number; // y: caller uses terrain.heightAt (pines) or lateralPoint (near-road items)
  yaw: number; // local +Z faces the road for boards/posts
  scale: number; // pines: 1 = 16 m tall
  station: number;
  side: -1 | 1;
}

/** FNV-1a over a string: the seed for a track's placements. */
export function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: small, fast, seeded; returns numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pine scale range (1 = 16 m tall). */
const PINE_SCALE_MIN = 0.8;
const PINE_SCALE_MAX = 1.35;
/** No pines this far (m) along the lap either side of the start line, on its right (grandstand, gantry). */
const START_CLEAR = 35;
/** Corners tighter than this radius (m) keep pines this far (m) back from their inside wall. */
const SIGHT_RADIUS = 200;
const SIGHT_CLEAR = 25;
/** Boards: before braking zones losing at least this much speed (m/s), this far beyond the wall (m). */
const BOARD_DROP = 15;
const BOARD_BEYOND_WALL = 2.5;
/** Boards face the oncoming cars, turned this far (rad) towards the road. */
const BOARD_TOE = 0.35;
/** A board station must be this straight (1/m), and no board stands this close (m) to the start line. */
const BOARD_MAX_CURVATURE = 1 / 300;
const BOARD_START_CLEAR = 40;
/** The corner a board counts down to begins where the curvature first passes this (1/m). */
const TURN_IN_CURVATURE = 1 / 400;
const BOARDS = [
  ['board300', 300],
  ['board200', 200],
  ['board100', 100],
] as const;
/** Marshal posts: spacing along the lap and its random spread (m), distance behind the wall (m). */
const MARSHAL_EVERY = 300;
const MARSHAL_SPREAD = 40;
const MARSHAL_BEHIND_WALL = 4;
const MARSHAL_START_CLEAR = 50;
/** A marshal post looks this far (m) either way along the lap for the corner it watches. */
const MARSHAL_CORNER_SEARCH = 150;

export function placeTrackside(track: Track, terrain: Terrain): Placement[] {
  const rng = mulberry32(hash32(track.definition.id));
  return [...placePines(track, terrain, rng), ...placeBoards(track), ...placeMarshals(track, rng)];
}

/** Signed distance along the lap from the start line, in (-length/2, length/2]. */
function fromStart(track: Track, station: number): number {
  const d = track.ahead(track.startLine.distance, station * track.spacing);
  return d > track.length / 2 ? d - track.length : d;
}

function placePines(track: Track, terrain: Terrain, rng: () => number): Placement[] {
  const { field } = terrain;
  const proximity = new TrackProximity(track, 32);
  const grid = TRACKGEN.pineGrid;
  const maxX = field.minX + (field.cols - 1) * field.spacing;
  const maxZ = field.minZ + (field.rows - 1) * field.spacing;
  let widest = 0;
  for (const s of track.samples) widest = Math.max(widest, s.sideL.wall, s.sideR.wall);
  const kept: (Placement & { beyond: number })[] = [];
  for (let gz = field.minZ; gz <= maxZ; gz += grid) {
    for (let gx = field.minX; gx <= maxX; gx += grid) {
      // Every candidate draws the same numbers whether it is kept or not, so one change in the
      // rules never reshuffles the whole forest.
      const x = gx + (rng() * 2 - 1) * TRACKGEN.pineJitter;
      const z = gz + (rng() * 2 - 1) * TRACKGEN.pineJitter;
      const roll = rng();
      const yaw = rng() * Math.PI * 2;
      const scale = MathUtils.lerp(PINE_SCALE_MIN, PINE_SCALE_MAX, rng());
      const density = MathUtils.smoothstep(fbm(x * 0.008, z * 0.008, 3), 0.35, 0.65);
      // Outside the dense band only the noise decides, so a short search is enough to reject.
      const reach = roll < density ? TRACKGEN.pineReach + widest : TRACKGEN.pineDenseBand + widest;
      const nearest = proximity.nearest(x, z, reach);
      if (nearest.index < 0) continue;
      const sample = track.sample(nearest.index);
      const lateral =
        (x - sample.position.x) * sample.right.x + (z - sample.position.z) * sample.right.z;
      const side = lateral < 0 ? -1 : 1;
      const beyond = Math.abs(lateral) - track.side(nearest.index, side).wall;
      const gap = TRACKGEN.pineGap + TRACKGEN.pineGapNoise * fbm(x * 0.05 + 31, z * 0.05 + 17, 2);
      if (beyond < gap || beyond > TRACKGEN.pineReach) continue;
      if (roll >= (beyond <= TRACKGEN.pineDenseBand ? 1 : density)) continue;
      if (side > 0 && Math.abs(fromStart(track, nearest.index)) <= START_CLEAR) continue;
      const k = sample.curvature;
      const insideSide = k > 0 ? -1 : 1;
      if (Math.abs(k) > 1 / SIGHT_RADIUS && side === insideSide && beyond <= SIGHT_CLEAR) continue;
      kept.push({ kind: 'pine', x, z, yaw, scale, station: nearest.index, side, beyond });
    }
  }
  // Over the cap, drop the trees furthest from the wall: the treeline is what the drivers see.
  if (kept.length > TRACKGEN.pineCap) {
    const order = kept
      .map((_, i) => i)
      .sort((a, b) => {
        const pa = kept[a] as (typeof kept)[number];
        const pb = kept[b] as (typeof kept)[number];
        return pa.beyond - pb.beyond || a - b;
      });
    const keep = new Uint8Array(kept.length);
    for (const i of order.slice(0, TRACKGEN.pineCap)) keep[i] = 1;
    return kept.filter((_, i) => keep[i]).map(stripBeyond);
  }
  return kept.map(stripBeyond);
}

function stripBeyond(p: Placement & { beyond: number }): Placement {
  return {
    kind: p.kind,
    x: p.x,
    z: p.z,
    yaw: p.yaw,
    scale: p.scale,
    station: p.station,
    side: p.side,
  };
}

/** Yaw that points local +Z along (dx, dz). */
function yawOf(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

function placeBoards(track: Track): Placement[] {
  const n = track.samples.length;
  const placements: Placement[] = [];
  const speed = Float32Array.from(track.samples, (s) => s.targetSpeed);
  for (const zone of brakingZones(speed)) {
    if (zone.drop < BOARD_DROP) continue;
    // Count down to the turn-in: the first station from the braking point that is really turning.
    let turnIn = zone.start;
    for (let k = 0; k < n; k++) {
      const i = (zone.start + k) % n;
      turnIn = i;
      if (i === zone.apex || Math.abs(track.sample(i).curvature) > TURN_IN_CURVATURE) break;
    }
    const side = track.sample(zone.apex).curvature > 0 ? 1 : -1; // the outside of the corner
    for (const [kind, metres] of BOARDS) {
      const station = (((turnIn - Math.round(metres / track.spacing)) % n) + n) % n;
      const sample = track.sample(station);
      if (Math.abs(sample.curvature) > BOARD_MAX_CURVATURE) continue;
      if (Math.abs(fromStart(track, station)) < BOARD_START_CLEAR) continue;
      const wall = track.side(station, side).wall;
      const { position: p, right: r, tangent: t } = sample;
      // Face back up the road, toed in towards it.
      const dx = -t.x * Math.cos(BOARD_TOE) - side * r.x * Math.sin(BOARD_TOE);
      const dz = -t.z * Math.cos(BOARD_TOE) - side * r.z * Math.sin(BOARD_TOE);
      placements.push({
        kind,
        x: p.x + r.x * side * (wall + BOARD_BEYOND_WALL),
        z: p.z + r.z * side * (wall + BOARD_BEYOND_WALL),
        yaw: yawOf(dx, dz),
        scale: 1,
        station,
        side,
      });
    }
  }
  return placements;
}

function placeMarshals(track: Track, rng: () => number): Placement[] {
  const n = track.samples.length;
  const placements: Placement[] = [];
  const search = Math.round(MARSHAL_CORNER_SEARCH / track.spacing);
  for (
    let d = MARSHAL_EVERY / 2;
    d < track.length - MARSHAL_START_CLEAR;
    d += MARSHAL_EVERY + (rng() * 2 - 1) * MARSHAL_SPREAD
  ) {
    const station = track.indexAt(track.startLine.distance + d);
    if (Math.abs(fromStart(track, station)) < MARSHAL_START_CLEAR) continue;
    // Watch the nearest real corner: the tightest station within reach either way.
    let corner = 0;
    for (let k = -search; k <= search; k++) {
      const c = track.sample(station + k).curvature;
      if (Math.abs(c) > Math.abs(corner)) corner = c;
    }
    const side = corner > 0 ? 1 : -1;
    const { position: p, right: r } = track.sample(station);
    const lateral = side * (track.side(station, side).wall + MARSHAL_BEHIND_WALL);
    placements.push({
      kind: 'marshal',
      x: p.x + r.x * lateral,
      z: p.z + r.z * lateral,
      yaw: yawOf(-side * r.x, -side * r.z),
      scale: 1,
      station: ((station % n) + n) % n,
      side,
    });
  }
  return placements;
}
