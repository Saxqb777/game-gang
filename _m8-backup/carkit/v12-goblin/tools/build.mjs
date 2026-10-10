/**
 * V12 Goblin (Olli Teittinen, CC BY 4.0) -> single GLB for the racing game (M12 prep).
 * Stage 1 (this file): bake transforms, fix orientation (upright, +Z forward), drop the 1 mm
 * "clearcoat" shell + ground/shadow planes, split the single-atlas body into named parts,
 * un-camber and pivot the wheels/calipers on the axle, export geometry + named materials.
 * Stage 2 (inject.mjs) embeds the converted textures (exporter cannot encode images in Node).
 */
import { writeFileSync } from 'node:fs';
import { THREE, loadFBX, FIX, KIT, sampler } from './common.mjs';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const root = loadFBX();
const src = {}; root.traverse((o) => { src[o.name] = o; });
const S = { spec: sampler('spec'), albedo: sampler('albedo') };

/** Non-indexed source geometry in game space (metres, Y up, +Z forward, +X = car's left). */
function worldGeometry(mesh) {
  const g = mesh.geometry.clone();
  g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(FIX, mesh.matrixWorld));
  g.deleteAttribute('color');
  fixFlippedNormals(g);
  return g;
}
/** The source's right-hand mirror (and a few caliper/glass faces) store normals opposite to their
 *  winding, which renders as white Fresnel "chrome". Point those normals along the face. */
let flipped = 0;
function fixFlippedNormals(g) {
  const p = g.attributes.position, n = g.attributes.normal;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), fn = new THREE.Vector3(), e = new THREE.Vector3();
  for (let t = 0; t < p.count / 3; t++) {
    a.fromBufferAttribute(p, 3 * t); b.fromBufferAttribute(p, 3 * t + 1); c.fromBufferAttribute(p, 3 * t + 2);
    fn.subVectors(c, b).cross(e.subVectors(a, b));
    let d = 0; for (let k = 0; k < 3; k++) d += fn.x * n.getX(3 * t + k) + fn.y * n.getY(3 * t + k) + fn.z * n.getZ(3 * t + k);
    if (d < 0) { flipped++; for (let k = 0; k < 3; k++) n.setXYZ(3 * t + k, -n.getX(3 * t + k), -n.getY(3 * t + k), -n.getZ(3 * t + k)); }
  }
}

// ---------- body classification ----------
const isPaintSpec = ([r, g, b]) => g > 70 && g > r * 1.5 && g > b * 2.5;
const inRect = (u, v, [u0, v0, u1, v1]) => u >= u0 && u <= u1 && v >= v0 && v <= v1;
const RECT = {
  plate: [0.150, 0.140, 0.230, 0.240],
  lens: [0.595, 0.600, 0.830, 0.745],
};
const CABIN = new THREE.Box3(new THREE.Vector3(-0.80, 0.12, -0.62), new THREE.Vector3(0.80, 1.18, 1.12));
const BOX = {
  // light clusters (housing + reflectors + lenses), refined from the class-view renders
  headlight: [new THREE.Box3(new THREE.Vector3(0.30, 0.38, 1.98), new THREE.Vector3(0.86, 0.66, 2.40))],
  taillight: [new THREE.Box3(new THREE.Vector3(0.40, 0.55, -2.30), new THREE.Vector3(0.98, 0.92, -1.86))],
};
const mirrorX = (b) => new THREE.Box3(new THREE.Vector3(-b.max.x, b.min.y, b.min.z), new THREE.Vector3(-b.min.x, b.max.y, b.max.z));
for (const k of Object.keys(BOX)) BOX[k] = BOX[k].flatMap((b) => [b, mirrorX(b)]);

