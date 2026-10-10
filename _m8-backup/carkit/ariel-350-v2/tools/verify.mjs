// sanity checks on the exported GLB
import { loadGLB, THREE, KIT, triCount } from './common.mjs';
import { statSync } from 'node:fs';
const P = process.argv[2] || KIT + 'ariel-350-v2.glb';
const g = await loadGLB(P);
const s = g.scene; s.updateMatrixWorld(true);
const f = (v) => v.toArray().map((x) => x.toFixed(4)).join(', ');
const box = new THREE.Box3().setFromObject(s);
console.log('file', P, (statSync(P).size / 1048576).toFixed(2), 'MB; bbox min', f(box.min), 'max', f(box.max));
const head = new THREE.Box3().setFromObject(s.getObjectByName('headlight')), tail = new THREE.Box3().setFromObject(s.getObjectByName('taillight'));
console.log('headlight z', head.getCenter(new THREE.Vector3()).z.toFixed(3), 'taillight z', tail.getCenter(new THREE.Vector3()).z.toFixed(3), '=> front is', head.max.z > tail.max.z ? '+Z' : '-Z');
for (const id of ['fl', 'fr', 'rl', 'rr']) {
  const w = s.getObjectByName('wheel_' + id); const b = s.getObjectByName('brake_' + id);
  const lb = new THREE.Box3(); w.traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingBox(); lb.union(o.geometry.boundingBox); } });
  const wb = new THREE.Box3().setFromObject(w, true);
  const tyre = w.children.find((c) => c.name.endsWith('tyre')); tyre.geometry.computeBoundingBox(); const tb = tyre.geometry.boundingBox;
  console.log(`wheel_${id} pivot ${f(w.position)} | local tyre centre y,z ${((tb.min.y + tb.max.y) / 2).toFixed(4)}, ${((tb.min.z + tb.max.z) / 2).toFixed(4)} radius ${(tb.max.y).toFixed(4)} width ${(tb.max.x - tb.min.x).toFixed(3)} | world minY ${wb.min.y.toFixed(4)} | children ${w.children.map((c) => c.name + ':' + c.material.name).join(' ')} | brake ${b ? f(b.position) + ' ' + b.children.map((c) => c.name + ':' + c.material.name).join(' ') : 'none'}`);
  // spin test: rotate about X by 1 rad, tyre bbox should stay the same (axle on X through pivot)
  w.rotation.x = 1; w.updateMatrixWorld(true); const sb = new THREE.Box3().setFromObject(w, true); w.rotation.x = 0; w.updateMatrixWorld(true);
  console.log('   spin drift', f(sb.min.clone().sub(wb.min)), '/', f(sb.max.clone().sub(wb.max)));
}
const mats = new Set(); let tris = 0, meshes = 0, tex = 0;
s.traverse((o) => { if (o.isMesh) { meshes++; tris += triCount(o.geometry); mats.add(o.material.name); for (const k of ['map', 'normalMap', 'roughnessMap']) if (o.material[k]) tex++; } });
console.log('meshes', meshes, 'tris', tris, 'materials', [...mats].join(','), 'textures', tex, 'json', JSON.stringify(g.parser.json.extensionsUsed));
