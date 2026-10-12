/**
 * Step 4 of track generation: the elevation profile. Each segment is a C1 cubic Hermite from its
 * start height to `zEnd`; join tangents are the layout's own when given, otherwise the average of
 * the two neighbours' mean grades. Crests and sags sharper than the TRACKGEN limits are then
 * smoothed locally (periodic, so the loop stays closed in height). Node-safe.
 */
import { TRACKGEN } from '../../config';
import type { Plan } from './centreline';
import type { LayoutSegment } from './layout';

/** Spacing of the profile used for the curvature limits (m). */
const PROFILE_STEP = 0.5;
/** Offending stations are those over the limit by more than this share. */
const LIMIT_TOLERANCE = 1.1;
const MAX_PASSES = 2000;
/** Largest height mismatch (m) tolerated between the last segment's zEnd and startZ. */
const MAX_HEIGHT_GAP = 0.01;

export interface ElevationProfile {
  /** Heights on a uniform periodic grid; sample k is at arc length k * step. */
  y: Float64Array;
  step: number;
  length: number;
  /** Smoothing passes the curvature limits needed (0 = the layout already met them). */
  passes: number;
}

function hermite(z0: number, z1: number, m0: number, m1: number, length: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * z0 +
    (t3 - 2 * t2 + t) * length * m0 +
    (-2 * t3 + 3 * t2) * z1 +
    (t3 - t2) * length * m1
  );
}

/** Vertical curvature at k on the periodic grid (1/m; + = sag, - = crest). */
function verticalCurvature(y: Float64Array, k: number, step: number): number {
  const n = y.length;
  const a = y[(k - 1 + n) % n] as number;
  const b = y[k] as number;
  const c = y[(k + 1) % n] as number;
  return (a - 2 * b + c) / (step * step);
}

export function elevationProfile(
  segments: readonly LayoutSegment[],
  plan: Plan,
  startZ: number,
): ElevationProfile {
  const count = segments.length;
  const lastZ = (segments[count - 1] as LayoutSegment).zEnd;
  if (Math.abs(lastZ - startZ) > MAX_HEIGHT_GAP) {
    throw new Error(`Elevation: the lap ends at z ${lastZ} but starts at ${startZ}`);
  }
  const startHeights = segments.map((_, j) =>
    j === 0 ? startZ : (segments[j - 1] as LayoutSegment).zEnd,
  );
  const grades = segments.map(
    (s, j) => (s.zEnd - (startHeights[j] as number)) / (plan.segmentLength[j] as number),
  );
  /** Tangent at the join before segment j. */
  const joinTangent = (j: number): number => {
    const prev = (j - 1 + count) % count;
    const own =
      (segments[prev] as LayoutSegment).tangentEnd ?? (segments[j] as LayoutSegment).tangentStart;
    return own ?? ((grades[prev] as number) + (grades[j] as number)) / 2;
  };

  const n = Math.max(8, Math.round(plan.length / PROFILE_STEP));
  const step = plan.length / n;
  const y = new Float64Array(n);
  let j = 0;
  for (let k = 0; k < n; k++) {
    const s = k * step;
    while (j < count - 1 && s >= (plan.segmentStart[j + 1] as number)) j++;
    const segment = segments[j] as LayoutSegment;
    const length = plan.segmentLength[j] as number;
    const t = Math.min(1, Math.max(0, (s - (plan.segmentStart[j] as number)) / length));
    const m0 = segment.tangentStart ?? joinTangent(j);
    const m1 = segment.tangentEnd ?? joinTangent((j + 1) % count);
    y[k] = hermite(startHeights[j] as number, segment.zEnd, m0, m1, length, t);
  }

  // Curvature limits: smooth only the offending samples until none is more than 10% over.
  const crest = LIMIT_TOLERANCE / TRACKGEN.crestRadius;
  const sag = LIMIT_TOLERANCE / TRACKGEN.sagRadius;
  const offending: number[] = [];
  let passes = 0;
  for (;;) {
    offending.length = 0;
    for (let k = 0; k < n; k++) {
      const kv = verticalCurvature(y, k, step);
      if (kv < -crest || kv > sag) offending.push(k);
    }
    if (offending.length === 0) break;
    if (passes >= MAX_PASSES) {
      throw new Error(
        `Elevation: ${offending.length} samples still break the crest/sag limits after ${MAX_PASSES} passes`,
      );
    }
    // Jacobi-style: every offender is smoothed from the same old values.
    const next = offending.map((k) => {
      const a = y[(k - 1 + n) % n] as number;
      const c = y[(k + 1) % n] as number;
      return (a + 2 * (y[k] as number) + c) / 4;
    });
    offending.forEach((k, i) => (y[k] = next[i] as number));
    passes++;
  }
  return { y, step, length: plan.length, passes };
}

/** Height at arc length `s` (linear between samples, periodic). */
export function elevationAt(profile: ElevationProfile, s: number): number {
  const n = profile.y.length;
  const f = (((s % profile.length) + profile.length) % profile.length) / profile.step;
  const k = Math.floor(f);
  const t = f - k;
  const a = profile.y[k % n] as number;
  const b = profile.y[(k + 1) % n] as number;
  return a + (b - a) * t;
}
