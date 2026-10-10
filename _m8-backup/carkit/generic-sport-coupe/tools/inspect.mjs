import { loadFBX, THREE } from './common.mjs';
const obj = await loadFBX(process.argv[2]);
let tris = 0, meshes = 0;
const mats = new Map();
function texName(t) { return t ? (t.name || t.userData.src || 'tex') : null; }
obj.traverse((o) => {
  const depth = (() => { let d = 0, p = o.parent; while (p) { d++; p = p.parent; } return d; })();
  let line = '  '.repeat(depth) + `${o.type} "${o.name}"`;
  const p = o.position, r = o.rotation, s = o.scale;
  line += ` pos(${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}) rot(${r.x.toFixed(2)},${r.y.toFixed(2)},${r.z.toFixed(2)}) scl(${s.x.toFixed(3)},${s.y.toFixed(3)},${s.z.toFixed(3)})`;
  if (o.isMesh) {
    meshes++;
    const g = o.geometry;
    const n = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    tris += n;
    const bb = new THREE.Box3().setFromObject(o);
    const c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
    const ml = (Array.isArray(o.material) ? o.material : [o.material]);
    line += ` tris=${n} groups=${g.groups.length} attrs=${Object.keys(g.attributes).join('/')} mats=[${ml.map(m=>m.name).join(', ')}] wc(${c.x.toFixed(1)},${c.y.toFixed(1)},${c.z.toFixed(1)}) wsz(${sz.x.toFixed(1)},${sz.y.toFixed(1)},${sz.z.toFixed(1)})`;
    for (const m of ml) mats.set(m.name, m);
  }
  console.log(line);
});
console.log('TOTAL tris', tris, 'meshes', meshes);
const bb = new THREE.Box3().setFromObject(obj);
console.log('bbox', bb.min.toArray().map(v=>v.toFixed(2)), bb.max.toArray().map(v=>v.toFixed(2)));
for (const [n, m] of mats) {
  console.log('MAT', n, m.type, 'color', m.color?.getHexString(), 'map', texName(m.map), 'normal', texName(m.normalMap), 'rough', texName(m.roughnessMap), 'metal', texName(m.metalnessMap), 'bump', texName(m.bumpMap), 'alpha', texName(m.alphaMap), 'emiss', texName(m.emissiveMap), 'opacity', m.opacity, 'transparent', m.transparent, 'emissive', m.emissive?.getHexString(), 'spec', texName(m.specularMap));
}
