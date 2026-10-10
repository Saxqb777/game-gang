// usage: node uvwho.mjs <A|B> <x0,y0,x1,y1 in 1024 image px> ...  -> components with triangles whose UV centroid falls in rect
import { splitAll } from './split.mjs';
const [atlas, ...rects] = process.argv.slice(2);
const comps = splitAll();
for (const r of rects) {
  const [x0, y0, x1, y1] = r.split(',').map((v) => +v / 1024);
  const hits = [];
  for (const c of comps) { if ((c.mat === 'Bake' ? 'A' : 'B') !== atlas) continue; const uv = c.geo.attributes.uv; let n = 0;
    for (const t of c.tris) { let u = (uv.getX(t*3) + uv.getX(t*3+1) + uv.getX(t*3+2)) / 3, v = 1 - (uv.getY(t*3) + uv.getY(t*3+1) + uv.getY(t*3+2)) / 3; u -= Math.floor(u); v -= Math.floor(v); if (u >= x0 && u <= x1 && v >= y0 && v <= y1) n++; }
    if (n) { const b = c.box; hits.push(`${c.id}(${n}/${c.tris.length}) at [${((b.min.x+b.max.x)/2).toFixed(0)},${((b.min.y+b.max.y)/2).toFixed(0)},${((b.min.z+b.max.z)/2).toFixed(0)}]`); } }
  console.log(atlas, r, '->', hits.join('  ') || 'none');
}
