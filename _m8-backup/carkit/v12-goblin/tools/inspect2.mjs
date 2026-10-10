import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
const buf = readFileSync(process.argv[2]);
const loaded = [];
THREE.TextureLoader.prototype.load = function (url) { loaded.push(url); const t = new THREE.Texture(); t.name = url; return t; };
const root = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
root.updateMatrixWorld(true);
console.log('textures requested', [...new Set(loaded)]);
const seen = new Set();
root.traverse(o => {
  if (!o.isMesh) return;
  const g = o.geometry;
  console.log(o.name, 'det', o.matrixWorld.determinant().toFixed(3), 'groups', JSON.stringify(g.groups.map(x => [x.start, x.count, x.materialIndex])));
  const uv = g.attributes.uv; if (uv) { let mn=[1e9,1e9],mx=[-1e9,-1e9]; for (let i=0;i<uv.count;i++){mn[0]=Math.min(mn[0],uv.getX(i));mn[1]=Math.min(mn[1],uv.getY(i));mx[0]=Math.max(mx[0],uv.getX(i));mx[1]=Math.max(mx[1],uv.getY(i));} console.log('  uv', mn.map(n=>n.toFixed(3)), mx.map(n=>n.toFixed(3)), 'uv1?', !!g.attributes.uv1, !!g.attributes.uv2); }
  const c = g.attributes.color; if (c) { const set = new Map(); for (let i=0;i<c.count;i+=1){const k=[c.getX(i),c.getY(i),c.getZ(i)].map(n=>n.toFixed(2)).join(','); set.set(k,(set.get(k)||0)+1);} console.log('  colors', [...set.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6)); }
  const ms = Array.isArray(o.material) ? o.material : [o.material];
  ms.forEach(m => { if (seen.has(m.uuid)) return; seen.add(m.uuid);
    const info = {type: m.type, color: m.color?.getHexString(), emissive: m.emissive?.getHexString(), spec: m.specular?.getHexString(), shin: m.shininess, opacity: m.opacity, transparent: m.transparent, vc: m.vertexColors};
    for (const k of ['map','normalMap','bumpMap','specularMap','alphaMap','aoMap','emissiveMap','lightMap','envMap','displacementMap']) if (m[k]) info[k]=m[k].name;
    console.log('  MAT', m.name, JSON.stringify(info)); });
});
