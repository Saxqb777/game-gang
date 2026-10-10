import { loadFBX, THREE } from './common.mjs';
const obj = await loadFBX(process.argv[2]);
const o = obj.getObjectByName('dashboard-base');
const g = o.geometry; const mats = [].concat(o.material);
const uv = g.attributes.uv, uv1 = g.attributes.uv1;
for (const name of ['media', 'interior']) {
  let a = [9, -9, 9, -9], b = [9, -9, 9, -9], n = 0;
  for (const gr of g.groups) { if (mats[gr.materialIndex].name !== name) continue;
    for (let t = gr.start; t < gr.start + gr.count; t++) { n++;
      a = [Math.min(a[0], uv.getX(t)), Math.max(a[1], uv.getX(t)), Math.min(a[2], uv.getY(t)), Math.max(a[3], uv.getY(t))];
      b = [Math.min(b[0], uv1.getX(t)), Math.max(b[1], uv1.getX(t)), Math.min(b[2], uv1.getY(t)), Math.max(b[3], uv1.getY(t))]; } }
  console.log(name, n / 3, 'uv0', a.map(v => v.toFixed(3)), 'uv1', b.map(v => v.toFixed(3)));
}
// which mesh has media material, list its triangles world centers
const m = mats.find(m => m.name === 'media');
console.log('media map channel', m.map.channel, 'interior map channel', mats.find(m=>m.name==='interior').map.channel);
