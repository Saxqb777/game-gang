/**
 * Concept Car 039 (unityfan777, CC0) OBJ -> single game-ready GLB.
 * usage: node build.mjs [--generic-tyre] [--out file.glb]
 *
 * - source OBJ is already metric (Blender metres) and faces +Z; no rotation/scale needed.
 * - origin: x = centreline, z = mid-wheelbase, y = 0 at the tyre contact patch.
 * - the source has no .mtl: OBJ material names are mapped to game materials with hand-set PBR values.
 * - wheels: one node per corner (wheel_fl/fr/rl/rr) pivoted on the axle centre, holding rim, chrome
 *   inserts, tyre sidewall, tread and brake disc (all spin). Calipers are separate nodes
 *   (brake_fl/...) on the same pivot so they can steer but not spin.
 * - textures are injected into the GLB afterwards (GLTFExporter cannot encode images in Node).
 */
import { THREE, loadOBJ, splitByMaterial, KIT } from './common.mjs';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeVertices, mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const GENERIC_TYRE = args.includes('--generic-tyre');
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : KIT + 'concept-car-039.glb';

// ---------- materials ----------
const M = {
  paint: new THREE.MeshPhysicalMaterial({ name: 'paint', color: 0x14409a, metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.03 }),
  chrome: new THREE.MeshStandardMaterial({ name: 'chrome', color: 0xdfe3e8, metalness: 1, roughness: 0.1 }),
  trim: new THREE.MeshStandardMaterial({ name: 'trim', color: 0x111214, metalness: 0.15, roughness: 0.42 }),
  blackout: new THREE.MeshStandardMaterial({ name: 'blackout', color: 0x060606, metalness: 0, roughness: 0.92 }),
  glass: new THREE.MeshPhysicalMaterial({ name: 'glass', color: 0x0b0e13, metalness: 0, roughness: 0.03, ior: 1.5, transparent: true, opacity: 0.72 }),
  lens: new THREE.MeshPhysicalMaterial({ name: 'lens', color: 0xffffff, metalness: 0, roughness: 0.02, ior: 1.5, transparent: true, opacity: 0.18 }),
  headlight: new THREE.MeshStandardMaterial({ name: 'headlight', color: 0xe9eef5, metalness: 0.85, roughness: 0.18, emissive: 0xdfeaff, emissiveIntensity: 1 }),
  turnlight: new THREE.MeshStandardMaterial({ name: 'turnlight', color: 0xffa000, metalness: 0.3, roughness: 0.3, emissive: 0xff8a00, emissiveIntensity: 1 }),
  taillight: new THREE.MeshStandardMaterial({ name: 'taillight', color: 0x8a0606, metalness: 0, roughness: 0.25, emissive: 0xff1010, emissiveIntensity: 1 }),
  rim: new THREE.MeshStandardMaterial({ name: 'rim', color: 0x3b3e43, metalness: 1, roughness: 0.28 }),
  tyre: new THREE.MeshStandardMaterial({ name: 'tyre', color: 0x8c8c8c, metalness: 0, roughness: 0.88 }),
  tyre_tread: new THREE.MeshStandardMaterial({ name: 'tyre_tread', color: 0xb4b4b4, metalness: 1, roughness: 1 }),
  brake: new THREE.MeshStandardMaterial({ name: 'brake', color: 0x5d6064, metalness: 1, roughness: 0.42 }),
  caliper: new THREE.MeshStandardMaterial({ name: 'caliper', color: 0xc8102e, metalness: 0.1, roughness: 0.35 }),
};

/** OBJ object (sanitised name prefix) + OBJ material -> [game mesh, game material]. */
function classifyBody(objName, matName) {
  switch (matName) {
    case 'body_color_supra.001': return ['body', 'paint'];
    case 'blockers': return ['blackout', 'blackout'];
    case 'plasticShiny': return ['glass', 'glass'];
    case 'plasticBlur': return ['trim', 'trim'];
    case 'headlightCovers': return ['headlight_lens', 'lens'];
    case 'chrome_turnlight': return ['turnlight', 'turnlight'];
    case 'Material.001': return ['taillight', 'taillight'];
    case 'chrome':
      // reflectors inside the headlight slits / lower lamps glow; the rest is body brightwork
      if (/^Cube\.0(58|28|43)_/.test(objName)) return ['headlight', 'headlight'];
      return ['chrome', 'chrome'];
  }
  throw new Error(`unmapped body material ${objName} / ${matName}`);
}
const WHEEL_PART = { 'rims.001': 'rim', chrome: 'rim_chrome', 'rubber___tires.001': 'tyre', tireProtector: 'tread', 'metal_1.001': 'disc', brakeCalipers: 'caliper' };
const WHEEL_MAT = { rim: 'rim', rim_chrome: 'chrome', tyre: 'tyre', tread: 'tyre_tread', disc: 'brake', caliper: 'caliper' };
const isWheelObj = (n) => /^(Plane\.01[5-9]|Plane\.020|Mesh[24567]\.004)_/.test(n);

