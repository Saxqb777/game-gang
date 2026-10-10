// UV usage of each material in the built GLB: world area (m^2) vs UV area (fraction of atlas) -> texel density
import { readFileSync } from 'node:fs';
const b = readFileSync(process.argv[2]); const jl = b.readUInt32LE(12); const j = JSON.parse(b.subarray(20, 20 + jl).toString());
const bin = b.subarray(20 + jl + 8);
const acc = (i) => { const a = j.accessors[i], bv = j.bufferViews[a.bufferView]; const n = { VEC3: 3, VEC2: 2, SCALAR: 1 }[a.type]; const C = a.componentType === 5126 ? Float32Array : a.componentType === 5125 ? Uint32Array : Uint16Array;
  return new C(bin.buffer, bin.byteOffset + (bv.byteOffset || 0) + (a.byteOffset || 0), a.count * n); };
const res = {};
for (const node of j.nodes) { if (node.mesh === undefined) continue; for (const p of j.meshes[node.mesh].primitives) {
  const mat = j.materials[p.material].name; const P = acc(p.attributes.POSITION), U = acc(p.attributes.TEXCOORD_0), I = acc(p.indices);
  let wa = 0, ua = 0, collapsed = 0; for (let t = 0; t < I.length; t += 3) { const [a, c, d] = [I[t], I[t + 1], I[t + 2]];
    const e1 = [P[c*3]-P[a*3], P[c*3+1]-P[a*3+1], P[c*3+2]-P[a*3+2]], e2 = [P[d*3]-P[a*3], P[d*3+1]-P[a*3+1], P[d*3+2]-P[a*3+2]];
    const cr = [e1[1]*e2[2]-e1[2]*e2[1], e1[2]*e2[0]-e1[0]*e2[2], e1[0]*e2[1]-e1[1]*e2[0]]; const w = Math.hypot(...cr) / 2;
    const u = Math.abs((U[c*2]-U[a*2])*(U[d*2+1]-U[a*2+1]) - (U[d*2]-U[a*2])*(U[c*2+1]-U[a*2+1])) / 2; wa += w; ua += u; if (w > 1e-5 && u / w < 1e-4) collapsed += w; }
  const r = res[mat] ??= { wa: 0, ua: 0, collapsed: 0 }; r.wa += wa; r.ua += ua; r.collapsed += collapsed; } }
for (const [m, r] of Object.entries(res)) console.log(m.padEnd(16), 'world m2', r.wa.toFixed(2).padStart(7), 'uv frac', r.ua.toFixed(4), 'px/m @2048', (2048 * Math.sqrt(r.ua / Math.max(r.wa, 1e-9))).toFixed(0).padStart(5), 'collapsed-area', (100 * r.collapsed / r.wa).toFixed(0) + '%');
