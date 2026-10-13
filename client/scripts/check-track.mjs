/**
 * Checks a track folder's own layout files: validates `base.layout.json` and `overrides.json` with
 * the zod schemas, runs the generator and prints what it produced (length, turn, closure, radius,
 * elevation, corridor warnings). Validation only: it reads nothing but those two files and writes
 * nothing. Exits non-zero on any schema, closure or generation error.
 *
 * Usage: pnpm assets:track assets/tracks/kestrel-pines   (runs under tsx so it can import the TS)
 */
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { generateTrackWithReport } from '../src/games/splitways/track/gen/generate.ts';
import {
  trackLayoutSchema,
  trackOverridesSchema,
} from '../src/games/splitways/track/gen/layout.ts';
import { Track } from '../src/games/splitways/track/track.ts';

const DEG = 180 / Math.PI;

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function fail(message) {
  console.error(`check-track: ${message}`);
  process.exit(1);
}

const folder = process.argv[2];
if (!folder) fail('usage: pnpm assets:track <track folder>');
const dir = resolve(process.cwd(), folder);

let base;
let overrides;
try {
  base = trackLayoutSchema.parse(await readJson(join(dir, 'base.layout.json')));
  overrides = trackOverridesSchema.parse(await readJson(join(dir, 'overrides.json')));
} catch (error) {
  fail(
    `invalid track files in ${folder}\n${error instanceof Error ? error.message : String(error)}`,
  );
}

let generated;
try {
  generated = generateTrackWithReport(base, overrides);
} catch (error) {
  fail(`generation failed: ${error instanceof Error ? error.message : String(error)}`);
}
const { track: data, report } = generated;
const track = new Track(data);
const { closure } = report;

const fileHeights = [base.startZ, ...base.segments.map((s) => s.zEnd)];
const lines = [
  `Track          ${overrides.name} (${overrides.id}), ${overrides.laps} laps, ${overrides.checkpointCount} checkpoints`,
  `Licence        ${base.licence}`,
  `Segments       ${report.segments}`,
  `Length         ${data.length.toFixed(1)} m horizontal, ${data.count} stations at ${data.spacing.toFixed(4)} m`,
  `Net turn       ${(closure.netTurn * DEG).toFixed(3)} deg (${closure.netTurn > 0 ? 'counter-clockwise' : 'clockwise'})`,
  `Closure gap    ${closure.gapBefore.toFixed(4)} m before closure, heading error ${(closure.headingError * DEG).toExponential(2)} deg`,
  closure.arc
    ? `Closure arc    "${closure.arc.name}": ${(closure.arc.before * DEG).toFixed(4)} -> ${(closure.arc.after * DEG).toFixed(4)} deg (${((closure.arc.after - closure.arc.before) * DEG).toExponential(2)})`
    : 'Closure arc    none',
  ...closure.straights.map(
    (s) =>
      `Closure str.   "${s.name}": ${s.before.toFixed(4)} -> ${s.after.toFixed(4)} m (${(s.after - s.before).toExponential(2)})`,
  ),
  `Residual       ${closure.residual.toExponential(2)} m (spread over the lap)`,
  `Min radius     ${report.minRadius.toFixed(1)} m ("${report.minRadiusSegment}"); stations ${track.minimumRadius().toFixed(1)} m`,
  `Elevation      ${report.elevationMin.toFixed(2)} to ${report.elevationMax.toFixed(2)} m (range ${(report.elevationMax - report.elevationMin).toFixed(2)} m; file ${Math.min(...fileHeights).toFixed(2)} to ${Math.max(...fileHeights).toFixed(2)} m), ${report.elevationPasses} smoothing passes`,
  `Corridor       ${report.warnings.length} warnings, validateCorridor: ${track.validateCorridor().length} problems`,
];
console.log(lines.join('\n'));
for (const warning of report.warnings) console.log(`  warning: ${warning}`);
const problems = track.validateCorridor();
for (const problem of problems.slice(0, 20)) console.log(`  problem: ${problem}`);
if (Math.abs(Math.abs(closure.netTurn) - 2 * Math.PI) > 1e-3) fail('net turn is not +-360 deg');
if (problems.length > 0) fail(`${problems.length} corridor problems`);
