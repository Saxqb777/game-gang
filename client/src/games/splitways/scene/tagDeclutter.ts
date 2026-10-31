import { NAME_TAGS } from '../config';

/** Opacity a name tag gets from its distance to the camera alone (m), before declutter. */
export function tagDistanceOpacity(distance: number): number {
  const { nearHide, nearFull, farFull, farHide } = NAME_TAGS;
  if (distance <= nearHide || distance >= farHide) return 0;
  if (distance < nearFull) return (distance - nearHide) / (nearFull - nearHide);
  if (distance > farFull) return (farHide - distance) / (farHide - farFull);
  return 1;
}

/** Moves `current` towards `target` at `rate` opacity per second. */
export function approachOpacity(current: number, target: number, dt: number, rate: number): number {
  const step = rate * dt;
  if (current < target) return Math.min(target, current + step);
  return Math.max(target, current - step);
}

/**
 * Per-view name tag layout, the way racing games declutter labels: each tag fades with distance,
 * and where two tags would overlap on screen the nearer one wins and the other fades out. Fill
 * the candidates with `set`, then `solve`; all buffers are allocated once (no per-frame garbage).
 */
export class TagDeclutter {
  /** Screen centre of each tag in the view (px, any origin), and its half size on screen (px). */
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly halfWidth: Float64Array;
  readonly halfHeight: Float64Array;
  /** Camera-to-car distance (m); negative or a zero `base` means the tag is not shown. */
  readonly distance: Float64Array;
  /** Opacity before declutter (distance fade, 0 for your own car or a car behind the camera). */
  readonly base: Float64Array;
  /** Result of `solve`: the opacity each tag should fade to. */
  readonly target: Float64Array;
  private readonly order: Int32Array;

  constructor(readonly capacity: number) {
    this.x = new Float64Array(capacity);
    this.y = new Float64Array(capacity);
    this.halfWidth = new Float64Array(capacity);
    this.halfHeight = new Float64Array(capacity);
    this.distance = new Float64Array(capacity);
    this.base = new Float64Array(capacity);
    this.target = new Float64Array(capacity);
    this.order = new Int32Array(capacity);
  }

  set(
    i: number,
    x: number,
    y: number,
    halfWidth: number,
    halfHeight: number,
    distance: number,
  ): void {
    this.x[i] = x;
    this.y[i] = y;
    this.halfWidth[i] = halfWidth;
    this.halfHeight[i] = halfHeight;
    this.distance[i] = distance;
    this.base[i] = tagDistanceOpacity(distance);
  }

  hide(i: number): void {
    this.base[i] = 0;
    this.distance[i] = Infinity;
  }

  /** Fills `target` for tags 0..count-1: nearest first, each one hidden if it overlaps a nearer shown tag. */
  solve(count: number): void {
    const { order, distance, base, target, x, y, halfWidth, halfHeight } = this;
    const margin = NAME_TAGS.overlapMargin;
    // Insertion sort by distance: at most 8 tags.
    for (let i = 0; i < count; i++) {
      let j = i;
      while (j > 0 && (distance[order[j - 1] as number] as number) > (distance[i] as number)) {
        order[j] = order[j - 1] as number;
        j--;
      }
      order[j] = i;
    }
    for (let k = 0; k < count; k++) {
      const a = order[k] as number;
      let opacity = base[a] as number;
      for (let m = 0; m < k && opacity > 0; m++) {
        const b = order[m] as number;
        if ((target[b] as number) <= 0) continue;
        const overlapX =
          Math.abs((x[a] as number) - (x[b] as number)) <
          (halfWidth[a] as number) + (halfWidth[b] as number) + margin;
        const overlapY =
          Math.abs((y[a] as number) - (y[b] as number)) <
          (halfHeight[a] as number) + (halfHeight[b] as number) + margin;
        if (overlapX && overlapY) opacity = 0;
      }
      target[a] = opacity;
    }
  }
}
