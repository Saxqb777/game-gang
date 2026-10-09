/**
 * Race rules: countdown, checkpoints in order, laps, live positions, finish, and soft respawns.
 * Pure logic over the simulation (no rendering), so whole races can run headlessly in tests.
 */
import { Vector3 } from 'three';
import { RACE, RESPAWN } from '../config';
import type { Car, Spawn } from '../sim/car';
import { NEUTRAL_INPUT, copyInput } from '../sim/input';
import type { Checkpoint, Projection, Track } from '../track/track';

export type RacePhase = 'countdown' | 'racing' | 'finished';

export interface Racer {
  readonly car: Car;
  readonly slot: number;
  /** Current lap, 1-based once the car has crossed the start line; 0 on the grid. */
  lap: number;
  nextGate: number;
  /** Gates crossed since the start (the main part of the position ranking). */
  gatesPassed: number;
  lapStartedAt: number;
  lastLapMs: number | null;
  bestLapMs: number | null;
  /** Race time at the finish line in ms, null until finished. */
  finishedMs: number | null;
  /** Live position, 1 = leading. */
  place: number;
  readonly projection: Projection;
  /** Seconds driving the wrong way (HUD warning). */
  wrongWayTime: number;
  stuckTime: number;
  /** 0..1 screen fade while respawning: fade out, teleport, fade in. */
  fade: number;
  respawn: 'none' | 'out' | 'in';
  respawnTimer: number;
}

const delta = new Vector3();
const forward = new Vector3();
const LOCAL_FORWARD = new Vector3(0, 0, 1);
const RESPAWN_FADE_OUT = 0.3;
const RESPAWN_FADE_IN = 0.45;

export class Race {
  phase: RacePhase = 'countdown';
  /** Seconds since GO (negative during the countdown). */
  clock: number;
  readonly racers: Racer[];
  readonly totalLaps: number;
  /** Racers in position order, re-sorted in place every step. */
  private readonly order: Racer[];
  private finishDeadline = Infinity;
  private finishers = 0;

  /** Called when a car crosses the line to finish, and when the light goes green. */
  onFinish: ((racer: Racer) => void) | null = null;
  onGo: (() => void) | null = null;

  constructor(
    readonly track: Track,
    cars: readonly Car[],
  ) {
    this.totalLaps = track.definition.laps;
    this.clock = -RACE.countdownSeconds;
    this.racers = cars.map((car, slot) => ({
      car,
      slot,
      lap: 0,
      nextGate: 0,
      gatesPassed: 0,
      lapStartedAt: 0,
      lastLapMs: null,
      bestLapMs: null,
      finishedMs: null,
      place: slot + 1,
      projection: track.project(car.position, -1, { index: 0, distance: 0, lateral: 0 }),
      wrongWayTime: 0,
      stuckTime: 0,
      fade: 0,
      respawn: 'none',
      respawnTimer: 0,
    }));
    this.order = [...this.racers];
  }

  /** Whole seconds left on the countdown (3, 2, 1), 0 once racing. */
  get countdown(): number {
    return this.phase === 'countdown' ? Math.max(1, Math.ceil(-this.clock)) : 0;
  }

  /** Racers in finishing / current order. */
  standings(): Racer[] {
    return [...this.racers].sort((a, b) => a.place - b.place);
  }

  /**
   * Cars that may not drive right now: everyone during the countdown, finished cars, and cars
   * being respawned. Call before the physics step; it overrides their inputs.
   */
  holdInputs(): void {
    for (const racer of this.racers) {
      const input = racer.car.input;
      if (this.phase === 'countdown') {
        copyInput(input, NEUTRAL_INPUT);
        input.handbrake = true;
      } else if (racer.finishedMs !== null || racer.respawn === 'out') {
        copyInput(input, NEUTRAL_INPUT);
        if (racer.finishedMs !== null) input.brake = racer.car.forwardSpeed > 1 ? 0.35 : 0;
      }
    }
  }

  /** Advance the rules by one physics step (after the step). */
  update(dt: number): void {
    this.clock += dt;
    if (this.phase === 'countdown') {
      if (this.clock < 0) return;
      this.phase = 'racing';
      this.onGo?.();
    }
    for (const racer of this.racers) {
      this.track.project(racer.car.position, racer.projection.index, racer.projection);
      if (this.phase === 'racing' && racer.finishedMs === null) this.checkGate(racer);
      this.updateRespawn(racer, dt);
      this.updateWrongWay(racer, dt);
    }
    this.rank();
    if (
      this.phase === 'racing' &&
      (this.finishers === this.racers.length || this.clock > this.finishDeadline)
    ) {
      this.phase = 'finished';
    }
  }

