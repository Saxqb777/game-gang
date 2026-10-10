import { splitAll } from './split.mjs';
import { sampleAlpha } from './sampler.mjs';
const comps = splitAll();
for (const id of process.argv.slice(2)) {
  const c = comps.find((x) => x.id === id); const uv = c.geo.attributes.uv; const atlas = c.mat === 'Bake' ? 'A' : 'B'; const out = [];
  for (const t of c.tris) { const p = [0, 1, 2].map((k) => [uv.getX(t*3+k), uv.getY(t*3+k)]); const cu = (p[0][0]+p[1][0]+p[2][0])/3, cv = (p[0][1]+p[1][1]+p[2][1])/3;
    const pts = [...p, [cu, cv]]; const lo = pts.filter(([u, v]) => sampleAlpha(atlas, u, v) < 128).length; if (lo >= 2) out.push(`${(cu % 1 * 1024).toFixed(0)},${((1 - cv % 1) * 1024).toFixed(0)}:${sampleAlpha(atlas, cu, cv)}`); }
  console.log(id, out.length, out.slice(0, 30).join(' '));
}
