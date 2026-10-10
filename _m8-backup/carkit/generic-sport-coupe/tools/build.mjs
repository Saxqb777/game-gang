/**
 * Converts the MMC Works "Generic Sport Coupe" FBX into a game-ready GLB (no textures yet;
 * pack-textures.py embeds them afterwards). Bakes transforms, metres, +Z forward, tyres on y=0,
 * wheels as pivoted nodes at the axle, parts merged per material.
 * Usage: node build.mjs <fbx> <body_base_1024.ppm> <out.glb> <report.json>
 */
import { loadFBX, THREE } from './common.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const [fbxPath, ppmPath, outPath, reportPath] = process.argv.slice(2);
const SCALE = 0.01; // FBX world space is centimetres

// --- body colour atlas sampler (to split paint from black/grey trim inside the car-body material)
const ppm = readFileSync(ppmPath);
let off = 0;
const tok = () => { while (ppm[off] === 0x20 || ppm[off] === 0x0a) off++; let s = ''; while (ppm[off] !== 0x20 && ppm[off] !== 0x0a) s += String.fromCharCode(ppm[off++]); return s; };
tok(); const PW = +tok(), PH = +tok(); tok(); off++;
const px = ppm.subarray(off);
function isPaint(u, v) {
  u -= Math.floor(u); v -= Math.floor(v);
  const x = Math.min(PW - 1, Math.floor(u * PW)), y = Math.min(PH - 1, Math.floor((1 - v) * PH));
  const i = (y * PW + x) * 3;
  return px[i] > 100 && px[i + 1] < 60 && px[i + 2] < 60;
}

// --- part classification
const WHEEL_GROUPS = { 'Coupe-WheelFtL': 'fl', 'Coupe-WheelFtR': 'fr', 'Coupe-WheelBkL': 'rl', 'Coupe-WheelBkR': 'rr' };
const STEERING = new Set(['steering-wheel-rim', 'steering-wheel-frame', 'steering-wheel-center']);
const LAMP_MESHES = new Set(['headlightsl', 'headlightsr', 'headlight-drll', 'headlight-drlr']);
function corner(center) { return (center.z > 0 ? 'f' : 'r') + (center.x > 0 ? 'l' : 'r'); }
function roleFor(meshName, matName, paint) {
  switch (matName) {
    case 'car-body':
      if (LAMP_MESHES.has(meshName)) return 'headlight';
      return paint ? 'paint' : 'body_trim';
    case 'black-metal': case 'wipers': return 'trim';
    case 'Rubber - Black': return 'rubber';
    case 'Glass ext': return 'glass';
    case 'Glass ext-tinted': return 'glass_tinted';
    case 'Glass - Clear': return 'headlight_lens';
    case 'Glass - Clear - Bumps': return 'headlight';
    case 'Glass - Clear - Ridged ': return 'indicator';
    case 'Glass - Red': case 'Glass - Red - Rough': return 'taillight';
    case 'Glass - Clear - Ridged - UV': return 'reverse_light';
    case 'mirror': return 'mirror';
    case 'front-grille-texture': return 'grille';
    case 'mechanics': return 'chassis';
    case 'interior': return 'interior';
    case 'media': return 'screen';
    case 'wheel-brake-disc':
      if (meshName.startsWith('wheel-full')) return 'rim';
      if (meshName.startsWith('brake-disc')) return 'brake_disc';
      if (meshName.startsWith('brake-caliper')) return 'brake_caliper';
      throw new Error('unexpected wheel-brake-disc user ' + meshName);
    case 'tire-low.001': return 'tyre';
  }
  throw new Error(`unmapped material ${matName} on ${meshName}`);
}

