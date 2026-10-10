// per mesh: share of triangles whose winding normal disagrees with the stored vertex normals
import { loadGLB, THREE, KIT } from './common.mjs';
const g = await loadGLB(process.argv[2] || KIT + 'ariel-350-v2.glb');
const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), fn = new THREE.Vector3();
g.scene.traverse((o) => {
  if (!o.isMesh) return;
  const geo = o.geometry, idx = geo.index.array, pos = geo.attributes.position, nor = geo.attributes.normal;
  let bad = 0, area = 0, badArea = 0, cnt = idx.length / 3;
  for (let t = 0; t < idx.length; t += 3) {
    a.fromBufferAttribute(pos, idx[t]); b.fromBufferAttribute(pos, idx[t + 1]); c.fromBufferAttribute(pos, idx[t + 2]);
    fn.subVectors(c, b).cross(a.clone().sub(b)); const ar = fn.length() / 2; if (ar < 1e-12) continue;
    n.set(0, 0, 0); for (let k = 0; k < 3; k++) n.add(new THREE.Vector3().fromBufferAttribute(nor, idx[t + k]));
    area += ar; if (fn.dot(n) < 0) { bad++; badArea += ar; }
  }
  console.log(`${o.parent.name}/${o.name}`.padEnd(32), 'tris', cnt, 'flipped', bad, `(${(badArea / area * 100).toFixed(1)}% area)`);
});
