// Builds muscle-car-concept.glb from the extracted FBX (ViktorKom, CC BY 4.0).
// - closes the doors, hood and trunk lid (posed open in the source) with fitted hinge rotations
// - splits wheels into wheel_fl/fr/rl/rr nodes at the axle (tyre, rim, brake disc) + caliper_* nodes
// - classifies every part into paint / trim / glass / mirror / headlight / taillight / plate /
//   interior / engine / chassis / rim / tyre / brake, keeping the two source PBR atlases
// - metres, car faces +Z, wheels on y=0, origin at the wheelbase midpoint
// usage: node build.mjs [--class]   (run from tools/)
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { THREE, KIT } from './common.mjs';
import { splitAll, subGeometry } from './split.mjs';
import { hingeMatrix } from './fitlib.mjs';
import { sample, isOrange, transparentTexels } from './sampler.mjs';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { injectTextures } from './inject.mjs';

const D = Math.PI / 180;
const comps = splitAll();
const V = () => new THREE.Vector3();
const centre = (box) => box.getCenter(V());

// ---------- panels posed open in the source: fitted hinge rotations (see fitpanel.mjs) ----------
function hinge(ax, x) {
  const base = ax === 'y' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const axis = base.applyEuler(new THREE.Euler(ax === 'y' ? x[3] * D : 0, ax === 'x' ? x[3] * D : 0, x[4] * D));
  const piv = ax === 'y' ? new THREE.Vector3(x[0], 100, x[1]) : new THREE.Vector3(0, x[0], x[1]);
  return hingeMatrix(piv, axis, x[2] * D);
}
const PANEL_FIT = {
  door_l: ['y', [90.508, 81.822, 54.014, 0.01, 0.004]],
  door_r: ['y', [-90.485, 81.911, -53.969, -0.059, 0.032]],
  hood: ['x', [123.528, 86.343, 47.233, 0.049, 0.293]],
  trunk: ['x', [121.563, -155.532, -74.949, 0.164, -0.281]],
};
const PANEL_M = Object.fromEntries(Object.entries(PANEL_FIT).map(([k, [ax, x]]) => [k, hinge(ax, x)]));
function panelOf(c) {
  const p = centre(c.box);
  if (c.id === 'Body12_low#2') return 'hood';
  if (['Body12_low#3', 'SmallDetails_low#46', 'SmallDetails_low#47'].includes(c.id)) return 'trunk';
  if (p.y > 45 && p.z > -25 && p.z < 85) { if (p.x > 95) return 'door_l'; if (p.x < -95) return 'door_r'; }
  return null;
}
// hood prop rod; hood hinge arms and trunk hinge brackets that would poke through the closed panels
const DELETE = new Set(['Symmetrical6B_low#3', 'Body12_low#8', 'Body12_low#9', 'Body12_low#10', 'Body12_low#11',
  'SmallDetails_low#48', 'SmallDetails_low#49', 'Back2B_low#0', 'Back2B_low#1', 'Back2B_low#2', 'Back2B_low#3',
  ...Array.from({ length: 18 }, (_, i) => `Bake3_low#${13 + i}`)]);

// ---------- wheels ----------
const tyres = comps.filter((c) => c.mesh === 'SmallDetails_low' && c.tris.length === 720);
const wheels = tyres.map((t) => {
  const c = centre(t.box); const s = t.box.getSize(V());
  return { name: `wheel_${c.z > 0 ? 'f' : 'r'}${c.x > 0 ? 'l' : 'r'}`, c, halfW: s.x / 2, radius: s.y / 2, width: s.x, tyre: t.id };
});
const groundY = Math.min(...tyres.map((t) => t.box.min.y));
const front = wheels.filter((w) => w.c.z > 0), rear = wheels.filter((w) => w.c.z < 0);
const zMid = (front[0].c.z + rear[0].c.z) / 2;
const WHEEL_MESHES = new Set(['SmallDetails_low', 'Below2B_low', 'BelowB_low', 'BoltsB_low', 'BelowBake_low', 'BrakeDisk_low']);
function wheelPart(c) {
  if (!WHEEL_MESHES.has(c.mesh)) return null;
  if (c.mesh === 'SmallDetails_low' && c.tris.length !== 720) return null;
  if (c.mesh === 'BelowBake_low' && ![110, 164].includes(c.tris.length)) return null;
  const p = centre(c.box);
  for (const w of wheels) {
    if (Math.abs(p.x - w.c.x) > w.halfW + 1.5) continue;
    if (Math.hypot(p.y - w.c.y, p.z - w.c.z) > 30) continue;
    if (c.mesh === 'SmallDetails_low') return { wheel: w, cat: 'tyre', group: w.name };
    if (c.mesh === 'BrakeDisk_low') return { wheel: w, cat: 'brake', group: w.name };
    if (c.mesh === 'BelowBake_low' && c.tris.length === 164) return { wheel: w, cat: 'brake', group: w.name.replace('wheel', 'caliper') };
    return { wheel: w, cat: 'rim', group: w.name };
  }
  return null;
}

