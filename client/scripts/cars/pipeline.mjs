/**
 * One car from source model to runtime GLB (spec C2a.2, contract 3.9):
 *   1. find the hubs, check the axes, re-centre on the axle midpoint and the ground;
 *   2. sort meshes into body, wheels and calipers (rear calipers join the body);
 *   3. LOD0: merge per (group, material), simplify hidden parts first if over budget, and pack the
 *      cheapest materials into one atlas while the draw calls are over budget;
 *   4. LOD1: simplified, remapped into the 1024 px kit atlas; calipers dropped;
 *   5. LOD2: paint plus a 64 px palette, wheels baked in at rest;
 *   6. shadow stand-in: LOD2 positions only;
 *   7. the GLB with the node and material names of 3.9.
 * Everything is ordered by name and uses fixed options, so the same input gives the same bytes.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  FrontSide,
  Group,
  LinearSRGBColorSpace,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
} from 'three';
import {
  ImageCache,
  MAP_KINDS,
  anyEmissive,
  anyMap,
  cropOf,
  emissiveScaleOf,
  isTextured,
  layoutAtlas,
  remapUvs,
  renderAtlasMap,
  wrapUvs,
} from './atlas.mjs';
import budgets from './budgets.json' with { type: 'json' };
import { CORNERS, HIDDEN_FAMILIES } from './classify.mjs';
import { exportGlb } from './glb.mjs';
import { ImageSet } from './imageset.mjs';
import { gpuBytes, linearToSrgb, srgbToLinear } from './images.mjs';
import {
  SIMPLIFY_PASSES,
  meshBounds,
  mergeMeshes,
  simplifyMesh,
  surfaceArea,
  translateMesh,
  triangleCount,
  weldMesh,
} from './mesh.mjs';

export const BUILDER = 'build-cars@1';

/** Simplification aims a little under each budget: the simplifier lands near, not on, a target. */
const TARGET_SHARE = 0.97;
/** LOD1 keeps fewer of the hidden families' triangles than of the outside's. */
const LOD1_HIDDEN_WEIGHT = 0.3;
/** Hidden families never drop below this share of their triangles at LOD0. */
const LOD0_HIDDEN_MIN = 0.1;
/** Wheel hub: use the mesh bounds when the node origin is further than this from their centre. */
const HUB_TOLERANCE = 0.002;
/** Axes check: the tyres must touch y = 0 within this. */
const GROUND_TOLERANCE = 0.05;
/** Paint texture rule (3.9): greyscale and light, so the TV's paint colour shows true. */
export const PAINT_MAX_SATURATION = 0.05;
export const PAINT_MIN_LUMINANCE = 0.6;
/** A paint texture that breaks the rule is turned grey and lifted to this mean luminance. */
const PAINT_TARGET_LUMINANCE = 0.8;
/** UV tile-straddling share (by area) above which a textured material gets a warning. */
const STRADDLE_WARN = 0.02;
/** Palette cells (LOD2): 8 px each in the 64 px palette, 4 px if a car has more than 64 colours. */
const PALETTE_CELL = 8;
/** LOD2 material for the palette: matte, so distant cars do not sparkle. */
const PALETTE_ROUGHNESS = 0.6;
/** LOD2 drops parts smaller than this share of the car's surface (invisible at 110 px). */
const LOD2_MIN_AREA_SHARE = 0.001;
const ROLE_ORDER = ['paint', 'opaque', 'cutout', 'glass', 'tail'];

function byName(a, b) {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : a.index - b.index;
}

