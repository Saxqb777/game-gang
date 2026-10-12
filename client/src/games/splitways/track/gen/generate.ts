/**
 * Trackgen v1: a layout plus its overrides in, evenly spaced stations out (centre line, elevation,
 * bank, side profiles, racing line and speed). Steps, in order: overrides, plan integration,
 * closure, elevation and bank, resampling, corridor profile, centring, racing line, tyre walls.
 * Deterministic and Node-safe.
 */
import type { TrackId } from '@gamergang/shared';
import { TRACKGEN } from '../../config';
import { planIndex, segmentIndexAt, type Plan } from './centreline';
import { closeLoop, type ClosureReport } from './closure';
import { applyTyreBarriers, corridorProfile, movingAverage, type StationSides } from './corridor';
import { elevationAt, elevationProfile } from './elevation';
import type { LayoutSegment, TrackLayout, TrackOverrides } from './layout';
import { applyOverrides } from './overrides';
import { brakingZones, buildRacingLine } from './racingLine';

export type { StationSides } from './corridor';

export interface GeneratedTrack {
  id: TrackId;
  name: string;
  laps: number;
  checkpointCount: number;
  startDistance: number; // arc length of the start line (m); 0 for Kestrel Pines
  length: number; // horizontal lap length (m)
  spacing: number; // length / count (~1.000 m)
  count: number; // stations; station `count` is station 0
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  heading: Float32Array; // yaw (rad), tangent = (sin h, 0, cos h)
  curvature: Float32Array; // plan curvature (1/m), + = bends left
  bank: Float32Array; // rad, + = right edge higher
  left: StationSides;
  right: StationSides;
  racingLine: Float32Array; // lateral offset of the racing line (m, + = right)
  speed: Float32Array; // speed profile on the racing line (m/s)
  licence: string;
  credits: readonly string[];
}

/** What the generator did, for `pnpm assets:track` and the tests. */
export interface GenerationReport {
  segments: number;
  closure: ClosureReport;
  /** Smallest layout radius (m) over the arc segments after overrides, and its segment. */
  minRadius: number;
  minRadiusSegment: string;
  elevationMin: number;
  elevationMax: number;
  /** Crest/sag smoothing passes the elevation needed (0 = none). */
  elevationPasses: number;
  /** Corridor warnings (inside run-off shrunk to keep the wall inside the curve). */
  warnings: string[];
  /** The layout after overrides and closure. */
  layout: TrackLayout;
}

const HALF_PI = Math.PI / 2;

function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function generateTrack(base: TrackLayout, overrides: TrackOverrides): GeneratedTrack {
  return generateTrackWithReport(base, overrides).track;
}

export function generateTrackWithReport(
  base: TrackLayout,
  overrides: TrackOverrides,
): { track: GeneratedTrack; report: GenerationReport } {
  // 1. Overrides.
  const { layout: overridden, extraKerbs } = applyOverrides(base, overrides);
  // 2-3. Plan integration and closure.
  const { segments, plan, report: closure } = closeLoop(overridden.segments, overrides.closure);
  const layout: TrackLayout = { ...overridden, segments };
  // 4. Elevation (bank is per segment, smoothed after resampling).
  const profile = elevationProfile(segments, plan, base.startZ);

  // 5. Resample at ~1 m from the start offset.
  const length = plan.length;
  const count = Math.round(length / TRACKGEN.spacing);
  const spacing = length / count;
  const startOffset = overrides.startOffset ?? 0;
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  const z = new Float32Array(count);
  const heading = new Float32Array(count);
  const curvature = new Float32Array(count);
  const bank = new Float32Array(count);
  const segment = new Uint16Array(count);
  const offset = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const s = (startOffset + i * spacing) % length;
    const p = planIndex(plan, s);
    const t = interval(plan, p, s);
    const at = (values: readonly number[]) => lerp(values[p] as number, values[p + 1] as number, t);
    // Plan (x, y) maps to (x, -y); our yaw is the plan heading + pi/2.
    x[i] = at(plan.x);
    z[i] = -at(plan.y);
    heading[i] = wrapAngle(at(plan.heading) + HALF_PI);
    curvature[i] = at(plan.curvature);
    y[i] = elevationAt(profile, s);
    const j = segmentIndexAt(plan, s);
    const seg = segments[j] as LayoutSegment;
    const u = s - (plan.segmentStart[j] as number);
    segment[i] = j;
    offset[i] = u;
    bank[i] = lerp(seg.bankStart, seg.bankEnd, Math.min(1, u / (plan.segmentLength[j] as number)));
  }
  movingAverage(bank, Math.round(TRACKGEN.smoothWindow / spacing));

  // 6. Corridor profile.
  const { left, right, warnings } = corridorProfile({
    segments,
    segment,
    offset,
    curvature,
    extraKerbs,
  });

  // 7. Centre the plan bounding box on the origin (heights stay as they are).
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < count; i++) {
    minX = Math.min(minX, x[i] as number);
    maxX = Math.max(maxX, x[i] as number);
    minZ = Math.min(minZ, z[i] as number);
    maxZ = Math.max(maxZ, z[i] as number);
  }
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  for (let i = 0; i < count; i++) {
    x[i] = (x[i] as number) - cx;
    z[i] = (z[i] as number) - cz;
  }

  // 8. Racing line and speed profile.
  const line = buildRacingLine(x, z, heading, left.road, right.road, spacing);
  // 9. Tyre walls where the speed falls hard into a corner.
  applyTyreBarriers(brakingZones(line.speed), curvature, left, right, spacing);

  let minRadius = Infinity;
  let minRadiusSegment = '';
  for (const s of segments) {
    if (s.type === 'straight') continue;
    const r = Math.min(s.radiusStart, s.radiusEnd);
    // On a tie, name the constant-radius piece (the apex) rather than the spiral into it.
    if (r < minRadius || (r === minRadius && s.radiusStart === s.radiusEnd)) {
      minRadius = r;
      minRadiusSegment = s.name;
    }
  }
  let elevationMin = Infinity;
  let elevationMax = -Infinity;
  for (const h of y) {
    elevationMin = Math.min(elevationMin, h);
    elevationMax = Math.max(elevationMax, h);
  }
  const credits = [...base.credits];
  for (const c of overrides.credits) if (!credits.includes(c)) credits.push(c);

  const track: GeneratedTrack = {
    id: overrides.id,
    name: overrides.name,
    laps: overrides.laps,
    checkpointCount: overrides.checkpointCount,
    startDistance: 0,
    length,
    spacing,
    count,
    x,
    y,
    z,
    heading,
    curvature,
    bank,
    left,
    right,
    racingLine: line.lateral,
    speed: line.speed,
    licence: base.licence,
    credits,
  };
  return {
    track,
    report: {
      segments: segments.length,
      closure,
      minRadius,
      minRadiusSegment,
      elevationMin,
      elevationMax,
      elevationPasses: profile.passes,
      warnings,
      layout,
    },
  };
}

/** Fraction of `s` between plan points p and p + 1. */
function interval(plan: Plan, p: number, s: number): number {
  const s0 = plan.s[p] as number;
  const s1 = plan.s[p + 1] as number;
  return s1 > s0 ? Math.min(1, Math.max(0, (s - s0) / (s1 - s0))) : 0;
}
