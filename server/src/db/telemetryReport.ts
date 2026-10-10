/**
 * `pnpm telemetry:report [--since 24h] [--session <id>]`: prints the TV performance samples stored
 * by POST /api/telemetry, one row per sample. Reads only. Needs DATABASE_URL (from .env, like
 * `pnpm db:migrate`).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../local/paths';
import { readEnv } from '../env';
import { createNeonRunner } from './neon';
import { q, type Row } from './sql';

const envFile = join(REPO_ROOT, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const { databaseUrl } = readEnv();
if (!databaseUrl) {
  console.error('DATABASE_URL is not set (add it to .env). The report reads the Neon database.');
  process.exit(1);
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

/** "24h", "90m", "7d" -> seconds. */
function parseSince(text: string): number {
  const match = /^(\d+(?:\.\d+)?)\s*([mhd])$/.exec(text.trim());
  if (!match) {
    console.error(`--since takes a number with m, h or d (for example 24h), not "${text}".`);
    process.exit(1);
  }
  const unit = { m: 60, h: 3600, d: 86_400 }[match[2] as 'm' | 'h' | 'd'];
  return Number(match[1]) * unit;
}

const sinceSeconds = parseSince(argument('since') ?? '24h');
const session = argument('session') ?? null;

const [rows = []] = await createNeonRunner(databaseUrl).batch([
  q(
    `SELECT created_at, session, build, kind, scenario, viewports, preset, sample, device
     FROM telemetry
     WHERE created_at > now() - make_interval(secs => $1)
       AND ($2::text IS NULL OR session = $2)
     ORDER BY created_at`,
    sinceSeconds,
    session,
  ),
]);

const asObject = (value: unknown): Record<string, unknown> => {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
  return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
};
const number = (value: unknown, digits = 1): string =>
  typeof value === 'number' ? value.toFixed(digits) : '-';
const text = (value: unknown): string => (typeof value === 'string' ? value : '-');

const columns = [
  'time',
  'session',
  'build',
  'kind',
  'scenario',
  'vp',
  'preset',
  'fps',
  'p99',
  'cpu99',
  'gpu avg/p99',
  'missed',
  'scale avg/min',
  'internal -> output',
  'Hz',
  'gpu',
];

function format(row: Row): string[] {
  const sample = asObject(row.sample);
  const device = asObject(row.device);
  const created =
    row.created_at instanceof Date ? row.created_at : new Date(String(row.created_at));
  return [
    created.toISOString().slice(0, 19).replace('T', ' '),
    text(row.session),
    text(row.build),
    text(row.kind),
    text(row.scenario),
    String(row.viewports),
    text(row.preset),
    number(sample.fpsAvg),
    number(sample.frameMsP99),
    number(sample.cpuMsP99),
    `${number(sample.gpuMsAvg)}/${number(sample.gpuMsP99)}`,
    `${number(sample.missedFrames, 0)}/${number(sample.frames, 0)}`,
    `${number(sample.scaleAvg, 2)}/${number(sample.scaleMin, 2)}`,
    `${number(sample.internalWidth, 0)}x${number(sample.internalHeight, 0)} -> ${number(sample.outputWidth, 0)}x${number(sample.outputHeight, 0)}`,
    number(device.refreshHz, 0),
    text(device.gpu),
  ];
}

const table = [columns, ...rows.map(format)];
const widths = columns.map((_, i) => Math.max(...table.map((cells) => (cells[i] ?? '').length)));
for (const cells of table) {
  console.log(cells.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join('  '));
}
console.log(
  `\n${rows.length} sample${rows.length === 1 ? '' : 's'} since ${argument('since') ?? '24h'} ago${session ? ` for session ${session}` : ''}.`,
);
