import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
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
globalThis.self ??= globalThis;
export const KIT = new URL('../', import.meta.url).pathname;
export const SRC = KIT + 'src/source/Ariel_350-V2.glb';
export function loadGLB(path = SRC) {
  const buf = readFileSync(path);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((res, rej) => new GLTFLoader().parse(ab, '', (g) => { g.scene.updateMatrixWorld(true); res(g); }, rej));
}
export function triCount(g) { return (g.index ? g.index.count : g.attributes.position.count) / 3; }
export { THREE };
