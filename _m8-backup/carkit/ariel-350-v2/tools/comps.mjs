// connected components of named output meshes (metres)
import { loadGLB, THREE, KIT } from './common.mjs';
const g = await loadGLB(KIT + 'ariel-350-v2.glb');
const f = (v) => v.toArray().map((x) => x.toFixed(2)).join(',');
for (const name of process.argv.slice(2)) {
  const o = g.scene.getObjectByName(name); const geo = o.geometry; const idx = geo.index.array; const pos = geo.attributes.position;
  const parent = new Int32Array(pos.count).map((_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (let t = 0; t < idx.length; t += 3) { const a = find(idx[t]); parent[find(idx[t + 1])] = a; parent[find(idx[t + 2])] = a; }
  const comps = new Map(); const v = new THREE.Vector3();
  for (let t = 0; t < idx.length; t += 3) { const r = find(idx[t]); if (!comps.has(r)) comps.set(r, { tris: 0, box: new THREE.Box3() }); const c = comps.get(r); c.tris++; for (let k = 0; k < 3; k++) c.box.expandByPoint(v.fromBufferAttribute(pos, idx[t + k]).applyMatrix4(o.matrixWorld)); }
  const list = [...comps.values()].sort((a, b) => b.tris - a.tris);
  console.log(name, 'components', list.length);
  for (const c of list.slice(0, +process.env.N || 12)) console.log('  ', c.tris, 'min', f(c.box.min), 'max', f(c.box.max));
}
