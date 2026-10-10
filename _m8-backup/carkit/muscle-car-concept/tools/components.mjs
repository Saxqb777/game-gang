// usage: node components.mjs <meshName> [minTris]
import { loadFBX, THREE } from './common.mjs';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const root = loadFBX();
const name = process.argv[2]; const minT = +(process.argv[3] || 0);
const mesh = root.getObjectByName(name);
let g = mesh.geometry.clone(); g.applyMatrix4(mesh.matrixWorld);
const pos = g.attributes.position; const n = pos.count;
// weld by position only
const key = (i) => `${Math.round(pos.getX(i)*100)},${Math.round(pos.getY(i)*100)},${Math.round(pos.getZ(i)*100)}`;
const map = new Map(); const rep = new Int32Array(n);
for (let i = 0; i < n; i++) { const k = key(i); if (!map.has(k)) map.set(k, i); rep[i] = map.get(k); }
const parent = new Int32Array(n).map((_, i) => i);
const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
const idx = g.index ? g.index.array : null; const T = idx ? idx.length / 3 : n / 3;
const vi = (t, k) => rep[idx ? idx[t * 3 + k] : t * 3 + k];
for (let t = 0; t < T; t++) { const a = find(vi(t, 0)), b = find(vi(t, 1)), c = find(vi(t, 2)); parent[b] = a; parent[find(c)] = a; }
const comps = new Map();
for (let t = 0; t < T; t++) { const r = find(vi(t, 0)); let c = comps.get(r); if (!c) { c = { tris: 0, box: new THREE.Box3() }; comps.set(r, c); } c.tris++; for (let k = 0; k < 3; k++) { const v = idx ? idx[t*3+k] : t*3+k; c.box.expandByPoint(new THREE.Vector3(pos.getX(v), pos.getY(v), pos.getZ(v))); } }
const list = [...comps.values()].sort((a, b) => b.tris - a.tris);
console.log(name, 'tris', T, 'components', list.length);
for (const c of list) if (c.tris >= minT) { const s = c.box.getSize(new THREE.Vector3()), m = c.box.getCenter(new THREE.Vector3()); console.log(`tris=${c.tris} ctr=(${m.x.toFixed(1)},${m.y.toFixed(1)},${m.z.toFixed(1)}) size=(${s.x.toFixed(1)},${s.y.toFixed(1)},${s.z.toFixed(1)})`); }
