// Rasterise UV layouts of chosen OBJ materials: overlap %, UV-space usage, texel-density spread. Writes a PPM for viewing.
import { THREE, loadOBJ, splitByMaterial, KIT } from './common.mjs';
import { writeFileSync } from 'node:fs';
const mats = process.argv.slice(2).length ? process.argv.slice(2) : ['body_color_supra.001'];
const N = 1024;
const root = loadOBJ();
const cnt = new Uint16Array(N * N); const owner = new Int32Array(N * N).fill(-1); const shared = new Uint8Array(N * N);
let objId = 0; const ratios = []; let uvArea = 0, area3 = 0; let outOfRange = 0, tris = 0;
const objNames = [];
root.traverse((o) => {
  if (!o.isMesh) return;
  for (const { matName, geometry } of splitByMaterial(o)) {
    if (!mats.includes(matName)) continue;
    const id = objId++; objNames.push(o.name);
    const p = geometry.attributes.position, uv = geometry.attributes.uv;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let t = 0; t < p.count; t += 3) {
      tris++;
      a.fromBufferAttribute(p, t); b.fromBufferAttribute(p, t + 1); c.fromBufferAttribute(p, t + 2);
      const A3 = b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
      const u = [uv.getX(t), uv.getX(t + 1), uv.getX(t + 2)], v = [uv.getY(t), uv.getY(t + 1), uv.getY(t + 2)];
      if (Math.min(...u, ...v) < 0 || Math.max(...u, ...v) > 1) outOfRange++;
      const Auv = Math.abs((u[1] - u[0]) * (v[2] - v[0]) - (u[2] - u[0]) * (v[1] - v[0])) / 2;
      uvArea += Auv; area3 += A3; if (A3 > 1e-7) ratios.push([Auv / A3, A3]);
      const x = u.map((q) => q * N), y = v.map((q) => (1 - q) * N);
      const x0 = Math.max(0, Math.floor(Math.min(...x))), x1 = Math.min(N - 1, Math.ceil(Math.max(...x)));
      const y0 = Math.max(0, Math.floor(Math.min(...y))), y1 = Math.min(N - 1, Math.ceil(Math.max(...y)));
      const d = (x[1] - x[0]) * (y[2] - y[0]) - (x[2] - x[0]) * (y[1] - y[0]); if (Math.abs(d) < 1e-12) continue;
      for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
        const sx = px + 0.5, sy = py + 0.5;
        const w1 = ((sx - x[0]) * (y[2] - y[0]) - (x[2] - x[0]) * (sy - y[0])) / d;
        const w2 = ((x[1] - x[0]) * (sy - y[0]) - (sx - x[0]) * (y[1] - y[0])) / d;
        if (w1 < 0 || w2 < 0 || w1 + w2 > 1) continue;
        const i = py * N + px; cnt[i]++;
        if (owner[i] === -1) owner[i] = id; else if (owner[i] !== id) shared[i] = 1;
      }
    }
  }
});
let covered = 0, over = 0, cross = 0;
for (let i = 0; i < N * N; i++) { if (cnt[i]) covered++; if (cnt[i] > 1) over++; if (shared[i]) cross++; }
ratios.sort((p, q) => p[0] - q[0]);
const wq = (f) => { let acc = 0; const tot = ratios.reduce((s, r) => s + r[1], 0); for (const r of ratios) { acc += r[1]; if (acc >= f * tot) return r[0]; } };
const texelsPerM = (res) => Math.sqrt(uvArea / area3) * res;
console.log(JSON.stringify({ mats, pieces: objId, tris, outOfRangeTris: outOfRange, uvUsage: +(covered / N / N).toFixed(3), overlapPx_samePieceOrOther: +(over / Math.max(1, covered)).toFixed(3), overlapBetweenPieces: +(cross / Math.max(1, covered)).toFixed(3),
  surfaceM2: +area3.toFixed(2), texelsPerMetreAt2048: +texelsPerM(2048).toFixed(0), densitySpread_p10_p50_p90: [wq(0.1), wq(0.5), wq(0.9)].map((x) => +(Math.sqrt(x / (uvArea / area3))).toFixed(2)) }));
// image: red = overlap between pieces, white = single, colour by piece
const img = Buffer.alloc(N * N * 3);
for (let i = 0; i < N * N; i++) {
  if (!cnt[i]) continue;
  if (shared[i]) { img[i * 3] = 255; continue; }
  const h = (owner[i] * 0.618) % 1; const col = new THREE.Color().setHSL(h, 0.6, cnt[i] > 1 ? 0.35 : 0.6);
  img[i * 3] = col.r * 255; img[i * 3 + 1] = col.g * 255; img[i * 3 + 2] = col.b * 255;
}
writeFileSync(KIT + 'work/uv_' + mats[0].replace(/\W/g, '') + '.ppm', Buffer.concat([Buffer.from(`P6 ${N} ${N} 255\n`), img]));