// ---------- explicit categories ----------
const byMesh = (m) => (c) => c.mesh === m;
const GLASS = new Set(['BodyGlass_low', 'Bodyglass2_low', 'Bodyglass3_low']);
const TRIM_MESHES = new Set(['Body5B_low', 'Body6B_low', 'Body7B_low', 'Body8B_low', 'Body9B_low', 'Body13B_low']); // wipers
const TRIM_IDS = new Set(['Body3_low#0', 'Body3_low#1']); // door window frame posts
const PLATE = new Set(['SymmetricalX_low#0', 'Symmetrical13_low#0']);
const PAINT_SHELLS = new Set(['Body12_low#0', 'Body12_low#2', 'Body12_low#3', 'Body12_low#4', 'Body12_low#5',
  'Body12_low#15', 'Body12_low#16', 'Body12_low#17', 'Body12_low#18',
  'Body12_low#21', 'Body12_low#22', 'Body12_low#23', 'Body12_low#24', 'Symmetrical12_low#0', 'Symmetrical12_low#1',
  'Symmetrical14_low#0']);
const CHASSIS_MESHES = new Set(['PartsBelow_low', 'PartsBelow2B_low', 'PartsBelow3B_low', 'PartsBelow5_low', 'PartsBelow7_low', 'PartsBelow8B_low', 'Tubes_low', 'Tubes2_low', 'FuelTank_low', 'Val_low']);
const INTERIOR_MESHES = new Set(['Below3B_low', 'Carpet_low', 'Chair2B_low', 'Chair3B_low', 'Chair4B_low', 'Chair4_low', 'ChairB_low', 'Chest2B_low', 'ChestB_low', 'SteeringWheel3B_low', 'UnderChair_low', 'Underchair2_low', 'Doors9B_low']);

/** Zone category from a closed-pose point (cm, source frame). */
function zone(p) {
  const ax = Math.abs(p.x);
  if (p.z > 222 && ax > 33 && ax < 88 && p.y > 84 && p.y < 110) return 'headlight';
  if (p.z > 222 && ax > 74 && ax < 88 && p.y > 55 && p.y < 70) return 'headlight'; // front indicators
  if (p.z < -217 && ax > 30 && ax < 85 && p.y > 88 && p.y < 110) return 'taillight';
  if (ax < 86 && p.z > -137 && p.z < 92 && p.y > 56 && p.y < 166) return 'interior';
  if (ax < 92 && p.z >= 92 && p.z < 212 && p.y > 40 && p.y < 140) return 'engine';
  if (p.y < 58 && ax < 80 && p.z > -200 && p.z < 205) return 'chassis';
  return 'trim';
}

// ---------- classify ----------
const buckets = new Map(); // key group|cat|atlas -> [{g, idx}]
const stats = { deleted: 0, panels: {} };
function add(group, cat, atlas, g, idx) {
  if (cat === 'glass' || cat === 'mirror') atlas = 'X'; // untextured: one material regardless of atlas
  const k = `${group}|${cat}|${atlas}`; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push({ g, idx });
}
const TRI = (g, i) => { const p = g.attributes.position; return [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(p, i * 3 + k)); };
const TUV = (g, i) => { const u = g.attributes.uv; return [0, 1, 2].map((k) => [u.getX(i * 3 + k), u.getY(i * 3 + k)]); };
for (const c of comps) {
  if (DELETE.has(c.id)) { stats.deleted += c.tris.length; continue; }
  const atlas = c.mat === 'Bake' ? 'A' : 'B';
  const g = subGeometry(c.geo, c.tris);
  const n = c.tris.length; const all = [...Array(n).keys()];
  const wp = wheelPart(c);
  if (wp) { add(wp.group, wp.cat, atlas, g, all); continue; }
  const pan = panelOf(c);
  if (pan) { g.applyMatrix4(PANEL_M[pan]); stats.panels[pan] = (stats.panels[pan] || 0) + n; }
  g.computeBoundingBox(); const p = centre(g.boundingBox);
  let cat = null;
  if (GLASS.has(c.mesh)) cat = 'glass';
  else if (TRIM_MESHES.has(c.mesh) || TRIM_IDS.has(c.id)) cat = 'trim';
  else if (PLATE.has(c.id)) cat = 'plate';
  else if (CHASSIS_MESHES.has(c.mesh)) cat = 'chassis';
  else if (INTERIOR_MESHES.has(c.mesh)) cat = 'interior';
  if (cat) { add('body', cat, atlas, g, all); continue; }
  if (PAINT_SHELLS.has(c.id)) {
    for (const i of all) {
      const uv = TUV(g, i); const u = (uv[0][0] + uv[1][0] + uv[2][0]) / 3, v = (uv[0][1] + uv[1][1] + uv[2][1]) / 3;
      if (isOrange(sample(atlas, u, v))) { add('body', 'paint', atlas, g, [i]); continue; }
      const t = TRI(g, i); const tc = t[0].add(t[1]).add(t[2]).multiplyScalar(1 / 3);
      const z = zone(tc); add('body', z === 'headlight' || z === 'taillight' ? 'trim' : z, atlas, g, [i]);
    }
    continue;
  }
  add('body', zone(p), atlas, g, all);
}

