import { describe, expect, it } from 'vitest';
import { RACE, RESPAWN } from '../config';
import { autopilot } from '../debug/autopilot';
import { NEUTRAL_INPUT, copyInput, type DriveInput } from '../sim/input';
import { Simulation } from '../sim/simulation';
import { PhysicsWorld } from '../sim/world';
import { buildTrackPhysics } from '../track/trackPhysics';
import { createPlaceholderTrack } from '../track/tracks';
import { Race, type Racer } from './race';

async function setup(cars: number, laps?: number) {
  const track = createPlaceholderTrack();
  const physics = await PhysicsWorld.create();
  buildTrackPhysics(physics, track);
  const sim = new Simulation(physics);
  const race = new Race(
    track,
    track.gridSpawns(cars).map((spawn) => sim.addCar(spawn)),
    laps,
  );
  const step = () => {
    race.holdInputs();
    sim.step();
    race.update(sim.dt);
  };
  return { track, sim, race, step };
}

/** Steps until a respawn has faded back in (at most 2 s). */
function untilBack(racer: Racer, step: () => void): void {
  for (let t = 0; t < 2 && racer.respawn !== 'none'; t += 1 / 60) step();
}

/** Runs the countdown out and lets go of the handbrake it held the cars with. */
function skipCountdown(race: Race, step: () => void): void {
  while (race.phase === 'countdown') step();
  for (const racer of race.racers) copyInput(racer.car.input, NEUTRAL_INPUT);
}

describe('race (placeholder loop)', () => {
  it('holds cars during the countdown, then goes green', async () => {
    const { sim, race } = await setup(2);
    let wentGreen = false;
    race.onGo = () => (wentGreen = true);
    expect(race.countdown).toBe(3);
    for (let t = 0; t < RACE.countdownSeconds - 0.1; t += sim.dt) {
      for (const r of race.racers) r.car.input.throttle = 1; // drivers flooring it early
      race.holdInputs();
      sim.step();
      race.update(sim.dt);
    }
    expect(race.phase).toBe('countdown');
    for (const r of race.racers) expect(r.car.velocity.length()).toBeLessThan(0.5);
    for (let i = 0; i < 12; i++) {
      race.holdInputs();
      sim.step();
      race.update(sim.dt);
    }
    expect(wentGreen).toBe(true);
    expect(race.phase).toBe('racing');
  });

  it('runs a full 3-lap race with 4 cars end to end', async () => {
    const { track, sim, race } = await setup(4);
    const finishOrder: number[] = [];
    race.onFinish = (racer) => finishOrder.push(racer.slot);
    let steps = 0;
    while (race.phase !== 'finished' && steps < 60 * 400) {
      for (const racer of race.racers) autopilot(track, racer, racer.car.input);
      race.holdInputs();
      sim.step();
      race.update(sim.dt);
      steps++;
    }
    expect(race.phase).toBe('finished');
    expect(finishOrder).toHaveLength(4);
    const standings = race.standings();
    expect(standings.map((r) => r.place)).toEqual([1, 2, 3, 4]);
    for (const racer of standings) {
      expect(racer.lap).toBe(race.totalLaps + 1);
      expect(racer.finishedMs).not.toBeNull();
      // A placeholder-loop lap at racing speed takes roughly 30-75 s.
      expect(racer.bestLapMs).toBeGreaterThan(25_000);
      expect(racer.bestLapMs).toBeLessThan(75_000);
    }
    // Finishing order matches the ranking.
    expect(standings.map((r) => r.slot)).toEqual(finishOrder);
  }, 60_000);

  it('does not count a lap that skips checkpoints', async () => {
    const { track, sim, race } = await setup(1);
    const racer = race.racers[0];
    if (!racer) throw new Error('no racer');
    race.clock = 0.01; // skip the countdown
    race.phase = 'racing';
    // Teleport straight from the start line back to the start line, missing gates 1..7.
    const start = track.startLine;
    racer.car.placeAt(track.spawnAt(start.distance, 0));
    sim.step();
    race.update(sim.dt);
    expect(racer.lap).toBe(1);
    racer.car.placeAt(track.spawnAt(start.distance + 40, 0));
    sim.step();
    race.update(sim.dt);
    racer.car.placeAt(track.spawnAt(start.distance, 0));
    sim.step();
    race.update(sim.dt);
    expect(racer.lap).toBe(1);
    expect(racer.nextGate).toBe(1);
  });

  it('takes the lap count from the track unless the race overrides it', async () => {
    expect((await setup(1)).race.totalLaps).toBe(3);
    expect((await setup(1, 99)).race.totalLaps).toBe(99);
  });
});

