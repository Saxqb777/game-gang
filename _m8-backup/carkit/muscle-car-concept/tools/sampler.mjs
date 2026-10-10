import { readFileSync } from 'node:fs';
import { KIT } from './common.mjs';
function readPNM(path) { const b = readFileSync(path); let p = 0, f = []; while (f.length < 4) { while (b[p] === 0x20 || b[p] === 0x0a) p++; let s = ''; while (b[p] !== 0x20 && b[p] !== 0x0a) s += String.fromCharCode(b[p++]); f.push(s); } p++; const ch = f[0] === 'P6' ? 3 : 1; return { w: +f[1], h: +f[2], ch, data: b.subarray(p) }; }
const imgs = {
  A: readPNM(KIT + 'work/A_bc1024.ppm'), B: readPNM(KIT + 'work/B_bc1024.ppm'),
  Aa: readPNM(KIT + 'work/A_a1024.pgm'), Ba: readPNM(KIT + 'work/B_a1024.pgm'),
  Ae: readPNM(KIT + 'work/A_em1024.ppm'), Be: readPNM(KIT + 'work/B_em1024.ppm'),
};
function px(im, u, v) { u -= Math.floor(u); v -= Math.floor(v); const x = Math.min(im.w - 1, Math.floor(u * im.w)), y = Math.min(im.h - 1, Math.floor((1 - v) * im.h)); const i = (y * im.w + x) * im.ch; return im.ch === 3 ? [im.data[i], im.data[i + 1], im.data[i + 2]] : im.data[i]; }
/** colour at (u,v) in three's UV convention (v up), wrapping. */
export function sample(atlas, u, v) { return px(imgs[atlas], u, v); }
export function sampleAlpha(atlas, u, v) { return px(imgs[atlas + 'a'], u, v); }
export function sampleEmissive(atlas, u, v) { return px(imgs[atlas + 'e'], u, v); }
export function hsv([r, g, b]) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); const d = mx - mn; let h = 0; if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return [h, mx ? d / mx : 0, mx / 255]; }
export function isOrange(c) { const [h, s, v] = hsv(c); return s > 0.45 && v > 0.5 && h >= 5 && h <= 30; }
/** Number of texels (1024 grid) under a UV triangle with alpha < 128, and the triangle's texel area. */
export function transparentTexels(atlas, uv) {
  const im = imgs[atlas + 'a']; const N = im.w;
  const fu = Math.floor(Math.min(uv[0][0], uv[1][0], uv[2][0])), fv = Math.floor(Math.min(uv[0][1], uv[1][1], uv[2][1]));
  const P = uv.map(([u, v]) => [(u - fu) * N, (1 - (v - fv)) * N]); // image space, may exceed N (wraps)
  const area = Math.abs((P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (P[1][1] - P[0][1])) / 2;
  const x0 = Math.floor(Math.min(P[0][0], P[1][0], P[2][0])), x1 = Math.ceil(Math.max(P[0][0], P[1][0], P[2][0]));
  const y0 = Math.floor(Math.min(P[0][1], P[1][1], P[2][1])), y1 = Math.ceil(Math.max(P[0][1], P[1][1], P[2][1]));
  if ((x1 - x0) * (y1 - y0) > 4e6) return { count: 0, area };
  const ed = (a, b, x, y) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
  const s = Math.sign(ed(P[0], P[1], P[2][0], P[2][1])) || 1; let count = 0, inside = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const cx = x + 0.5, cy = y + 0.5;
    if (s * ed(P[0], P[1], cx, cy) < 0 || s * ed(P[1], P[2], cx, cy) < 0 || s * ed(P[2], P[0], cx, cy) < 0) continue; inside++;
    const ix = ((x % N) + N) % N, iy = ((y % N) + N) % N; if (im.data[iy * N + ix] < 128) count++; }
  if (!inside) { const cu = (uv[0][0] + uv[1][0] + uv[2][0]) / 3, cv = (uv[0][1] + uv[1][1] + uv[2][1]) / 3; return { count: sampleAlpha(atlas, cu, cv) < 128 ? 1 : 0, area: Math.max(area, 1) }; }
  return { count, area: inside };
}
