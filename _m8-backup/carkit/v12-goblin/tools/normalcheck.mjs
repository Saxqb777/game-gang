import { THREE, loadFBX, FIX } from './common.mjs';
const root = loadFBX();
root.traverse((o) => {
  if (!o.isMesh || o.name === 'car_shadow') return;
  const g = o.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(FIX, o.matrixWorld));
  const p = g.attributes.position, n = g.attributes.normal;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), fn = new THREE.Vector3(), vn = new THREE.Vector3();
  let bad = 0; const where = [];
  for (let t = 0; t < p.count / 3; t++) {
    a.fromBufferAttribute(p, 3*t); b.fromBufferAttribute(p, 3*t+1); c.fromBufferAttribute(p, 3*t+2);
    fn.subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize();
    vn.set(0,0,0); for (let k = 0; k < 3; k++) vn.add(new THREE.Vector3().fromBufferAttribute(n, 3*t+k));
    if (fn.dot(vn) < 0) { bad++; if (where.length < 400) where.push(a.clone()); }
  }
  const box = new THREE.Box3().setFromPoints(where.length ? where : [new THREE.Vector3()]);
  console.log(o.name.padEnd(14), 'tris', p.count/3, 'normal-vs-winding mismatches', bad, bad ? `sample bbox ${box.min.toArray().map(v=>v.toFixed(2))} .. ${box.max.toArray().map(v=>v.toFixed(2))}` : '');
});