// --- materials (textures are attached by pack-textures.py by material name)
const M = (cls, name, p, tex) => { const m = new cls({ name, ...p }); if (tex) m.userData.textureSet = tex; return m; };
const S = THREE.MeshStandardMaterial, P = THREE.MeshPhysicalMaterial;
const MATERIALS = {
  paint: M(P, 'paint', { color: 0xffffff, roughness: 1, metalness: 1, clearcoat: 1, clearcoatRoughness: 0.04 }, 'body'),
  body_trim: M(S, 'body_trim', { color: 0xffffff, roughness: 1, metalness: 1 }, 'body'),
  trim: M(S, 'trim', { color: 0x0b0b0c, roughness: 0.45, metalness: 0.5 }),
  rubber: M(S, 'rubber', { color: 0x080808, roughness: 0.85, metalness: 0 }),
  glass: M(S, 'glass', { color: 0x10141a, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.45, depthWrite: false }),
  glass_tinted: M(S, 'glass_tinted', { color: 0x06080b, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.82, depthWrite: false }),
  mirror: M(S, 'mirror', { color: 0xffffff, roughness: 0.03, metalness: 1 }),
  grille: M(S, 'grille', { color: 0xffffff, roughness: 0.5, metalness: 0.4, alphaTest: 0.5, side: THREE.DoubleSide }, 'grille'),
  headlight: M(S, 'headlight', { color: 0xf0f2f5, roughness: 0.1, metalness: 0.3, emissive: 0xb0b0b0 }),
  headlight_lens: M(S, 'headlight_lens', { color: 0xffffff, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.15, depthWrite: false }),
  indicator: M(S, 'indicator', { color: 0xd8d8d8, roughness: 0.15, metalness: 0.2 }),
  taillight: M(S, 'taillight', { color: 0x7a0202, roughness: 0.15, metalness: 0.1, emissive: 0x300000 }),
  reverse_light: M(S, 'reverse_light', { color: 0xe6e6e6, roughness: 0.1, metalness: 0.2 }),
  chassis: M(S, 'chassis', { color: 0xffffff, roughness: 1, metalness: 1 }, 'chassis'),
  interior: M(S, 'interior', { color: 0xffffff, roughness: 1, metalness: 1 }, 'interior'),
  screen: M(S, 'screen', { color: 0xffffff, roughness: 0.2, metalness: 0, emissive: 0xffffff }, 'screen'),
  rim: M(S, 'rim', { color: 0xffffff, roughness: 1, metalness: 1 }, 'wheel'),
  brake: M(S, 'brake', { color: 0xffffff, roughness: 1, metalness: 1 }, 'wheel'),
  tyre: M(S, 'tyre', { color: 0xffffff, roughness: 1, metalness: 0 }, 'tyre'),
};
const ROLE_MATERIAL = { brake_disc: 'brake', brake_caliper: 'brake' };

// --- collect triangles into buckets
const buckets = new Map(); // key -> {node, role, parts:Set, pos:[], nrm:[], uv:[]}
function bucket(node, role) {
  const key = node + '|' + role;
  if (!buckets.has(key)) buckets.set(key, { node, role, parts: new Set(), pos: [], nrm: [], uv: [] });
  return buckets.get(key);
}
const src = await loadFBX(fbxPath);
src.updateMatrixWorld(true);
const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
let sourceTris = 0, sourceMeshes = 0;
const sourceMaterials = new Set();
src.traverse((o) => {
  if (!o.isMesh) return;
  sourceMeshes++;
  const g = o.geometry;
  if (g.index) throw new Error('indexed FBX geometry not expected');
  const mats = [].concat(o.material);
  mats.forEach((m) => sourceMaterials.add(m.name));
  const groups = g.groups.length ? g.groups : [{ start: 0, count: g.attributes.position.count, materialIndex: 0 }];
  const flip = o.matrixWorld.determinant() < 0;
  nm.getNormalMatrix(o.matrixWorld);
  const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, U1 = g.attributes.uv1;
  const wheelCorner = WHEEL_GROUPS[o.parent?.name];
  const center = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
  for (const gr of groups) {
    const matName = mats[gr.materialIndex].name;
    for (let t = gr.start; t < gr.start + gr.count; t += 3) {
      sourceTris++;
      const uvA = matName === 'media' ? U1 : U;
      const paint = matName === 'car-body' && isPaint((U.getX(t) + U.getX(t + 1) + U.getX(t + 2)) / 3, (U.getY(t) + U.getY(t + 1) + U.getY(t + 2)) / 3);
      const role = roleFor(o.name, matName, paint);
      let node;
      if (wheelCorner) node = 'wheel_' + wheelCorner;
      else if (role === 'brake_disc') node = 'wheel_' + corner(center);
      else if (role === 'brake_caliper') node = 'caliper_' + corner(center);
      else if (STEERING.has(o.name)) node = 'steering_wheel';
      else if (role === 'interior' || role === 'screen') node = 'interior';
      else if (role === 'chassis') node = 'chassis';
      else node = 'body';
      const b = bucket(node, role);
      b.parts.add(o.name);
      const order = flip ? [0, 2, 1] : [0, 1, 2];
      for (const k of order) {
        const i = t + k;
        v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld).multiplyScalar(SCALE);
        n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
        b.pos.push(v.x, v.y, v.z); b.nrm.push(n.x, n.y, n.z);
        // glTF UV origin is top-left (images are embedded unflipped), FBX/three is bottom-left
        b.uv.push(uvA ? uvA.getX(i) : 0, uvA ? 1 - uvA.getY(i) : 0);
      }
    }
  }
});

