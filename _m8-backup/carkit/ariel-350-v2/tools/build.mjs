// Build carkit/ariel-350-v2/ariel-350-v2.glb from the extracted source GLB (never modifies src/).
// Bakes transforms, scales to metres (front +Z, left +X, wheels on y=0), renames meshes/materials,
// separates the 4 wheels (pivot on the axle) and the brakes (pivot on the axle, steer only).
import { writeFileSync } from 'node:fs';
import { loadGLB, THREE, KIT, triCount } from './common.mjs';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const OUT = process.argv[2] || KIT + 'ariel-350-v2.glb';
const ROOT_NAME = 'strix-r4'; // working name: source is called "Ariel 350" (real marque), renamed
const S = 0.235; // metres per source unit: body 3.94 m long, 2.20 m wide, 1.31 m tall, tyre 0.70 m

const g = await loadGLB();
const src = g.scene;

// ---- wheels: pivots in source space (node origin = hub centre; camber/toe dropped) ----
const WHEELS = { wheel_fl: 'wheel_front_left', wheel_fr: 'wheel_front_right', wheel_rl: 'wheel_rear_left', wheel_rr: 'wheel_rear_right' };
const wheelInfo = {};
let radiusSrc = 0;
for (const [id, srcName] of Object.entries(WHEELS)) {
  const node = src.getObjectByName(srcName);
  let r = 0;
  node.traverse((o) => { if (o.isMesh && o.material.name === 'tyres') { o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; r = Math.max(b.max.y, -b.min.y, b.max.z, -b.min.z) * node.scale.x; } });
  radiusSrc = Math.max(radiusSrc, r);
  wheelInfo[id] = { node, pos: node.position.clone(), radiusSrc: r };
}
// symmetric, level pivots: average |x| per axle, common hub height
const hubY = Object.values(wheelInfo).reduce((s, w) => s + w.pos.y, 0) / 4;
for (const [id, w] of Object.entries(wheelInfo)) {
  const axle = id[6]; const pair = Object.entries(wheelInfo).filter(([k]) => k[6] === axle).map(([, v]) => v);
  const ax = (Math.abs(pair[0].pos.x) + Math.abs(pair[1].pos.x)) / 2; const az = (pair[0].pos.z + pair[1].pos.z) / 2;
  w.pivotSrc = new THREE.Vector3(Math.sign(w.pos.x) * ax, hubY, az);
}
const groundY = hubY - radiusSrc;
const zMid = (wheelInfo.wheel_fl.pivotSrc.z + wheelInfo.wheel_rl.pivotSrc.z) / 2;
// source -> output (metres): translate so ground is y=0 and the wheelbase midpoint is z=0, then scale
const OUTM = new THREE.Matrix4().makeScale(S, S, S).multiply(new THREE.Matrix4().makeTranslation(0, -groundY, -zMid));
const toOut = (v) => v.clone().applyMatrix4(OUTM);