function compareKeys(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function roleOf(material) {
  if (material.family === 'paint') return 'paint';
  if (material.family === 'light_tail') return 'tail';
  if (material.family === 'glass') return 'glass';
  if (material.cutout) return 'cutout';
  return 'opaque';
}

/** Two materials with the same key render identically and can share one draw call. */
function stateKey(material) {
  const role = roleOf(material);
  return JSON.stringify([
    role,
    material.family,
    material.color,
    role === 'glass' ? material.opacity : 1,
    material.metalness,
    material.roughness,
    material.emissive,
    role === 'cutout' ? material.alphaCutoff : 0,
    material.doubleSided,
    material.clearcoat,
    material.clearcoatRoughness,
    material.maps,
    material.normalScale,
    material.occlusionStrength,
  ]);
}

const sumTris = (meshes) => meshes.reduce((sum, mesh) => sum + triangleCount(mesh), 0);

/** Step 1: hubs, axes check and the re-centring offset. */
function measureWheels(source) {
  const hubs = {};
  const radii = {};
  const notes = [];
  for (const corner of CORNERS) {
    const meshes = source.parts.filter((part) => part.group === `wheel_${corner}`).map((p) => p.mesh);
    if (!meshes.length) throw new Error(`wheel_${corner} has no meshes`);
    const { min, max } = meshBounds(meshes);
    const centre = [0, 1, 2].map((axis) => (min[axis] + max[axis]) / 2);
    radii[corner] = Math.max(max[1] - min[1], max[2] - min[2]) / 2;
    const origin = source.wheelOrigins[corner];
    const off = Math.hypot(origin[0] - centre[0], origin[1] - centre[1], origin[2] - centre[2]);
    if (off > HUB_TOLERANCE) {
      notes.push(
        `wheel_${corner}: node origin is ${(off * 1000).toFixed(1)} mm off its meshes; using the mesh centre`,
      );
      hubs[corner] = centre;
    } else {
      hubs[corner] = origin;
    }
  }
  const { fl, fr, rl, rr } = hubs;
  const problems = [];
  if (!(fl[2] > rl[2] && fr[2] > rr[2])) problems.push('front wheels are not at +Z');
  if (!(fl[0] > fr[0] && rl[0] > rr[0])) problems.push('left wheels are not at +X');
  const ground = CORNERS.reduce((sum, c) => sum + hubs[c][1] - radii[c], 0) / 4;
  if (Math.abs(ground) > GROUND_TOLERANCE) problems.push(`tyres touch y = ${ground.toFixed(3)}, not 0`);
  if (problems.length) {
    throw new Error(
      `Axes check failed (expected +Y up, +Z forward, +X left, ground at 0): ${problems.join('; ')}`,
    );
  }
  const offset = [
    (fl[0] + fr[0] + rl[0] + rr[0]) / 4,
    ground,
    ((fl[2] + fr[2]) / 2 + (rl[2] + rr[2]) / 2) / 2,
  ];
  const centred = {};
  for (const corner of CORNERS) {
    centred[corner] = hubs[corner].map((value, axis) => value - offset[axis]);
  }
  return { hubs: centred, radii, offset, notes };
}

/** Step 2: per (group, material) buckets; wheel and front-caliper meshes are hub-local. */
function collectBuckets(source, wheels) {
  const byKey = new Map();
  for (const part of source.parts) {
    const material = source.materials[part.material];
    let group = part.group;
    const caliper = group.startsWith('caliper_');
    let shift = wheels.offset;
    if (group.startsWith('wheel_') || group === 'caliper_fl' || group === 'caliper_fr') {
      const hub = wheels.hubs[group.slice(-2)];
      shift = wheels.offset.map((value, axis) => value + hub[axis]);
    }
    // Rear calipers never steer: they become part of the body.
    if (group === 'caliper_rl' || group === 'caliper_rr') group = 'body';
    const key = `${group}|${caliper ? 'caliper' : ''}|${material.name}|${material.index}`;
    let bucket = byKey.get(key);
    if (!bucket) {
      bucket = { key, group, caliper, material, parts: [] };
      byKey.set(key, bucket);
    }
    bucket.parts.push(translateMesh(part.mesh, -shift[0], -shift[1], -shift[2]));
  }
  const buckets = [...byKey.values()].sort((a, b) => compareKeys(a.key, b.key));
  const straddle = new Map();
  for (const bucket of buckets) {
    const textured = isTextured(bucket.material);
    let mesh = mergeMeshes(bucket.parts.map((m) => (textured ? m : { ...m, uvs: null })));
    if (textured && !mesh.uvs) {
      throw new Error(`Material ${bucket.material.name} has textures but its meshes have no UVs`);
    }
    if (textured) {
      const wrapped = wrapUvs(mesh);
      mesh = wrapped.mesh;
      const area = surfaceArea(mesh);
      const entry = straddle.get(bucket.material.name) ?? { area: 0, straddle: 0 };
      entry.area += area;
      entry.straddle += wrapped.straddleShare * area;
      straddle.set(bucket.material.name, entry);
    }
    // Exact duplicate vertices (unindexed sources) cost bytes and stop the simplifier.
    bucket.mesh = weldMesh(mesh);
    bucket.area = surfaceArea(mesh);
    delete bucket.parts;
  }
  const warnings = [];
  for (const [name, entry] of [...straddle].sort((a, b) => compareKeys(a[0], b[0]))) {
    const share = entry.area > 0 ? entry.straddle / entry.area : 0;
    if (share > STRADDLE_WARN) {
      warnings.push(
        `${name}: ${(share * 100).toFixed(1)}% of its surface has UVs across a texture tile edge (clamped in atlases)`,
      );
    }
  }
  return { buckets, warnings };
}

/**
 * Simplifies meshes so their total is at most `budget`, sharing the cut by a weight per mesh.
 * Retries with a smaller ratio when the simplifier stops above its targets.
 */
function simplifyAll(items, budget, weightOf, options = {}) {
  const total = sumTris(items.map((item) => item.mesh));
  if (total <= budget) return items.map((item) => item.mesh);
  const target = budget * TARGET_SHARE;
  const weighted = items.reduce((sum, item) => sum + triangleCount(item.mesh) * weightOf(item), 0);
  let ratio = target / Math.max(1, weighted);
  let result = items.map((item) => item.mesh);
  for (let attempt = 0; attempt < 8; attempt++) {
    result = items.map((item) => {
      const tris = triangleCount(item.mesh);
      const share = Math.min(1, ratio * weightOf(item));
      const wanted = Math.max(Math.min(tris, 4), Math.floor(tris * share));
      return wanted >= tris ? item.mesh : simplifyMesh(item.mesh, wanted, options);
    });
    const got = sumTris(result);
    if (got <= budget) return result;
    ratio *= (target / got) * 0.95;
  }
  return result;
}

/** LOD0: hidden families give way first (down to LOD0_HIDDEN_MIN), then the outside. */
function simplifyLod0(buckets) {
  const budget = budgets.lod0.triangles;
  const total = sumTris(buckets.map((b) => b.mesh));
  if (total <= budget) return;
  const isHidden = (b) => HIDDEN_FAMILIES.has(b.material.family);
  const hidden = sumTris(buckets.filter(isHidden).map((b) => b.mesh));
  const visible = total - hidden;
  const target = budget * TARGET_SHARE;
  const hiddenShare =
    hidden > 0 ? Math.min(1, Math.max(LOD0_HIDDEN_MIN, (target - visible) / hidden)) : 1;
  const visibleShare = Math.min(1, (target - hidden * hiddenShare) / Math.max(1, visible));
  const meshes = simplifyAll(buckets, budget, (b) => (isHidden(b) ? hiddenShare : visibleShare));
  buckets.forEach((bucket, i) => {
    bucket.mesh = meshes[i];
  });
}

/** Samples a material's base colour texture at its triangles' centroids, weighted by area. */
function sampleBase(cache, material, meshes, visit) {
  const image = cache.get(material.maps.base);
  let total = 0;
  for (const mesh of meshes) {
    if (!mesh.uvs) continue;
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const area = surfaceArea({ positions: mesh.positions, indices: mesh.indices.subarray(t, t + 3) });
      if (area <= 0) continue;
      let u = 0;
      let v = 0;
      for (let k = 0; k < 3; k++) {
        u += mesh.uvs[mesh.indices[t + k] * 2] / 3;
        v += mesh.uvs[mesh.indices[t + k] * 2 + 1] / 3;
      }
      const x = Math.min(image.width - 1, Math.max(0, Math.floor(u * image.width)));
      const y = Math.min(image.height - 1, Math.max(0, Math.floor(v * image.height)));
      const o = (y * image.width + x) * 4;
      visit(image.data[o], image.data[o + 1], image.data[o + 2], area);
      total += area;
    }
  }
  return total;
}

