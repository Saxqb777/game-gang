import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
const path = process.argv[2];
const buf = readFileSync(path);
// avoid texture loading: stub TextureLoader
THREE.TextureLoader.prototype.load = function () { return new THREE.Texture(); };
const root = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
root.updateMatrixWorld(true);
let tris = 0, meshes = 0;
const mats = new Map();
function d(o, depth) {
  const p = o.position.toArray().map(n => n.toFixed(2)).join(',');
  const r = o.rotation.toArray().slice(0,3).map(n => (n*180/Math.PI).toFixed(0)).join(',');
  const s = o.scale.toArray().map(n => n.toFixed(3)).join(',');
  let extra = '';
  if (o.isMesh) {
    meshes++;
    const g = o.geometry;
    const t = (g.index ? g.index.count : g.attributes.position.count) / 3;
    tris += t;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    ms.forEach(m => mats.set(m.name, (mats.get(m.name)||0)+1));
    g.computeBoundingBox();
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    extra = ` tris=${t} groups=${g.groups.length} mats=[${ms.map(m=>m.name).join('|')}] attrs=${Object.keys(g.attributes).join('/')} wbb=${bb.min.toArray().map(n=>n.toFixed(1))}..${bb.max.toArray().map(n=>n.toFixed(1))}`;
  }
  console.log(' '.repeat(depth*2) + `${o.type} "${o.name}" p=${p} r=${r} s=${s}${extra}`);
  o.children.forEach(c => d(c, depth+1));
}
d(root, 0);
console.log('meshes', meshes, 'tris', tris);
for (const [k,v] of mats) console.log('mat', k, v);
const bb = new THREE.Box3().setFromObject(root);
console.log('world bbox', bb.min, bb.max);