function classifyBody(g) {
  const pos = g.attributes.position, uv = g.attributes.uv;
  const n = pos.count / 3;
  const labels = new Array(n);
  const c = new THREE.Vector3();
  for (let t = 0; t < n; t++) {
    let u = 0, v = 0; c.set(0, 0, 0);
    for (let k = 0; k < 3; k++) { u += uv.getX(3 * t + k) / 3; v += uv.getY(3 * t + k) / 3; c.x += pos.getX(3 * t + k) / 3; c.y += pos.getY(3 * t + k) / 3; c.z += pos.getZ(3 * t + k) / 3; }
    // paint vote: centroid + vertices pulled 30% toward centroid
    let paintVotes = isPaintSpec(S.spec(u, v)) ? 1 : 0;
    for (let k = 0; k < 3; k++) {
      const uu = uv.getX(3 * t + k) * 0.7 + u * 0.3, vv = uv.getY(3 * t + k) * 0.7 + v * 0.3;
      if (isPaintSpec(S.spec(uu, vv))) paintVotes++;
    }
    let label = 'trim';
    if (inRect(u, v, RECT.plate)) label = 'plate';
    else if (paintVotes >= 2) label = 'paint';
    else if (inRect(u, v, RECT.lens) && Math.abs(c.z) > 1.85) label = c.z > 0 ? 'headlight' : 'taillight';
    else if (BOX.headlight.some((b) => b.containsPoint(c))) label = 'headlight';
    else if (BOX.taillight.some((b) => b.containsPoint(c))) label = 'taillight';
    else if (u > 0.5 && CABIN.containsPoint(c) && !(Math.abs(c.x) > 0.6 && c.z > 0.85)) label = 'interior';
    labels[t] = label;
  }
  return labels;
}

function subset(g, labels, want) {
  const idx = []; labels.forEach((l, t) => { if (l === want) idx.push(t); });
  if (!idx.length) return null;
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name]; const arr = new Float32Array(idx.length * 3 * a.itemSize);
    idx.forEach((t, i) => arr.set(a.array.subarray(3 * t * a.itemSize, 3 * (t + 1) * a.itemSize), 3 * i * a.itemSize));
    out.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
  }
  return out;
}
const indexed = (g) => mergeVertices(g, 1e-5);

// ---------- materials (factors; textures injected in stage 2) ----------
const M = {
  paint: new THREE.MeshPhysicalMaterial({ name: 'paint', color: 0xffffff, metalness: 1, roughness: 1, clearcoat: 1, clearcoatRoughness: 0.04 }),
  trim: new THREE.MeshStandardMaterial({ name: 'trim', color: 0xffffff, metalness: 1, roughness: 1 }),
  interior: new THREE.MeshStandardMaterial({ name: 'interior', color: 0xffffff, metalness: 1, roughness: 1 }),
  plate: new THREE.MeshStandardMaterial({ name: 'plate', color: 0xffffff, metalness: 1, roughness: 1 }),
  headlight: new THREE.MeshStandardMaterial({ name: 'headlight', color: 0xffffff, metalness: 1, roughness: 1, emissive: 0xffffff, emissiveIntensity: 1 }),
  taillight: new THREE.MeshStandardMaterial({ name: 'taillight', color: 0xffffff, metalness: 1, roughness: 1, emissive: 0xffffff, emissiveIntensity: 1 }),
  glass: new THREE.MeshStandardMaterial({ name: 'glass', color: 0x1a1f24, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.45 }),
  rim: new THREE.MeshStandardMaterial({ name: 'rim', color: 0xffffff, metalness: 1, roughness: 1 }),
  tyre: new THREE.MeshStandardMaterial({ name: 'tyre', color: 0x1c1c1c, metalness: 1, roughness: 1 }),
  brake: new THREE.MeshStandardMaterial({ name: 'brake', color: 0xffffff, metalness: 1, roughness: 1 }),
};

const car = new THREE.Group(); car.name = 'v12-goblin';
const stats = {};
function addMesh(name, geom, material, parent = car) {
  const mesh = new THREE.Mesh(geom, material); mesh.name = name; parent.add(mesh);
  stats[name] = (geom.index ? geom.index.count : geom.attributes.position.count) / 3;
  return mesh;
}

// body
const bodyG = worldGeometry(src.car_body);
const labels = classifyBody(bodyG);
const counts = {}; labels.forEach((l) => { counts[l] = (counts[l] || 0) + 1; });
console.log('body triangle classes', counts);
for (const part of ['paint', 'trim', 'interior', 'headlight', 'taillight', 'plate']) {
  const g = subset(bodyG, labels, part); if (!g) continue;
  addMesh(part === 'paint' ? 'body' : part, indexed(g), M[part]);
}
addMesh('glass', indexed(worldGeometry(src.car_glass)), M.glass);