// --- placement: centre X, origin midway between axles in Z, tyres touching y=0
const bboxOf = (arr) => { const b = new THREE.Box3(); for (let i = 0; i < arr.length; i += 3) b.expandByPoint(v.set(arr[i], arr[i + 1], arr[i + 2])); return b; };
const axle = {};
for (const c of ['fl', 'fr', 'rl', 'rr']) axle[c] = bboxOf(buckets.get(`wheel_${c}|tyre`).pos);
const all = new THREE.Box3(); for (const b of buckets.values()) all.union(bboxOf(b.pos));
const tyreMinY = Math.min(...Object.values(axle).map((b) => b.min.y));
const frontZ = (axle.fl.getCenter(v).z + axle.fr.getCenter(new THREE.Vector3()).z) / 2;
const rearZ = (axle.rl.getCenter(v).z + axle.rr.getCenter(new THREE.Vector3()).z) / 2;
const shift = new THREE.Vector3(-(all.min.x + all.max.x) / 2, -tyreMinY, -(frontZ + rearZ) / 2);
for (const b of buckets.values()) for (let i = 0; i < b.pos.length; i += 3) { b.pos[i] += shift.x; b.pos[i + 1] += shift.y; b.pos[i + 2] += shift.z; }
const pivots = {};
for (const c of ['fl', 'fr', 'rl', 'rr']) pivots[c] = bboxOf(buckets.get(`wheel_${c}|tyre`).pos).getCenter(new THREE.Vector3());

// steering wheel pivot + column axis (smallest-variance direction of the rim ring)
const sw = buckets.get('steering_wheel|interior');
const swRim = (() => { const b = new THREE.Box3(); return b; })();
const rimPos = [];
{ // rim vertices only: reload is overkill, use all steering wheel verts weighted by ring shape
  for (let i = 0; i < sw.pos.length; i += 3) rimPos.push(new THREE.Vector3(sw.pos[i], sw.pos[i + 1], sw.pos[i + 2]));
}
const swCenter = bboxOf(sw.pos).getCenter(new THREE.Vector3());
const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
for (const p of rimPos) { const d = p.clone().sub(swCenter).toArray(); for (let a = 0; a < 3; a++) for (let c = 0; c < 3; c++) cov[a][c] += d[a] * d[c]; }
// smallest eigenvector via inverse power iteration on (cov + eps I)
const covM = new THREE.Matrix3().set(...cov[0], ...cov[1], ...cov[2]);
const inv = covM.clone().invert();
let ax = new THREE.Vector3(0.3, 0.3, 0.9).normalize();
for (let k = 0; k < 50; k++) ax.applyMatrix3(inv).normalize();
if (ax.z < 0) ax.negate();

