/**
 * Step 2 of track generation: integrate a layout's segments into a plan centre line (x, y, heading)
 * in the layout's own plan frame: start at the origin heading along +x, heading counter-clockwise
 * positive, so left turns add heading. Constant-radius arcs use the closed form; spirals have
 * curvature linear in arc length and are integrated with Simpson's rule. Node-safe.
 */
import type { LayoutSegment } from './layout';

/** Integration step (m). */
export const PLAN_STEP = 0.25;

/** Arc length of one segment (m). A spiral's is `2 * arc / (1/radiusStart + 1/radiusEnd)`. */
export function segmentLength(segment: LayoutSegment): number {
  if (segment.type === 'straight') return segment.length;
  if (segment.radiusStart === segment.radiusEnd) return segment.arc * segment.radiusStart;
  return (2 * segment.arc) / (1 / segment.radiusStart + 1 / segment.radiusEnd);
}

/** +1 for left turns, -1 for right turns, 0 for straights. */
export function turnSign(segment: LayoutSegment): number {
  return segment.type === 'left' ? 1 : segment.type === 'right' ? -1 : 0;
}

/** Signed plan curvature (1/m, + = left) at a distance `u` into a segment of length `length`. */
export function segmentCurvature(segment: LayoutSegment, u: number, length: number): number {
  const sign = turnSign(segment);
  if (sign === 0) return 0;
  const k0 = 1 / segment.radiusStart;
  const k1 = 1 / segment.radiusEnd;
  return sign * (k0 + ((k1 - k0) * u) / length);
}

/** Heading change from the start of a segment to `u` into it (rad, + = left). */
function headingChange(segment: LayoutSegment, u: number, length: number): number {
  const sign = turnSign(segment);
  if (sign === 0) return 0;
  const k0 = 1 / segment.radiusStart;
  const k1 = 1 / segment.radiusEnd;
  return sign * (k0 * u + ((k1 - k0) * u * u) / (2 * length));
}

/** The integrated centre line: points every <= PLAN_STEP metres, including both ends of the lap. */
export interface Plan {
  /** Arc length of each point from the start of segments[0] (m). The last point is at `length`. */
  s: number[];
  x: number[];
  y: number[];
  /** Plan heading (rad, 0 = +x, counter-clockwise positive), continuous (not wrapped). */
  heading: number[];
  /** Signed curvature (1/m, + = left). */
  curvature: number[];
  /** Arc length at the start of each segment, and each segment's length (m). */
  segmentStart: number[];
  segmentLength: number[];
  length: number;
}

/** Integrates the segments in order from the origin, heading 0. */
export function integratePlan(segments: readonly LayoutSegment[]): Plan {
  const plan: Plan = {
    s: [0],
    x: [0],
    y: [0],
    heading: [0],
    curvature: [],
    segmentStart: [],
    segmentLength: [],
    length: 0,
  };
  let s = 0;
  let x = 0;
  let y = 0;
  let h = 0;
  segments.forEach((segment, index) => {
    const length = segmentLength(segment);
    if (!(length > 0)) throw new Error(`Segment "${segment.name}" has no length`);
    plan.segmentStart.push(s);
    plan.segmentLength.push(length);
    // The first point of this segment is the last point of the previous one: give it this
    // segment's starting curvature (the previous segment's end value is dropped at the join).
    if (index === 0) plan.curvature.push(segmentCurvature(segment, 0, length));
    else plan.curvature[plan.curvature.length - 1] = segmentCurvature(segment, 0, length);
    const steps = Math.max(1, Math.ceil(length / PLAN_STEP));
    const du = length / steps;
    const h0 = h;
    const x0 = x;
    const y0 = y;
    const sign = turnSign(segment);
    const constantArc = sign !== 0 && segment.radiusStart === segment.radiusEnd;
    for (let j = 1; j <= steps; j++) {
      const u = j * du;
      const hu = h0 + headingChange(segment, u, length);
      if (sign === 0) {
        x = x0 + u * Math.cos(h0);
        y = y0 + u * Math.sin(h0);
      } else if (constantArc) {
        // Closed form: x' = cos h, h = h0 + sign * u / R.
        const r = segment.radiusStart;
        x = x0 + sign * r * (Math.sin(hu) - Math.sin(h0));
        y = y0 - sign * r * (Math.cos(hu) - Math.cos(h0));
      } else {
        // Spiral: Simpson's rule over this step.
        const ua = u - du;
        const ha = h0 + headingChange(segment, ua, length);
        const hm = h0 + headingChange(segment, ua + du / 2, length);
        x += (du / 6) * (Math.cos(ha) + 4 * Math.cos(hm) + Math.cos(hu));
        y += (du / 6) * (Math.sin(ha) + 4 * Math.sin(hm) + Math.sin(hu));
      }
      plan.s.push(s + u);
      plan.x.push(x);
      plan.y.push(y);
      plan.heading.push(hu);
      plan.curvature.push(segmentCurvature(segment, u, length));
    }
    s += length;
    h = h0 + headingChange(segment, length, length);
  });
  plan.length = s;
  return plan;
}

/** Index of the last plan point at or before `s` (binary search), clamped to a valid interval. */
export function planIndex(plan: Plan, s: number): number {
  let lo = 0;
  let hi = plan.s.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((plan.s[mid] as number) <= s) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Index of the segment containing arc length `s` (binary search over segment starts). */
export function segmentIndexAt(plan: Plan, s: number): number {
  let lo = 0;
  let hi = plan.segmentStart.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((plan.segmentStart[mid] as number) <= s) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
