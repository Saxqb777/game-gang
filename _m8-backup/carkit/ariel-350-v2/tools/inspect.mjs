import { loadGLB, THREE, triCount } from './common.mjs';
const g = await loadGLB(process.argv[2]);
const all = new THREE.Box3();
let total = 0, meshes = 0;
const f = (v) => v.toArray().map((x) => x.toFixed(3)).join(',');
g.scene.traverse((o) => {
  if (!o.isMesh) return;
  meshes++;
  const b = new THREE.Box3().setFromObject(o); all.union(b);
  const t = triCount(o.geometry); total += t;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  console.log(`${o.parent.name}/${o.name} tris=${t} det=${o.matrixWorld.determinant().toFixed(3)} min=[${f(b.min)}] max=[${f(b.max)}] mats=${mats.map((m) => m.name).join('|')}`);
});
console.log('TOTAL tris', total, 'meshes', meshes, 'bbox', f(all.min), f(all.max), 'size', f(all.getSize(new THREE.Vector3())));