describe('manual reset', () => {
  it('is refused on the grid, then fades out, teleports and fades back in', async () => {
    const { race, step } = await setup(1);
    const racer = race.racers[0] as Racer;
    expect(race.requestRespawn(racer)).toBe(false);
    expect(racer.respawn).toBe('none');

    skipCountdown(race, step);
    expect(race.requestRespawn(racer)).toBe(true);
    expect(racer.respawn).toBe('out');
    let outFor = 0;
    while (racer.respawn === 'out' && outFor < 2) {
      step();
      outFor += 1 / 60;
    }
    expect(racer.respawn).toBe('in');
    expect(outFor).toBeCloseTo(0.3, 1);
    expect(racer.fade).toBeGreaterThan(0.9);
    for (let t = 0; t < 1 && racer.respawn === 'in'; t += 1 / 60) step();
    expect(racer.respawn).toBe('none');
    expect(racer.fade).toBe(0);
  });

  it('has a cooldown, and is refused mid-respawn and after the finish', async () => {
    const { race, step } = await setup(1);
    const racer = race.racers[0] as Racer;
    skipCountdown(race, step);
    expect(race.requestRespawn(racer)).toBe(true);
    // Mid-respawn.
    expect(race.requestRespawn(racer)).toBe(false);
    untilBack(racer, step);
    // Back on the road but still inside the cooldown.
    expect(race.clock).toBeLessThan(racer.resetReadyAt);
    expect(race.requestRespawn(racer)).toBe(false);
    const readyAt = racer.resetReadyAt;
    expect(readyAt - race.clock).toBeLessThan(RESPAWN.resetCooldownSeconds);
    while (race.clock < readyAt) step();
    expect(race.requestRespawn(racer)).toBe(true);
    untilBack(racer, step);

    racer.finishedMs = 1;
    racer.resetReadyAt = -Infinity;
    expect(race.requestRespawn(racer)).toBe(false);
  });

  it('a reset puts the car back at its last gate, never further round the lap', async () => {
    const { track, race, step } = await setup(1);
    const racer = race.racers[0] as Racer;
    skipCountdown(race, step);
    for (let t = 0; t < 8; t += 1 / 60) {
      autopilot(track, racer, racer.car.input);
      step();
    }
    const gates = racer.gatesPassed;
    const before = racer.projection.distance;
    expect(gates).toBeGreaterThan(0);
    expect(race.requestRespawn(racer)).toBe(true);
    untilBack(racer, step);
    expect(racer.gatesPassed).toBe(gates);
    // Signed distance gained along the lap: at most the 3 m the respawn sits past the gate.
    let gained = track.ahead(before, racer.projection.distance);
    if (gained > track.length / 2) gained -= track.length;
    expect(gained).toBeLessThan(3.5);
  });
});

describe('stuck on gas', () => {
  it('grows only with the gas held at a standstill, and brake alone does not grow it', async () => {
    const { track, sim, race, step } = await setup(1);
    const racer = race.racers[0] as Racer;
    const car = racer.car;
    skipCountdown(race, step);
    const spawn = track.spawnAt(track.startLine.distance + 30, 0);
    /** One step with the car pinned in place (as if wedged against a wall). */
    const pinned = (input: Partial<DriveInput>) => {
      copyInput(car.input, NEUTRAL_INPUT);
      Object.assign(car.input, input);
      race.holdInputs();
      sim.step();
      car.placeAt(spawn);
      race.update(sim.dt);
    };

    for (let i = 0; i < 60; i++) pinned({ brake: 1 });
    expect(racer.stuckOnGasTime).toBe(0);
    expect(racer.stuckTime).toBeGreaterThan(0.9);

    for (let i = 0; i < 60; i++) pinned({ throttle: 0.2 });
    expect(racer.stuckOnGasTime).toBe(0);

    for (let i = 0; i < 120; i++) pinned({ throttle: 1 });
    expect(racer.stuckOnGasTime).toBeCloseTo(2, 1);
    expect(racer.stuckOnGasTime).toBeGreaterThanOrEqual(RESPAWN.stuckHintSeconds - 0.05);

    // Moving again resets it.
    for (let t = 0; t < 2; t += 1 / 60) {
      copyInput(car.input, NEUTRAL_INPUT);
      car.input.throttle = 1;
      step();
    }
    expect(car.velocity.length()).toBeGreaterThan(1);
    expect(racer.stuckOnGasTime).toBe(0);
  });

  it('respawns a car wedged for RESPAWN.stuckSeconds', async () => {
    const { track, sim, race, step } = await setup(1);
    const racer = race.racers[0] as Racer;
    const car = racer.car;
    skipCountdown(race, step);
    const spawn = track.spawnAt(track.startLine.distance + 30, 0);
    let wedged = 0;
    while (racer.respawn === 'none' && wedged < RESPAWN.stuckSeconds + 1) {
      copyInput(car.input, NEUTRAL_INPUT);
      car.input.throttle = 1;
      race.holdInputs();
      sim.step();
      car.placeAt(spawn);
      race.update(sim.dt);
      wedged += sim.dt;
    }
    expect(racer.respawn).toBe('out');
    expect(wedged).toBeGreaterThan(RESPAWN.stuckSeconds - 0.05);
    expect(wedged).toBeLessThan(RESPAWN.stuckSeconds + 0.1);
    expect(racer.stuckOnGasTime).toBe(0);
  });
});
