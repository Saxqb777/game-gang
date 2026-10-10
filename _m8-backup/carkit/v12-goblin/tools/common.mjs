import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
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
THREE.TextureLoader.prototype.load = function (url) { const t = new THREE.Texture(); t.name = String(url); return t; };
const origWarn = console.warn; console.warn = (...a) => { if (String(a[0]).includes('Z-UP')) return; origWarn(...a); };
export const KIT = new URL('../', import.meta.url).pathname;
export function loadFBX() {
  const buf = readFileSync(KIT + 'src/source/f50d71ecc6fa49d28d9b1fd980c106b6.fbx.fbx');
  const root = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  root.updateMatrixWorld(true);
  return root;
}
/** Source is upside down after FBXLoader's Z-up fix; rotate 180 deg about Z: car upright, front +Z, left side +X. */
export const FIX = new THREE.Matrix4().makeRotationZ(Math.PI);
export function sampler(name) {
  const data = readFileSync(KIT + `work/${name}_1024x512.rgb`);
  return (u, v) => {
    const x = Math.min(1023, Math.max(0, Math.floor(u * 1024)));
    const y = Math.min(511, Math.max(0, Math.floor((1 - v) * 512)));
    const i = (y * 1024 + x) * 3;
    return [data[i], data[i + 1], data[i + 2]];
  };
}
export { THREE };
