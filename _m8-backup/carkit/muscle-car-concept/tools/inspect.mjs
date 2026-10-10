import { loadFBX, THREE } from './common.mjs';
const root = loadFBX();
let tris = 0, meshes = 0;
const mats = new Map();
function walk(o, d) {
  const p = o.position, r = o.rotation, s = o.scale;
  let line = `${'  '.repeat(d)}${o.type} "${o.name}" pos(${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}) rot(${(r.x*57.3).toFixed(0)},${(r.y*57.3).toFixed(0)},${(r.z*57.3).toFixed(0)}) scl(${s.x.toFixed(3)},${s.y.toFixed(3)},${s.z.toFixed(3)})`;
  if (o.isMesh) {
    meshes++;
    const g = o.geometry; const n = g.index ? g.index.count / 3 : g.attributes.position.count / 3; tris += n;
    g.computeBoundingBox(); const bb = new THREE.Box3().setFromObject(o);
    const m = Array.isArray(o.material) ? o.material : [o.material];
    m.forEach((mm) => { mats.set(mm.name, (mats.get(mm.name) || 0) + 1); });
    line += ` tris=${n} mats=[${m.map((x) => x.name).join(',')}] groups=${g.groups.length} attrs=${Object.keys(g.attributes).join(',')} wbb=(${bb.min.toArray().map(v=>v.toFixed(1))})-(${bb.max.toArray().map(v=>v.toFixed(1))})`;
  }
  console.log(line);
  o.children.forEach((c) => walk(c, d + 1));
}
walk(root, 0);
console.log('TOTAL tris', tris, 'meshes', meshes);
for (const [k, v] of mats) console.log('mat', k, v);
const bb = new THREE.Box3().setFromObject(root); console.log('bbox', bb.min, bb.max);
root.traverse((o) => { if (o.isMesh) { const m = Array.isArray(o.material) ? o.material : [o.material]; } });
const seen = new Set();
root.traverse((o) => { if (!o.isMesh) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (seen.has(m.uuid)) return; seen.add(m.uuid);
  console.log('MAT', m.name, m.type, 'color', m.color?.getHexString(), 'map', m.map?.name, 'normal', m.normalMap?.name, 'emis', m.emissiveMap?.name, 'spec', m.specularMap?.name, 'alpha', m.alphaMap?.name, 'transp', m.transparent, m.opacity); }); });