// ---- material table: source name -> output name + PBR ----
const MAT = {
  body: 'paint', windshield: 'glass', plactic: 'trim', metal: 'metal', 'metal.016': 'rim', tyres: 'tyre',
  headlights: 'headlight', taillights: 'taillight', mirror: 'mirror', interior: 'interior', white: 'interior_panel',
  screen: 'screen', red: 'accent_red', spring: 'accent_red', liquids: 'fluid', 'air filters': 'filter',
};
function makeMaterial(name, srcMat) {
  const c = srcMat.color;
  switch (name) {
    case 'paint': return new THREE.MeshPhysicalMaterial({ name, color: new THREE.Color(0.60, 0.61, 0.64), metalness: 0.5, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.03 });
    case 'glass': return new THREE.MeshPhysicalMaterial({ name, color: new THREE.Color(0.02, 0.025, 0.03), metalness: 0, roughness: 0.03, transparent: true, opacity: 0.35, clearcoat: 1, clearcoatRoughness: 0.02, side: THREE.DoubleSide, depthWrite: false });
    case 'trim': return new THREE.MeshStandardMaterial({ name, color: new THREE.Color(0.018, 0.018, 0.02), metalness: 0.2, roughness: 0.45 });
    case 'metal': return new THREE.MeshStandardMaterial({ name, color: c.clone(), metalness: 0.8, roughness: 0.5 });
    case 'rim': return new THREE.MeshStandardMaterial({ name, color: new THREE.Color(0.06, 0.06, 0.065), metalness: 0.9, roughness: 0.35 });
    case 'tyre': return new THREE.MeshStandardMaterial({ name, color: new THREE.Color(0.022, 0.022, 0.022), metalness: 0, roughness: 0.88 });
    case 'brake': return new THREE.MeshStandardMaterial({ name, color: new THREE.Color(0.35, 0.35, 0.35), metalness: 0.9, roughness: 0.45 });
    case 'caliper': return new THREE.MeshStandardMaterial({ name, color: new THREE.Color(0.8, 0.03, 0.0), metalness: 0.1, roughness: 0.35 });
    case 'headlight': return new THREE.MeshStandardMaterial({ name, color: new THREE.Color(0.85, 0.85, 0.85), emissive: new THREE.Color(1, 0.96, 0.88), emissiveIntensity: 1, metalness: 0, roughness: 0.15 });
    case 'taillight': return new THREE.MeshStandardMaterial({ name, color: new THREE.Color(0.12, 0.007, 0), emissive: new THREE.Color(1, 0.03, 0), emissiveIntensity: 1.2, metalness: 0, roughness: 0.15 });
    case 'mirror': return new THREE.MeshStandardMaterial({ name, color: new THREE.Color(0.9, 0.9, 0.9), metalness: 1, roughness: 0.05 });
    case 'interior': return new THREE.MeshStandardMaterial({ name, color: c.clone(), metalness: 0.1, roughness: 0.8 });
    case 'interior_panel': return new THREE.MeshStandardMaterial({ name, color: c.clone(), metalness: 0, roughness: 0.6 });
    case 'screen': return new THREE.MeshStandardMaterial({ name, color: new THREE.Color(0.01, 0.01, 0.012), metalness: 0, roughness: 0.1 });
    case 'accent_red': return new THREE.MeshStandardMaterial({ name, color: new THREE.Color(0.8, 0.03, 0.0), metalness: 0, roughness: 0.5 });
    case 'fluid': return new THREE.MeshStandardMaterial({ name, color: c.clone(), metalness: 0, roughness: 0.4 });
    case 'filter': return new THREE.MeshStandardMaterial({ name, color: c.clone(), metalness: 0, roughness: 0.9 });
  }
  throw new Error('no material ' + name);
}
const mats = new Map();
const matFor = (name, srcMat) => { if (!mats.has(name)) mats.set(name, makeMaterial(name, srcMat)); return mats.get(name); };

// ---- part classification: source node -> output group ----
const GROUP_OF = {
  body: 'body', Hood: 'body', door_left: 'body', door_right: 'body', trunk: 'body', 'Sub-frame': 'body', 'sub-frame_2': 'body',
  wing_1: 'body', diffusor: 'body', windows: 'body', tail_lights: 'body', antenna: 'body', tow_strap: 'body',
  interior: 'interior', rollcage: 'interior',
  suspension: 'chassis', drivetrain: 'chassis', gas_tank: 'chassis',
};
const nodeKey = (o) => { let n = o; while (n.parent && n.parent !== src) n = n.parent; return n; };

