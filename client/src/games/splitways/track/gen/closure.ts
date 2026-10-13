/**
 * Step 3 of track generation: make the plan loop close exactly. The heading error goes into one
 * named arc; the position gap is solved with two named straights (a 2x2 linear system); any
 * rounding left over is spread linearly over the lap. Every lever is bounded so a broken layout
 * throws with details instead of silently turning into a different track. Node-safe.
 */
import { integratePlan, turnSign, type Plan } from './centreline';
import type { LayoutSegment, TrackOverrides } from './layout';

/** Closure straights must be at least this far from parallel (rad). */
const MIN_STRAIGHT_ANGLE = (20 * Math.PI) / 180;
const MIN_STRAIGHT_LENGTH = 20;
const MAX_CHANGE_SHARE = 0.5;
/** Largest residual gap (m) the final linear spread may absorb. */
const MAX_RESIDUAL = 0.05;
const TWO_PI = Math.PI * 2;

export interface ClosureChange {
  name: string;
  before: number;
  after: number;
}

export interface ClosureReport {
  /** Plan gap between the end and the start before any closure (m). */
  gapBefore: number;
  /** Heading error before closure (rad): total turn minus the nearer of +-2 pi. */
  headingError: number;
  /** Net turn of the lap (rad, + = counter-clockwise). */
  netTurn: number;
  /** The closure arc's turned angle (rad), when one is named. */
  arc: ClosureChange | null;
  /** The two closure straights' lengths (m). */
  straights: [ClosureChange, ClosureChange];
  /** Gap left after the straights were solved, spread over the lap (m). */
  residual: number;
}

export interface ClosedLoop {
  segments: LayoutSegment[];
  plan: Plan;
  report: ClosureReport;
}

function indexOf(segments: readonly LayoutSegment[], name: string, what: string): number {
  const index = segments.findIndex((s) => s.name === name);
  if (index < 0) throw new Error(`Closure: unknown ${what} segment "${name}"`);
  return index;
}

function last(values: readonly number[]): number {
  return values[values.length - 1] as number;
}

/** Total signed turn of a segment list (rad, + = left). */
export function netTurn(segments: readonly LayoutSegment[]): number {
  let turn = 0;
  for (const segment of segments) turn += turnSign(segment) * segment.arc;
  return turn;
}

/** Closes the loop as described above. The input segments are not mutated. */
export function closeLoop(
  input: readonly LayoutSegment[],
  closure: TrackOverrides['closure'],
): ClosedLoop {
  const segments = input.map((s) => ({ ...s, left: { ...s.left }, right: { ...s.right } }));
  const raw = integratePlan(segments);
  const gapBefore = Math.hypot(last(raw.x), last(raw.y));

  // 1. Heading.
  const turn = netTurn(segments);
  const target = turn >= 0 ? TWO_PI : -TWO_PI;
  const headingError = turn - target;
  let arc: ClosureChange | null = null;
  if (closure.arc === null) {
    if (Math.abs(headingError) >= 1e-6) {
      throw new Error(
        `Closure: heading error ${((headingError * 180) / Math.PI).toFixed(4)} deg and no closure arc`,
      );
    }
  } else {
    const index = indexOf(segments, closure.arc, 'arc');
    const segment = segments[index] as LayoutSegment;
    if (segment.type === 'straight') throw new Error(`Closure: "${closure.arc}" is not an arc`);
    const before = segment.arc;
    segment.arc -= headingError * turnSign(segment);
    if (!(segment.arc > 0)) {
      throw new Error(`Closure: arc "${closure.arc}" would turn ${segment.arc} rad (must be > 0)`);
    }
    if (Math.abs(segment.arc - before) > MAX_CHANGE_SHARE * before) {
      throw new Error(
        `Closure: arc "${closure.arc}" would change from ${before} to ${segment.arc} rad (> 50%)`,
      );
    }
    arc = { name: closure.arc, before, after: segment.arc };
  }

  // 2-3. Position: solve dL1 * d1 + dL2 * d2 = -gap for the two straights.
  let plan = integratePlan(segments);
  const [name1, name2] = closure.straights;
  const i1 = indexOf(segments, name1, 'straight');
  const i2 = indexOf(segments, name2, 'straight');
  const straights = [i1, i2].map((i) => {
    const segment = segments[i] as LayoutSegment;
    if (segment.type !== 'straight')
      throw new Error(`Closure: "${segment.name}" is not a straight`);
    return segment;
  });
  const s1 = straights[0] as LayoutSegment;
  const s2 = straights[1] as LayoutSegment;
  const h1 = netTurn(segments.slice(0, i1));
  const h2 = netTurn(segments.slice(0, i2));
  const d1x = Math.cos(h1);
  const d1y = Math.sin(h1);
  const d2x = Math.cos(h2);
  const d2y = Math.sin(h2);
  const det = d1x * d2y - d1y * d2x;
  // 4. Reject nearly parallel straights: the system would need huge length changes.
  if (Math.abs(det) < Math.sin(MIN_STRAIGHT_ANGLE)) {
    const apart = (Math.acos(Math.max(-1, Math.min(1, d1x * d2x + d1y * d2y))) * 180) / Math.PI;
    throw new Error(
      `Closure: straights "${name1}" and "${name2}" are ${apart.toFixed(1)} deg apart (need >= 20 deg and <= 160 deg)`,
    );
  }
  const gx = -last(plan.x);
  const gy = -last(plan.y);
  const dL1 = (gx * d2y - gy * d2x) / det;
  const dL2 = (d1x * gy - d1y * gx) / det;
  const changes: ClosureChange[] = [];
  for (const [segment, change] of [
    [s1, dL1],
    [s2, dL2],
  ] as const) {
    const before = segment.length;
    const after = before + change;
    if (after < MIN_STRAIGHT_LENGTH) {
      throw new Error(
        `Closure: straight "${segment.name}" would be ${after.toFixed(2)} m (< 20 m)`,
      );
    }
    if (Math.abs(change) > MAX_CHANGE_SHARE * before) {
      throw new Error(
        `Closure: straight "${segment.name}" would change by ${change.toFixed(2)} m (> 50% of ${before} m)`,
      );
    }
    segment.length = after;
    changes.push({ name: segment.name, before, after });
  }

  // 5. Re-integrate and spread the rounding left over linearly along the lap.
  plan = integratePlan(segments);
  const rx = last(plan.x);
  const ry = last(plan.y);
  const residual = Math.hypot(rx, ry);
  if (residual >= MAX_RESIDUAL) {
    throw new Error(`Closure: ${residual.toFixed(4)} m left after solving (must be < 0.05 m)`);
  }
  const rh = last(plan.heading) - target;
  for (let k = 0; k < plan.s.length; k++) {
    const share = (plan.s[k] as number) / plan.length;
    plan.x[k] = (plan.x[k] as number) - rx * share;
    plan.y[k] = (plan.y[k] as number) - ry * share;
    plan.heading[k] = (plan.heading[k] as number) - rh * share;
  }
  return {
    segments,
    plan,
    report: {
      gapBefore,
      headingError,
      netTurn: turn,
      arc,
      straights: [changes[0] as ClosureChange, changes[1] as ClosureChange],
      residual,
    },
  };
}
