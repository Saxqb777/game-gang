import { THREE } from './common.mjs';
import { splitAll } from './split.mjs';
import { sample, hsv } from './sampler.mjs';
const comps = splitAll();
const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
for (const c of comps) { const pos = c.geo.attributes.position, uv = c.geo.attributes.uv; const atlas = c.mat === 'Bake' ? 'A' : 'B'; let or = 0, tot = 0;
  for (const t of c.tris) { A.fromBufferAttribute(pos, t*3); B.fromBufferAttribute(pos, t*3+1); C.fromBufferAttribute(pos, t*3+2); const area = B.clone().sub(A).cross(C.clone().sub(A)).length() / 2;
    const u = (uv.getX(t*3) + uv.getX(t*3+1) + uv.getX(t*3+2)) / 3, v = (uv.getY(t*3) + uv.getY(t*3+1) + uv.getY(t*3+2)) / 3; const [h, s, val] = hsv(sample(atlas, u, v)); if (s > 0.45 && val > 0.5 && h >= 5 && h <= 30) or += area; tot += area; }
  const share = or / tot; if (share > 0.3 && tot > 30) { const b = c.box; console.log(c.id, c.mat, c.tris.length, 'orange', (share * 100).toFixed(0) + '%', 'area', tot.toFixed(0), 'ctr', [(b.min.x+b.max.x)/2, (b.min.y+b.max.y)/2, (b.min.z+b.max.z)/2].map((v) => v.toFixed(0)).join(','), 'size', b.getSize(new THREE.Vector3()).toArray().map((v) => v.toFixed(0)).join('x')); } }
