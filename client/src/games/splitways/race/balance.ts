/**
 * Balance and feel measurements shared by the balance test, the per-car feel tests and the
 * `client/scripts/balance-cars.ts` tuning printout. Node-safe; never imported by the game.
 */
import { autopilot } from '../debug/autopilot';
import type { Car } from '../sim/car';
import type { CarSpec } from '../sim/carSpec';
import { NEUTRAL_INPUT, copyInput } from '../sim/input';
import { Simulation } from '../sim/simulation';
import { PhysicsWorld } from '../sim/world';
import type { Track } from '../track/track';
import { buildTrackPhysics } from '../track/trackPhysics';
import { Race } from './race';
import { carSpeedProfile } from './speedProfile';

export interface BalanceRun {
  /** Lap times in ms (lap 1 from the green light, lap 2 flying); null if not completed. */
  lap1Ms: number | null;
  lap2Ms: number | null;
  respawns: number;
  /** Highest speed seen (km/h). */
  topKph: number;
}

/** Hard cap on simulated race time (s), so a stuck car cannot hang the test. */
const MAX_RACE_SECONDS = 400;

/**
 * One car alone on grid slot 0, two laps on the autopilot at its own speed profile (balance
 * definition, spec §5.6).
 */
export async function runBalance(track: Track, spec: CarSpec): Promise<BalanceRun> {
  const physics = await PhysicsWorld.create();
  buildTrackPhysics(physics, track);
  const sim = new Simulation(physics);
  const [spawn] = track.gridSpawns(1);
  if (!spawn) throw new Error('no grid slot');
  const car = sim.addCar(spawn, spec);
  const race = new Race(track, [car], 2);
  const racer = race.racers[0];
  if (!racer) throw new Error('no racer');
  const speeds = carSpeedProfile(track, spec);
  const laps: number[] = [];
  let respawns = 0;
  let topKph = 0;
  let wasRespawning = false;
  race.onFinish = () => undefined;
  try {
    for (let step = 0; race.phase !== 'finished' && step < MAX_RACE_SECONDS * 60; step++) {
      if (race.phase === 'racing') autopilot(track, racer, car.input, speeds);
      else copyInput(car.input, NEUTRAL_INPUT);
      race.holdInputs();
      sim.step();
      const lapBefore = racer.lap;
      race.update(sim.dt);
      if (racer.lap > lapBefore && racer.lastLapMs !== null && lapBefore >= 1) {
        laps.push(racer.lastLapMs);
      }
      const respawning = racer.respawn !== 'none';
      if (respawning && !wasRespawning) respawns++;
      wasRespawning = respawning;
      topKph = Math.max(topKph, car.speedKph);
    }
  } finally {
    sim.dispose();
  }
  return { lap1Ms: laps[0] ?? null, lap2Ms: laps[1] ?? null, respawns, topKph };
}

/** A big flat floor and one car on it, settled on its suspension. */
export async function flatWorld(spec: CarSpec): Promise<{ sim: Simulation; car: Car }> {
  const physics = await PhysicsWorld.create();
  physics.addBox({ x: 0, y: -0.5, z: 0 }, { x: 4000, y: 0.5, z: 4000 });
  const sim = new Simulation(physics);
  const car = sim.addCar({ x: 0, y: 0.3, z: 0, yaw: 0 }, spec);
  for (let i = 0; i < 90; i++) sim.step();
  return { sim, car };
}

export interface Launch {
  /** Seconds from a standstill to 100 km/h (Infinity if never reached). */
  zeroTo100: number;
  /** Speed after `seconds` of full throttle (km/h). */
  topKph: number;
}

/** Full throttle in a straight line from a standstill on the flat. */
export async function measureLaunch(spec: CarSpec, seconds = 30): Promise<Launch> {
  const { sim, car } = await flatWorld(spec);
  copyInput(car.input, NEUTRAL_INPUT);
  car.input.throttle = 1;
  let zeroTo100 = Infinity;
  for (let i = 1; i <= seconds * 60; i++) {
    sim.step();
    if (zeroTo100 === Infinity && car.forwardSpeed >= 100 / 3.6) zeroTo100 = i / 60;
  }
  const topKph = car.speedKph;
  sim.dispose();
  return { zeroTo100, topKph };
}

/** Engine top speed on the flat: where the engine force meets drag and rolling resistance (m/s). */
export function plannedTopSpeed(spec: CarSpec): number {
  const { force, topSpeed, curve, drag, rollingResistance } = spec.engine;
  let lo = 0;
  let hi = topSpeed;
  for (let i = 0; i < 60; i++) {
    const v = (lo + hi) / 2;
    const push = force * (1 - (v / topSpeed) ** curve);
    if (push > drag * v * v + rollingResistance) lo = v;
    else hi = v;
  }
  return lo;
}

/** Distance (m) to stop from 100 km/h with full brakes on the flat. */
export async function measureBraking(spec: CarSpec): Promise<number> {
  const { sim, car } = await flatWorld(spec);
  copyInput(car.input, NEUTRAL_INPUT);
  car.input.throttle = 1;
  for (let i = 0; i < 60 * 20 && car.forwardSpeed < 100 / 3.6; i++) sim.step();
  car.input.throttle = 0;
  car.input.brake = 1;
  const start = car.position.clone();
  for (let i = 0; i < 60 * 10 && car.forwardSpeed > 0.3; i++) sim.step();
  const distance = car.position.distanceTo(start);
  sim.dispose();
  return distance;
}