// wheels + calipers: un-camber (drop the suspension bone rotation), pivot at the axle centre
const carRot = new THREE.Quaternion();
new THREE.Matrix4().multiplyMatrices(FIX, src.bone_car.matrixWorld).decompose(new THREE.Vector3(), carRot, new THREE.Vector3());
const WHEELS = { FL: 'wheel_fl', FR: 'wheel_fr', BL: 'wheel_rl', BR: 'wheel_rr' };
const pivots = {};
for (const [sfx, name] of Object.entries(WHEELS)) {
  const wm = src[`car_wheel_${sfx}`];
  const local = wm.geometry.clone(); local.deleteAttribute('color');
  local.computeBoundingBox();
  const cLocal = local.boundingBox.getCenter(new THREE.Vector3());
  const toWorld = new THREE.Matrix4().multiplyMatrices(FIX, wm.matrixWorld);
  const pivot = cLocal.clone().applyMatrix4(toWorld);
  const unCamber = new THREE.Matrix4().makeRotationFromQuaternion(carRot).multiply(new THREE.Matrix4().makeTranslation(-cLocal.x, -cLocal.y, -cLocal.z));
  local.applyMatrix4(unCamber);
  // split rim (atlas, material index 0) from tyre (material index 2)
  const triMat = new Array(local.attributes.position.count / 3);
  for (const grp of local.groups) for (let t = grp.start / 3; t < (grp.start + grp.count) / 3; t++) triMat[t] = grp.materialIndex === 2 ? 'tyre' : 'rim';
  local.clearGroups();
  const node = new THREE.Group(); node.name = name; node.position.copy(pivot); car.add(node);
  addMesh(`${name}_rim`, indexed(subset(local, triMat, 'rim')), M.rim, node);
  addMesh(`${name}_tyre`, indexed(subset(local, triMat, 'tyre')), M.tyre, node);
  pivots[sfx] = { pivot, toWorldInv: toWorld.clone().invert(), cLocal, unCamber };
  // caliper: into the wheel's local frame, then the same un-camber
  const bm = src[`car_brake_${sfx}`];
  const bg = bm.geometry.clone(); bg.deleteAttribute('color'); bg.clearGroups();
  bg.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toWorld.clone().invert(), new THREE.Matrix4().multiplyMatrices(FIX, bm.matrixWorld)));
  bg.applyMatrix4(unCamber);
  fixFlippedNormals(bg);
  const bnode = addMesh(name.replace('wheel', 'brake'), indexed(bg), M.brake);
  bnode.position.copy(pivot);
}

// ground: lowest tyre point -> y = 0
car.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(car);
const wheelBox = new THREE.Box3(); for (const n of Object.values(WHEELS)) wheelBox.union(new THREE.Box3().setFromObject(car.getObjectByName(n)));
const dy = -wheelBox.min.y;
for (const child of car.children) child.position.y += dy;
// the meshes that hold world-space geometry have position (0,0,0); shift them via position too (kept as node offset? no: bake)
for (const child of car.children) if (child.isMesh && !child.name.startsWith('brake')) { child.geometry.translate(0, child.position.y, 0); child.position.y = 0; }
car.updateMatrixWorld(true);
const fin = new THREE.Box3().setFromObject(car);
const size = fin.getSize(new THREE.Vector3());
console.log('size (m) W x H x L:', size.toArray().map((n) => n.toFixed(3)).join(' x '), 'min', fin.min.toArray().map((n) => n.toFixed(3)), 'max', fin.max.toArray().map((n) => n.toFixed(3)));
const wheelInfo = {};
for (const n of Object.values(WHEELS)) {
  const node = car.getObjectByName(n); const b = new THREE.Box3().setFromObject(node); const s = b.getSize(new THREE.Vector3());
  wheelInfo[n] = { pivot: node.position.toArray().map((x) => +x.toFixed(4)), width: +s.x.toFixed(3), diameter: +s.y.toFixed(3), diameterZ: +s.z.toFixed(3), minY: +b.min.y.toFixed(4) };
}
console.log(wheelInfo);
let total = 0; for (const v of Object.values(stats)) total += v;
console.log('triangles per mesh', stats, 'total', total, 'normals flipped on', flipped, 'triangles');
writeFileSync(KIT + 'work/stats.json', JSON.stringify({ stats, total, size: size.toArray(), min: fin.min.toArray(), max: fin.max.toArray(), wheelInfo, classes: counts }, null, 1));

// glTF UV origin is top-left; FBX/three UVs are bottom-left (textures are injected unflipped).
car.traverse((o) => { if (!o.isMesh) return; const uv = o.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); });
const glb = await new GLTFExporter().parseAsync(car, { binary: true, trs: true });
writeFileSync(KIT + 'work/stage.glb', Buffer.from(glb));
console.log('stage.glb', glb.byteLength);
