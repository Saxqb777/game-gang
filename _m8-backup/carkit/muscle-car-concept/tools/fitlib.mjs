import { THREE } from './common.mjs';
/** Boundary edge sample points of a non-indexed triangle soup (positions welded at 0.2 mm). */
export function boundaryPoints(pos, tris, step = 1.0) {
  const key = (i) => `${Math.round(pos.getX(i) * 50)},${Math.round(pos.getY(i) * 50)},${Math.round(pos.getZ(i) * 50)}`;
  const edges = new Map();
  for (const t of tris) {
    const ks = [key(t*3), key(t*3+1), key(t*3+2)];
    for (let e = 0; e < 3; e++) { const a = ks[e], b = ks[(e+1)%3]; const k = a < b ? a + '|' + b : b + '|' + a;
      const r = edges.get(k); if (r) r.n++; else edges.set(k, { n: 1, a: t*3+e, b: t*3+(e+1)%3 }); }
  }
  const pts = []; const A = new THREE.Vector3(), B = new THREE.Vector3();
  for (const e of edges.values()) { if (e.n !== 1) continue; A.fromBufferAttribute(pos, e.a); B.fromBufferAttribute(pos, e.b);
    const L = A.distanceTo(B); const n = Math.max(1, Math.ceil(L / step)); for (let i = 0; i <= n; i++) pts.push(A.clone().lerp(B, i / n)); }
  return pts;
}
export class Grid {
  constructor(pts, cell = 2) { this.cell = cell; this.map = new Map(); for (const p of pts) { const k = this.k(p.x, p.y, p.z); let a = this.map.get(k); if (!a) this.map.set(k, a = []); a.push(p); } }
  k(x, y, z) { const c = this.cell; return `${Math.floor(x / c)},${Math.floor(y / c)},${Math.floor(z / c)}`; }
  nearest(p, cap) { const c = this.cell, r = Math.ceil(cap / c); const ix = Math.floor(p.x / c), iy = Math.floor(p.y / c), iz = Math.floor(p.z / c); let best = cap * cap;
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) { const a = this.map.get(`${ix+dx},${iy+dy},${iz+dz}`); if (!a) continue; for (const q of a) { const d = p.distanceToSquared(q); if (d < best) best = d; } }
    return Math.sqrt(best); }
}
/** Rotation by angle about an axis through pivot. */
export function hingeMatrix(pivot, axis, angle) {
  const m = new THREE.Matrix4().makeTranslation(pivot.x, pivot.y, pivot.z);
  m.multiply(new THREE.Matrix4().makeRotationAxis(axis.clone().normalize(), angle));
  m.multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
  return m;
}
export function score(pts, grid, m, cap) { let s = 0; const v = new THREE.Vector3(); for (const p of pts) { v.copy(p).applyMatrix4(m); s += grid.nearest(v, cap); } return s / pts.length; }
export function nelderMead(f, x0, step, iters = 300) {
  const n = x0.length; let simplex = [x0.slice()]; for (let i = 0; i < n; i++) { const x = x0.slice(); x[i] += step[i]; simplex.push(x); }
  let vals = simplex.map(f);
  for (let it = 0; it < iters; it++) {
    const order = vals.map((v, i) => i).sort((a, b) => vals[a] - vals[b]); simplex = order.map((i) => simplex[i]); vals = order.map((i) => vals[i]);
    const c = new Array(n).fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += simplex[i][j] / n;
    const w = simplex[n]; const xr = c.map((v, j) => v + (v - w[j])); const fr = f(xr);
    if (fr < vals[0]) { const xe = c.map((v, j) => v + 2 * (v - w[j])); const fe = f(xe); if (fe < fr) { simplex[n] = xe; vals[n] = fe; } else { simplex[n] = xr; vals[n] = fr; } }
    else if (fr < vals[n - 1]) { simplex[n] = xr; vals[n] = fr; }
    else { const xc = c.map((v, j) => v + 0.5 * (w[j] - v)); const fc = f(xc); if (fc < vals[n]) { simplex[n] = xc; vals[n] = fc; } else { for (let i = 1; i <= n; i++) { simplex[i] = simplex[i].map((v, j) => simplex[0][j] + 0.5 * (v - simplex[0][j])); vals[i] = f(simplex[i]); } } }
  }
  return { x: simplex[0], v: vals[0] };
}
/** Points sampled over triangles about every `step` units. */
export function surfacePoints(pos, tris, step = 2) {
  const pts = []; const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  for (const t of tris) { A.fromBufferAttribute(pos, t*3); B.fromBufferAttribute(pos, t*3+1); C.fromBufferAttribute(pos, t*3+2);
    const L = Math.max(A.distanceTo(B), B.distanceTo(C), C.distanceTo(A)); const n = Math.max(1, Math.ceil(L / step));
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) { const u = i / n, v = j / n; pts.push(new THREE.Vector3().addScaledVector(A, 1 - u - v).addScaledVector(B, u).addScaledVector(C, v)); } }
  return pts;
}
export function vertexPoints(pos, tris) { const seen = new Set(); const pts = []; for (const t of tris) for (let k = 0; k < 3; k++) { const i = t*3+k; const p = new THREE.Vector3().fromBufferAttribute(pos, i); const key = `${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`; if (!seen.has(key)) { seen.add(key); pts.push(p); } } return pts; }
