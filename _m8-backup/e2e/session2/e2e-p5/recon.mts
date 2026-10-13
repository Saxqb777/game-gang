// Node recon (outside the repo): one autopilot car from grid slot 0 on Kestrel Pines.
// Prints "clock lap distance kph lapStartedAt" every 0.1 s of race clock until lap 2 begins.
const R = '/home/claude/m8-wt/p5/client/src/games/splitways';
const fs = await import('fs');
const read = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
const A = '/home/claude/m8-wt/p5/assets/tracks/kestrel-pines';
const { autopilot } = await import(`${R}/debug/autopilot.ts`);
const { Simulation } = await import(`${R}/sim/simulation.ts`);
const { PhysicsWorld } = await import(`${R}/sim/world.ts`);
const { buildTrackPhysics } = await import(`${R}/track/trackPhysics.ts`);
const { buildTrack } = await import(`${R}/track/tracks.ts`);
const { Race } = await import(`${R}/race/race.ts`);
const cars = Number(process.argv[2] ?? 1);
const track = buildTrack(read(`${A}/base.layout.json`), read(`${A}/overrides.json`));
const physics = await PhysicsWorld.create();
buildTrackPhysics(physics, track);
const sim = new Simulation(physics);
const race = new Race(track, track.gridSpawns(cars).map((s: unknown) => sim.addCar(s)));
const out: string[] = [];
let next = -3;
for (let steps = 0; steps < 60 * 300; steps++) {
  for (const r of race.racers) autopilot(track, r, r.car.input);
  race.holdInputs();
  sim.step();
  race.update(sim.dt);
  const r = race.racers[0];
  if (race.clock >= next) {
    next += 0.1;
    out.push(`${race.clock.toFixed(2)} ${r.lap} ${r.projection.distance.toFixed(1)} ${(Math.max(0, r.car.forwardSpeed) * 3.6).toFixed(0)} ${r.lapStartedAt.toFixed(2)}`);
  }
  if (r.lap >= 2) break;
}
fs.writeFileSync('/tmp/claude-0/e2e-p5/recon.txt', out.join('\n') + '\n');
console.error(`rows ${out.length}, track length ${track.length}, start ${track.startLine.distance}, dt ${sim.dt}`);