/** Area-weighted mean base colour (linear RGB, factor applied) of a material. */
function meanColour(cache, material, meshes) {
  if (material.maps.base === null) return [...material.color];
  const sum = [0, 0, 0];
  const total = sampleBase(cache, material, meshes, (r, g, b, area) => {
    sum[0] += srgbToLinear(r) * area;
    sum[1] += srgbToLinear(g) * area;
    sum[2] += srgbToLinear(b) * area;
  });
  if (total <= 0) return [...material.color];
  return sum.map((value, c) => (value / total) * material.color[c]);
}

/** Mean saturation and luminance (0..1, sRGB values) of the paint texture where the paint is. */
export function paintStats(cache, material, meshes) {
  let saturation = 0;
  let luminance = 0;
  const total = sampleBase(cache, material, meshes, (r8, g8, b8, area) => {
    const r = r8 / 255;
    const g = g8 / 255;
    const b = b8 / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    saturation += (max > 0 ? (max - min) / max : 0) * area;
    luminance += (0.2126 * r + 0.7152 * g + 0.0722 * b) * area;
  });
  return total > 0 ? { saturation: saturation / total, luminance: luminance / total } : null;
}

/** Copies the crop rectangle of a raw image. */
function cropRaw(raw, crop) {
  const x0 = Math.round(crop.u0 * raw.width);
  const y0 = Math.round(crop.v0 * raw.height);
  const width = Math.max(1, Math.round(crop.u1 * raw.width) - x0);
  const height = Math.max(1, Math.round(crop.v1 * raw.height) - y0);
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = ((y0 + y) * raw.width + x0) * 4;
    data.set(raw.data.subarray(row, row + width * 4), y * width * 4);
  }
  return { width, height, data };
}

/** Rescales UVs from a crop rectangle to the full [0, 1] range. */
function cropUvs(mesh, crop) {
  const uvs = new Float32Array(mesh.uvs.length);
  for (let i = 0; i < uvs.length; i += 2) {
    uvs[i] = (Math.min(crop.u1, Math.max(crop.u0, mesh.uvs[i])) - crop.u0) / (crop.u1 - crop.u0);
    uvs[i + 1] =
      (Math.min(crop.v1, Math.max(crop.v0, mesh.uvs[i + 1])) - crop.v0) / (crop.v1 - crop.v0);
  }
  return { ...mesh, uvs };
}

/** Cells for an atlas: textured cells cropped to the UV rectangle they use. */
function atlasCells(materials, meshesOf, sizeOf) {
  return [...materials].sort(byName).map((material) => {
    const key = `m${String(material.index).padStart(3, '0')}`;
    if (!isTextured(material)) return { key, material, textured: false, crop: null, width: 8, height: 8 };
    const crop = cropOf(meshesOf(material));
    return { key, material, textured: true, crop, ...sizeOf(material, crop) };
  });
}

/** Renders an atlas's maps into the image set. Returns { textures, emissiveScale, layout, cellOf }. */
function buildAtlas(images, cache, prefix, cells, { fixedSize = null, alpha, lod0, hidden = false }) {
  const layout = layoutAtlas(cells, { fixedSize, maxSize: budgets.lod0.maxImagePx });
  const materials = cells.map((cell) => cell.material);
  const emissiveScale = emissiveScaleOf(materials);
  const textures = {};
  const anyTextured = cells.some((cell) => cell.textured);
  for (const kind of MAP_KINDS) {
    if (kind === 'normal' && !anyMap(materials, 'normal')) continue;
    if (kind === 'emissive' && !anyEmissive(materials)) continue;
    const raw = renderAtlasMap(cache, layout, cells, kind, { emissiveScale });
    // Solid-only atlases stay PNG (exact colours, tiny); the glass atlas needs alpha.
    const mimeType = (alpha && kind === 'base') || !anyTextured ? 'image/png' : 'image/jpeg';
    const key = images.addRaw(`${prefix}:${kind}`, `${prefix}_${kind}`, kind, raw, {
      lod0,
      hidden,
      mimeType,
    });
    if (kind === 'base') textures.base = key;
    if (kind === 'orm') {
      textures.mr = key;
      if (cells.some((cell) => cell.material.maps.occlusion !== null)) textures.occlusion = key;
    }
    if (kind === 'normal') textures.normal = key;
    if (kind === 'emissive') textures.emissive = key;
  }
  const cellOf = new Map(cells.map((cell) => [cell.material, cell]));
  return { textures, emissiveScale, layout, cellOf };
}