// --- build scene
const root = new THREE.Group(); root.name = 'generic-sport-coupe';
const nodes = {};
function node(name, parent = root, pos = null) {
  if (nodes[name]) return nodes[name];
  const g = new THREE.Group(); g.name = name; if (pos) g.position.copy(pos); parent.add(g); nodes[name] = g; return g;
}
node('body'); node('chassis'); const interior = node('interior');
node('steering_wheel', interior, swCenter);
nodes.steering_wheel.userData = { origin: 'steering column centre', axis: ax.toArray().map((x) => +x.toFixed(4)) };
for (const c of ['fl', 'fr', 'rl', 'rr']) {
  node('wheel_' + c, root, pivots[c]).userData = { origin: 'axle centre', spinAxis: 'local X', steer: c[0] === 'f' };
  node('caliper_' + c, root, pivots[c]).userData = { origin: 'axle centre', note: 'steers with the wheel but does not spin' };
}
const report = { nodes: {}, meshes: [], materials: [], triangles: 0 };
const ROLE_ORDER = Object.keys(MATERIALS);
const sorted = [...buckets.values()].sort((a, b) => a.node.localeCompare(b.node) || ROLE_ORDER.indexOf(ROLE_MATERIAL[a.role] ?? a.role) - ROLE_ORDER.indexOf(ROLE_MATERIAL[b.role] ?? b.role));
for (const b of sorted) {
  const parent = nodes[b.node];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
  const pp = new THREE.Vector3(); parent.getWorldPosition(pp);
  geo.translate(-pp.x, -pp.y, -pp.z);
  const indexed = mergeVertices(geo, 1e-5);
  const matName = ROLE_MATERIAL[b.role] ?? b.role;
  const mesh = new THREE.Mesh(indexed, MATERIALS[matName]);
  const suffix = b.node.match(/_(fl|fr|rl|rr)$/)?.[1];
  mesh.name = b.node === 'body' || b.node === 'chassis' || b.node === 'interior' ? (b.node === 'chassis' ? 'chassis' : b.role)
    : b.node === 'steering_wheel' ? 'steering_wheel_mesh' : `${b.role}_${suffix}`;
  mesh.userData = { sourceParts: [...b.parts].sort() };
  parent.add(mesh);
  const tris = indexed.index.count / 3;
  report.triangles += tris;
  report.meshes.push({ name: mesh.name, parent: b.node, material: matName, triangles: tris, vertices: indexed.attributes.position.count, sourceParts: [...b.parts].sort() });
}
root.updateMatrixWorld(true);
const fin = new THREE.Box3().setFromObject(root);
report.bbox = { min: fin.min.toArray(), max: fin.max.toArray(), size: fin.getSize(new THREE.Vector3()).toArray() };
report.wheelPivots = Object.fromEntries(Object.entries(pivots).map(([k, p]) => [k, p.toArray().map((x) => +x.toFixed(4))]));
report.tyre = Object.fromEntries(['fl', 'rl'].map((c) => { const s = bboxOf(buckets.get(`wheel_${c}|tyre`).pos).getSize(new THREE.Vector3()); return [c, { width: +s.x.toFixed(3), diameter: +s.y.toFixed(3) }]; }));
report.wheelbase = +(pivots.fl.z - pivots.rl.z).toFixed(3);
report.trackFront = +(pivots.fl.x - pivots.fr.x).toFixed(3);
report.trackRear = +(pivots.rl.x - pivots.rr.x).toFixed(3);
report.steeringWheel = { center: swCenter.toArray(), axis: ax.toArray() };
report.source = { triangles: sourceTris, meshes: sourceMeshes, materials: [...sourceMaterials] };
report.materials = [...new Set(report.meshes.map((m) => m.material))];
report.shift = shift.toArray();

globalThis.FileReader ??= class { readAsArrayBuffer(b) { b.arrayBuffer().then((r) => { this.result = r; this.onload?.({ target: this }); this.onloadend?.({ target: this }); }); } };
const glb = await new GLTFExporter().parseAsync(root, { binary: true });
writeFileSync(outPath, Buffer.from(glb));
writeFileSync(reportPath, JSON.stringify(report, null, 1));
console.log('wrote', outPath, glb.byteLength, 'tris', report.triangles, 'meshes', report.meshes.length);
console.log('bbox size', report.bbox.size.map((x) => x.toFixed(3)).join(' x '), 'min', report.bbox.min.map((x) => x.toFixed(3)).join(','));
console.log('pivots', JSON.stringify(report.wheelPivots), 'wheelbase', report.wheelbase, 'tracks', report.trackFront, report.trackRear, 'tyre', JSON.stringify(report.tyre));
console.log('steering', JSON.stringify(report.steeringWheel));
for (const m of report.meshes) console.log(m.parent.padEnd(15), m.name.padEnd(20), m.material.padEnd(15), String(m.triangles).padStart(6), m.sourceParts.join(','));
