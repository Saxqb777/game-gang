import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { BOOSTS, ITEMS } from '../config';
import type { Car } from '../sim/car';
import { NEUTRAL_INPUT, copyInput } from '../sim/input';
import { Simulation } from '../sim/simulation';
import { PhysicsWorld } from '../sim/world';
import { CORNICHE_RUN } from '../track/cornicheRun';
import { Track } from '../track/track';
import { buildTrackPhysics } from '../track/trackPhysics';
import { Boosts } from './boosts';
import { Items, rollItem } from './items';
import { Race, type Racer } from './race';

/** Small deterministic random for repeatable tests. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

async function setup(cars: number) {
  const track = new Track(CORNICHE_RUN);
  const physics = await PhysicsWorld.create();
  buildTrackPhysics(physics, track);
  const sim = new Simulation(physics);
  const race = new Race(
    track,
    track.gridSpawns(cars).map((spawn) => sim.addCar(spawn)),
  );
  const boosts = new Boosts(
    track,
    race.racers.map((r) => r.car),
  );
  const items = new Items(track, race, boosts, seeded(7));
  const step = () => {
    race.holdInputs();
    sim.step();
    race.update(sim.dt);
    items.update(sim.dt);
    boosts.update(sim.dt, race.phase === 'racing');
  };
  // Skip the countdown, and let go of the handbrake it held the cars with.
  while (race.phase === 'countdown') step();
  for (const racer of race.racers) copyInput(racer.car.input, NEUTRAL_INPUT);
  /** Puts a racer at an arc length (m from the start of the spline) and lane offset. */
  const place = (racer: Racer, distance: number, lateral = 0) => {
    racer.car.placeAt(track.spawnAt(distance, lateral));
    track.project(racer.car.position, -1, racer.projection);
  };
  return { track, sim, race, boosts, items, step, place };
}

/** Full throttle for every car, straight ahead. */
function floor(cars: readonly Car[]) {
  for (const car of cars) {
    copyInput(car.input, NEUTRAL_INPUT);
    car.input.throttle = 1;
  }
}

describe('item odds', () => {
  it('gives the leader defence and the back of the pack attack, and never a drone to the leader', () => {
    const random = seeded(42);
    const count = (place: number, kind: string) => {
      let n = 0;
      for (let i = 0; i < 4000; i++) if (rollItem(place, 4, random).kind === kind) n++;
      return n / 4000;
    };
    expect(count(1, 'bounty')).toBe(0);
    expect(count(4, 'bounty')).toBeGreaterThan(0.05);
    expect(count(4, 'nitro')).toBeGreaterThan(count(1, 'nitro') * 2);
    expect(count(1, 'oil') + count(1, 'shield')).toBeGreaterThan(0.55);
    // No drone with only two cars: the rocket already hunts the leader.
    for (let i = 0; i < 500; i++) expect(rollItem(2, 2, random).kind).not.toBe('bounty');
  });
});

