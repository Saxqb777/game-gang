import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const buf = await readFile(process.argv[2]);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
// stub image loading for embedded textures
globalThis.self ??= globalThis;
const loader = new GLTFLoader();
loader.parse(ab, '', (gltf) => {
  const s = gltf.scene; s.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(s);
  console.log('bbox', bb.min.toArray().map(v=>v.toFixed(3)), bb.max.toArray().map(v=>v.toFixed(3)));
  let tris=0, meshes=0; const mats=new Set();
  s.traverse(o=>{ if(o.isMesh){meshes++; const g=o.geometry; tris+=(g.index?g.index.count:g.attributes.position.count)/3; [].concat(o.material).forEach(m=>mats.add(m.name));}
    if (o.name) console.log(o.type, o.name, o.position.toArray().map(v=>v.toFixed(3)).join(','), o.parent?.name);
  });
  console.log('tris', tris, 'meshes', meshes, 'mats', [...mats].join(','));
}, (e)=>console.error('ERR', e));
