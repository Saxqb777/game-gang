import { describe, expect, it } from 'vitest';
import base from '../../../../../assets/tracks/kestrel-pines/base.layout.json';
import overrides from '../../../../../assets/tracks/kestrel-pines/overrides.json';
import { RACE, RESPAWN } from '../config';
import { autopilot } from '../debug/autopilot';
import { NEUTRAL_INPUT, copyInput, type DriveInput } from '../sim/input';
import { Simulation } from '../sim/simulation';
import { PhysicsWorld } from '../sim/world';
import { SURFACE } from '../track/surfaces';
import { buildTrackPhysics } from '../track/trackPhysics';
import { buildTrack } from '../track/tracks';
import { Race, type Racer } from './race';

const kestrelPines = buildTrack(base, overrides);

async function setup(cars: number, laps?: number) {
  const track = kestrelPines;
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

describe('race (Kestrel Pines)', () => {
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
  }, 30_000);

  // The track's own 3 laps: the run takes about 10 s here (measured alone, P2.11 allows up to 40 s).
  it('runs a full 3-lap race with 4 autopilot cars end to end', async () => {
    const { track, sim, race } = await setup(4);
    const finishOrder: number[] = [];
    race.onFinish = (racer) => finishOrder.push(racer.slot);
    let steps = 0;
    let respawns = 0;
    while (race.phase !== 'finished' && steps < 60 * 900) {
      for (const racer of race.racers) {
        autopilot(track, racer, racer.car.input);
        if (racer.respawn === 'out' && racer.respawnTimer === 0) respawns++;
      }
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
      // A Kestrel Pines lap on autopilot takes about 1.5 minutes.
      expect(racer.bestLapMs).toBeGreaterThan(55_000);
      expect(racer.bestLapMs).toBeLessThan(160_000);
    }
    // Finishing order matches the ranking.
    expect(standings.map((r) => r.slot)).toEqual(finishOrder);
    console.info(
      `[race] ${race.totalLaps} laps in ${(steps / 60).toFixed(0)} s of race time, best laps ${standings.map((r) => r.bestLapMs).join(', ')} ms, ${respawns} respawns`,
    );
  }, 120_000);

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

  it('a reset puts the car back behind its last safe spot, never further round the lap', async () => {
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
    // Signed distance gained along the lap: the respawn sits 10 m behind the last safe spot, which
    // is never ahead of where the reset was asked for.
    let gained = track.ahead(before, racer.projection.distance);
    if (gained > track.length / 2) gained -= track.length;
    expect(gained).toBeLessThan(0);
  }, 30_000);
});

describe('safe respawn', () => {
  it('puts a car that went onto the run-off back behind its last clean spot, on the asphalt', async () => {
    const { track, race, step } = await setup(1);
    const racer = race.racers[0] as Racer;
    const car = racer.car;
    skipCountdown(race, step);
    for (let t = 0; t < 10; t += 1 / 60) {
      autopilot(track, racer, car.input);
      step();
    }
    expect(racer.gatesPassed).toBeGreaterThan(0);
    const safe = racer.safeDistance;
    expect(track.ahead(safe, racer.projection.distance)).toBeLessThan(5);

    // Off onto the grass 40 m further on, and keep going there.
    const index = track.indexAt(racer.projection.distance + 40);
    const p = track.side(index, -1);
    car.placeAt(track.spawnAt(index * track.spacing, -(p.road + p.kerb + 4)));
    for (let t = 0; t < 1; t += 1 / 60) {
      copyInput(car.input, NEUTRAL_INPUT);
      car.input.throttle = 0.4;
      step();
    }
    expect(Math.abs(racer.projection.lateral)).toBeGreaterThan(p.road);
    expect(racer.safeDistance).toBe(safe);

    copyInput(car.input, NEUTRAL_INPUT);
    expect(race.requestRespawn(racer)).toBe(true);
    untilBack(racer, step);
    for (let i = 0; i < 30; i++) step();
    // Behind the safe spot (10 m back), in its lane on the asphalt.
    let back = track.ahead(racer.projection.distance, safe);
    if (back > track.length / 2) back -= track.length;
    expect(back).toBeGreaterThan(8);
    expect(back).toBeLessThan(12);
    const side = track.side(racer.projection.index, racer.projection.lateral < 0 ? -1 : 1);
    expect(Math.abs(racer.projection.lateral)).toBeLessThan(side.road);
    expect(car.dominantSurface).toBe(SURFACE.asphalt);
  }, 30_000);
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
