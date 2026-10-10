import { readFileSync } from 'node:fs';
import { THREE, KIT } from './common.mjs';
import { splitAll } from './split.mjs';
function readPPM(path) { const b = readFileSync(path); let p = 0, f = []; while (f.length < 4) { while (b[p] === 0x20 || b[p] === 0x0a) p++; let s = ''; while (b[p] !== 0x20 && b[p] !== 0x0a) s += String.fromCharCode(b[p++]); f.push(s); } p++; return { w: +f[1], h: +f[2], data: b.subarray(p) }; }
const em = { A: readPPM(KIT + 'work/A_em1024.ppm'), B: readPPM(KIT + 'work/B_em1024.ppm') };
const comps = splitAll();
for (const c of comps) { const atlas = c.mat === 'Bake' ? 'A' : 'B'; const im = em[atlas]; const uv = c.geo.attributes.uv; let lit = 0, col = [0, 0, 0];
  for (const t of c.tris) { let u = (uv.getX(t*3) + uv.getX(t*3+1) + uv.getX(t*3+2)) / 3, v = (uv.getY(t*3) + uv.getY(t*3+1) + uv.getY(t*3+2)) / 3; u -= Math.floor(u); v -= Math.floor(v);
    const x = Math.min(1023, Math.floor(u * 1024)), y = Math.min(1023, Math.floor((1 - v) * 1024)); const i = (y * 1024 + x) * 3; const s = im.data[i] + im.data[i+1] + im.data[i+2]; if (s > 60) { lit++; col[0] += im.data[i]; col[1] += im.data[i+1]; col[2] += im.data[i+2]; } }
  if (lit) { const b = c.box; console.log(c.id, `${lit}/${c.tris.length}`, 'ctr', [(b.min.x+b.max.x)/2, (b.min.y+b.max.y)/2, (b.min.z+b.max.z)/2].map((v) => v.toFixed(0)).join(','), 'size', b.getSize(new THREE.Vector3()).toArray().map((v) => v.toFixed(0)).join('x'), 'col', col.map((v) => (v / lit).toFixed(0)).join('/')); } }
