// Splits every FBX mesh into connected components (welded by position). Exported for build + analysis.
import { loadFBX, THREE } from './common.mjs';
export function splitAll() {
  const root = loadFBX();
  const comps = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry.attributes.uv) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    const pos = g.attributes.position, n = pos.count, T = n / 3;
    const key = (i) => `${Math.round(pos.getX(i) * 50)},${Math.round(pos.getY(i) * 50)},${Math.round(pos.getZ(i) * 50)}`;
    const map = new Map(); const rep = new Int32Array(n);
    for (let i = 0; i < n; i++) { const k = key(i); if (!map.has(k)) map.set(k, i); rep[i] = map.get(k); }
    const parent = new Int32Array(n).map((_, i) => i);
    const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    for (let t = 0; t < T; t++) { const a = find(rep[t*3]), b = find(rep[t*3+1]); parent[b] = a; const c = find(rep[t*3+2]); parent[c] = find(a); }
    const byRoot = new Map();
    for (let t = 0; t < T; t++) { const r = find(rep[t*3]); if (!byRoot.has(r)) byRoot.set(r, []); byRoot.get(r).push(t); }
    let ci = 0;
    for (const tris of [...byRoot.values()].sort((a, b) => b.length - a.length)) {
      const box = new THREE.Box3(); const v = new THREE.Vector3();
      for (const t of tris) for (let k = 0; k < 3; k++) box.expandByPoint(v.fromBufferAttribute(pos, t*3+k));
      comps.push({ id: `${o.name}#${ci++}`, mesh: o.name, mat: o.material.name, tris, geo: g, box });
    }
  });
  return comps;
}
export function subGeometry(g, tris) {
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const a = g.attributes[name]; if (!a) continue; const s = a.itemSize; const arr = new Float32Array(tris.length * 3 * s);
    let p = 0; for (const t of tris) for (let k = 0; k < 3; k++) for (let j = 0; j < s; j++) arr[p++] = a.array[(t*3+k)*s + j];
    out.setAttribute(name, new THREE.BufferAttribute(arr, s));
  }
  return out;
}
