/**
 * Tuning printout for the five cars: two autopilot laps alone on Kestrel Pines (the balance test's
 * run), plus 0-100 km/h, flat-out top speed and 100-0 braking on the flat. Reads nothing but the
 * Kestrel Pines layout and the game config; writes nothing.
 *
 * Usage: pnpm exec tsx client/scripts/balance-cars.mjs [carId ...]
 */
import { readFile } from 'node:fs/promises';
import { CAR_IDS } from '../../shared/src/cars.ts';
import { REFERENCE_SPEC, resolveCarSpec } from '../src/games/splitways/sim/carSpec.ts';
import {
  measureBraking,
  measureLaunch,
  plannedTopSpeed,
  runBalance,
} from '../src/games/splitways/race/balance.ts';
import { buildTrack } from '../src/games/splitways/track/tracks.ts';

const folder = new URL('../../assets/tracks/kestrel-pines/', import.meta.url);
const readJson = async (name) => JSON.parse(await readFile(new URL(name, folder), 'utf8'));
const track = buildTrack(await readJson('base.layout.json'), await readJson('overrides.json'));

const ids = process.argv.length > 2 ? process.argv.slice(2) : ['reference', ...CAR_IDS];
const rows = [];
for (const id of ids) {
  const spec = id === 'reference' ? REFERENCE_SPEC : resolveCarSpec(id);
  const run = await runBalance(track, spec);
  const launch = await measureLaunch(spec);
  const braking = await measureBraking(spec);
  rows.push({ id, spec, run, launch, braking });
}
const flying = rows.filter((r) => r.id !== 'reference' && r.run.lap2Ms !== null);
const fastest = Math.min(...flying.map((r) => r.run.lap2Ms));
const pad = (v, n) => String(v).padStart(n);
console.info(
  'car        lap1 s  lap2 s   gap %  resp  top km/h  plan km/h  flat km/h  0-100 s  100-0 m',
);
for (const { id, spec, run, launch, braking } of rows) {
  const gap = run.lap2Ms === null ? '-' : (((run.lap2Ms - fastest) / fastest) * 100).toFixed(2);
  console.info(
    [
      id.padEnd(9),
      pad(run.lap1Ms === null ? '-' : (run.lap1Ms / 1000).toFixed(2), 7),
      pad(run.lap2Ms === null ? '-' : (run.lap2Ms / 1000).toFixed(2), 7),
      pad(gap, 7),
      pad(run.respawns, 5),
      pad(run.topKph.toFixed(1), 9),
      pad((plannedTopSpeed(spec) * 3.6).toFixed(1), 10),
      pad(launch.topKph.toFixed(1), 10),
      pad(launch.zeroTo100.toFixed(2), 8),
      pad(braking.toFixed(1), 8),
    ].join(' '),
  );
}
const slowest = Math.max(...flying.map((r) => r.run.lap2Ms));
console.info(
  `spread ${(((slowest - fastest) / fastest) * 100).toFixed(2)}% over ${flying.length} cars`,
);