/** A material definition copied from a source material. */
function plainDef(name, material, family) {
  // Emissive above 1 (emissive strength) is carried by the intensity.
  const peak = Math.max(1, ...material.emissive);
  const role = roleOf(material);
  return {
    name,
    family,
    color: material.color,
    opacity: role === 'glass' ? material.opacity : 1,
    metalness: material.metalness,
    roughness: material.roughness,
    emissive: material.emissive.map((value) => value / peak),
    emissiveIntensity: peak,
    alphaMode: role === 'glass' ? 'BLEND' : role === 'cutout' ? 'MASK' : 'OPAQUE',
    alphaCutoff: material.alphaCutoff,
    doubleSided: material.doubleSided,
    clearcoat: material.clearcoat,
    clearcoatRoughness: material.clearcoatRoughness,
  };
}

/** A material definition for an atlas (factors are baked into its maps). */
function atlasDef(name, family, atlas, { alphaMode = 'OPAQUE', doubleSided = false } = {}) {
  const glows = atlas.textures.emissive !== undefined;
  return {
    name,
    family,
    color: [1, 1, 1],
    opacity: 1,
    metalness: 1,
    roughness: 1,
    emissive: glows ? [1, 1, 1] : [0, 0, 0],
    emissiveIntensity: glows ? atlas.emissiveScale : 1,
    alphaMode,
    alphaCutoff: 0.5,
    doubleSided,
    clearcoat: 0,
    clearcoatRoughness: 0,
  };
}

/** Step 3: LOD0 slots (output materials), their maps, and a UV mapper per source material. */
function buildLod0(buckets, cache, images, log) {
  const used = [...new Set(buckets.map((b) => b.material))].sort(byName);
  const slotsByKey = new Map();
  for (const material of used) {
    const key = stateKey(material);
    let slot = slotsByKey.get(key);
    if (!slot) {
      slot = { key, role: roleOf(material), materials: [], atlas: null };
      slotsByKey.set(key, slot);
    }
    slot.materials.push(material);
  }
  let slots = [...slotsByKey.values()];
  const paintSlots = slots.filter((slot) => slot.role === 'paint');
  if (paintSlots.length > 1) {
    throw new Error(
      `More than one distinct paint material: ${paintSlots.map((s) => s.materials[0].name).join(', ')}`,
    );
  }
  // Glass and tail lights: one material each (an atlas of their cells when there are several).
  for (const role of ['glass', 'tail']) {
    const group = slots.filter((slot) => slot.role === role);
    if (group.length > 1) {
      slots = slots.filter((slot) => slot.role !== role);
      slots.push({ key: `~${role}-atlas`, role, materials: group.flatMap((s) => s.materials), atlas: role });
    }
  }
  const slotOf = new Map();
  const assign = () => {
    slotOf.clear();
    for (const slot of slots) for (const material of slot.materials) slotOf.set(material, slot);
  };
  assign();
  const draws = () => new Set(buckets.map((b) => `${b.group}|${slotOf.get(b.material).key}`)).size;
  // Over the draw budget: pack the cheapest opaque materials into one atlas until it fits.
  const texels = (slot) =>
    slot.materials.reduce((sum, material) => {
      const { width, height } = cache.largestMap(material);
      return sum + width * height;
    }, 0);
  const candidates = slots
    .filter((slot) => slot.role === 'opaque')
    .map((slot) => ({ slot, cost: texels(slot), name: [...slot.materials].sort(byName)[0].name }))
    .sort((a, b) => a.cost - b.cost || compareKeys(a.name, b.name));
  const detail = { key: '~detail-atlas', role: 'opaque', materials: [], atlas: 'detail' };
  const before = draws();
  while (draws() > budgets.lod0.draws && candidates.length) {
    const { slot } = candidates.shift();
    slots = slots.filter((s) => s !== slot);
    detail.materials.push(...slot.materials);
    if (!slots.includes(detail)) slots.push(detail);
    assign();
  }
  if (draws() > budgets.lod0.draws) {
    throw new Error(
      `LOD0 needs ${draws()} draw calls even with every opaque material in one atlas (budget ${budgets.lod0.draws})`,
    );
  }
  if (detail.materials.length) {
    log(
      `LOD0 had ${before} draw calls (budget ${budgets.lod0.draws}); ${detail.materials.length} materials share one atlas`,
    );
  }

  // Names: vocabulary words; `.2` and up for repeats.
  const baseName = (slot) => {
    if (slot.atlas === 'detail') return 'trim';
    if (slot.atlas === 'glass') return 'glass';
    if (slot.atlas === 'tail') return 'taillight';
    // Named after its biggest member (by surface area).
    const area = (m) => buckets.filter((b) => b.material === m).reduce((sum, b) => sum + b.area, 0);
    const first = [...slot.materials].sort((a, b) => area(b) - area(a) || byName(a, b))[0];
    return `${first.base}${first.cutout ? '_cutout' : ''}`;
  };
  slots.sort(
    (a, b) =>
      ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) ||
      compareKeys(baseName(a), baseName(b)) ||
      compareKeys(a.key, b.key),
  );
  const taken = new Map();
  for (const slot of slots) {
    const base = baseName(slot);
    const n = (taken.get(base) ?? 0) + 1;
    taken.set(base, n);
    slot.name = n === 1 ? base : `${base}.${n}`;
    slot.family =
      slot.atlas === 'detail' ? 'trim' : slot.atlas === 'tail' ? 'light_tail' : slot.materials[0].family;
  }

  const meshesOf = (material) => buckets.filter((b) => b.material === material).map((b) => b.mesh);
  const defs = [];
  const textures = new Map();
  const uvMapper = new Map();
  for (const slot of slots) {
    const hidden = slot.materials.every((m) => HIDDEN_FAMILIES.has(m.family));
    const fileName = slot.name.replace('.', '_');
    if (slot.atlas) {
      const cells = atlasCells(slot.materials, meshesOf, (material, crop) => {
        const { width, height } = cache.largestMap(material);
        return {
          width: Math.max(32, Math.round((crop.u1 - crop.u0) * width)),
          height: Math.max(32, Math.round((crop.v1 - crop.v0) * height)),
        };
      });
      const alpha = slot.role === 'glass';
      const atlas = buildAtlas(images, cache, `${fileName}_atlas`, cells, { alpha, lod0: true, hidden });
      defs.push(
        atlasDef(slot.name, slot.family, atlas, {
          alphaMode: alpha ? 'BLEND' : 'OPAQUE',
          doubleSided: slot.materials.some((m) => m.doubleSided),
        }),
      );
      textures.set(slot.name, atlas.textures);
      for (const material of slot.materials) {
        const cell = atlas.cellOf.get(material);
        uvMapper.set(material, (mesh) => remapUvs(mesh, atlas.layout, cell));
      }
      continue;
    }
    const material = slot.materials[0];
    const def = plainDef(slot.name, material, slot.family);
    const slotTextures = {};
    let mapper = (mesh) => mesh;
    const mapNames = { base: 'basecolor', mr: 'orm', normal: 'normal', occlusion: 'orm', emissive: 'emissive' };
    const kindOf = (slotKey) =>
      slotKey === 'base' || slotKey === 'normal' || slotKey === 'emissive' ? slotKey : 'orm';
    const stats =
      slot.role === 'paint' && material.maps.base !== null
        ? paintStats(cache, material, slot.materials.flatMap(meshesOf))
        : null;
    if (stats && (stats.saturation >= PAINT_MAX_SATURATION || stats.luminance <= PAINT_MIN_LUMINANCE)) {
      // The paint gets its own greyscale maps, cropped to the area it uses.
      const crop = cropOf(slot.materials.flatMap(meshesOf));
      const base = cropRaw(cache.get(material.maps.base), crop);
      const gain = Math.max(1, PAINT_TARGET_LUMINANCE / Math.max(0.05, stats.luminance));
      for (let i = 0; i < base.data.length; i += 4) {
        const l = 0.2126 * base.data[i] + 0.7152 * base.data[i + 1] + 0.0722 * base.data[i + 2];
        const value = Math.min(255, Math.round(l * gain));
        base.data[i] = value;
        base.data[i + 1] = value;
        base.data[i + 2] = value;
        base.data[i + 3] = 255;
      }
      slotTextures.base = images.addRaw('paint:base', 'paint_basecolor', 'base', base, {
        lod0: true,
        mimeType: 'image/jpeg',
      });
      for (const slotKey of ['mr', 'normal', 'occlusion', 'emissive']) {
        const index = material.maps[slotKey];
        if (index === null) continue;
        const key = `paint:${String(index).padStart(3, '0')}`;
        if (!images.entries.has(key)) {
          const mimeType = cache.images[index].mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
          images.addRaw(key, `paint_${mapNames[slotKey]}`, kindOf(slotKey), cropRaw(cache.get(index), crop), {
            lod0: true,
            mimeType,
          });
        }
        slotTextures[slotKey] = key;
      }
      mapper = (mesh) => cropUvs(mesh, crop);
      log(
        `paint texture is not a light greyscale (saturation ${stats.saturation.toFixed(2)}, ` +
          `luminance ${stats.luminance.toFixed(2)}): made a greyscale copy`,
      );
    } else {
      for (const [slotKey, index] of Object.entries(material.maps)) {
        if (index === null) continue;
        slotTextures[slotKey] = images.addSource(index, `${fileName}_${mapNames[slotKey]}`, kindOf(slotKey), {
          hidden,
        });
      }
    }
    if (Object.keys(slotTextures).length) textures.set(slot.name, slotTextures);
    defs.push(def);
    for (const m of slot.materials) uvMapper.set(m, mapper);
  }
  return { slots, slotOf, defs, textures, uvMapper };
}

