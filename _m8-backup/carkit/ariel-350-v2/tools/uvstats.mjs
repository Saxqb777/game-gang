// UV coverage/overlap per mesh+uv set: rasterise UV triangles into a 256 grid
import { loadGLB, THREE } from './common.mjs';
const g = await loadGLB();
const N = 256;
const out = [];
g.scene.traverse((o) => {
  if (!o.isMesh) return;
  const geo = o.geometry; const idx = geo.index.array;
  for (const set of ['uv', 'uv1', 'uv2']) {
    const uv = geo.attributes[set]; if (!uv) continue;
    let umin = 1e9, umax = -1e9, vmin = 1e9, vmax = -1e9, zeroArea = 0;
    const grid = new Uint16Array(N * N);
    for (let t = 0; t < idx.length; t += 3) {
      const p = [0, 1, 2].map((k) => [uv.getX(idx[t + k]), uv.getY(idx[t + k])]);
      for (const [u, v] of p) { umin = Math.min(umin, u); umax = Math.max(umax, u); vmin = Math.min(vmin, v); vmax = Math.max(vmax, v); }
      const area = ((p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1])) / 2;
      if (Math.abs(area) < 1e-9) { zeroArea++; continue; }
      // raster in wrapped 0..1 space (only if inside)
      const xs = p.map((q) => q[0] * N), ys = p.map((q) => q[1] * N);
      const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(N - 1, Math.ceil(Math.max(...xs)));
      const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(N - 1, Math.ceil(Math.max(...ys)));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const e = (a, b) => (xs[b] - xs[a]) * (py - ys[a]) - (ys[b] - ys[a]) * (px - xs[a]);
        const w0 = e(1, 2), w1 = e(2, 0), w2 = e(0, 1);
        if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) grid[y * N + x]++;
      }
    }
    let cov = 0, over = 0; for (const c of grid) { if (c) cov++; if (c > 1) over++; }
    out.push(`${o.name.padEnd(16)} ${o.material.name.padEnd(10)} ${set.padEnd(4)} u[${umin.toFixed(2)},${umax.toFixed(2)}] v[${vmin.toFixed(2)},${vmax.toFixed(2)}] cover=${(cov / N / N * 100).toFixed(1)}% overlap=${cov ? (over / cov * 100).toFixed(1) : 0}% zeroArea=${zeroArea}/${idx.length / 3}`);
  }
});
console.log(out.join('\n'));
