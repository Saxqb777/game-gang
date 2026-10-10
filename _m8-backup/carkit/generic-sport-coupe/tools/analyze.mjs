import { loadFBX, THREE } from './common.mjs';
import { readFileSync } from 'node:fs';
const obj = await loadFBX(process.argv[2]);
// PPM reader
const ppm = readFileSync(process.argv[3]);
let off = 0; const tok = () => { while (ppm[off] === 0x20 || ppm[off] === 0x0a) off++; let s = ''; while (ppm[off] !== 0x20 && ppm[off] !== 0x0a) s += String.fromCharCode(ppm[off++]); return s; };
tok(); const W = +tok(), H = +tok(); tok(); off++;
const px = ppm.subarray(off);
const sample = (u, v) => { u = u - Math.floor(u); v = v - Math.floor(v); const x = Math.min(W - 1, Math.floor(u * W)); const y = Math.min(H - 1, Math.floor((1 - v) * H)); const i = (y * W + x) * 3; return [px[i], px[i + 1], px[i + 2]]; };
const cls = (c) => { const [r, g, b] = c; if (r > 100 && g < 60 && b < 60) return 'red'; if (r > 170) return 'lightgrey'; if (b > 140 && r < 150) return 'bluegrey'; if (r > 60) return 'grey80'; return 'dark'; };
obj.traverse((o) => {
  if (!o.isMesh) return;
  const g = o.geometry; const mats = [].concat(o.material);
  const groups = g.groups.length ? g.groups : [{ start: 0, count: g.attributes.position.count, materialIndex: 0 }];
  const uv = g.attributes.uv;
  const stats = {};
  for (const gr of groups) {
    const m = mats[gr.materialIndex];
    if (m.name !== 'car-body') continue;
    for (let t = gr.start; t < gr.start + gr.count; t += 3) {
      const u = (uv.getX(t) + uv.getX(t + 1) + uv.getX(t + 2)) / 3, v = (uv.getY(t) + uv.getY(t + 1) + uv.getY(t + 2)) / 3;
      const k = cls(sample(u, v)); stats[k] = (stats[k] || 0) + 1;
    }
  }
  if (Object.keys(stats).length) console.log(o.name.padEnd(28), JSON.stringify(stats));
  if (g.attributes.color) { const c = g.attributes.color; let mn = 1, mx = 0; for (let i = 0; i < c.count * 3; i++) { mn = Math.min(mn, c.array[i]); mx = Math.max(mx, c.array[i]); } if (mn < 0.99) console.log('   vcolor range', o.name, mn.toFixed(2), mx.toFixed(2)); }
  if (o.name === 'dashboard-base') {
    for (const gr of groups) { const m = mats[gr.materialIndex]; if (m.name !== 'media') continue;
      let umin = 9, umax = -9, vmin = 9, vmax = -9; const uv1 = g.attributes.uv1;
      for (let t = gr.start; t < gr.start + gr.count; t++) { umin = Math.min(umin, uv.getX(t)); umax = Math.max(umax, uv.getX(t)); vmin = Math.min(vmin, uv.getY(t)); vmax = Math.max(vmax, uv.getY(t)); }
      console.log('media group uv0', umin.toFixed(3), umax.toFixed(3), vmin.toFixed(3), vmax.toFixed(3), 'count', gr.count/3);
    }
  }
});
