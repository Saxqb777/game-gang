import { splitAll } from './split.mjs';
import { writeFileSync } from 'node:fs';
const comps = splitAll();
const rows = comps.map((c) => { const mn = c.box.min, mx = c.box.max; return { id: c.id, mat: c.mat, tris: c.tris.length, min: [mn.x, mn.y, mn.z].map((v) => +v.toFixed(1)), max: [mx.x, mx.y, mx.z].map((v) => +v.toFixed(1)) }; });
writeFileSync(new URL('./comps.json', import.meta.url), JSON.stringify(rows));
console.log('components', rows.length, 'tris', rows.reduce((s, r) => s + r.tris, 0));
