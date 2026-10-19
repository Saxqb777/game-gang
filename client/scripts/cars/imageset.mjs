/**
 * The images a runtime GLB carries: source images kept byte-for-byte where possible, generated maps
 * (atlases, derived paint maps, the palette) encoded once. Sizes are fitted to the LOD0 limits here.
 */
import budgets from './budgets.json' with { type: 'json' };
import {
  encodeImage,
  gpuBytes,
  hasAlpha,
  imageSize,
  resizeEncoded,
  transformRaw,
} from './images.mjs';

/** Images below this many pixels are never halved (they cost nothing). */
const MIN_HALVE_PIXELS = 128 * 128;

export class ImageSet {
  constructor(sourceImages) {
    this.sourceImages = sourceImages;
    this.entries = new Map();
  }

  /** A source image by index; `lod0` and `hidden` accumulate over every material that uses it. */
  addSource(index, name, kind, { hidden, lod0 = true }) {
    const key = `src:${String(index).padStart(3, '0')}`;
    const existing = this.entries.get(key);
    if (existing) {
      existing.hidden &&= hidden;
      existing.lod0 ||= lod0;
      return key;
    }
    const image = this.sourceImages[index];
    const { width, height } = imageSize(image.bytes);
    const mimeType = image.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
    this.entries.set(key, {
      key,
      name,
      kind,
      hidden,
      lod0,
      mimeType,
      original: image,
      raw: null,
      width,
      height,
      fullWidth: width,
      fullHeight: height,
    });
    return key;
  }

  /** A generated image from raw RGBA8 pixels. */
  addRaw(key, name, kind, raw, { lod0, hidden = false, mimeType }) {
    if (this.entries.has(key)) throw new Error(`Image ${key} added twice`);
    this.entries.set(key, {
      key,
      name,
      kind,
      hidden,
      lod0,
      mimeType,
      original: null,
      raw,
      width: raw.width,
      height: raw.height,
      fullWidth: raw.width,
      fullHeight: raw.height,
    });
    return key;
  }

  lod0Gpu() {
    let sum = 0;
    for (const entry of this.entries.values())
      if (entry.lod0) sum += gpuBytes(entry.width, entry.height);
    return sum;
  }

  gpuOf(keys) {
    let sum = 0;
    for (const key of new Set(keys)) {
      const entry = this.entries.get(key);
      if (entry) sum += gpuBytes(entry.width, entry.height);
    }
    return sum;
  }

  /**
   * Caps every image at the LOD0 size limit, then halves LOD0 images until the GPU estimate fits:
   * always the biggest image; between equals, maps of hidden parts first, then data maps (ORM,
   * normal, emissive), then colour. Returns a list of what was shrunk.
   */
  fitLod0() {
    const shrunk = [];
    const max = budgets.lod0.maxImagePx;
    for (const entry of this.sorted()) {
      const scale = Math.min(1, max / Math.max(entry.width, entry.height));
      if (scale < 1) {
        entry.width = Math.max(1, Math.round(entry.width * scale));
        entry.height = Math.max(1, Math.round(entry.height * scale));
        shrunk.push(`${entry.name} capped to ${entry.width}x${entry.height}`);
      }
    }
    const priority = (e) => (e.hidden ? 0 : e.kind === 'base' ? 2 : 1);
    while (this.lod0Gpu() > budgets.lod0.gpuBytes) {
      const candidates = this.sorted().filter(
        (e) => e.lod0 && e.width * e.height > MIN_HALVE_PIXELS,
      );
      if (!candidates.length) break;
      candidates.sort(
        (a, b) => b.width * b.height - a.width * a.height || priority(a) - priority(b),
      );
      const entry = candidates[0];
      entry.width = Math.max(1, Math.round(entry.width / 2));
      entry.height = Math.max(1, Math.round(entry.height / 2));
      shrunk.push(`${entry.name} halved to ${entry.width}x${entry.height} (GPU budget)`);
    }
    return shrunk;
  }

  /** Halves the largest LOD0 image (file size budget). False when nothing is left to halve. */
  halveLargest() {
    const candidates = this.sorted().filter((e) => e.lod0 && e.width * e.height > MIN_HALVE_PIXELS);
    if (!candidates.length) return null;
    candidates.sort((a, b) => b.width * b.height - a.width * a.height);
    const entry = candidates[0];
    entry.width = Math.max(1, Math.round(entry.width / 2));
    entry.height = Math.max(1, Math.round(entry.height / 2));
    return `${entry.name} halved to ${entry.width}x${entry.height} (file size budget)`;
  }

  sorted() {
    return [...this.entries.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  }

  bytesOf(entry) {
    const size = `${entry.width}x${entry.height}`;
    if (entry.bytes && entry.encodedSize === size) return entry.bytes;
    let bytes;
    let mimeType = entry.mimeType;
    if (entry.original) {
      bytes =
        entry.width === entry.fullWidth && entry.height === entry.fullHeight
          ? entry.original.bytes
          : resizeEncoded(entry.original.bytes, entry.mimeType, entry.width, entry.height);
    } else {
      let raw = entry.raw;
      if (raw.width !== entry.width || raw.height !== entry.height) {
        raw = transformRaw(raw, { width: entry.width, height: entry.height });
      }
      ({ bytes, mimeType } = encodeGenerated(raw, entry));
    }
    entry.bytes = bytes;
    entry.encodedMime = mimeType;
    entry.encodedSize = size;
    return bytes;
  }

  /** { key, name, mimeType, bytes } for the GLB writer, in key order. */
  list() {
    return this.sorted().map((entry) => ({
      key: entry.key,
      name: entry.name,
      bytes: this.bytesOf(entry),
      mimeType: entry.encodedMime,
    }));
  }
}

function encodeGenerated(raw, entry) {
  if (entry.mimeType === 'image/png') {
    return {
      bytes: encodeImage(raw, { format: 'png', alpha: hasAlpha(raw) }),
      mimeType: 'image/png',
    };
  }
  if (entry.kind === 'normal') {
    // Normal maps: JPEG q92 when that is smaller than PNG (3.9).
    const jpeg = encodeImage(raw, { format: 'jpeg', quality: 92, chroma444: true });
    const png = encodeImage(raw, { format: 'png' });
    return jpeg.length < png.length
      ? { bytes: jpeg, mimeType: 'image/jpeg' }
      : { bytes: png, mimeType: 'image/png' };
  }
  const bytes = encodeImage(raw, { format: 'jpeg', quality: 90, chroma444: entry.kind !== 'base' });
  return { bytes, mimeType: 'image/jpeg' };
}
