import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { readFileSync } from 'node:fs';
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    void blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onload?.({ target: this });
      this.onloadend?.({ target: this });
    });
  }
};
export const KIT = new URL('../', import.meta.url).pathname;
export const OBJ_PATH = KIT + 'src/source/Futuristic_Car_039_by_unity_fan_youtube_channel/Futuristic_Car_039_by_unity_fan_youtube_channel.obj';
export function loadOBJ() {
  const root = new OBJLoader().parse(readFileSync(OBJ_PATH, 'utf8'));
  root.updateMatrixWorld(true);
  return root;
}
/** Split a (possibly multi-material) OBJ mesh into [{matName, geometry}] non-indexed pieces. */
export function splitByMaterial(mesh) {
  const g = mesh.geometry;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const groups = g.groups.length ? g.groups : [{ start: 0, count: g.attributes.position.count, materialIndex: 0 }];
  const out = new Map();
  for (const gr of groups) {
    const name = mats[gr.materialIndex].name;
    if (!out.has(name)) out.set(name, []);
    out.get(name).push([gr.start, gr.count]);
  }
  return [...out].map(([matName, ranges]) => {
    const r = new THREE.BufferGeometry();
    for (const key of Object.keys(g.attributes)) {
      const src = g.attributes[key]; const n = src.itemSize;
      const total = ranges.reduce((s, [, c]) => s + c, 0);
      const arr = new Float32Array(total * n); let cur = 0;
      for (const [s, c] of ranges) { arr.set(src.array.subarray(s * n, (s + c) * n), cur * n); cur += c; }
      r.setAttribute(key, new THREE.BufferAttribute(arr, n));
    }
    return { matName, geometry: r };
  });
}
export { THREE };