  private checkGate(racer: Racer): void {
    const gate = this.track.checkpoints[racer.nextGate];
    if (!gate || !insideGate(racer.car.position, gate)) return;
    racer.gatesPassed++;
    racer.nextGate = (racer.nextGate + 1) % this.track.checkpoints.length;
    if (gate.index !== 0) return;
    if (racer.lap === 0) {
      // First crossing after the start: lap 1 is timed from the green light.
      racer.lap = 1;
      return;
    }
    const lapMs = Math.round((this.clock - racer.lapStartedAt) * 1000);
    racer.lastLapMs = lapMs;
    racer.bestLapMs = racer.bestLapMs === null ? lapMs : Math.min(racer.bestLapMs, lapMs);
    racer.lapStartedAt = this.clock;
    racer.lap++;
    if (racer.lap > this.totalLaps) {
      racer.finishedMs = Math.round(this.clock * 1000);
      this.finishers++;
      if (this.finishers === 1) this.finishDeadline = this.clock + RACE.finishTimeoutSeconds;
      this.onFinish?.(racer);
    }
  }

  private rank(): void {
    // Insertion sort in place: at most 4 racers, nearly sorted already, and no allocation.
    const order = this.order;
    for (let i = 1; i < order.length; i++) {
      const racer = order[i] as Racer;
      let j = i - 1;
      while (j >= 0 && this.isAhead(racer, order[j] as Racer)) {
        order[j + 1] = order[j] as Racer;
        j--;
      }
      order[j + 1] = racer;
    }
    for (let i = 0; i < order.length; i++) (order[i] as Racer).place = i + 1;
  }

  private isAhead(a: Racer, b: Racer): boolean {
    if (a.finishedMs !== null || b.finishedMs !== null) {
      return a.finishedMs !== null && (b.finishedMs === null || a.finishedMs < b.finishedMs);
    }
    if (a.gatesPassed !== b.gatesPassed) return a.gatesPassed > b.gatesPassed;
    return this.toNextGate(a) < this.toNextGate(b);
  }

  private toNextGate(racer: Racer): number {
    const gate = this.track.checkpoints[racer.nextGate];
    return gate ? this.track.ahead(racer.projection.distance, gate.distance) : 0;
  }

  private updateWrongWay(racer: Racer, dt: number): void {
    const { car } = racer;
    forward.copy(LOCAL_FORWARD).applyQuaternion(car.quaternion);
    const tangent = this.track.sample(racer.projection.index).tangent;
    const backwards = forward.dot(tangent) < -0.3 && car.velocity.dot(tangent) < -4;
    racer.wrongWayTime = backwards ? racer.wrongWayTime + dt : 0;
  }

  private updateRespawn(racer: Racer, dt: number): void {
    if (racer.respawn === 'out') {
      racer.respawnTimer += dt;
      racer.fade = Math.min(1, racer.respawnTimer / RESPAWN_FADE_OUT);
      if (racer.respawnTimer >= RESPAWN_FADE_OUT) {
        this.teleport(racer);
        racer.respawn = 'in';
        racer.respawnTimer = 0;
      }
      return;
    }
    if (racer.respawn === 'in') {
      racer.respawnTimer += dt;
      racer.fade = Math.max(0, 1 - racer.respawnTimer / RESPAWN_FADE_IN);
      if (racer.respawnTimer >= RESPAWN_FADE_IN) racer.respawn = 'none';
      return;
    }
    if (this.phase !== 'racing' || racer.finishedMs !== null) return;
    const { car } = racer;
    const tryingToMove = car.input.throttle > 0.3 || car.input.brake > 0.3;
    racer.stuckTime = tryingToMove && car.velocity.lengthSq() < 1 ? racer.stuckTime + dt : 0;
    const offTrack =
      Math.abs(racer.projection.lateral) > this.track.halfDrivable + 3 ||
      car.position.y < this.track.sample(racer.projection.index).position.y - 4;
    if (
      car.flippedTime > RESPAWN.flippedSeconds ||
      racer.stuckTime > RESPAWN.stuckSeconds ||
      offTrack
    ) {
      racer.respawn = 'out';
      racer.respawnTimer = 0;
      racer.stuckTime = 0;
    }
  }

  /** Back on the track at the last gate, in this car's own lane, clear of other cars. */
  private teleport(racer: Racer): void {
    const gates = this.track.checkpoints;
    const lastGate = gates[(racer.nextGate - 1 + gates.length) % gates.length];
    const base =
      racer.gatesPassed === 0 || !lastGate
        ? this.track.startLine.distance - 10
        : lastGate.distance + 3;
    const lane = ((racer.slot % 4) - 1.5) * (this.track.halfRoad * 0.5);
    let spawn: Spawn = this.track.spawnAt(base, lane);
    for (let attempt = 1; attempt < 6 && this.occupied(spawn, racer); attempt++) {
      spawn = this.track.spawnAt(base - attempt * 8, lane);
    }
    racer.car.placeAt(spawn);
    this.track.project(racer.car.position, -1, racer.projection);
  }

  private occupied(spawn: Spawn, self: Racer): boolean {
    for (const other of this.racers) {
      if (other === self) continue;
      if (delta.set(spawn.x, spawn.y, spawn.z).sub(other.car.position).lengthSq() < 36) return true;
    }
    return false;
  }
}

export function insideGate(position: Vector3, gate: Checkpoint): boolean {
  delta.subVectors(position, gate.sample.position);
  return (
    Math.abs(delta.dot(gate.sample.tangent)) <= gate.halfLength &&
    Math.abs(delta.dot(gate.sample.right)) <= gate.halfWidth &&
    Math.abs(delta.y) <= gate.halfHeight
  );
}
