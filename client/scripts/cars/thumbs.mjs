/**
 * Checks in the thumbnail zip the studio (/tools/thumbs, "Download all") produces: 40 WebP files
 * (<id>/thumb-<colour>.webp) plus thumbs.json, which pins the SHA-256 of each GLB they show.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { unzipSync } from 'three/examples/jsm/libs/fflate.module.js';
import { CAR_IDS, PLAYER_COLOURS } from '@gamergang/shared';
import budgets from './budgets.json' with { type: 'json' };
import { imageSize } from './images.mjs';

export function installThumbs(zipPath, carsDir) {
  const files = unzipSync(new Uint8Array(readFileSync(zipPath)));
  const problems = [];
  const manifestBytes = files['thumbs.json'];
  if (!manifestBytes) throw new Error('The zip has no thumbs.json');
  const manifest = JSON.parse(Buffer.from(manifestBytes).toString('utf8'));
  const out = {};
  const writes = [];
  for (const id of CAR_IDS) {
    const glbPath = join(carsDir, id, `${id}.glb`);
    if (!existsSync(glbPath)) {
      problems.push(`${id}: no ${id}.glb to pin the thumbnails to`);
      continue;
    }
    const sha = createHash('sha256').update(readFileSync(glbPath)).digest('hex');
    const pinned = manifest[id]?.glbSha256;
    if (pinned !== sha) {
      problems.push(
        `${id}: thumbnails were rendered from another GLB (${String(pinned).slice(0, 8)}, now ${sha.slice(0, 8)})`,
      );
    }
    out[id] = { glbSha256: sha };
    for (const colour of PLAYER_COLOURS) {
      const name = `${id}/thumb-${colour.id}.webp`;
      const bytes = files[name];
      if (!bytes) {
        problems.push(`missing ${name}`);
        continue;
      }
      const buffer = Buffer.from(bytes);
      if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
        problems.push(`${name} is not a WebP file`);
        continue;
      }
      if (buffer.length > budgets.thumbBytes)
        problems.push(`${name} is ${buffer.length} bytes (> ${budgets.thumbBytes})`);
      const { width, height } = imageSize(buffer);
      if (width !== budgets.thumbWidth || height !== budgets.thumbHeight) {
        problems.push(
          `${name} is ${width}x${height}, not ${budgets.thumbWidth}x${budgets.thumbHeight}`,
        );
      }
      writes.push([join(carsDir, id, `thumb-${colour.id}.webp`), buffer]);
    }
  }
  if (problems.length) throw new Error(`Thumbnail zip rejected:\n  ${problems.join('\n  ')}`);
  for (const [path, buffer] of writes) {
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, buffer);
  }
  writeFileSync(join(carsDir, 'thumbs.json'), `${JSON.stringify(out, null, 2)}\n`);
  return writes.length + 1;
}