/** geometry with only position+normal, baked to output space; winding fixed for mirrored nodes */
function bake(geo, matrix) {
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', geo.attributes.position.clone());
  out.setAttribute('normal', geo.attributes.normal.clone());
  out.setIndex(geo.index ? geo.index.clone() : null);
  out.applyMatrix4(matrix);
  if (matrix.determinant() < 0 && out.index) {
    const a = out.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; }
  }
  const ni = out.toNonIndexed(); return ni;
}
/** split an indexed geometry by triangle predicate; returns [selected, rest] (indexed copies) */
function splitTris(geo, pick) {
  const idx = geo.index.array; const a = [], b = [];
  for (let t = 0; t < idx.length; t += 3) (pick[t / 3] ? a : b).push(idx[t], idx[t + 1], idx[t + 2]);
  const mk = (list) => { const gg = new THREE.BufferGeometry(); for (const k of Object.keys(geo.attributes)) gg.setAttribute(k, geo.attributes[k]); gg.setIndex(list); return gg; };
  return [mk(a), mk(b)];
}
/** connected components (by welded position) -> per-triangle component id + component boxes (world) */
function components(geo, matrixWorld) {
  const idx = geo.index.array; const pos = geo.attributes.position;
  const key = new Map(); const rep = new Int32Array(pos.count);
  for (let i = 0; i < pos.count; i++) { const k = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`; if (!key.has(k)) key.set(k, i); rep[i] = key.get(k); }
  const parent = new Int32Array(pos.count).map((_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (let t = 0; t < idx.length; t += 3) { const a = find(rep[idx[t]]); parent[find(rep[idx[t + 1]])] = a; parent[find(rep[idx[t + 2]])] = a; }
  const triComp = new Int32Array(idx.length / 3); const boxes = new Map(); const v = new THREE.Vector3();
  for (let t = 0; t < idx.length; t += 3) {
    const r = find(rep[idx[t]]); triComp[t / 3] = r;
    if (!boxes.has(r)) boxes.set(r, new THREE.Box3());
    for (let k = 0; k < 3; k++) boxes.get(r).expandByPoint(v.fromBufferAttribute(pos, idx[t + k]).applyMatrix4(matrixWorld));
  }
  return { triComp, boxes };
}

const parts = []; // {group, mat, geo (non-indexed, output space or pivot-local)}
const add = (group, matName, srcMat, geo) => { matFor(matName, srcMat); parts.push({ group, mat: matName, geo }); };

// wheels
const wheelOfNode = new Map(Object.entries(WHEELS).map(([id, n]) => [n, id]));
src.updateMatrixWorld(true);
const pivotOut = {};
for (const [id, w] of Object.entries(wheelInfo)) pivotOut[id] = toOut(w.pivotSrc);

src.traverse((o) => {
  if (!o.isMesh) return;
  const top = nodeKey(o); const srcMatName = o.material.name;
  const wheel = wheelOfNode.get(top.name);
  if (wheel) {
    // keep only node scale (drop camber/toe), local to pivot, in metres
    const m = new THREE.Matrix4().makeScale(top.scale.x * S, top.scale.y * S, top.scale.z * S);
    const name = srcMatName === 'tyres' ? 'tyre' : srcMatName === 'metal.016' ? 'rim' : 'hub';
    add(wheel, name === 'hub' ? 'trim' : name, o.material, Object.assign(bake(o.geometry, m), { partName: `${wheel}_${name}` }));
    return;
  }
  const group = GROUP_OF[top.name];
  if (!group) throw new Error('unclassified node ' + top.name);
  const world = new THREE.Matrix4().multiplyMatrices(OUTM, o.matrixWorld);
  let geo = o.geometry;
  if (top.name === 'suspension' && (srcMatName === 'metal' || srcMatName === 'spring')) {
    // pull the brake discs (metal) and calipers (red "spring") out of the suspension so they can steer
    const { triComp, boxes } = components(geo, o.matrixWorld);
    const compWheel = new Map();
    for (const [c, b] of boxes) {
      const ctr = b.getCenter(new THREE.Vector3()), size = b.getSize(new THREE.Vector3());
      for (const [id, w] of Object.entries(wheelInfo)) {
        const p = w.pivotSrc; const yz = Math.hypot(ctr.y - p.y, ctr.z - p.z);
        if (process.env.DBG && Math.abs(ctr.x - p.x) < 1.2 && yz < 1.5) console.error("cand", srcMatName, id, size.toArray().map((x) => x.toFixed(2)).join(","), ctr.toArray().map((x) => x.toFixed(2)).join(","), "dx", (ctr.x - p.x).toFixed(2), "yz", yz.toFixed(2));
        if (size.x < 0.65 && Math.abs(ctr.x - p.x) < 0.4 && yz < 0.9 && Math.max(size.y, size.z) < 1.9) compWheel.set(c, id);
      }
    }
    const orig = geo;
    geo = splitTris(orig, Array.from(triComp, (c) => !compWheel.has(c)))[0];
    for (const id of Object.keys(wheelInfo)) {
      const pick = Array.from(triComp, (c) => compWheel.get(c) === id);
      if (!pick.some(Boolean)) continue;
      const [sel] = splitTris(orig, pick);
      const local = new THREE.Matrix4().makeTranslation(-pivotOut[id].x, -pivotOut[id].y, -pivotOut[id].z).multiply(world);
      const brakeId = 'brake_' + id.slice(6);
      add(brakeId, srcMatName === 'metal' ? 'brake' : 'caliper', o.material, Object.assign(bake(sel, local), { partName: `${brakeId}_${srcMatName === 'metal' ? 'disc' : 'caliper'}` }));
    }
  }
  add(group, MAT[srcMatName], o.material, bake(geo, world));
});

// ---- assemble ----
const root = new THREE.Group(); root.name = ROOT_NAME;
const groups = {};
const order = ['body', 'interior', 'chassis', 'wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr', 'brake_fl', 'brake_fr', 'brake_rl', 'brake_rr'];
for (const gname of order) {
  const node = new THREE.Group(); node.name = gname; groups[gname] = node; root.add(node);
  if (pivotOut[gname]) node.position.copy(pivotOut[gname]);
  if (gname.startsWith('brake_')) node.position.copy(pivotOut['wheel_' + gname.slice(6)]);
  const byMat = new Map();
  for (const p of parts.filter((q) => q.group === gname)) { if (!byMat.has(p.mat)) byMat.set(p.mat, []); byMat.get(p.mat).push(p); }
  for (const [mat, list] of byMat) {
    const merged = mergeVertices(mergeGeometries(list.map((p) => p.geo)), 1e-6);
    const mesh = new THREE.Mesh(merged, mats.get(mat));
    const wheelPart = list[0].geo.partName;
    mesh.name = wheelPart ? wheelPart : (gname === 'body' ? mat : mat === gname ? `${gname}_shell` : mat.startsWith(gname) ? mat : `${gname}_${mat}`);
    node.add(mesh);
  }
}
// sort materials alphabetically? keep insertion. Report.
root.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(root);
const bodyBox = new THREE.Box3().setFromObject(groups.body);
let tris = 0, meshes = 0; const perGroup = {};
root.traverse((o) => { if (o.isMesh) { const t = triCount(o.geometry); tris += t; meshes++; perGroup[o.parent.name] = (perGroup[o.parent.name] || 0) + t; } });
const r3 = (v) => v.toArray().map((x) => +x.toFixed(3));
const report = {
  root: ROOT_NAME, scale: S, size: r3(box.getSize(new THREE.Vector3())), min: r3(box.min), max: r3(box.max),
  bodyLength: +(bodyBox.max.z - bodyBox.min.z).toFixed(3),
  wheelbase: +(pivotOut.wheel_fl.z - pivotOut.wheel_rl.z).toFixed(3), trackFront: +(pivotOut.wheel_fl.x - pivotOut.wheel_fr.x).toFixed(3), trackRear: +(pivotOut.wheel_rl.x - pivotOut.wheel_rr.x).toFixed(3),
  wheelRadius: +(radiusSrc * S).toFixed(4), pivots: Object.fromEntries(Object.entries(pivotOut).map(([k, v]) => [k, r3(v)])),
  triangles: tris, meshes, perGroup, materials: [...mats.keys()],
};
console.log(JSON.stringify(report, null, 1));
writeFileSync(KIT + 'tools/report.json', JSON.stringify(report, null, 1));
const glb = await new GLTFExporter().parseAsync(root, { binary: true });
writeFileSync(OUT, Buffer.from(glb));
console.log('wrote', OUT, glb.byteLength);
