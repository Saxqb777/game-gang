import { THREE } from './common.mjs';
import { splitAll } from './split.mjs';
import { sample, hsv } from './sampler.mjs';
const comps = splitAll();
for (const id of process.argv.slice(2)) {
  const c = comps.find((x) => x.id === id); const pos = c.geo.attributes.position, uv = c.geo.attributes.uv; const atlas = c.mat === 'Bake' ? 'A' : 'B';
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(); const bins = new Map(); let total = 0;
  for (const t of c.tris) { A.fromBufferAttribute(pos, t*3); B.fromBufferAttribute(pos, t*3+1); C.fromBufferAttribute(pos, t*3+2); const area = B.clone().sub(A).cross(C.clone().sub(A)).length() / 2;
    const u = (uv.getX(t*3) + uv.getX(t*3+1) + uv.getX(t*3+2)) / 3, v = (uv.getY(t*3) + uv.getY(t*3+1) + uv.getY(t*3+2)) / 3;
    const col = sample(atlas, u, v); const [h, s, val] = hsv(col); const k = s > 0.45 && val > 0.5 && h >= 5 && h <= 30 ? 'orange' : s > 0.45 && val > 0.4 && (h < 5 || h > 340) ? 'red' : val < 0.25 ? 'dark' : s < 0.2 ? 'grey' : 'other';
    bins.set(k, (bins.get(k) || 0) + area); total += area; }
  console.log(id, c.mat, [...bins].map(([k, v]) => `${k}:${(100 * v / total).toFixed(1)}%`).join(' '));
}
