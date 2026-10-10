// usage: node uvdump.mjs <out.json> <compId>...   writes UV triangles (v flipped to image space) per component
import { splitAll } from './split.mjs';
import { writeFileSync } from 'node:fs';
const [out, ...ids] = process.argv.slice(2);
const comps = splitAll(); const res = {};
for (const id of ids) { const c = comps.find((x) => x.id === id); const uv = c.geo.attributes.uv; res[id] = c.tris.map((t) => [0, 1, 2].map((k) => [uv.getX(t*3+k), 1 - uv.getY(t*3+k)])); }
writeFileSync(out, JSON.stringify(res));
