/**
 * Rebuilds assets/models/sports-car.glb from the CC0 "Free Low Poly Vehicles Pack" by Rgsdev
 * (https://opengameart.org/content/free-low-poly-vehicles-pack). Run: pnpm assets:car
 *
 * The source is FBX only. This script downloads the pack, takes the "Sports" model, bakes its
 * transforms, scales it to metres, re-centres each wheel on its axle, smooths normals on gentle
 * curves (keeping sharp panel edges), renames parts and materials, and exports a GLB.
 * Materials are placeholders: the game assigns its own PBR materials by name at runtime.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { unzipSync } from 'three/examples/jsm/libs/fflate.module.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeVertices, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const SOURCE_URL =
  'https://opengameart.org/sites/default/files/free_low_poly_vehicles_pack_by_rgsdev.zip';
const SOURCE_SHA256 = '9091e478bd211a7cf8b562f04e8f061a2188d323e2fa0878f3f1641e5e67c800';
const MODEL_PATH = 'Free Low Poly Vehicles Pack by Rgsdev/Sports/Sports.fbx';
/** Source is in centimetres and a little oversized; 0.8 m per 100 units gives a ~4.6 m supercar. */
const SCALE = 0.008;
/** Faces meeting at less than this angle are shaded smooth. */
const CREASE_ANGLE = THREE.MathUtils.degToRad(32);

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CACHE = join(REPO_ROOT, 'node_modules', '.cache', 'gamergang', 'rgsdev-vehicles.zip');
const OUTPUT = join(REPO_ROOT, 'assets', 'models', 'sports-car.glb');

const MATERIAL_NAMES = {
  'body red': 'paint',
  'body black': 'trim',
  'body white': 'accent',
  windows: 'glass',
  headlights: 'headlight',
  'rear lights': 'taillight',
  wheels: 'rim',
  tires: 'tyre',
};

const WHEEL_NAMES = {
  Sports_wheel_front_left: 'wheel_fl',
  Sports_wheel_front_right: 'wheel_fr',
  Sports_wheel_rear_left: 'wheel_rl',
  Sports_wheel_rear_right: 'wheel_rr',
};

// GLTFExporter's binary path reads Blobs with FileReader, which Node does not have.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    void blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onload?.({ target: this });
      this.onloadend?.({ target: this });
    });
  }
};

async function loadZip() {
  let zip = await readFile(CACHE).catch(() => null);
  if (!zip) {
    const response = await fetch(SOURCE_URL);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    zip = Buffer.from(await response.arrayBuffer());
    await mkdir(dirname(CACHE), { recursive: true });
    await writeFile(CACHE, zip);
  }
  const hash = createHash('sha256').update(zip).digest('hex');
  if (hash !== SOURCE_SHA256) {
    console.warn(`Warning: source zip hash changed (${hash}). Check the license is still CC0.`);
  }
  return zip;
}

/**
 * The FBX splits the body into ~80 small groups, each a draw call. Reorder the triangles so each
 * material is one contiguous group: one draw call per material.
 */
function consolidateGroups(geometry) {
  const order = [...geometry.groups].sort(
    (a, b) => a.materialIndex - b.materialIndex || a.start - b.start,
  );
  const result = new THREE.BufferGeometry();
  const groups = [];
  for (const name of Object.keys(geometry.attributes)) {
    const source = geometry.attributes[name];
    const target = new Float32Array(source.array.length);
    let cursor = 0;
    for (const group of order) {
      const begin = group.start * source.itemSize;
      const end = (group.start + group.count) * source.itemSize;
      target.set(source.array.subarray(begin, end), cursor * source.itemSize);
      cursor += group.count;
    }
    result.setAttribute(name, new THREE.BufferAttribute(target, source.itemSize));
  }
  let cursor = 0;
  for (const group of order) {
    const last = groups.at(-1);
    if (last && last.materialIndex === group.materialIndex) last.count += group.count;
    else groups.push({ start: cursor, count: group.count, materialIndex: group.materialIndex });
    cursor += group.count;
  }
  for (const group of groups) result.addGroup(group.start, group.count, group.materialIndex);
  return result;
}

function bakeGeometry(mesh) {
  const geometry = mesh.geometry.clone();
  geometry.applyMatrix4(mesh.matrixWorld);
  geometry.scale(SCALE, SCALE, SCALE);
  geometry.deleteAttribute('uv');
  geometry.deleteAttribute('color');
  const merged = mergeVertices(geometry, 1e-4);
  merged.groups = geometry.groups;
  // Creasing returns non-indexed triangles in the same order, so the group ranges still line up.
  const creased = toCreasedNormals(merged, CREASE_ANGLE);
  creased.groups = geometry.groups;
  // Re-index to share vertices again (mergeVertices keeps the groups).
  return mergeVertices(consolidateGroups(creased), 1e-5);
}

function renamedMaterials(mesh) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.map((source) => {
    const name = MATERIAL_NAMES[source.name];
    if (!name) throw new Error(`Unexpected material "${source.name}"`);
    return new THREE.MeshStandardMaterial({ name, color: source.color });
  });
}

const zip = await loadZip();
const files = unzipSync(new Uint8Array(zip), { filter: (file) => file.name === MODEL_PATH });
const fbx = files[MODEL_PATH];
if (!fbx) throw new Error(`${MODEL_PATH} not found in the pack`);

const source = new FBXLoader().parse(
  fbx.buffer.slice(fbx.byteOffset, fbx.byteOffset + fbx.byteLength),
  '',
);
source.updateMatrixWorld(true);

const car = new THREE.Group();
car.name = 'sports-car';
source.traverse((object) => {
  if (!object.isMesh) return;
  const geometry = bakeGeometry(object);
  const wheelName = WHEEL_NAMES[object.name];
  const mesh = new THREE.Mesh(geometry, renamedMaterials(object));
  if (wheelName) {
    // Pivot each wheel on its own centre so the game can spin and steer it.
    geometry.computeBoundingBox();
    const centre = geometry.boundingBox.getCenter(new THREE.Vector3());
    geometry.translate(-centre.x, -centre.y, -centre.z);
    mesh.position.copy(centre);
    mesh.name = wheelName;
  } else {
    mesh.name = 'body';
  }
  car.add(mesh);
});

const box = new THREE.Box3().setFromObject(car);
console.log(
  'size (m):',
  box
    .getSize(new THREE.Vector3())
    .toArray()
    .map((n) => n.toFixed(2))
    .join(' x '),
);
for (const child of car.children) {
  console.log(
    child.name.padEnd(8),
    'at',
    child.position
      .toArray()
      .map((n) => n.toFixed(3))
      .join(', '),
  );
}

const glb = await new GLTFExporter().parseAsync(car, { binary: true });
await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, Buffer.from(glb));
console.log(`Wrote ${OUTPUT} (${(glb.byteLength / 1024).toFixed(0)} KB)`);
