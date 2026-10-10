import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { readFileSync } from 'node:fs';
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) { void blob.arrayBuffer().then((b) => { this.result = b; this.onload?.({ target: this }); this.onloadend?.({ target: this }); }); }
};
THREE.TextureLoader.prototype.load = function (url) { const t = new THREE.Texture(); t.name = String(url); return t; };
const ow = console.warn; console.warn = (...a) => { if (String(a[0]).includes('Z-UP')) return; ow(...a); };
export const KIT = new URL('../', import.meta.url).pathname;
export function loadFBX() {
  const buf = readFileSync(KIT + 'src/source/CarV8_low.fbx');
  const root = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  root.updateMatrixWorld(true);
  return root;
}
export { THREE };
