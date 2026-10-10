import { THREE, loadFBX, FIX, sampler } from './common.mjs';
import { writeFileSync } from 'node:fs';
const root = loadFBX();
const meshes = {}; root.traverse(o => { if (o.isMesh) meshes[o.name] = o; });
const name = process.argv[2] || 'car_body';
const g = meshes[name].geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(FIX, meshes[name].matrixWorld));
const pos = g.attributes.position, uv = g.attributes.uv, col = g.attributes.color;
const triCount = pos.count / 3; // non-indexed from FBXLoader
// union-find on position-welded vertices
const key = i => `${Math.round(pos.getX(i)*1e4)},${Math.round(pos.getY(i)*1e4)},${Math.round(pos.getZ(i)*1e4)}`;
const vid = new Map(); const vmap = new Int32Array(pos.count);
for (let i = 0; i < pos.count; i++) { const k = key(i); if (!vid.has(k)) vid.set(k, vid.size); vmap[i] = vid.get(k); }
const parent = new Int32Array(vid.size).map((_, i) => i);
const find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
for (let t = 0; t < triCount; t++) { const a = find(vmap[3*t]), b = find(vmap[3*t+1]), c = find(vmap[3*t+2]); parent[b] = a; parent[find(c)] = a; }
const S = { albedo: sampler('albedo'), spec: sampler('spec'), rough: sampler('rough'), ao: sampler('ao') };
const comps = new Map();
for (let t = 0; t < triCount; t++) {
  const r = find(vmap[3*t]);
  let c = comps.get(r); if (!c) { c = { id: comps.size, tris: [], bb: new THREE.Box3(), uvbb: new THREE.Box2(), alb: [0,0,0], spec: [0,0,0], rough: 0, vc: 0 }; comps.set(r, c); }
  c.tris.push(t);
  let u = 0, v = 0;
  for (let k = 0; k < 3; k++) { const i = 3*t+k; c.bb.expandByPoint(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i))); c.uvbb.expandByPoint(new THREE.Vector2(uv.getX(i), uv.getY(i))); u += uv.getX(i)/3; v += uv.getY(i)/3; c.vc += col ? col.getX(i)/3 : 1; }
  const a = S.albedo(u, v), s = S.spec(u, v), ro = S.rough(u, v);
  for (let k = 0; k < 3; k++) { c.alb[k] += a[k]; c.spec[k] += s[k]; } c.rough += ro[0];
}
const list = [...comps.values()].sort((a, b) => b.tris.length - a.tris.length);
const f = n => n.toFixed(2);
const lines = list.map(c => { const n = c.tris.length; const ctr = c.bb.getCenter(new THREE.Vector3()); const sz = c.bb.getSize(new THREE.Vector3());
  return `#${c.id} tris=${n} ctr=(${f(ctr.x)},${f(ctr.y)},${f(ctr.z)}) size=(${f(sz.x)},${f(sz.y)},${f(sz.z)}) uv=[${f(c.uvbb.min.x)},${f(c.uvbb.min.y)}..${f(c.uvbb.max.x)},${f(c.uvbb.max.y)}] alb=${c.alb.map(x=>Math.round(x/n)).join('/')} spec=${c.spec.map(x=>Math.round(x/n)).join('/')} rough=${Math.round(c.rough/n)} vc=${f(c.vc/n)}`; });
writeFileSync(new URL(`../work/components_${name}.txt`, import.meta.url), lines.join('\n'));
console.log('components', list.length); console.log(lines.slice(0, 60).join('\n'));
