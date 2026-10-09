import { describe, expect, it } from 'vitest';
import { RACE } from '../config';
import { autopilot } from '../debug/autopilot';
import { Simulation } from '../sim/simulation';
import { PhysicsWorld } from '../sim/world';
import { CORNICHE_RUN } from '../track/cornicheRun';
import { Track } from '../track/track';
import { buildTrackPhysics } from '../track/trackPhysics';
import { Race } from './race';

async function setup(cars: number) {
  const track = new Track(CORNICHE_RUN);
  const physics = await PhysicsWorld.create();
  buildTrackPhysics(physics, track);
  const sim = new Simulation(physics);
  const race = new Race(
    track,
    track.gridSpawns(cars).map((spawn) => sim.addCar(spawn)),
  );
  return { track, sim, race };
}

describe('race', () => {
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
      // A Corniche Run lap at racing speed takes roughly 30-75 s.
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
});