/** Turns a material definition into a three material for the exporter. */
function makeMaterial(def) {
  const params = {
    name: def.name,
    color: new Color().setRGB(def.color[0], def.color[1], def.color[2], LinearSRGBColorSpace),
    metalness: def.metalness,
    roughness: def.roughness,
    emissive: new Color().setRGB(def.emissive[0], def.emissive[1], def.emissive[2], LinearSRGBColorSpace),
    emissiveIntensity: def.emissiveIntensity,
    side: def.doubleSided ? DoubleSide : FrontSide,
    transparent: def.alphaMode === 'BLEND',
    opacity: def.opacity,
    alphaTest: def.alphaMode === 'MASK' ? def.alphaCutoff : 0,
  };
  const material =
    def.clearcoat > 0
      ? new MeshPhysicalMaterial({
          ...params,
          clearcoat: def.clearcoat,
          clearcoatRoughness: def.clearcoatRoughness,
        })
      : new MeshStandardMaterial(params);
  material.userData = { family: def.family, packKey: def.packKey ?? def.name };
  return material;
}

function geometryOf(mesh, { positionsOnly = false } = {}) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(mesh.positions, 3));
  if (!positionsOnly) {
    const normals = mesh.normals.slice();
    for (let i = 0; i < normals.length; i += 3) {
      const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
      if (length > 1e-6) {
        normals[i] /= length;
        normals[i + 1] /= length;
        normals[i + 2] /= length;
      } else {
        normals[i] = 0;
        normals[i + 1] = 1;
        normals[i + 2] = 0;
      }
    }
    geometry.setAttribute('normal', new BufferAttribute(normals, 3));
    if (mesh.uvs) geometry.setAttribute('uv', new BufferAttribute(mesh.uvs, 2));
  }
  const count = mesh.positions.length / 3;
  const indices = count < 65536 ? Uint16Array.from(mesh.indices) : mesh.indices;
  geometry.setIndex(new BufferAttribute(indices, 1));
  return geometry;
}

