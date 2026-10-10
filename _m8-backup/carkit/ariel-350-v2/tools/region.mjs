// which meshes have triangles whose centroid lies in a box: node region.mjs x0 y0 z0 x1 y1 z1
import { loadGLB, THREE, KIT } from './common.mjs';
const a = process.argv.slice(2).map(Number); const B = new THREE.Box3(new THREE.Vector3(a[0], a[1], a[2]), new THREE.Vector3(a[3], a[4], a[5]));
const g = await loadGLB(KIT + 'ariel-350-v2.glb'); g.scene.updateMatrixWorld(true);
const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], c = new THREE.Vector3();
g.scene.traverse((o) => {
  if (!o.isMesh) return; const idx = o.geometry.index.array, pos = o.geometry.attributes.position; let n = 0; const bb = new THREE.Box3();
  for (let t = 0; t < idx.length; t += 3) { for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(pos, idx[t + k]).applyMatrix4(o.matrixWorld); c.copy(v[0]).add(v[1]).add(v[2]).divideScalar(3); if (B.containsPoint(c)) { n++; bb.expandByPoint(c); } }
  if (n) console.log(o.name, o.material.name, n, bb.min.toArray().map((x) => x.toFixed(2)).join(','), bb.max.toArray().map((x) => x.toFixed(2)).join(','));
});
