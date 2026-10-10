import { THREE, loadFBX, FIX, sampler } from './common.mjs';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const root = loadFBX();
const meshes = {};
root.traverse(o => { if (o.isMesh) meshes[o.name] = o; });
function baked(name) { const g = meshes[name].geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(FIX, meshes[name].matrixWorld)); return g; }
// overall bbox after fix
const all = new THREE.Box3();
for (const n of Object.keys(meshes)) { if (n === 'car_shadow') continue; const g = baked(n); g.computeBoundingBox(); all.union(g.boundingBox); console.log(n.padEnd(14), g.boundingBox.min.toArray().map(v=>v.toFixed(3)).join(','), '..', g.boundingBox.max.toArray().map(v=>v.toFixed(3)).join(',')); }
console.log('ALL', all.min, all.max);
// clearcoat duplicate check
const body = baked('car_body'), cc = baked('clearcoat');
const key = (x,y,z) => `${Math.round(x*500)},${Math.round(y*500)},${Math.round(z*500)}`;
const set = new Set(); const bp = body.attributes.position;
for (let i = 0; i < bp.count; i++) set.add(key(bp.getX(i), bp.getY(i), bp.getZ(i)));
const cp = cc.attributes.position; let hit = 0;
for (let i = 0; i < cp.count; i++) if (set.has(key(cp.getX(i), cp.getY(i), cp.getZ(i)))) hit++;
console.log('clearcoat verts coincident with body (2mm grid):', hit, '/', cp.count);
// nearest offset: sample some clearcoat verts and find min dist to body verts brute force
let dsum = 0, n = 0, dmax = 0;
for (let i = 0; i < cp.count; i += 997) { let best = 1e9; for (let j = 0; j < bp.count; j++) { const dx = cp.getX(i)-bp.getX(j), dy = cp.getY(i)-bp.getY(j), dz = cp.getZ(i)-bp.getZ(j); const d = dx*dx+dy*dy+dz*dz; if (d < best) best = d; } best = Math.sqrt(best); dsum += best; n++; dmax = Math.max(dmax, best); }
console.log('clearcoat->body nearest vertex mean', (dsum/n*1000).toFixed(2), 'mm max', (dmax*1000).toFixed(2), 'mm');