function meshNode(name, mesh, material, options) {
  const node = new Mesh(geometryOf(mesh, options), material);
  node.name = name;
  return node;
}

/**
 * Builds one car. `source` comes from source.mjs (or the placeholder builder); returns the GLB
 * bytes and the report numbers.
 */
export async function buildCar({ id, source, sourceSha256, copyright, placeholder = false, log = () => undefined }) {
  const wheels = measureWheels(source);
  for (const note of wheels.notes) log(note);
  const { buckets, warnings } = collectBuckets(source, wheels);
  const cache = new ImageCache(source.images);
  const images = new ImageSet(source.images);
  const sourceTris = sumTris(buckets.map((b) => b.mesh));

  // --- LOD0 ---
  simplifyLod0(buckets);
  const lod0 = buildLod0(buckets, cache, images, log);
  const materials = new Map();
  for (const def of lod0.defs) materials.set(def.name, makeMaterial(def));
  const textures = new Map(lod0.textures);
  const lod0Meshes = new Map();
  for (const bucket of buckets) {
    const slot = lod0.slotOf.get(bucket.material);
    const key = `${bucket.group}|${slot.name}`;
    const list = lod0Meshes.get(key) ?? [];
    list.push(lod0.uvMapper.get(bucket.material)(bucket.mesh));
    lod0Meshes.set(key, list);
  }

  // --- LOD1: paint (factors only), kit, glass, light_tail; calipers dropped ---
  const lod1Buckets = buckets.filter((b) => !b.caliper);
  const lod1Simplified = simplifyAll(lod1Buckets, budgets.lod1.triangles, (b) =>
    HIDDEN_FAMILIES.has(b.material.family) ? LOD1_HIDDEN_WEIGHT : 1,
  );
  const lod1Of = new Map(lod1Buckets.map((bucket, i) => [bucket, lod1Simplified[i]]));
  const kitMaterials = [...new Set(lod1Buckets.map((b) => b.material))]
    .filter((m) => roleOf(m) !== 'paint' && roleOf(m) !== 'glass')
    .sort(byName);
  const areaOf = (material) =>
    buckets.filter((b) => b.material === material).reduce((sum, b) => sum + b.area, 0);
  const texturedArea = kitMaterials.filter(isTextured).reduce((sum, m) => sum + areaOf(m), 0) || 1;
  const kitCells = atlasCells(
    kitMaterials,
    (material) => lod1Buckets.filter((b) => b.material === material).map((b) => lod1Of.get(b)),
    (material, crop) => {
      // Cell area follows the material's surface area; its shape follows the cropped texture.
      const { width, height } = cache.largestMap(material);
      const aspect = ((crop.u1 - crop.u0) * width) / Math.max(1e-6, (crop.v1 - crop.v0) * height);
      const share = Math.max(1e-4, areaOf(material) / texturedArea);
      return { width: Math.sqrt(share * aspect) * 1000, height: Math.sqrt(share / aspect) * 1000 };
    },
  );
  // The kit is 1024 px when it holds textures; solid colours alone need only a few pixels.
  const kit = buildAtlas(images, cache, 'kit', kitCells, {
    fixedSize: kitCells.some((cell) => cell.textured) ? budgets.lod1.kitPx : null,
    alpha: false,
    lod0: false,
  });
  materials.set('kit', makeMaterial(atlasDef('kit', 'kit', kit)));
  textures.set('kit', kit.textures);
  const hasTail = kitMaterials.some((m) => roleOf(m) === 'tail');
  if (hasTail) {
    materials.set('light_tail', makeMaterial({ ...atlasDef('light_tail', 'light_tail', kit), packKey: 'light_tail' }));
    textures.set('light_tail', kit.textures);
  }
  const paintSlot = lod0.slots.find((slot) => slot.role === 'paint');
  // LOD1/LOD2 paint: the LOD0 finish without its maps, so Low never uploads LOD0 textures.
  let paintFar = null;
  if (paintSlot) {
    paintFar = textures.has(paintSlot.name)
      ? makeMaterial({ ...plainDef('paint', paintSlot.materials[0], 'paint'), packKey: 'paint~far' })
      : materials.get(paintSlot.name);
  }
  const glassSlot = lod0.slots.find((slot) => slot.role === 'glass');
  const lod1Meshes = new Map();
  for (const bucket of lod1Buckets) {
    const role = roleOf(bucket.material);
    let name;
    let mesh = lod1Of.get(bucket);
    if (role === 'paint') {
      name = 'paint';
      mesh = { ...mesh, uvs: null };
    } else if (role === 'glass') {
      name = 'glass';
      mesh = lod0.uvMapper.get(bucket.material)(mesh);
    } else {
      name = role === 'tail' ? 'light_tail' : 'kit';
      mesh = remapUvs(mesh, kit.layout, kit.cellOf.get(bucket.material));
    }
    const key = `${bucket.group}|${name}`;
    const list = lod1Meshes.get(key) ?? [];
    list.push(mesh);
    lod1Meshes.set(key, list);
  }

  // --- LOD2: paint + palette, wheels baked in at rest; no calipers, no interior ---
  const lod2Buckets = buckets.filter((b) => !b.caliper && !HIDDEN_FAMILIES.has(b.material.family));
  const paletteMaterials = [...new Set(lod2Buckets.map((b) => b.material))]
    .filter((m) => roleOf(m) !== 'paint')
    .sort(byName);
  const paletteSize = budgets.lod2.palettePx;
  const cell = paletteMaterials.length <= (paletteSize / PALETTE_CELL) ** 2 ? PALETTE_CELL : PALETTE_CELL / 2;
  const perRow = paletteSize / cell;
  if (paletteMaterials.length > perRow * perRow) throw new Error('Too many materials for the LOD2 palette');
  const palette = new Uint8Array(paletteSize * paletteSize * 4);
  const paletteUv = new Map();
  paletteMaterials.forEach((material, i) => {
    const cx = (i % perRow) * cell;
    const cy = Math.floor(i / perRow) * cell;
    const colour = meanColour(cache, material, buckets.filter((b) => b.material === material).map((b) => b.mesh));
    if (process.env.CARS_DEBUG) console.log('palette', material.name, colour.map(linearToSrgb).join(','));
    let rgb = colour.map(linearToSrgb);
    if (process.env.CARS_DEBUG_PALETTE) {
      const hues = [[255,0,0],[0,255,0],[0,0,255],[255,255,0],[255,0,255],[0,255,255],[255,128,0],[128,0,255],[0,128,64],[128,64,0],[255,160,200],[90,90,90],[200,255,120],[0,60,160],[160,0,60],[255,255,255]];
      rgb = hues[i % hues.length];
      console.log('debug colour', material.name, rgb.join(','));
    }
    for (let y = cy; y < cy + cell; y++) {
      for (let x = cx; x < cx + cell; x++) palette.set([rgb[0], rgb[1], rgb[2], 255], (y * paletteSize + x) * 4);
    }
    paletteUv.set(material, [(cx + cell / 2) / paletteSize, (cy + cell / 2) / paletteSize]);
  });
  const paletteKey = images.addRaw('palette', 'palette', 'base', { width: paletteSize, height: paletteSize, data: palette }, {
    lod0: false,
    mimeType: 'image/png',
  });
  materials.set(
    'palette',
    makeMaterial({
      name: 'palette',
      family: 'palette',
      color: [1, 1, 1],
      opacity: 1,
      metalness: 0,
      roughness: PALETTE_ROUGHNESS,
      emissive: [0, 0, 0],
      emissiveIntensity: 1,
      alphaMode: 'OPAQUE',
      alphaCutoff: 0.5,
      doubleSided: false,
      clearcoat: 0,
      clearcoatRoughness: 0,
    }),
  );
  textures.set('palette', { base: paletteKey });
  const atRest = (bucket, mesh) => {
    if (!bucket.group.startsWith('wheel_')) return mesh;
    const hub = wheels.hubs[bucket.group.slice(-2)];
    return translateMesh(mesh, hub[0], hub[1], hub[2]);
  };
  // Each part is simplified on its own (a merged soup of open panels tears), with triangles shared
  // out by surface area: big smooth panels keep their shape, dense small details give way.
  const mode = process.env.CARS_LOD2 ?? 'A';
  const lod2Passes = mode === 'A' ? [['LockBorder'], []] : SIMPLIFY_PASSES;
  const lod2Input = lod2Buckets.map((bucket) => ({ bucket, mesh: atRest(bucket, lod1Of.get(bucket)) }));
  const lod2Area = lod2Input.reduce((sum, item) => sum + item.bucket.area, 0) || 1;
  const lod2Kept = lod2Input.filter((item) => item.bucket.area >= lod2Area * LOD2_MIN_AREA_SHARE);
  const lod2Simplified = simplifyAll(
    lod2Kept,
    budgets.lod2.triangles,
    (item) => item.bucket.area / Math.max(1, triangleCount(item.mesh)),
    { passes: lod2Passes, sloppyAllowed: mode === 'C' },
  );
  const lod2Paint = [];
  const lod2Palette = [];
  lod2Kept.forEach(({ bucket }, i) => {
    const mesh = lod2Simplified[i];
    if (roleOf(bucket.material) === 'paint') {
      lod2Paint.push({ ...mesh, uvs: null });
    } else {
      const [u, v] = paletteUv.get(bucket.material);
      const uvs = new Float32Array((mesh.positions.length / 3) * 2);
      for (let k = 0; k < uvs.length; k += 2) {
        uvs[k] = u;
        uvs[k + 1] = v;
      }
      lod2Palette.push({ ...mesh, uvs });
    }
  });
  const lod2Items = [];
  if (lod2Paint.length) lod2Items.push({ name: 'paint', mesh: mergeMeshes(lod2Paint) });
  if (lod2Palette.length) lod2Items.push({ name: 'palette', mesh: mergeMeshes(lod2Palette) });

  // --- Shadow stand-in: LOD2 positions only ---
  const shadowSource = mergeMeshes(
    lod2Items.map(({ mesh }) => ({
      positions: mesh.positions,
      normals: new Float32Array(mesh.positions.length),
      uvs: null,
      indices: mesh.indices,
    })),
  );
  const shadowMesh = simplifyAll([{ mesh: weldMesh(shadowSource) }], budgets.shadow.triangles, () => 1, {
    sloppyAllowed: true,
  })[0];

  // --- Scene ---
  const root = new Group();
  root.name = `car_${id}`;
  const addLevel = (parent, name, entries) => {
    const group = new Group();
    group.name = name;
    for (const [materialName, meshes] of entries) {
      group.add(meshNode(materialName, mergeMeshes(meshes), materials.get(materialName)));
    }
    parent.add(group);
    return group;
  };
  const entriesFor = (meshMap, group, order) =>
    [...meshMap]
      .filter(([key]) => key.startsWith(`${group}|`))
      .map(([key, meshes]) => [key.slice(group.length + 1), meshes])
      .sort((a, b) => order(a[0]) - order(b[0]) || compareKeys(a[0], b[0]));
  const lod0Order = (name) => lod0.slots.findIndex((slot) => slot.name === name);
  const lod1Order = (name) => ['paint', 'kit', 'glass', 'light_tail'].indexOf(name);
  const lod1Material = (name) => (name === 'paint' ? paintFar : materials.get(name));

  addLevel(root, 'body_lod0', entriesFor(lod0Meshes, 'body', lod0Order));
  const body1 = new Group();
  body1.name = 'body_lod1';
  for (const [name, meshes] of entriesFor(lod1Meshes, 'body', lod1Order)) {
    body1.add(meshNode(name, mergeMeshes(meshes), lod1Material(name)));
  }
  root.add(body1);
  const body2 = new Group();
  body2.name = 'body_lod2';
  lod2Items.forEach((item) => {
    const material = item.name === 'paint' ? paintFar : materials.get('palette');
    body2.add(meshNode(item.name, item.mesh, material));
  });
  root.add(body2);
  for (const corner of CORNERS) {
    const wheel = new Group();
    wheel.name = `wheel_${corner}`;
    wheel.position.fromArray(wheels.hubs[corner]);
    addLevel(wheel, `wheel_${corner}_lod0`, entriesFor(lod0Meshes, `wheel_${corner}`, lod0Order));
    const wheelLod1 = entriesFor(lod1Meshes, `wheel_${corner}`, lod1Order).flatMap(([, meshes]) => meshes);
    // Wheels are one kit mesh at LOD1 (a paint or glass part on a wheel goes to the kit too).
    const kitMeshes = wheelLod1.map((mesh) => (mesh.uvs ? mesh : { ...mesh, uvs: new Float32Array((mesh.positions.length / 3) * 2) }));
    wheel.add(meshNode(`wheel_${corner}_lod1`, mergeMeshes(kitMeshes), materials.get('kit')));
    root.add(wheel);
  }
  for (const corner of ['fl', 'fr']) {
    const entries = entriesFor(lod0Meshes, `caliper_${corner}`, lod0Order);
    if (!entries.length) continue;
    const caliper = new Group();
    caliper.name = `caliper_${corner}`;
    caliper.position.fromArray(wheels.hubs[corner]);
    addLevel(caliper, `caliper_${corner}_lod0`, entries);
    root.add(caliper);
  }
  const shadowMaterial = new MeshStandardMaterial({ name: 'shadow' });
  shadowMaterial.userData = { family: 'shadow', packKey: 'shadow' };
  root.add(meshNode('shadow', shadowMesh, shadowMaterial, { positionsOnly: true }));

  // --- Images, GLB, budgets ---
  const shrunk = images.fitLod0();
  for (const line of shrunk) log(line);
  const asset = {
    version: '2.0',
    generator: BUILDER,
    copyright,
    extras: { carId: id, sourceSha256, builder: BUILDER, ...(placeholder ? { placeholder: true } : {}) },
  };
  const texturesByPackKey = new Map();
  for (const [name, slots] of textures) texturesByPackKey.set(materials.get(name)?.userData.packKey ?? name, slots);
  let glb = await exportGlb(root, { asset, textures: texturesByPackKey, images: images.list() });
  while (glb.length > budgets.fileBytes) {
    const line = images.halveLargest();
    if (!line) break;
    log(line);
    glb = await exportGlb(root, { asset, textures: texturesByPackKey, images: images.list() });
  }

  const report = makeReport({ root, glb, images, wheels, sourceTris, warnings, textures, materials });
  root.traverse((object) => {
    if (object instanceof Mesh) object.geometry.dispose();
  });
  return { glb, report };
}

