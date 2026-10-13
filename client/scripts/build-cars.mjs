/**
 * The car packager (spec C2a): turns each debranded source car into assets/cars/<id>/<id>.glb with
 * three levels of detail and a shadow stand-in (contract 3.9), and checks in the phone thumbnails.
 *
 *   pnpm assets:cars <V2 folder> [--only <id>] [--check] [--out <dir>]
 *   pnpm assets:cars --placeholder [--only <id>] [--check]
 *   pnpm assets:cars --thumbs <zip from /tools/thumbs>
 *
 * --check rebuilds in memory and fails if a result differs from the committed file or breaks a
 * budget of spec 4.4. Builds are deterministic: same input and config, same bytes.
 * Needs ImageMagick (`convert`) with JPEG, PNG and WebP; runs with tsx (it reads SW/config.ts).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAR_IDS, creditLine } from '@gamergang/shared';
import { CARS } from '../src/games/splitways/config.ts';
import { readGlb } from './cars/glb.mjs';
import { checkImageMagick } from './cars/images.mjs';
import { simplifierReady } from './cars/mesh.mjs';
import { buildCar } from './cars/pipeline.mjs';
import { PLACEHOLDER_CREDIT, loadPlaceholderSource } from './cars/placeholder.mjs';
import { budgetFailures, formatReport } from './cars/report.mjs';
import { loadSourceGlb } from './cars/source.mjs';
import { installThumbs } from './cars/thumbs.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CARS_DIR = join(REPO_ROOT, 'assets', 'cars');
const PLACEHOLDER_SOURCE = join(REPO_ROOT, 'assets', 'models', 'sports-car.glb');

function usage(message) {
  if (message) console.error(message);
  console.error(
    'Usage: pnpm assets:cars <V2 folder> [--only <id>] [--check] [--out <dir>]\n' +
      '       pnpm assets:cars --placeholder [--only <id>] [--check]\n' +
      '       pnpm assets:cars --thumbs <zip>',
  );
  process.exit(2);
}

function parseArgs(argv) {
  const args = { folder: null, only: null, check: false, placeholder: false, out: null, thumbs: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') continue;
    if (arg === '--check') args.check = true;
    else if (arg === '--placeholder') args.placeholder = true;
    else if (arg === '--only') args.only = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--thumbs') args.thumbs = argv[++i];
    else if (arg.startsWith('--')) usage(`Unknown option ${arg}`);
    else if (!args.folder) args.folder = arg;
    else usage(`Unexpected argument ${arg}`);
  }
  if (args.only && !CAR_IDS.includes(args.only)) usage(`Unknown car id ${args.only}`);
  if (args.thumbs) return args;
  if (args.placeholder === Boolean(args.folder)) usage('Give either a source folder or --placeholder.');
  if (args.check && args.out) usage('--check compares with assets/cars; it takes no --out.');
  return args;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * The car a source GLB is: the folder's name when it is a car id, else the debranded model name the
 * art track writes into the GLB (asset.extras.model, or the root node "<make>-<model>"). The carkit
 * folder names are not matched by name: they carry real make words that stay out of the code.
 */
function carIdOf(folderName, bytes) {
  const lower = folderName.toLowerCase();
  if (CAR_IDS.includes(lower)) return lower;
  const { json } = readGlb(bytes);
  const model = String(json.asset?.extras?.model ?? '').toLowerCase();
  if (CAR_IDS.includes(model)) return model;
  const roots = (json.scenes?.[json.scene ?? 0]?.nodes ?? []).map((i) => String(json.nodes[i]?.name ?? ''));
  for (const root of roots) {
    const last = root.toLowerCase().split(/[-_ ]/).pop();
    if (CAR_IDS.includes(last)) return last;
  }
  return null;
}

/** Source folder -> { id: glb path }: one folder per car, one .glb in each. */
function findSources(folder) {
  const root = resolve(folder);
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error(`No such folder: ${root}`);
  const found = {};
  for (const entry of readdirSync(root).sort()) {
    const dir = join(root, entry);
    if (!statSync(dir).isDirectory()) continue;
    const glbs = readdirSync(dir).filter((name) => name.toLowerCase().endsWith('.glb')).sort();
    if (!glbs.length) continue;
    if (glbs.length > 1) throw new Error(`${dir} must hold exactly one .glb (found ${glbs.join(', ')})`);
    const path = join(dir, glbs[0]);
    const id = carIdOf(entry, readFileSync(path));
    if (!id) {
      console.log(`  skipped ${entry}: not a car id and no known model name inside`);
      continue;
    }
    if (found[id]) throw new Error(`Two sources for ${id}: ${found[id]} and ${path}`);
    found[id] = path;
  }
  return found;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.thumbs) {
    const written = installThumbs(resolve(args.thumbs), CARS_DIR);
    console.log(`Thumbnails checked in: ${written} files under ${relative(REPO_ROOT, CARS_DIR)}`);
    return;
  }
  checkImageMagick();
  await simplifierReady;
  const ids = args.only ? [args.only] : [...CAR_IDS];
  let sources = null;
  if (!args.placeholder) {
    sources = findSources(args.folder);
    const missing = ids.filter((id) => !sources[id]);
    if (missing.length) throw new Error(`No source car for: ${missing.join(', ')} (use --only for a subset)`);
  }
  const outDir = args.out ? resolve(args.out) : CARS_DIR;
  const problems = [];
  for (const id of ids) {
    const bytes = readFileSync(args.placeholder ? PLACEHOLDER_SOURCE : sources[id]);
    const sha = sha256(bytes);
    const geometry = CARS[id].geometry;
    const source = args.placeholder
      ? await loadPlaceholderSource(bytes, geometry)
      : await loadSourceGlb(bytes);
    const notes = [];
    const { glb, report } = await buildCar({
      id,
      source,
      sourceSha256: sha,
      copyright: args.placeholder ? PLACEHOLDER_CREDIT : creditLine(id),
      placeholder: args.placeholder,
      log: (line) => notes.push(line),
    });
    console.log(formatReport(id, report, geometry, { sha }));
    for (const note of notes) console.log(`  note: ${note}`);
    for (const failure of budgetFailures(report)) problems.push(`${id}: ${failure}`);
    const target = join(outDir, id, `${id}.glb`);
    if (args.check) {
      const committed = existsSync(target) ? readFileSync(target) : null;
      if (!committed) problems.push(`${id}: ${relative(REPO_ROOT, target)} does not exist`);
      else if (!committed.equals(glb)) {
        problems.push(`${id}: rebuilt file differs from ${relative(REPO_ROOT, target)} (${glb.length} vs ${committed.length} bytes)`);
      }
    } else {
      mkdirSync(join(outDir, id), { recursive: true });
      writeFileSync(target, glb);
      console.log(`  wrote ${relative(process.cwd(), target)} (${glb.length} bytes)`);
    }
  }
  if (problems.length) {
    console.error(`\nassets:cars ${args.check ? 'check ' : ''}failed:\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log(args.check ? '\nassets:cars check: OK (byte-identical, within budgets)' : '\nassets:cars: done');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
