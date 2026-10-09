/**
 * A race track built from a closed loop of spline control points. Everything else (road mesh,
 * walls, checkpoints, grid, minimap) derives from the evenly spaced samples computed here, so a new
 * track is just a new list of points. Node-safe: no rendering.
 */
import { CatmullRomCurve3, Vector3 } from 'three';
import type { Spawn } from '../sim/car';

export interface TrackDefinition {
  id: string;
  name: string;
  /** Closed loop of [x, y, z] control points in driving order. y is the road height. */
  points: readonly (readonly [number, number, number])[];
  /** Asphalt width, plus a drivable sand shoulder on each side, then a wall. */
  roadWidth: number;
  shoulderWidth: number;
  /** Number of lap-validation gates, gate 0 being the start/finish line. */
  checkpointCount: number;
  /** Arc-length position of the start/finish line along the loop (m). */
  startDistance: number;
  laps: number;
}

export interface TrackSample {
  position: Vector3;
  /** Unit direction of travel (horizontal). */
  tangent: Vector3;
  /** Unit vector to the driver's right (horizontal). */
  right: Vector3;
  /** Arc length from the start of the spline (m). */
  distance: number;
  /** Signed curvature (1/m): positive bends left. */
  curvature: number;
}

export interface Checkpoint {
  index: number;
  /** Arc length along the loop (m). */
  distance: number;
  sample: TrackSample;
  /** Half extents of the trigger box: along the road, across it, and vertically. */
  halfLength: number;
  halfWidth: number;
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

const SAMPLE_SPACING = 1;
const UP = new Vector3(0, 1, 0);
const delta = new Vector3();

export class Track {
  readonly samples: TrackSample[];
  readonly length: number;
  readonly checkpoints: Checkpoint[];
  readonly halfRoad: number;
  /** Half width up to the walls (road + shoulder). */
  readonly halfDrivable: number;

  constructor(readonly definition: TrackDefinition) {
    const curve = new CatmullRomCurve3(
      definition.points.map(([x, y, z]) => new Vector3(x, y, z)),
      true,
      'centripetal',
    );
    curve.arcLengthDivisions = 6000;
    this.length = curve.getLength();
    const count = Math.round(this.length / SAMPLE_SPACING);
    this.samples = [];
    for (let i = 0; i < count; i++) {
      const u = i / count;
      const position = curve.getPointAt(u);
      const tangent = curve.getTangentAt(u);
      tangent.y = 0;
      tangent.normalize();
      const right = new Vector3().crossVectors(tangent, UP).normalize();
      this.samples.push({ position, tangent, right, distance: u * this.length, curvature: 0 });
    }
    this.computeCurvature();
    this.halfRoad = definition.roadWidth / 2;
    this.halfDrivable = this.halfRoad + definition.shoulderWidth;

    this.checkpoints = [];
    for (let k = 0; k < definition.checkpointCount; k++) {
      const distance = this.wrap(
        definition.startDistance + (k * this.length) / definition.checkpointCount,
      );
      this.checkpoints.push({
        index: k,
        distance,
        sample: this.sampleAt(distance),
        // Long enough along the road that even a car at top speed can't skip it between two steps.
        halfLength: 3,
        halfWidth: this.halfDrivable + 1.5,
        halfHeight: 6,
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

  /** Nearest stored sample to an arc length. */
  sampleAt(distance: number): TrackSample {
    return this.sample(Math.round((this.wrap(distance) / this.length) * this.samples.length));
  }

  /**
   * Nearest centre-line sample to a position, searching around a previous index so cars on two
   * parallel stretches (like the hairpin's legs) are never confused. Pass -1 to search everything.
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
      spawns.push(this.spawnAt(this.startLine.distance - back, side * this.halfRoad * 0.45));
    }
    return spawns;
  }

  /** A spawn on the road at an arc length, offset sideways (positive = right), facing forward. */
  spawnAt(distance: number, lateral: number): Spawn {
    const sample = this.sampleAt(distance);
    return {
      x: sample.position.x + sample.right.x * lateral,
      y: sample.position.y + 0.5,
      z: sample.position.z + sample.right.z * lateral,
      yaw: Math.atan2(sample.tangent.x, sample.tangent.z),
    };
  }

  /** Smallest turning radius along the track (m). The road must be wider than nothing at any point. */
  minimumRadius(): number {
    let maxCurvature = 0;
    for (const s of this.samples) maxCurvature = Math.max(maxCurvature, Math.abs(s.curvature));
    return maxCurvature > 0 ? 1 / maxCurvature : Infinity;
  }

  private computeCurvature(): void {
    const n = this.samples.length;
    const span = 4;
    for (let i = 0; i < n; i++) {
      const before = this.sample(i - span).tangent;
      const after = this.sample(i + span).tangent;
      // Signed angle between tangents (left turns positive) over the arc length between them.
      const cross = before.x * after.z - before.z * after.x;
      const dot = before.x * after.x + before.z * after.z;
      const angle = Math.atan2(-cross, dot);
      (this.samples[i] as TrackSample).curvature = angle / (2 * span * SAMPLE_SPACING);
    }
  }
}