// ---------- assemble ----------
const S = 0.01;
const toMetres = new THREE.Matrix4().makeScale(S, S, S).premultiply(new THREE.Matrix4().makeTranslation(0, -groundY * S, -zMid * S));
const wheelPos = Object.fromEntries(wheels.map((w) => [w.name, new THREE.Vector3(w.c.x, w.c.y, w.c.z).applyMatrix4(toMetres)]));
const TEXTURED = new Set(['paint', 'trim', 'interior', 'engine', 'chassis', 'headlight', 'taillight', 'plate', 'rim', 'tyre', 'brake']);
const EMISSIVE = new Set(['headlight', 'taillight', 'interior']);
const CLASS_COL = { paint: 0x2e8b57, trim: 0x444444, interior: 0xd2691e, headlight: 0xffff66, taillight: 0xff2222, plate: 0x3366ff, glass: 0x66ccff, mirror: 0xeeeeee, rim: 0xcccccc, tyre: 0x111111, brake: 0xaa00aa, chassis: 0x8b4513, engine: 0x9932cc };
const classMode = process.argv.includes('--class');

// split each bucket into opaque and cut-out triangles (alpha < 128 anywhere on the triangle)
const prims = new Map(); // key group|cat|atlas|cut -> geometry pieces
for (const [k, list] of buckets) {
  const [group, cat, atlas] = k.split('|');
  for (const { g, idx } of list) {
    const opaque = [], cut = [];
    for (const i of idx) {
      if (!TEXTURED.has(cat)) { opaque.push(i); continue; }
      const { count, area } = transparentTexels(atlas, TUV(g, i));
      (count >= Math.max(1, 0.02 * area) ? cut : opaque).push(i);
    }
    for (const [arr, cutFlag] of [[opaque, 0], [cut, 1]]) {
      if (!arr.length) continue; const kk = `${group}|${cat}|${atlas}|${cutFlag}`;
      if (!prims.has(kk)) prims.set(kk, []); prims.get(kk).push(subGeometry(g, arr));
    }
  }
}
// a handful of stray cut-out triangles is not worth a separate draw call: keep them opaque
for (const [k, list] of [...prims]) {
  if (!k.endsWith('|1')) continue;
  if (list.reduce((s, g) => s + g.attributes.position.count / 3, 0) >= 10) continue;
  const ok = k.slice(0, -1) + '0'; if (!prims.has(ok)) prims.set(ok, []); prims.get(ok).push(...list); prims.delete(k);
}

// material naming: plain category name for the atlas with most triangles, ".2" for the other
const catAtlasTris = {};
for (const [k, list] of prims) { const [, cat, atlas, cut] = k.split('|'); const id = `${cat}${cut === '1' ? '_cutout' : ''}`; catAtlasTris[id] ??= {}; catAtlasTris[id][atlas] = (catAtlasTris[id][atlas] || 0) + list.reduce((s, g) => s + g.attributes.position.count / 3, 0); }
const matName = (id, atlas) => { const t = catAtlasTris[id]; const atl = Object.keys(t); if (atl.length === 1) return id; const main = (t.A || 0) >= (t.B || 0) ? 'A' : 'B'; return atlas === main ? id : `${id}.2`; };

