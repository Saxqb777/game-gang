/**
 * Tyre marks that stay for the whole race: a ring buffer of quads laid along every skidding wheel's
 * path, one draw call for all cars. When the buffer is full the oldest marks are reused.
 */
import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three';
import type { Car } from '../sim/car';

const MAX_SEGMENTS = 8000;
const HALF_WIDTH = 0.12;
/** A new segment starts once the wheel has moved this far (m). */
const SEGMENT_LENGTH = 0.4;
/** Height above the road, on top of the polygon offset. */
const LIFT = 0.02;
const WHEELS = 4;
const ASPHALT = [0.015, 0.015, 0.015] as const;
const SAND = [0.16, 0.11, 0.06] as const;

const UP = new Vector3(0, 1, 0);
const direction = new Vector3();
const side = new Vector3();

interface Trail {
  active: boolean;
  last: Vector3;
  lastSide: Vector3;
}

interface Range {
  start: number;
  count: number;
}

export class SkidMarks {
  readonly mesh: Mesh<BufferGeometry, MeshBasicMaterial>;
  private readonly positions: BufferAttribute;
  private readonly colours: BufferAttribute;
  private readonly trails = new Map<Car, Trail[]>();
  private next = 0;
  private count = 0;
  /** Segments before `flushed` have been handed to the GPU (from `pendingFrom` if not yet uploaded). */
  private flushed = 0;
  private pendingFrom = 0;
  private readonly positionRanges: Range[] = [
    { start: 0, count: 0 },
    { start: 0, count: 0 },
  ];
  private readonly colourRanges: Range[] = [
    { start: 0, count: 0 },
    { start: 0, count: 0 },
  ];

  constructor() {
    const geometry = new BufferGeometry();
    this.positions = new BufferAttribute(new Float32Array(MAX_SEGMENTS * 4 * 3), 3);
    this.colours = new BufferAttribute(new Float32Array(MAX_SEGMENTS * 4 * 4), 4);
    this.positions.setUsage(DynamicDrawUsage);
    this.colours.setUsage(DynamicDrawUsage);
    const index = new Uint32Array(MAX_SEGMENTS * 6);
    for (let i = 0; i < MAX_SEGMENTS; i++) {
      // Vertices: 0 previous left, 1 previous right, 2 current left, 3 current right.
      index.set([i * 4, i * 4 + 2, i * 4 + 1, i * 4 + 1, i * 4 + 2, i * 4 + 3], i * 6);
    }
    geometry.setIndex(new BufferAttribute(index, 1));
    geometry.setAttribute('position', this.positions);
    geometry.setAttribute('color', this.colours);
    geometry.setDrawRange(0, 0);
    this.mesh = new Mesh(
      geometry,
      new MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  addCar(car: Car): void {
    const trails: Trail[] = [];
    for (let i = 0; i < WHEELS; i++) {
      trails.push({ active: false, last: new Vector3(), lastSide: new Vector3() });
    }
    this.trails.set(car, trails);
  }

  /** After each physics step. `onSand`: the car is on the shoulder, so marks are sandy ruts. */
  update(car: Car, onSand: boolean): void {
    const trails = this.trails.get(car);
    if (!trails) return;
    for (let i = 0; i < WHEELS; i++) {
      const trail = trails[i] as Trail;
      // On sand every rolling wheel leaves a rut; on asphalt only sliding ones do.
      const marking =
        car.wheelInContact[i] === 1 &&
        (car.wheelSkidding[i] === 1 || (onSand && Math.abs(car.forwardSpeed) > 3));
      if (!marking) {
        trail.active = false;
        continue;
      }
      const contact = car.wheelContact[i] as Vector3;
      if (!trail.active) {
        trail.active = true;
        trail.last.copy(contact);
        trail.lastSide.set(0, 0, 0);
        continue;
      }
      direction.subVectors(contact, trail.last);
      direction.y = 0;
      const length = direction.length();
      if (length < SEGMENT_LENGTH) continue;
      side.crossVectors(direction, UP).normalize().multiplyScalar(HALF_WIDTH);
      if (trail.lastSide.lengthSq() === 0) trail.lastSide.copy(side);
      const strength = onSand ? 0.5 : Math.min(0.75, 0.3 + (car.wheelSlide[i] ?? 0) * 0.05);
      this.addSegment(trail.last, trail.lastSide, contact, side, onSand ? SAND : ASPHALT, strength);
      trail.last.copy(contact);
      trail.lastSide.copy(side);
    }
  }

  /** Once per frame: upload the segments added since the last upload (only those bytes). */
  flush(): void {
    // Ranges still queued means three.js hasn't drawn the marks since: keep the older start.
    const from = this.positions.updateRanges.length > 0 ? this.pendingFrom : this.flushed;
    if (from === this.next) return;
    this.positions.clearUpdateRanges();
    this.colours.clearUpdateRanges();
    if (this.next > from) {
      this.queue(0, from, this.next - from);
    } else {
      this.queue(0, from, MAX_SEGMENTS - from);
      if (this.next > 0) this.queue(1, 0, this.next);
    }
    this.positions.needsUpdate = true;
    this.colours.needsUpdate = true;
    this.pendingFrom = from;
    this.flushed = this.next;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }

  private addSegment(
    from: Vector3,
    fromSide: Vector3,
    to: Vector3,
    toSide: Vector3,
    colour: readonly [number, number, number],
    alpha: number,
  ): void {
    const k = this.next;
    const p = this.positions.array as Float32Array;
    const o = k * 12;
    p[o] = from.x + fromSide.x;
    p[o + 1] = from.y + LIFT;
    p[o + 2] = from.z + fromSide.z;
    p[o + 3] = from.x - fromSide.x;
    p[o + 4] = from.y + LIFT;
    p[o + 5] = from.z - fromSide.z;
    p[o + 6] = to.x + toSide.x;
    p[o + 7] = to.y + LIFT;
    p[o + 8] = to.z + toSide.z;
    p[o + 9] = to.x - toSide.x;
    p[o + 10] = to.y + LIFT;
    p[o + 11] = to.z - toSide.z;
    const c = this.colours.array as Float32Array;
    for (let v = 0; v < 4; v++) {
      const ci = (k * 4 + v) * 4;
      c[ci] = colour[0];
      c[ci + 1] = colour[1];
      c[ci + 2] = colour[2];
      c[ci + 3] = alpha;
    }
    this.next = (k + 1) % MAX_SEGMENTS;
    this.count = Math.min(this.count + 1, MAX_SEGMENTS);
    this.mesh.geometry.setDrawRange(0, this.count * 6);
  }

  private queue(slot: number, firstSegment: number, segments: number): void {
    const p = this.positionRanges[slot] as Range;
    p.start = firstSegment * 12;
    p.count = segments * 12;
    this.positions.updateRanges.push(p);
    const c = this.colourRanges[slot] as Range;
    c.start = firstSegment * 16;
    c.count = segments * 16;
    this.colours.updateRanges.push(c);
  }
}
