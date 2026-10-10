import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { readFile } from 'node:fs/promises';

globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    void blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onload?.({ target: this });
      this.onloadend?.({ target: this });
    });
  }
};

// FBXLoader calls TextureLoader.load for each referenced image; in Node there is no Image,
// so return a placeholder texture that records the referenced file name.
THREE.TextureLoader.prototype.load = function (url) {
  const t = new THREE.Texture();
  t.userData.src = url;
  t.name = String(url).split(/[\\/]/).pop();
  return t;
};
THREE.ImageLoader.prototype.load = function (url) { return { src: url }; };

export async function loadFBX(path) {
  const buf = await readFile(path);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const obj = new FBXLoader().parse(ab, '');
  obj.updateMatrixWorld(true);
  return obj;
}
export { THREE };