// cut-out materials get a PNG that keeps only the texels they use (see cutout_png.py)
if (!classMode) {
  const cutUV = {};
  for (const [k, list] of prims) { if (!k.endsWith('|1')) continue; const atlas = k.split('|')[2]; cutUV[atlas] ??= [];
    for (const g of list) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i += 3) cutUV[atlas].push([0, 1, 2].map((j) => [uv.getX(i + j), uv.getY(i + j)])); } }
  writeFileSync(KIT + 'work/cutout-uv.json', JSON.stringify(cutUV));
  console.log(execFileSync('python3', ['-I', KIT + 'tools/cutout_png.py', KIT + 'tex', KIT + 'work/cutout-uv.json']).toString().trim());
}
const materials = new Map(); const spec = {};
function material(cat, atlas, cut) {
  const id = `${cat}${cut ? '_cutout' : ''}`; const name = matName(id, atlas);
  if (materials.has(name)) return materials.get(name);
  let m;
  if (classMode) m = new THREE.MeshStandardMaterial({ name, color: CLASS_COL[cat] ?? 0xff00ff, roughness: 0.6, side: THREE.DoubleSide });
  else if (cat === 'glass') m = new THREE.MeshPhysicalMaterial({ name, color: 0x0c1116, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
  else if (cat === 'mirror') m = new THREE.MeshStandardMaterial({ name, color: 0xffffff, metalness: 1, roughness: 0.03 });
  else if (cat === 'paint') m = new THREE.MeshPhysicalMaterial({ name, color: 0xffffff, metalness: 1, roughness: 1, clearcoat: 1, clearcoatRoughness: 0.04 });
  else m = new THREE.MeshStandardMaterial({ name, color: 0xffffff, metalness: 1, roughness: 1 });
  if (!classMode && cut) { m.alphaTest = 0.5; m.side = THREE.DoubleSide; }
  if (!classMode && EMISSIVE.has(cat)) m.emissive = new THREE.Color(0xffffff);
  m.userData = { category: cat, atlas: atlas === 'A' ? 'CarV8E_low_Bake' : atlas === 'B' ? 'CarV8E_low_NotBake' : 'none' };
  if (!classMode && TEXTURED.has(cat)) {
    spec[name] = { baseColor: cut ? `${atlas}_basecolor_cutout.png` : `${atlas}_basecolor.jpg`, mr: `${atlas}_mr.jpg`, normal: `${atlas}_normal.png`, ...(EMISSIVE.has(cat) ? { emissive: `${atlas}_emissive.jpg` } : {}) };
  }
  materials.set(name, m); return m;
}

const root = new THREE.Group(); root.name = 'muscle_car_concept';
const groups = new Map();
const groupNode = (name) => {
  if (groups.has(name)) return groups.get(name);
  const o = new THREE.Group(); o.name = name;
  if (name !== 'body') { const w = wheelPos[name.replace('caliper', 'wheel')]; o.position.copy(w); }
  root.add(o); groups.set(name, o); return o;
};
const report = { nodes: [] };
const ORDER = ['paint', 'trim', 'glass', 'mirror', 'headlight', 'taillight', 'plate', 'interior', 'engine', 'chassis', 'tyre', 'rim', 'brake'];
const keys = [...prims.keys()].sort((a, b) => { const [ga, ca] = a.split('|'), [gb, cb] = b.split('|'); return ga === gb ? ORDER.indexOf(ca) - ORDER.indexOf(cb) : ga < gb ? -1 : 1; });
for (const k of keys) {
  const [group, cat, atlas, cut] = k.split('|');
  let g = mergeGeometries(prims.get(k));
  g.applyMatrix4(toMetres);
  const node = groupNode(group);
  if (group !== 'body') g.translate(-node.position.x, -node.position.y, -node.position.z);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  g = mergeVertices(g, 1e-6);
  const mat = material(cat, atlas, cut === '1');
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = group === 'body' ? mat.name : `${group}_${mat.name}`;
  node.add(mesh);
  report.nodes.push({ node: group, mesh: mesh.name, material: mat.name, tris: g.index.count / 3, verts: g.attributes.position.count });
}

const glb = await new GLTFExporter().parseAsync(root, { binary: true });
const out = classMode ? new Uint8Array(glb) : injectTextures(glb, spec, KIT + 'tex');
const file = classMode ? KIT + 'work/class.glb' : KIT + 'muscle-car-concept.glb';
writeFileSync(file, out);
const box = new THREE.Box3().setFromObject(root);
Object.assign(report, {
  file, bytes: out.length, groundY, zMid, deleted: stats.deleted, panelTris: stats.panels,
  bbox: { min: box.min.toArray().map((v) => +v.toFixed(3)), max: box.max.toArray().map((v) => +v.toFixed(3)) },
  wheels: wheels.map((w) => ({ name: w.name, pos: wheelPos[w.name].toArray().map((v) => +v.toFixed(4)), radius: +(w.radius * S).toFixed(4), width: +(w.width * S).toFixed(4) })),
  materials: [...materials.keys()], textures: spec,
  totalTris: report.nodes.reduce((s, n) => s + n.tris, 0), meshCount: report.nodes.length,
});
writeFileSync(KIT + 'tools/report' + (classMode ? '-class' : '') + '.json', JSON.stringify(report, null, 1));
console.log(file, out.length, 'tris', report.totalTris, 'meshes', report.meshCount, 'bbox', report.bbox);
for (const n of report.nodes) console.log(n.node.padEnd(12), n.mesh.padEnd(26), n.material.padEnd(18), n.tris);
