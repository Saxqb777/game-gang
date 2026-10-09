/**
 * Speed tricks on top of the car physics, in every mode: drift boost (slide long enough and the
 * sparks change colour; straighten up to cash in), boost pads on corner exits, and slipstream
 * behind other cars. Items add nitro through `give`. Pure logic, so it runs in tests.
 */
import { Vector3 } from 'three';
import { BOOSTS } from '../config';
import type { Car } from '../sim/car';
import type { Track, TrackSample } from '../track/track';

export interface BoostPad {
  sample: TrackSample;
  /** Offset from the centre line (m, + is right). */
  lateral: number;
  centre: Vector3;
  halfLength: number;
  halfWidth: number;
}

export interface BoostState {
  /** Seconds of boost left. */
  time: number;
  /** Seconds of sliding so far and the spark colour it has reached (0 none, 1-3). */
  charge: number;
  level: number;
  /** Seconds since the slide dipped below the angle. */
  grace: number;
  /** Slipstream strength, 0..1. */
  draft: number;
  padCooldown: number;
}

export type BoostSource = 'drift' | 'pad' | 'nitro';

const delta = new Vector3();
const forward = new Vector3();
const LOCAL_FORWARD = new Vector3(0, 0, 1);
/** Boosts fade over their last fraction of a second instead of cutting out. */
const BOOST_FADE = 0.25;

/** Corner exits, tightest corners first, spread out, away from the start line. */
export function placeBoostPads(track: Track, count: number): BoostPad[] {
  const n = track.samples.length;
  const exits: { index: number; sharpness: number }[] = [];
  let sharpest = 0;
  let inCorner = false;
  for (let i = 0; i < n; i++) {
    const curvature = Math.abs(track.sample(i).curvature);
    if (curvature > 1 / 110) {
      inCorner = true;
      sharpest = Math.max(sharpest, curvature);
      continue;
    }
    if (!inCorner) continue;
    // The road straightens for at least the next 10 m: a corner exit.
    let straight = true;
    for (let k = 1; k <= 10 && straight; k++)
      straight = Math.abs(track.sample(i + k).curvature) < 1 / 150;
    if (!straight) continue;
    exits.push({ index: i, sharpness: sharpest });
    inCorner = false;
    sharpest = 0;
  }
  exits.sort((a, b) => b.sharpness - a.sharpness);
  const chosen: number[] = [];
  const gap = (a: number, b: number) => {
    const from = track.sample(a).distance;
    const to = track.sample(b).distance;
    return Math.min(track.ahead(from, to), track.ahead(to, from));
  };
  const start = track.startLine.sample;
  const startIndex = track.samples.indexOf(start);
  for (const exit of exits) {
    if (chosen.length >= count) break;
    const at = (exit.index + 12) % n;
    if (gap(at, startIndex) > 60 && chosen.every((other) => gap(other, at) > 100)) chosen.push(at);
  }
  chosen.sort((a, b) => a - b);
  return chosen.map((index, k) => {
    const sample = track.sample(index);
    const lateral = (k % 2 === 0 ? -1 : 1) * track.halfRoad * 0.38;
    return {
      sample,
      lateral,
      centre: sample.position.clone().addScaledVector(sample.right, lateral),
      halfLength: 4,
      halfWidth: 1.9,
    };
  });
}

export class Boosts {
  readonly states: BoostState[];
  readonly pads: BoostPad[];
  /** A slide reached a new spark colour. */
  onDriftLevel: ((index: number, level: number) => void) | null = null;
  /** A boost started (or was topped up). */
  onBoost: ((index: number, source: BoostSource) => void) | null = null;

  constructor(
    track: Track,
    private readonly cars: readonly Car[],
  ) {
    this.pads = placeBoostPads(track, BOOSTS.padCount);
    this.states = cars.map(() => ({
      time: 0,
      charge: 0,
      level: 0,
      grace: 0,
      draft: 0,
      padCooldown: 0,
    }));
  }

  give(index: number, seconds: number, source: BoostSource): void {
    const state = this.states[index];
    if (!state) return;
    state.time = Math.max(state.time, seconds);
    this.onBoost?.(index, source);
  }

  /** After each physics step. Sets every car's boost and draft for the next one. */
  update(dt: number, racing: boolean): void {
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i] as Car;
      const state = this.states[i] as BoostState;
      if (racing && car.spinTime === 0) {
        this.updateDrift(i, car, state, dt);
        this.updatePads(i, car, state, dt);
        state.draft = this.slipstreamTarget(i, car, dt, state.draft);
      } else {
        state.charge = 0;
        state.level = 0;
        state.draft = 0;
      }
      state.time = Math.max(0, state.time - dt);
      car.boost = state.time > 0 ? Math.min(1, state.time / BOOST_FADE) : 0;
      car.draft = state.draft;
    }
  }

  private updateDrift(index: number, car: Car, state: BoostState, dt: number): void {
    const sliding =
      car.groundedWheels >= 2 &&
      car.forwardSpeed > BOOSTS.driftMinSpeed &&
      Math.abs(car.slipAngle) > BOOSTS.driftMinSlip;
    if (sliding) {
      state.charge += dt;
      state.grace = 0;
      let level = 0;
      for (const threshold of BOOSTS.driftLevels) if (state.charge >= threshold) level++;
      if (level > state.level) {
        state.level = level;
        this.onDriftLevel?.(index, level);
      }
      return;
    }
    if (state.charge === 0) return;
    state.grace += dt;
    if (state.grace < BOOSTS.driftGrace) return;
    if (state.level > 0) this.give(index, BOOSTS.driftBoosts[state.level - 1] ?? 0, 'drift');
    state.charge = 0;
    state.level = 0;
  }

  private updatePads(index: number, car: Car, state: BoostState, dt: number): void {
    state.padCooldown = Math.max(0, state.padCooldown - dt);
    if (state.padCooldown > 0) return;
    for (const pad of this.pads) {
      delta.subVectors(car.position, pad.centre);
      if (
        Math.abs(delta.dot(pad.sample.tangent)) <= pad.halfLength &&
        Math.abs(delta.dot(pad.sample.right)) <= pad.halfWidth &&
        Math.abs(delta.y) < 2
      ) {
        state.padCooldown = 0.6;
        this.give(index, BOOSTS.padBoost, 'pad');
        return;
      }
    }
  }

  /** Strength of the slipstream from the best car ahead, eased in and out. */
  private slipstreamTarget(index: number, car: Car, dt: number, current: number): number {
    let target = 0;
    if (car.forwardSpeed > BOOSTS.slipstreamMinSpeed) {
      forward.copy(LOCAL_FORWARD).applyQuaternion(car.quaternion);
      for (let j = 0; j < this.cars.length; j++) {
        if (j === index) continue;
        const other = this.cars[j] as Car;
        delta.subVectors(other.position, car.position);
        const along = delta.dot(forward);
        if (along < 2 || along > BOOSTS.slipstreamRange) continue;
        const sideways = Math.sqrt(Math.max(0, delta.lengthSq() - along * along));
        if (sideways > BOOSTS.slipstreamWidth) continue;
        target = Math.max(target, 1 - (along - 2) / (BOOSTS.slipstreamRange - 2));
      }
    }
    // Builds up over ~0.6 s, drops away over ~0.3 s.
    const rate = target > current ? dt / 0.6 : dt / 0.3;
    return current + Math.max(-rate, Math.min(rate, target - current));
  }
}
