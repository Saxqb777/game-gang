import { loadGLB, THREE, triCount } from './common.mjs';
const g = await loadGLB();
const f = (v) => v.toArray().map((x) => x.toFixed(3)).join(',');
for (const n of ['wheel_front_left', 'wheel_rear_right']) {
  const node = g.scene.getObjectByName(n);
  console.log(n, 'pos', f(node.position), 'rot', f(new THREE.Vector3().setFromEuler(node.rotation)), 'scale', f(node.scale));
  node.traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingBox(); console.log('  local', o.name, o.material.name, f(o.geometry.boundingBox.min), f(o.geometry.boundingBox.max)); } });
}
// components of suspension near front-left wheel
function components(mesh) {
  const geo = mesh.geometry; const idx = geo.index.array; const pos = geo.attributes.position;
  // merge by position
  const key = new Map(); const rep = new Int32Array(pos.count);
  for (let i = 0; i < pos.count; i++) { const k = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`; if (!key.has(k)) key.set(k, i); rep[i] = key.get(k); }
  const parent = new Int32Array(pos.count).map((_, i) => i);
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  for (let t = 0; t < idx.length; t += 3) { const a = find(rep[idx[t]]), b = find(rep[idx[t + 1]]), c = find(rep[idx[t + 2]]); parent[b] = a; parent[find(c)] = a; }
  const comps = new Map();
  const v = new THREE.Vector3();
  for (let t = 0; t < idx.length; t += 3) {
    const r = find(rep[idx[t]]);
    if (!comps.has(r)) comps.set(r, { tris: 0, box: new THREE.Box3() });
    const c = comps.get(r); c.tris++;
    for (let k = 0; k < 3; k++) c.box.expandByPoint(v.fromBufferAttribute(pos, idx[t + k]).applyMatrix4(mesh.matrixWorld));
  }
  return [...comps.values()];
}
for (const name of process.argv.slice(2)) {
  const mesh = g.scene.getObjectByName(name);
  const comps = components(mesh);
  console.log(name, mesh.material.name, 'components', comps.length);
  comps.sort((a, b) => b.tris - a.tris);
  for (const c of comps.slice(0, 60)) console.log('   tris', c.tris, f(c.box.min), f(c.box.max));
}
