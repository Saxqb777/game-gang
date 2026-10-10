// UV overlap of one material's triangles: rasterise at N x N, report covered texels and texels hit by >1 triangle
import { readFileSync } from 'node:fs';
const [file, matName, Ns] = process.argv.slice(2); const N = +(Ns || 1024);
const b = readFileSync(file); const jl = b.readUInt32LE(12); const j = JSON.parse(b.subarray(20, 20 + jl).toString()); const bin = b.subarray(20 + jl + 8);
const acc = (i) => { const a = j.accessors[i], bv = j.bufferViews[a.bufferView]; const n = { VEC3: 3, VEC2: 2, SCALAR: 1 }[a.type]; const C = a.componentType === 5126 ? Float32Array : a.componentType === 5125 ? Uint32Array : Uint16Array; return new C(bin.buffer, bin.byteOffset + (bv.byteOffset || 0) + (a.byteOffset || 0), a.count * n); };
const hits = new Uint16Array(N * N);
for (const node of j.nodes) { if (node.mesh === undefined) continue; for (const p of j.meshes[node.mesh].primitives) { if (j.materials[p.material].name !== matName) continue;
  const U = acc(p.attributes.TEXCOORD_0), I = acc(p.indices);
  for (let t = 0; t < I.length; t += 3) { const P = [I[t], I[t+1], I[t+2]].map((k) => [U[k*2] * N, U[k*2+1] * N]);
    const fu = Math.floor(Math.min(...P.map((q) => q[0])) / N) * N, fv = Math.floor(Math.min(...P.map((q) => q[1])) / N) * N; for (const q of P) { q[0] -= fu; q[1] -= fv; }
    const x0 = Math.floor(Math.min(...P.map((q) => q[0]))), x1 = Math.ceil(Math.max(...P.map((q) => q[0]))), y0 = Math.floor(Math.min(...P.map((q) => q[1]))), y1 = Math.ceil(Math.max(...P.map((q) => q[1])));
    const ed = (a, c, x, y) => (c[0] - a[0]) * (y - a[1]) - (c[1] - a[1]) * (x - a[0]); const s = Math.sign(ed(P[0], P[1], P[2][0], P[2][1])) || 1;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const cx = x + 0.5, cy = y + 0.5; if (s * ed(P[0], P[1], cx, cy) < 0 || s * ed(P[1], P[2], cx, cy) < 0 || s * ed(P[2], P[0], cx, cy) < 0) continue; const i = ((y % N + N) % N) * N + ((x % N + N) % N); if (hits[i] < 65535) hits[i]++; } } } }
let cov = 0, multi = 0, sum = 0; for (const h of hits) { if (h) cov++; if (h > 1) multi++; sum += h; }
console.log(matName, 'covered', (100 * cov / (N * N)).toFixed(2) + '% of atlas', 'texels hit >1x', (100 * multi / Math.max(cov, 1)).toFixed(1) + '% of covered', 'avg layers', (sum / Math.max(cov, 1)).toFixed(1));
