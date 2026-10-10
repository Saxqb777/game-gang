import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { readFileSync } from 'node:fs';
const KIT = new URL('../', import.meta.url).pathname;
const txt = readFileSync(KIT + 'src/source/Futuristic_Car_039_by_unity_fan_youtube_channel/Futuristic_Car_039_by_unity_fan_youtube_channel.obj', 'utf8');
const root = new OBJLoader().parse(txt);
const seen = new Set();
root.traverse(o => {
  if (!o.isMesh) return;
  const g = o.geometry; const uv = g.attributes.uv;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  const groups = g.groups.length ? g.groups : [{ start: 0, count: g.attributes.position.count, materialIndex: 0 }];
  for (const gr of groups) {
    const key = o.name + '|' + mats[gr.materialIndex].name; if (seen.has(key)) continue; seen.add(key);
    let a = [1e9, 1e9, -1e9, -1e9];
    for (let i = gr.start; i < gr.start + gr.count; i++) { const u = uv.getX(i), v = uv.getY(i); a = [Math.min(a[0], u), Math.min(a[1], v), Math.max(a[2], u), Math.max(a[3], v)]; }
    console.log(key.padEnd(44), a.map(x => x.toFixed(3)).join(' '));
  }
});
