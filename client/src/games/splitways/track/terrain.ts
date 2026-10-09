/**
 * Height of the land around a track: flat under the road, sand dunes inland, a beach that slopes
 * into the sea along the coast, and a calmer infield. Node-safe; the terrain mesh and the scenery
 * placement both use it.
 */
import { MathUtils } from 'three';
import type { Track } from './track';
import { TrackProximity } from './trackGeometry';

export const SEA_LEVEL = -0.6;

/** West of `x` the dunes flatten out into the low-rise city (blending over `blend` metres). */
export const CITY = { x: -215, blend: 50 } as const;

/** The shoreline z = base + sum(amplitude * sin(x * frequency + phase)). The sea shader reuses it. */
export const COAST = {
  base: 178,
  waves: [
    { frequency: 0.011, phase: 0, amplitude: 9 },
    { frequency: 0.037, phase: 1.3, amplitude: 3 },
  ],
} as const;

function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth value noise in 0..1. */
function valueNoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);
  return MathUtils.lerp(MathUtils.lerp(a, b, ux), MathUtils.lerp(c, d, ux), uz);
}

function fbm(x: number, z: number, octaves: number): number {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amplitude * valueNoise(x * frequency, z * frequency);
    frequency *= 2.03;
    amplitude *= 0.5;
  }
  return sum;
}

export interface RoadProximity {
  /** Distance to the centre line (m), capped at the search reach. */
  distance: number;
  /** Road height at the nearest point. */
  roadY: number;
  /** True inside the loop. The track runs anticlockwise, so the infield is on the driver's left. */
  infield: boolean;
}

export class Terrain {
  private readonly proximity: TrackProximity;

  constructor(readonly track: Track) {
    this.proximity = new TrackProximity(track);
  }

  /** The shoreline: where land meets the sea, south of the coastal straight (+Z is south). */
  coastZ(x: number): number {
    let z: number = COAST.base;
    for (const wave of COAST.waves) z += Math.sin(x * wave.frequency + wave.phase) * wave.amplitude;
    return z;
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

  heightAt(x: number, z: number): number {
    const { distance, roadY, infield } = this.nearRoad(x, z);
    const edge = this.track.halfDrivable + 1.4;
    const underRoad = roadY - 0.15;
    if (distance <= edge) return underRoad;

    const coast = this.coastZ(x);
    let natural: number;
    if (z > coast - 30) {
      // Beach: gentle slope from the road verge down under the water.
      const t = MathUtils.smoothstep(z, coast - 30, coast + 45);
      natural = MathUtils.lerp(0.35, SEA_LEVEL - 3, t) + (fbm(x * 0.05, z * 0.05, 2) - 0.5) * 0.3;
    } else if (infield) {
      natural = 0.3 + fbm(x * 0.012, z * 0.012, 3) * 1.6;
    } else {
      // Dunes grow taller the further you get from the road, except in the city.
      const city = 1 - MathUtils.smoothstep(x, CITY.x - CITY.blend, CITY.x);
      const growth = MathUtils.smoothstep(distance, edge + 10, edge + 160) * (1 - city);
      const ridges = fbm(x * 0.008 + 3.1, z * 0.011 - 1.7, 4);
      const sharp = 1 - Math.abs(ridges * 2 - 1);
      natural = 0.4 + growth * (4 + sharp * sharp * 22);
    }
    const blend = MathUtils.smoothstep(distance, edge, edge + 26);
    return MathUtils.lerp(underRoad, natural, blend);
  }
}
