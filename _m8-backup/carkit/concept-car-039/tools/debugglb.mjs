// Raw OBJ -> GLB with original object/material names, flat colours, no textures (for part identification).
import { THREE, loadOBJ, splitByMaterial, KIT } from './common.mjs';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { writeFileSync } from 'node:fs';
const root = loadOBJ();
const car = new THREE.Group(); car.name = 'debug';
const mats = {};
let idx = 0;
root.traverse((o) => {
  if (!o.isMesh) return;
  for (const { matName, geometry } of splitByMaterial(o)) {
    mats[matName] ??= new THREE.MeshStandardMaterial({ name: matName, color: new THREE.Color().setHSL((Object.keys(mats).length * 0.137) % 1, 0.7, 0.5) });
    const m = new THREE.Mesh(mergeVertices(geometry, 1e-6), mats[matName]);
    m.name = `${o.name}#${idx++}`;
    car.add(m);
  }
});
const glb = await new GLTFExporter().parseAsync(car, { binary: true });
writeFileSync(KIT + 'work/debug.glb', Buffer.from(glb));
console.log('debug.glb', glb.byteLength, Object.keys(mats));
