/**
 * Texture atlases: the LOD1 kit (spec C2a.2 step 4) and the LOD0 atlases the packager builds when a
 * car has more materials than the draw-call budget allows. A cell holds one source material, its
 * maps cropped to the UV rectangle that material uses and its factors baked into the pixels;
 * factor-only materials become small solid cells. Every map of an atlas shares one layout.
 */
import { decodeImage, linearToSrgb, srgbToLinear, transformRaw } from './images.mjs';
import { compactMesh, surfaceArea, vertexCount } from './mesh.mjs';

/** Gutter around textured cells (pixels at full atlas size), filled by extending the edges. */
export const CELL_PADDING = 4;
/** Solid (factor-only) cells: a few pixels are enough; they are sampled at their centre. */
export const SOLID_CELL = 8;
/** Crop rectangles snap to this UV grid so every map of a material crops the same region. */
const CROP_GRID = 64;
/** A crop that keeps more than this share of the image keeps the whole image. */
const FULL_CROP_SHARE = 0.8;

export const MAP_KINDS = ['base', 'orm', 'normal', 'emissive'];

export function isTextured(material) {
  return Object.values(material.maps).some((image) => image !== null);
}

/**
 * Moves every triangle's UVs into the [0, 1] tile its centroid sits in (exact under repeat
 * wrapping), duplicating vertices shared by triangles in different tiles, then clamps. Returns the
 * mesh and the surface share of triangles that span a tile edge (those are clamped, not exact).
 */