// ---------- load + bucket ----------
const root = loadOBJ();
const sourceMeshes = [];
root.traverse((o) => { if (o.isMesh) sourceMeshes.push(o); });

// tyre centres (Mesh5 = tyre) define the four corners
const tyres = sourceMeshes.filter((o) => o.name.startsWith('Mesh5.004_')).map((o) => {
  o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox;
  return { centre: b.getCenter(new THREE.Vector3()), size: b.getSize(new THREE.Vector3()) };
});
if (tyres.length !== 4) throw new Error('expected 4 tyres');
const zFront = Math.max(...tyres.map((t) => t.centre.z));
const cornerOf = (c) => (c.z > zFront - 0.5 ? 'f' : 'r') + (c.x > 0 ? 'l' : 'r');
const corners = {};
for (const t of tyres) corners[cornerOf(t.centre)] = t;

const groundY = Math.min(...tyres.map((t) => t.centre.y - t.size.y / 2));
const midZ = (Math.max(...tyres.map((t) => t.centre.z)) + Math.min(...tyres.map((t) => t.centre.z))) / 2;
const SHIFT = new THREE.Vector3(0, -groundY, -midZ);

const body = {}; // meshName -> {mat, geoms[]}
const wheels = {}; // corner -> part -> geoms[]
for (const o of sourceMeshes) {
  const wheel = isWheelObj(o.name);
  let corner;
  if (wheel) {
    o.geometry.computeBoundingBox();
    const c = o.geometry.boundingBox.getCenter(new THREE.Vector3());
    corner = Object.entries(corners).sort((a, b) => a[1].centre.distanceTo(c) - b[1].centre.distanceTo(c))[0][0];
  }
  for (const { matName, geometry } of splitByMaterial(o)) {
    geometry.translate(SHIFT.x, SHIFT.y, SHIFT.z);
    if (wheel) {
      const part = WHEEL_PART[matName]; if (!part) throw new Error(`wheel material ${matName}`);
      ((wheels[corner] ??= {})[part] ??= []).push(geometry);
    } else {
      const [mesh, mat] = classifyBody(o.name, matName);
      (body[mesh] ??= { mat, geoms: [] }).geoms.push(geometry);
    }
  }
}

// glTF UV origin is top-left; OBJ is bottom-left. Textures are injected unflipped, so flip v.
function finish(geoms) {
  const g = geoms.length === 1 ? geoms[0] : mergeGeometries(geoms, false);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  const ix = mergeVertices(g, 1e-6);
  ix.computeBoundingBox(); ix.computeBoundingSphere();
  return ix;
}

const car = new THREE.Group();
car.name = 'concept-car-039';
car.userData = {
  source: 'Concept Car 039 / "Futuristic Car 039" by unityfan777 (unity fan youtube channel)',
  license: 'CC0 1.0 (public domain dedication)',
  units: 'metres', forward: '+Z', up: '+Y', origin: 'centreline, mid-wheelbase, ground',
  tyreTexture: GENERIC_TYRE ? 'generic (debranded)' : 'SOURCE: Bridgestone Potenza RE050A sidewall (branded, replace before shipping)',
};
const stats = {};
const add = (parent, name, geom, matName) => {
  const m = new THREE.Mesh(geom, M[matName]); m.name = name; parent.add(m);
  stats[name] = geom.index.count / 3; return m;
};
const BODY_ORDER = ['body', 'chrome', 'trim', 'blackout', 'glass', 'headlight', 'headlight_lens', 'turnlight', 'taillight'];
for (const name of BODY_ORDER) if (body[name]) add(car, name, finish(body[name].geoms), body[name].mat);

const wheelInfo = {};
for (const corner of ['fl', 'fr', 'rl', 'rr']) {
  const t = corners[corner];
  const pivot = t.centre.clone().add(SHIFT);
  const node = new THREE.Group(); node.name = `wheel_${corner}`; node.position.copy(pivot); car.add(node);
  const parts = wheels[corner];
  for (const part of ['rim', 'rim_chrome', 'tyre', 'tread', 'disc']) {
    const geoms = parts[part]; if (!geoms) throw new Error(`missing ${corner} ${part}`);
    for (const g of geoms) g.translate(-pivot.x, -pivot.y, -pivot.z);
    add(node, `wheel_${corner}_${part}`, finish(geoms), WHEEL_MAT[part]);
  }
  for (const g of parts.caliper) g.translate(-pivot.x, -pivot.y, -pivot.z);
  const cal = add(car, `brake_${corner}`, finish(parts.caliper), 'caliper');
  cal.position.copy(pivot);
  wheelInfo[`wheel_${corner}`] = { pivot: pivot.toArray().map((v) => +v.toFixed(4)), radius: +(t.size.y / 2).toFixed(4), width: +t.size.x.toFixed(4) };
}