function makeReport({ root, glb, images, wheels, sourceTris, warnings, textures, materials }) {
  const level = (filter) => {
    let tris = 0;
    let draws = 0;
    root.traverse((object) => {
      if (!(object instanceof Mesh) || !filter(object)) return;
      tris += object.geometry.index.count / 3;
      draws++;
    });
    return { tris, draws };
  };
  const inLevel = (object, suffix) => {
    for (let node = object.parent; node; node = node.parent) if (node.name.endsWith(suffix)) return true;
    return object.name.endsWith(suffix);
  };
  const lod0 = level((o) => inLevel(o, '_lod0'));
  const lod1 = level((o) => inLevel(o, '_lod1'));
  const lod2 = level((o) => inLevel(o, '_lod2'));
  const shadow = level((o) => o.name === 'shadow');
  // Body size from LOD0 body plus wheels at rest.
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!(object instanceof Mesh) || !inLevel(object, '_lod0')) return;
    const position = object.geometry.getAttribute('position');
    const e = object.matrixWorld.elements;
    for (let i = 0; i < position.count; i++) {
      const p = [position.getX(i) + e[12], position.getY(i) + e[13], position.getZ(i) + e[14]];
      for (let axis = 0; axis < 3; axis++) {
        bounds.min[axis] = Math.min(bounds.min[axis], p[axis]);
        bounds.max[axis] = Math.max(bounds.max[axis], p[axis]);
      }
    }
  });
  const lod1Keys = [...new Set([...(textures.get('kit') ? Object.values(textures.get('kit')) : [])])];
  const glassName = [...materials.keys()].find((name) => name === 'glass');
  if (glassName && textures.get(glassName)) lod1Keys.push(...Object.values(textures.get(glassName)));
  return {
    sourceTris,
    lod0,
    lod1,
    lod2,
    shadow,
    fileBytes: glb.length,
    gpuLod0: images.lod0Gpu(),
    gpuLod1: images.gpuOf(lod1Keys),
    images: images.sorted().map((e) => ({ name: e.name, width: e.width, height: e.height, mimeType: e.encodedMime, bytes: e.bytes?.length ?? 0, lod0: e.lod0 })),
    hubs: wheels.hubs,
    radii: wheels.radii,
    size: {
      length: bounds.max[2] - bounds.min[2],
      width: bounds.max[0] - bounds.min[0],
      height: bounds.max[1],
    },
    warnings,
  };
}

export { gpuBytes };
