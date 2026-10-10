// Which non-hood/trunk parts stick out above the closed hood / trunk lid surface?
import { THREE } from './common.mjs';
import { splitAll } from './split.mjs';
import { hingeMatrix } from './fitlib.mjs';
const D = Math.PI / 180;
const comps = splitAll();
function hinge(x) { const axis = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, x[3] * D, x[4] * D)); return hingeMatrix(new THREE.Vector3(0, x[0], x[1]), axis, x[2] * D); }
const panels = { hood: ['Body12_low#2', hinge([123.528, 86.343, 47.233, 0.049, 0.293])], trunk: ['Body12_low#3', hinge([121.563, -155.532, -74.949, 0.164, -0.281])] };
for (const [name, [id, m]] of Object.entries(panels)) {
  const c = comps.find((x) => x.id === id); const pos = c.geo.attributes.position; const v = new THREE.Vector3();
  // height map of the closed panel's top surface on a 2 cm grid
  const H = new Map(); const key = (x, z) => `${Math.round(x / 2)},${Math.round(z / 2)}`;
  for (const t of c.tris) for (let k = 0; k < 3; k++) { v.fromBufferAttribute(pos, t * 3 + k).applyMatrix4(m); const kk = key(v.x, v.z); H.set(kk, Math.max(H.get(kk) ?? -1e9, v.y)); }
  const zr = name === 'hood' ? [85, 230] : [-235, -150];
  for (const o of comps) { if (o.id === id) continue; const b = o.box; if (b.max.z < zr[0] || b.min.z > zr[1]) continue; if (Math.abs((b.min.x + b.max.x) / 2) > 85) continue;
    const p = o.geo.attributes.position; let worst = -1e9;
    for (const t of o.tris) for (let k = 0; k < 3; k++) { v.fromBufferAttribute(p, t * 3 + k); let h = -1e9; for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) h = Math.max(h, H.get(`${Math.round(v.x / 2) + dx},${Math.round(v.z / 2) + dz}`) ?? -1e9); if (h > -1e8) worst = Math.max(worst, v.y - h); }
    if (worst > 0.3) console.log(name, o.id, o.tris.length, 'pokes', worst.toFixed(1), 'cm', 'ctr', b.getCenter(new THREE.Vector3()).toArray().map((x) => x.toFixed(0)).join(','));
  }
}