describe('items', () => {
  it('a box gives an item that only works once the slot stops, and the box comes back', async () => {
    const { race, items, step } = await setup(1);
    const box = items.boxes[0];
    if (!box) throw new Error('no boxes');
    const car = (race.racers[0] as Racer).car;
    car.placeAt({ x: box.position.x, y: box.position.y - 0.6, z: box.position.z, yaw: 0 });
    step();
    const holder = items.holders[0];
    expect(holder?.item).not.toBeNull();
    expect(box.respawnAt).toBeGreaterThan(0);
    items.requestUse(0);
    step();
    // Still rolling: nothing used.
    expect(holder?.item).not.toBeNull();
    // Drive off the box row and wait for it to come back.
    car.placeAt({ x: box.position.x + 30, y: box.position.y + 5, z: box.position.z + 30, yaw: 0 });
    for (let t = 0; t < ITEMS.boxRespawnSeconds + 0.1; t += 1 / 60) step();
    expect(box.respawnAt).toBe(0);
  });

  it('a rocket chases down the car ahead, and a shield stops the next one', async () => {
    const { track, race, items, step, place } = await setup(2);
    const [first, second] = race.racers as [Racer, Racer];
    // Coastal straight: the leader 40 m up the road.
    place(first, track.startLine.distance + 120, 2);
    place(second, track.startLine.distance + 80, -2);
    step();
    expect(first.place).toBe(1);
    const shooter = items.holders[1];
    if (!shooter) throw new Error('no holder');
    shooter.item = 'rocket';
    shooter.charges = 2;
    items.requestUse(1);
    const hits: string[] = [];
    items.onHit = (index, kind) => hits.push(`${index}:${kind}`);
    for (let t = 0; t < 3 && hits.length === 0; t += 1 / 60) step();
    expect(hits).toEqual(['0:rocket']);
    expect(first.car.spinTime).toBeGreaterThan(0);

    // Second rocket at a shielded leader.
    for (let t = 0; t < 2; t += 1 / 60) step();
    place(first, track.startLine.distance + 140, 0);
    place(second, track.startLine.distance + 100, 0);
    const target = items.holders[0];
    if (!target) throw new Error('no holder');
    target.shield = ITEMS.shieldSeconds;
    const blocked: number[] = [];
    items.onBlocked = (index) => blocked.push(index);
    hits.length = 0;
    items.requestUse(1);
    for (let t = 0; t < 3 && blocked.length === 0; t += 1 / 60) step();
    expect(blocked).toEqual([0]);
    expect(hits).toEqual([]);
  });

  it('a rocket still finds a car racing right alongside', async () => {
    const { track, race, items, step, place } = await setup(2);
    const [first, second] = race.racers as [Racer, Racer];
    place(first, track.startLine.distance + 105, 3.5);
    place(second, track.startLine.distance + 100, -3.5);
    step();
    const shooter = items.holders[1];
    if (!shooter) throw new Error('no holder');
    shooter.item = 'rocket';
    shooter.charges = 1;
    items.requestUse(1);
    const hits: string[] = [];
    items.onHit = (index, kind) => hits.push(`${index}:${kind}`);
    for (let t = 0; t < 2 && hits.length === 0; t += 1 / 60) {
      floor([first.car, second.car]);
      step();
    }
    expect(hits).toEqual(['0:rocket']);
    // One full turn: once the spin ends, the car points down the road again.
    const heading = new Vector3(0, 0, 1);
    for (let t = 0; t < 1.5; t += 1 / 60) step();
    expect(first.car.spinTime).toBe(0);
    heading.applyQuaternion(first.car.quaternion).setY(0).normalize();
    expect(heading.dot(track.sampleAt(first.projection.distance).tangent)).toBeGreaterThan(0.9);
  });

  it('an oil slick spins out whoever drives over it, but not its owner straight away', async () => {
    const { track, race, items, step, place } = await setup(2);
    const [leader, chaser] = race.racers as [Racer, Racer];
    place(leader, track.startLine.distance + 100, 0);
    place(chaser, track.startLine.distance + 60, 0);
    const holder = items.holders[0];
    if (!holder) throw new Error('no holder');
    holder.item = 'oil';
    holder.charges = 1;
    items.requestUse(0);
    step();
    expect(items.slicks.some((s) => s.active)).toBe(true);
    expect(leader.car.spinTime).toBe(0);
    const hits: string[] = [];
    items.onHit = (index, kind) => hits.push(`${index}:${kind}`);
    for (let t = 0; t < 4 && hits.length === 0; t += 1 / 60) {
      floor([chaser.car]);
      leader.car.input.throttle = 0;
      step();
    }
    expect(hits).toEqual(['1:oil']);
  });
});

