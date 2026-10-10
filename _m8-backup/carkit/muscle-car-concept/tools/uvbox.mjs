// usage: node uvbox.mjs <compId>...  -> UV bbox in 1024 image px (v flipped), wrapped to [0,1)
import { splitAll } from './split.mjs';
const comps = splitAll();
for (const id of process.argv.slice(2)) { const c = comps.find((x) => x.id === id); const uv = c.geo.attributes.uv; let a = [1e9, 1e9, -1e9, -1e9];
  for (const t of c.tris) for (let k = 0; k < 3; k++) { let u = uv.getX(t*3+k), v = uv.getY(t*3+k); u -= Math.floor(u); v -= Math.floor(v); const x = u * 1024, y = (1 - v) * 1024; a = [Math.min(a[0], x), Math.min(a[1], y), Math.max(a[2], x), Math.max(a[3], y)]; }
  console.log(id, c.mat, a.map((v) => v.toFixed(0)).join(',')); }