car.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(car);
const size = box.getSize(new THREE.Vector3());
let total = 0; for (const v of Object.values(stats)) total += v;
const report = {
  size: { width: +size.x.toFixed(3), height: +size.y.toFixed(3), length: +size.z.toFixed(3) },
  min: box.min.toArray().map((v) => +v.toFixed(3)), max: box.max.toArray().map((v) => +v.toFixed(3)),
  wheelbase: +(corners.fl.centre.z - corners.rl.centre.z).toFixed(3),
  trackFront: +(corners.fl.centre.x - corners.fr.centre.x).toFixed(3),
  trackRear: +(corners.rl.centre.x - corners.rr.centre.x).toFixed(3),
  wheelInfo, triangles: total, meshes: Object.keys(stats).length, stats,
  sourceObjects: sourceMeshes.length,
};
console.log(JSON.stringify(report, null, 1));
writeFileSync(KIT + 'tools/report.json', JSON.stringify(report, null, 1));

// ---------- export + inject textures ----------
const glb = Buffer.from(await new GLTFExporter().parseAsync(car, { binary: true }));
const jsonLen = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8').replace(/\s+$/, ''));
let bin = glb.subarray(20 + jsonLen + 8);
const binChunks = [bin];
let binLen = bin.length;
json.images ??= []; json.textures ??= []; json.samplers ??= [];
json.samplers.push({ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 });
const sampler = json.samplers.length - 1;
function addTexture(file) {
  const data = readFileSync(file);
  const pad = (4 - (binLen % 4)) % 4; if (pad) { binChunks.push(Buffer.alloc(pad)); binLen += pad; }
  json.bufferViews.push({ buffer: 0, byteOffset: binLen, byteLength: data.length });
  binChunks.push(data); binLen += data.length;
  json.images.push({ bufferView: json.bufferViews.length - 1, mimeType: 'image/jpeg', name: file.split('/').pop().replace(/\.\w+$/, '') });
  json.textures.push({ sampler, source: json.images.length - 1 });
  return json.textures.length - 1;
}
const TEX = KIT + 'tex/';
const side = GENERIC_TYRE ? [TEX + 'generic/tyre_sidewall_generic_basecolor.jpg', TEX + 'generic/tyre_sidewall_generic_normal.jpg'] : [TEX + 'tyre_sidewall_basecolor.jpg', TEX + 'tyre_sidewall_normal.jpg'];
const tex = {
  sideC: addTexture(side[0]), sideN: addTexture(side[1]),
  treadC: addTexture(TEX + 'tyre_tread_basecolor.jpg'), treadN: addTexture(TEX + 'tyre_tread_normal.jpg'), treadARM: addTexture(TEX + 'tyre_tread_arm.jpg'),
};
for (const m of json.materials) {
  if (m.name === 'tyre') {
    m.pbrMetallicRoughness.baseColorTexture = { index: tex.sideC };
    m.normalTexture = { index: tex.sideN, scale: 1 };
  } else if (m.name === 'tyre_tread') {
    m.pbrMetallicRoughness.baseColorTexture = { index: tex.treadC };
    m.pbrMetallicRoughness.metallicRoughnessTexture = { index: tex.treadARM };
    m.occlusionTexture = { index: tex.treadARM };
    m.normalTexture = { index: tex.treadN, scale: 1 };
  }
}
json.buffers[0].byteLength = binLen;
json.asset.extras = { note: 'carkit prep for M12; not for the repo as-is' };
const binOut = Buffer.concat(binChunks);
const binPad = Buffer.alloc((4 - (binOut.length % 4)) % 4);
let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
const binFinal = Buffer.concat([binOut, binPad]);
json.buffers[0].byteLength = binLen; // (padding excluded is fine: chunk may be larger than buffer)
const header = Buffer.alloc(12); header.write('glTF', 0); header.writeUInt32LE(2, 4);
const total2 = 12 + 8 + jsonBuf.length + 8 + binFinal.length; header.writeUInt32LE(total2, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(jsonBuf.length, 0); jh.write('JSON', 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(binFinal.length, 0); bh.writeUInt32LE(0x004e4942, 4);
writeFileSync(OUT, Buffer.concat([header, jh, jsonBuf, bh, binFinal]));
console.log('wrote', OUT, total2, 'bytes');