describe('boosts', () => {
  it('boost pads sit on corner exits and give a boost', async () => {
    const { track, boosts, race, step } = await setup(1);
    const car = (race.racers[0] as Racer).car;
    const sources: string[] = [];
    boosts.onBoost = (_, source) => sources.push(source);
    expect(boosts.pads.length).toBe(BOOSTS.padCount);
    const pad = boosts.pads[0];
    if (!pad) throw new Error('no pads');
    car.placeAt({
      x: pad.centre.x - pad.sample.tangent.x * 20,
      y: pad.centre.y + 0.5,
      z: pad.centre.z - pad.sample.tangent.z * 20,
      yaw: Math.atan2(pad.sample.tangent.x, pad.sample.tangent.z),
    });
    track.project(car.position, -1, (race.racers[0] as Racer).projection);
    for (let t = 0; t < 3 && !sources.includes('pad'); t += 1 / 60) {
      car.input.throttle = 1;
      step();
    }
    expect(sources).toContain('pad');
    expect(car.boost).toBeGreaterThan(0);
  });

  it('builds a slipstream tucked in behind another car', async () => {
    const { track, race, boosts, step, place } = await setup(2);
    const [front, back] = race.racers as [Racer, Racer];
    place(front, track.startLine.distance + 20, 0);
    place(back, track.startLine.distance + 11, 0);
    let best = 0;
    for (let t = 0; t < 4; t += 1 / 60) {
      floor([front.car, back.car]);
      step();
      best = Math.max(best, boosts.states[1]?.draft ?? 0);
    }
    expect(best).toBeGreaterThan(0.4);
    expect(boosts.states[0]?.draft ?? 0).toBeLessThan(0.05);
  });

  it('a long slide charges a drift boost that pays out when the car straightens up', async () => {
    const { track, race, boosts, step, place } = await setup(1);
    const racer = race.racers[0] as Racer;
    place(racer, track.startLine.distance + 10, 0);
    const levels: number[] = [];
    const sources: string[] = [];
    boosts.onDriftLevel = (_, level) => levels.push(level);
    boosts.onBoost = (_, source) => sources.push(source);
    const car = racer.car;
    // Up to speed down the coastal straight, then a handbrake flick into a held slide.
    for (let t = 0; t < 4; t += 1 / 60) {
      floor([car]);
      step();
    }
    for (let t = 0; t < 2.2; t += 1 / 60) {
      car.input.throttle = 1;
      car.input.steer = t < 0.3 ? -1 : 0.2;
      car.input.handbrake = t < 0.3;
      step();
    }
    for (let t = 0; t < 1.5; t += 1 / 60) {
      car.input.throttle = 1;
      car.input.steer = 0;
      car.input.handbrake = false;
      step();
    }
    expect(levels.length).toBeGreaterThan(0);
    expect(levels[0]).toBe(1);
    expect(sources).toContain('drift');
    expect(BOOSTS.driftLevels.length).toBe(3);
  });
});

describe('items race', () => {
  it('a full 4-car, 3-lap race with items (fired by the autopilot) still finishes', async () => {
    const { race, items, boosts, sim, track } = await setup(4);
    const { autopilot } = await import('../debug/autopilot');
    const used: string[] = [];
    items.onUse = (_, kind) => used.push(kind);
    let steps = 0;
    while (race.phase !== 'finished' && steps < 60 * 500) {
      race.racers.forEach((racer, i) => {
        autopilot(track, racer, racer.car.input);
        const holder = items.holders[i];
        if (holder?.item && race.clock > holder.rollUntil + 0.8) items.requestUse(i);
      });
      race.holdInputs();
      sim.step();
      race.update(sim.dt);
      items.update(sim.dt);
      boosts.update(sim.dt, race.phase === 'racing');
      steps++;
    }
    expect(race.phase).toBe('finished');
    expect(race.racers.filter((r) => r.finishedMs !== null).length).toBeGreaterThanOrEqual(1);
    // 4 cars x 3 laps x 4 box rows: plenty of items flew.
    expect(used.length).toBeGreaterThan(10);
  }, 60_000);
});
