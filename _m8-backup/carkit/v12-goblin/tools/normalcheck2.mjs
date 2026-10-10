import { THREE, loadFBX, FIX } from './common.mjs';
const root = loadFBX(); let o; root.traverse((x) => { if (x.name === 'car_body') o = x; });
const g = o.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(FIX, o.matrixWorld));
const p = g.attributes.position, n = g.attributes.normal;
const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), fn = new THREE.Vector3(), vn = new THREE.Vector3(), ctr = new THREE.Vector3();
const cells = {};
for (let t = 0; t < p.count / 3; t++) {
  a.fromBufferAttribute(p, 3*t); b.fromBufferAttribute(p, 3*t+1); c.fromBufferAttribute(p, 3*t+2);
  fn.subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize();
  vn.set(0,0,0); for (let k = 0; k < 3; k++) vn.add(new THREE.Vector3().fromBufferAttribute(n, 3*t+k));
  ctr.addVectors(a, b).add(c).divideScalar(3);
  // outward-ness: does face normal point away from car centre line?
  const key = `${ctr.x < 0 ? 'R' : 'L'} z${Math.round(ctr.z * 2) / 2} y${Math.round(ctr.y * 2) / 2}`;
  const cell = (cells[key] ||= { tri: 0, mismatch: 0 }); cell.tri++; if (fn.dot(vn) < 0) cell.mismatch++;
}
console.log(Object.entries(cells).filter(([, v]) => v.mismatch > 10).sort((x, y) => y[1].mismatch - x[1].mismatch).slice(0, 30).map(([k, v]) => `${k}: ${v.mismatch}/${v.tri}`).join('\n'));
