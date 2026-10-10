import { loadFBX, THREE } from './common.mjs';
const obj = await loadFBX(process.argv[2]);
const mats = new Map();
obj.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) mats.set(m.name, m); });
for (const [n, m] of mats) {
  const out = {};
  for (const k of ['map','normalMap','alphaMap','specularMap','emissiveMap','bumpMap','aoMap','lightMap']) if (m[k]) out[k] = m[k].userData.src;
  console.log(JSON.stringify(n), m.shininess, m.specular?.getHexString(), m.reflectivity, JSON.stringify(out), JSON.stringify(m.userData));
}
// print parent chain of a few meshes
for (const name of ['wheel-full002','body','brake-disc','brake-caliper']) {
  const o = obj.getObjectByName(name); const chain = []; let p = o; while (p) { chain.push(p.type+':'+p.name); p = p.parent; } console.log(chain.join(' <- '));
}
// list all child names of Car_Rig directly
const rig = obj.getObjectByName('Car_Rig');
console.log('root children', obj.children.map(c=>c.type+':'+c.name));
console.log('rig children', rig.children.map(c=>c.type+':'+c.name));
obj.traverse(o=>{ if (o.isSkinnedMesh) console.log('skinned', o.name); });
console.log('animations', obj.animations?.length, obj.animations?.map(a=>a.name+':'+a.duration));
