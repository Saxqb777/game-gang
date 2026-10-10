import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { readFileSync } from 'node:fs';
const KIT = new URL('../', import.meta.url).pathname;
const txt = readFileSync(KIT + 'src/source/Futuristic_Car_039_by_unity_fan_youtube_channel/Futuristic_Car_039_by_unity_fan_youtube_channel.obj', 'utf8');
const root = new OBJLoader().parse(txt);
const all = new THREE.Box3();
root.traverse(o => {
  if (!o.isMesh) return;
  const g = o.geometry; g.computeBoundingBox();
  const b = g.boundingBox; all.union(b);
  const mats = Array.isArray(o.material) ? o.material.map(m => m.name) : [o.material.name];
  const f = v => v.toArray().map(x => x.toFixed(3)).join(',');
  console.log(o.name.padEnd(22), String(g.attributes.position.count / 3).padStart(6), 'uv:' + !!g.attributes.uv, 'n:' + !!g.attributes.normal, mats.join('+').padEnd(36), 'min', f(b.min), 'max', f(b.max), 'groups', g.groups.length);
});
console.log('ALL', all.min.toArray(), all.max.toArray(), all.getSize(new THREE.Vector3()).toArray());