export function wrapUvs(mesh) {
  if (!mesh.uvs) return { mesh, straddleShare: 0 };
  const { indices, uvs } = mesh;
  const count = vertexCount(mesh);
  const tileKey = new Map();
  const extra = [];
  const newIndices = new Uint32Array(indices.length);
  const shiftOf = [];
  let straddleArea = 0;
  for (let t = 0; t < indices.length; t += 3) {
    let cu = 0;
    let cv = 0;
    for (let k = 0; k < 3; k++) {
      cu += uvs[indices[t + k] * 2];
      cv += uvs[indices[t + k] * 2 + 1];
    }
    const su = Math.floor(cu / 3);
    const sv = Math.floor(cv / 3);
    let straddles = false;
    for (let k = 0; k < 3; k++) {
      const v = indices[t + k];
      const u = uvs[v * 2] - su;
      const w = uvs[v * 2 + 1] - sv;
      if (u < -0.01 || u > 1.01 || w < -0.01 || w > 1.01) straddles = true;
      const key = `${v}:${su}:${sv}`;
      let target = tileKey.get(key);
      if (target === undefined) {
        // First use of this vertex keeps its slot; other tiles get a copy.
        const firstUse = !shiftOf[v];
        target = firstUse ? v : count + extra.length;
        if (firstUse) shiftOf[v] = [su, sv];
        else extra.push([v, su, sv]);
        tileKey.set(key, target);
      }
      newIndices[t + k] = target;
    }
    if (straddles) {
      straddleArea += surfaceArea({
        positions: mesh.positions,
        indices: indices.subarray(t, t + 3),
      });
    }
  }
  const total = count + extra.length;
  const positions = new Float32Array(total * 3);
  const normals = new Float32Array(total * 3);
  const newUvs = new Float32Array(total * 2);
  positions.set(mesh.positions);
  normals.set(mesh.normals);
  for (let v = 0; v < count; v++) {
    const [su, sv] = shiftOf[v] ?? [0, 0];
    newUvs[v * 2] = clamp01(uvs[v * 2] - su);
    newUvs[v * 2 + 1] = clamp01(uvs[v * 2 + 1] - sv);
  }
  extra.forEach(([v, su, sv], i) => {
    const target = count + i;
    positions.set(mesh.positions.subarray(v * 3, v * 3 + 3), target * 3);
    normals.set(mesh.normals.subarray(v * 3, v * 3 + 3), target * 3);
    newUvs[target * 2] = clamp01(uvs[v * 2] - su);
    newUvs[target * 2 + 1] = clamp01(uvs[v * 2 + 1] - sv);
  });
  const area = surfaceArea(mesh);
  return {
    mesh: compactMesh({ positions, normals, uvs: newUvs, indices: newIndices }),
    straddleShare: area > 0 ? straddleArea / area : 0,
  };
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

/** The UV rectangle a material's meshes use, snapped to the crop grid (whole image if most of it). */
export function cropOf(meshes) {
  let u0 = 1;
  let v0 = 1;
  let u1 = 0;
  let v1 = 0;
  for (const mesh of meshes) {
    if (!mesh.uvs) continue;
    for (let i = 0; i < mesh.indices.length; i++) {
      const v = mesh.indices[i];
      const u = mesh.uvs[v * 2];
      const w = mesh.uvs[v * 2 + 1];
      if (u < u0) u0 = u;
      if (u > u1) u1 = u;
      if (w < v0) v0 = w;
      if (w > v1) v1 = w;
    }
  }
  if (u1 < u0) return { u0: 0, v0: 0, u1: 1, v1: 1 };
  const snap = (value, round) => Math.min(1, Math.max(0, round(value * CROP_GRID) / CROP_GRID));
  const crop = {
    u0: snap(u0 - 0.5 / CROP_GRID, Math.floor),
    v0: snap(v0 - 0.5 / CROP_GRID, Math.floor),
    u1: snap(u1 + 0.5 / CROP_GRID, Math.ceil),
    v1: snap(v1 + 0.5 / CROP_GRID, Math.ceil),
  };
  if ((crop.u1 - crop.u0) * (crop.v1 - crop.v0) > FULL_CROP_SHARE) return { u0: 0, v0: 0, u1: 1, v1: 1 };
  return crop;
}

/** Decodes source images once, at full size. */
export class ImageCache {
  constructor(images) {
    this.images = images;
    this.decoded = new Map();
  }

  get(index) {
    let raw = this.decoded.get(index);
    if (!raw) {
      raw = decodeImage(this.images[index].bytes);
      this.decoded.set(index, raw);
    }
    return raw;
  }

  /** Pixel size of a material's largest map. */
  largestMap(material) {
    let width = 0;
    let height = 0;
    for (const index of Object.values(material.maps)) {
      if (index === null) continue;
      const raw = this.get(index);
      if (raw.width * raw.height > width * height) {
        width = raw.width;
        height = raw.height;
      }
    }
    return { width, height };
  }
}

/** Crops a source image to a UV rectangle and resizes it to width x height. */
function croppedMap(cache, index, crop, width, height) {
  const raw = cache.get(index);
  const x0 = Math.round(crop.u0 * raw.width);
  const y0 = Math.round(crop.v0 * raw.height);
  const x1 = Math.max(x0 + 1, Math.round(crop.u1 * raw.width));
  const y1 = Math.max(y0 + 1, Math.round(crop.v1 * raw.height));
  const whole = x0 === 0 && y0 === 0 && x1 === raw.width && y1 === raw.height;
  if (whole && width === raw.width && height === raw.height) return raw;
  return transformRaw(raw, {
    crop: whole ? null : { x: x0, y: y0, width: x1 - x0, height: y1 - y0 },
    width,
    height,
  });
}

/**
 * The pixels of one cell for one map kind, factors baked in. `emissiveScale` divides emissive
 * colours so values above 1 (emissive strength) fit; the atlas material multiplies it back.
 */
export function cellPixels(cache, material, crop, width, height, kind, { emissiveScale = 1 } = {}) {
  const out = new Uint8Array(width * height * 4);
  const pixels = width * height;
  const maps = material.maps;
  if (kind === 'base') {
    const src = maps.base !== null ? croppedMap(cache, maps.base, crop, width, height).data : null;
    const [r, g, b] = material.color;
    for (let i = 0; i < pixels; i++) {
      const o = i * 4;
      if (src) {
        out[o] = linearToSrgb(srgbToLinear(src[o]) * r);
        out[o + 1] = linearToSrgb(srgbToLinear(src[o + 1]) * g);
        out[o + 2] = linearToSrgb(srgbToLinear(src[o + 2]) * b);
        out[o + 3] = Math.round(src[o + 3] * material.opacity);
      } else {
        out[o] = linearToSrgb(r);
        out[o + 1] = linearToSrgb(g);
        out[o + 2] = linearToSrgb(b);
        out[o + 3] = Math.round(255 * material.opacity);
      }
    }
  } else if (kind === 'orm') {
    const ao = maps.occlusion !== null ? croppedMap(cache, maps.occlusion, crop, width, height).data : null;
    const mr = maps.mr !== null ? croppedMap(cache, maps.mr, crop, width, height).data : null;
    const strength = material.occlusionStrength;
    for (let i = 0; i < pixels; i++) {
      const o = i * 4;
      out[o] = ao ? Math.round(255 - (255 - ao[o]) * strength) : 255;
      out[o + 1] = Math.round((mr ? mr[o + 1] : 255) * material.roughness);
      out[o + 2] = Math.round((mr ? mr[o + 2] : 255) * material.metalness);
      out[o + 3] = 255;
    }
  } else if (kind === 'normal') {
    const src = maps.normal !== null ? croppedMap(cache, maps.normal, crop, width, height).data : null;
    const scale = material.normalScale;
    for (let i = 0; i < pixels; i++) {
      const o = i * 4;
      if (!src) {
        out[o] = 128;
        out[o + 1] = 128;
        out[o + 2] = 255;
      } else if (scale === 1) {
        out[o] = src[o];
        out[o + 1] = src[o + 1];
        out[o + 2] = src[o + 2];
      } else {
        const x = (src[o] / 255) * 2 - 1;
        const y = (src[o + 1] / 255) * 2 - 1;
        const z = (src[o + 2] / 255) * 2 - 1;
        const nx = x * scale;
        const ny = y * scale;
        const length = Math.hypot(nx, ny, z) || 1;
        out[o] = Math.round(((nx / length + 1) / 2) * 255);
        out[o + 1] = Math.round(((ny / length + 1) / 2) * 255);
        out[o + 2] = Math.round(((z / length + 1) / 2) * 255);
      }
      out[o + 3] = 255;
    }
  } else if (kind === 'emissive') {
    const src = maps.emissive !== null ? croppedMap(cache, maps.emissive, crop, width, height).data : null;
    const [r, g, b] = material.emissive.map((value) => value / emissiveScale);
    for (let i = 0; i < pixels; i++) {
      const o = i * 4;
      if (src) {
        out[o] = linearToSrgb(srgbToLinear(src[o]) * r);
        out[o + 1] = linearToSrgb(srgbToLinear(src[o + 1]) * g);
        out[o + 2] = linearToSrgb(srgbToLinear(src[o + 2]) * b);
      } else {
        out[o] = linearToSrgb(r);
        out[o + 1] = linearToSrgb(g);
        out[o + 2] = linearToSrgb(b);
      }
      out[o + 3] = 255;
    }
  } else {
    throw new Error(`Unknown map kind ${kind}`);
  }
  return { width, height, data: out };
}

/**
 * Shelf-packs cells ({ key, width, height } in pixels, padding included) into width x height.
 * Returns key -> { x, y, width, height } or null if they do not fit. Deterministic order.
 */
export function shelfPack(cells, width, height) {
  const sorted = [...cells].sort(
    (a, b) => b.height - a.height || b.width - a.width || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
  const rects = new Map();
  let x = 0;
  let y = 0;
  let shelf = 0;
  for (const cell of sorted) {
    if (cell.width > width) return null;
    if (x + cell.width > width) {
      y += shelf;
      x = 0;
      shelf = 0;
    }
    if (y + cell.height > height) return null;
    rects.set(cell.key, { x, y, width: cell.width, height: cell.height });
    x += cell.width;
    shelf = Math.max(shelf, cell.height);
  }
  return rects;
}

/**
 * Lays out an atlas. `cells` are { key, textured, width, height } with the wanted inner size of
 * textured cells. With `fixedSize` the textured cells are scaled to fill that size; otherwise the
 * smallest power-of-two atlas up to `maxSize` that holds them at their wanted size is used, and
 * they are scaled down only if even `maxSize` is too small.
 */
export function layoutAtlas(cells, { fixedSize = null, maxSize = 2048, minCell = 32 }) {
  const sizes = [];
  if (fixedSize) {
    sizes.push([fixedSize, fixedSize]);
  } else {
    for (let w = 8; w <= maxSize; w *= 2) {
      for (const h of [w / 2, w]) if (h >= 8) sizes.push([w, h]);
    }
  }
  const textured = cells.filter((cell) => cell.textured);
  const wanted = textured.reduce((sum, cell) => sum + cell.width * cell.height, 0);
  // With a fixed size, start by filling it; otherwise start at the wanted size.
  let scale = fixedSize && wanted > 0 ? Math.sqrt((fixedSize * fixedSize * 0.9) / wanted) : 1;
  for (let attempt = 0; attempt < 200; attempt++) {
    const padded = cells.map((cell) => {
      if (!cell.textured) return { key: cell.key, width: SOLID_CELL, height: SOLID_CELL };
      const w = Math.max(minCell, Math.round((cell.width * scale) / 4) * 4);
      const h = Math.max(minCell, Math.round((cell.height * scale) / 4) * 4);
      return { key: cell.key, width: w + CELL_PADDING * 2, height: h + CELL_PADDING * 2 };
    });
    for (const [width, height] of sizes) {
      const area = padded.reduce((sum, cell) => sum + cell.width * cell.height, 0);
      if (area > width * height) continue;
      const rects = shelfPack(padded, width, height);
      if (rects) return { width, height, rects };
    }
    scale *= 0.92;
  }
  throw new Error('Atlas layout failed: too many cells');
}

/** The inner (unpadded) rectangle of a cell. */
export function innerRect(rect, textured) {
  if (!textured) return rect;
  return {
    x: rect.x + CELL_PADDING,
    y: rect.y + CELL_PADDING,
    width: rect.width - CELL_PADDING * 2,
    height: rect.height - CELL_PADDING * 2,
  };
}

/** Renders one map of an atlas: every cell's pixels, gutters filled by edge extension. */
export function renderAtlasMap(cache, layout, cells, kind, options) {
  const { width, height } = layout;
  const data = new Uint8Array(width * height * 4);
  // Unused space: neutral for the kind (normal flat, ORM unoccluded rough, others black).
  const fill =
    kind === 'normal' ? [128, 128, 255, 255] : kind === 'orm' ? [255, 255, 0, 255] : [0, 0, 0, 255];
  for (let i = 0; i < width * height; i++) data.set(fill, i * 4);
  for (const cell of cells) {
    const rect = layout.rects.get(cell.key);
    const inner = innerRect(rect, cell.textured);
    const pixels = cellPixels(
      cache,
      cell.material,
      cell.crop,
      cell.textured ? inner.width : 1,
      cell.textured ? inner.height : 1,
      kind,
      options,
    );
    for (let y = rect.y; y < rect.y + rect.height; y++) {
      const sy = Math.min(pixels.height - 1, Math.max(0, y - inner.y));
      for (let x = rect.x; x < rect.x + rect.width; x++) {
        const sx = Math.min(pixels.width - 1, Math.max(0, x - inner.x));
        const s = (sy * pixels.width + sx) * 4;
        const d = (y * width + x) * 4;
        data[d] = pixels.data[s];
        data[d + 1] = pixels.data[s + 1];
        data[d + 2] = pixels.data[s + 2];
        data[d + 3] = pixels.data[s + 3];
      }
    }
  }
  return { width, height, data };
}

/** Rewrites a mesh's UVs into its atlas cell (solid cells: the cell centre). */
export function remapUvs(mesh, layout, cell) {
  const rect = layout.rects.get(cell.key);
  const count = vertexCount(mesh);
  const uvs = new Float32Array(count * 2);
  if (!cell.textured || !mesh.uvs) {
    const u = (rect.x + rect.width / 2) / layout.width;
    const v = (rect.y + rect.height / 2) / layout.height;
    for (let i = 0; i < count; i++) {
      uvs[i * 2] = u;
      uvs[i * 2 + 1] = v;
    }
    return { ...mesh, uvs };
  }
  const inner = innerRect(rect, true);
  const { u0, v0, u1, v1 } = cell.crop;
  for (let i = 0; i < count; i++) {
    const u = (Math.min(u1, Math.max(u0, mesh.uvs[i * 2])) - u0) / (u1 - u0);
    const v = (Math.min(v1, Math.max(v0, mesh.uvs[i * 2 + 1])) - v0) / (v1 - v0);
    uvs[i * 2] = (inner.x + u * inner.width) / layout.width;
    uvs[i * 2 + 1] = (inner.y + v * inner.height) / layout.height;
  }
  return { ...mesh, uvs };
}

/** Largest emissive component of the materials (at least 1): the atlas material's emissive scale. */
export function emissiveScaleOf(materials) {
  let scale = 1;
  for (const material of materials) for (const value of material.emissive) scale = Math.max(scale, value);
  return scale;
}

/** True if any material has a map of this kind (ORM counts occlusion and metal-roughness). */
export function anyMap(materials, kind) {
  return materials.some((material) =>
    kind === 'orm'
      ? material.maps.mr !== null || material.maps.occlusion !== null
      : material.maps[kind] !== null,
  );
}

/** True if any material glows. */
export function anyEmissive(materials) {
  return materials.some((material) => material.maps.emissive !== null || material.emissive.some((v) => v > 0));
}
