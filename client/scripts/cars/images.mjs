/**
 * Every image decode, resize and encode goes through ImageMagick's `convert` (spec C2a.1), with
 * raw RGBA8 buffers in between. Encodes are deterministic: metadata stripped, no PNG time chunks.
 */
import { execFileSync } from 'node:child_process';

const CONVERT = 'convert';
const MAX_BUFFER = 512 * 1024 * 1024;

function run(args, input) {
  return execFileSync(CONVERT, args, { input, maxBuffer: MAX_BUFFER, stdio: ['pipe', 'pipe', 'pipe'] });
}

/** Fails with an install hint unless `convert` can read and write JPEG, PNG and WebP. */
export function checkImageMagick() {
  const hint =
    'The car packager needs ImageMagick with JPEG, PNG and WebP support ' +
    '(macOS: brew install imagemagick; Debian/Ubuntu: sudo apt install imagemagick).';
  let formats;
  try {
    formats = execFileSync(CONVERT, ['-list', 'format'], { stdio: ['ignore', 'pipe', 'pipe'] })
      .toString()
      .split('\n');
  } catch {
    throw new Error(`ImageMagick "convert" was not found. ${hint}`);
  }
  for (const format of ['JPEG', 'PNG', 'WEBP']) {
    const line = formats.find((row) => new RegExp(`^\\s*${format}\\*?\\s`).test(row));
    if (!line || !/\srw/.test(line)) throw new Error(`ImageMagick cannot read and write ${format}. ${hint}`);
  }
}

/** Width and height of an encoded image. */
export function imageSize(bytes) {
  const [width, height] = run(['-', '-format', '%w %h', 'info:'], bytes)
    .toString()
    .trim()
    .split(' ')
    .map(Number);
  return { width, height };
}

/** Decodes to RGBA8 (optionally resized to exactly width x height). */
export function decodeImage(bytes, size) {
  const { width, height } = size ?? imageSize(bytes);
  const args = ['-', '-alpha', 'on'];
  if (size) args.push('-resize', `${width}x${height}!`);
  args.push('-depth', '8', 'rgba:-');
  const data = new Uint8Array(run(args, bytes));
  if (data.length !== width * height * 4) throw new Error('Image decode returned the wrong size');
  return { width, height, data };
}

/** Crops (pixels) and/or resizes a raw RGBA8 image. */
export function transformRaw(image, { crop, width, height }) {
  const args = ['-size', `${image.width}x${image.height}`, '-depth', '8', 'rgba:-'];
  if (crop) args.push('-crop', `${crop.width}x${crop.height}+${crop.x}+${crop.y}`, '+repage');
  args.push('-resize', `${width}x${height}!`, '-depth', '8', 'rgba:-');
  const data = new Uint8Array(run(args, Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength)));
  if (data.length !== width * height * 4) throw new Error('Image resize returned the wrong size');
  return { width, height, data };
}

/**
 * Encodes a raw RGBA8 image. `format` is 'jpeg' or 'png'; `alpha` keeps the alpha channel (PNG
 * only); `chroma444` keeps full colour resolution (data maps, where channels are independent).
 */
export function encodeImage(image, { format, quality = 90, alpha = false, chroma444 = false }) {
  const args = ['-size', `${image.width}x${image.height}`, '-depth', '8', 'rgba:-', '-strip'];
  if (!alpha) args.push('-alpha', 'off');
  if (format === 'jpeg') {
    args.push('-quality', String(quality), '-sampling-factor', chroma444 ? '1x1' : '2x2');
    args.push('-interlace', 'none', 'jpeg:-');
  } else if (format === 'png') {
    args.push('-define', 'png:exclude-chunks=date,time', '-define', 'png:compression-level=9');
    args.push(alpha ? 'png32:-' : 'png24:-');
  } else {
    throw new Error(`Unknown image format ${format}`);
  }
  return run(args, Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength));
}

/** Converts encoded bytes straight to another size (for capping source images). */
export function resizeEncoded(bytes, mimeType, width, height) {
  const raw = decodeImage(bytes, { width, height });
  return mimeType === 'image/png'
    ? encodeImage(raw, { format: 'png', alpha: hasAlpha(raw) })
    : encodeImage(raw, { format: 'jpeg', quality: 90 });
}

export function hasAlpha(image) {
  for (let i = 3; i < image.data.length; i += 4) if (image.data[i] < 255) return true;
  return false;
}

/** sRGB 8-bit value to linear 0..1. */
const TO_LINEAR = Float32Array.from({ length: 256 }, (_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

export function srgbToLinear(value) {
  return TO_LINEAR[value];
}

/** Linear 0..1 to an sRGB 8-bit value. */
export function linearToSrgb(value) {
  const c = Math.min(1, Math.max(0, value));
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(s * 255);
}

/** Estimated GPU bytes of an RGBA8 texture with mipmaps. */
export function gpuBytes(width, height) {
  return Math.round((width * height * 4 * 4) / 3);
}
