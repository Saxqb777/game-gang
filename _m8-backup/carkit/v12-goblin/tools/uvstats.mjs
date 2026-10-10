// Livery feasibility: UV overlap + texel density of the paint triangles, from the final GLB JSON/BIN.
import { readFileSync } from 'node:fs';
const KIT = new URL('../', import.meta.url).pathname;
const glb = readFileSync(KIT + 'v12-goblin.glb');
const jl = glb.readUInt32LE(12); const json = JSON.parse(glb.subarray(20, 20 + jl)); const bin = glb.subarray(20 + jl + 8);
const acc = (i) => { const a = json.accessors[i]; const bv = json.bufferViews[a.bufferView]; const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const T = a.componentType === 5126 ? Float32Array : a.componentType === 5125 ? Uint32Array : Uint16Array;
  return { arr: new T(bin.buffer, bin.byteOffset + (bv.byteOffset || 0) + (a.byteOffset || 0), a.count * n), n, count: a.count }; };
// inventory
let total = 0; const per = [];
json.meshes.forEach((m) => { let t = 0; for (const p of m.primitives) t += (p.indices !== undefined ? json.accessors[p.indices].count : json.accessors[p.attributes.POSITION].count) / 3; total += t; per.push([m.name, t, m.primitives.map((p) => json.materials[p.material].name).join('+')]); });
console.log('nodes', json.nodes.length, 'meshes', json.meshes.length, 'triangles', total);
for (const [n, t, mat] of per) console.log(' ', n.padEnd(16), String(t).padStart(6), mat);
for (const n of json.nodes) if (/wheel_..$|brake_/.test(n.name)) console.log('  node', n.name, 'translation', n.translation?.map((x) => +x.toFixed(4)), 'rotation', n.rotation ?? 'none');
console.log('materials', json.materials.map((m) => `${m.name}${m.extensions ? '[' + Object.keys(m.extensions).join(',') + ']' : ''}${m.alphaMode ? '(' + m.alphaMode + ')' : ''}`).join(', '));
console.log('extensionsUsed', json.extensionsUsed);
// paint UV analysis
const body = json.meshes.find((m) => m.name === 'body'); const prim = body.primitives[0];
const P = acc(prim.attributes.POSITION), U = acc(prim.attributes.TEXCOORD_0), I = acc(prim.indices);
const W = 2048, H = 1024; const cover = new Uint16Array(W * H);
let worldArea = 0, uvArea = 0;
for (let t = 0; t < I.count / 3; t++) {
  const ia = I.arr[3 * t], ib = I.arr[3 * t + 1], ic = I.arr[3 * t + 2];
  const p = (i) => [P.arr[3 * i], P.arr[3 * i + 1], P.arr[3 * i + 2]]; const u = (i) => [U.arr[2 * i] * W, U.arr[2 * i + 1] * H];
  const [a, b, c] = [p(ia), p(ib), p(ic)]; const ab = a.map((v, k) => b[k] - v), ac = a.map((v, k) => c[k] - v);
  const cr = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]]; worldArea += Math.hypot(...cr) / 2;
  const [A, B, C] = [u(ia), u(ib), u(ic)]; const area = ((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / 2; uvArea += Math.abs(area) / (W * H);
  const minX = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), maxX = Math.min(W - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
  const minY = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), maxY = Math.min(H - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
  if (Math.abs(area) < 1e-9) continue;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const px = x + 0.5, py = y + 0.5;
    const w0 = ((B[0] - px) * (C[1] - py) - (C[0] - px) * (B[1] - py)) / (2 * area), w1 = ((C[0] - px) * (A[1] - py) - (A[0] - px) * (C[1] - py)) / (2 * area);
    if (w0 >= 0 && w1 >= 0 && 1 - w0 - w1 >= 0) cover[y * W + x]++;
  }
}
let covered = 0, multi = 0; for (const c of cover) { if (c) covered++; if (c > 1) multi++; }
console.log(`paint world area ${worldArea.toFixed(2)} m2, uv area ${(uvArea * 100).toFixed(1)}% of atlas, texels covered ${(covered / (W * H) * 100).toFixed(1)}%, overlapped texels ${(multi / covered * 100).toFixed(1)}% of covered`);
console.log(`texel density: ${(Math.sqrt(uvArea * 4096 * 2048 / worldArea)).toFixed(0)} px/m at 4096x2048, ${(Math.sqrt(uvArea * 2048 * 1024 / worldArea)).toFixed(0)} px/m at 2048x1024`);
