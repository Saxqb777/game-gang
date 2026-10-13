/**
 * GLB reading and writing for the car packager (Node only).
 *
 * Reading: the JSON chunk is parsed by hand first, its images and texture references are lifted out
 * (Node has no image decoder; ImageMagick handles the bytes), and the rest goes through three's
 * GLTFLoader so accessors, sparse data and node transforms are handled the way the game sees them.
 *
 * Writing: GLTFExporter writes geometry, nodes and texture-less materials; the image bytes and the
 * texture slots are injected into the JSON afterwards (as the carkit's inject step did).
 */
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

/** The texture slots the packager understands (glTF core material slots). */
export const TEXTURE_SLOTS = ['base', 'mr', 'normal', 'occlusion', 'emissive'];

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

/** Splits a GLB into its JSON and binary chunks. */
export function readGlb(bytes) {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (buffer.length < 20 || buffer.readUInt32LE(0) !== GLB_MAGIC) throw new Error('Not a GLB file');
  const jsonLength = buffer.readUInt32LE(12);
  if (buffer.readUInt32LE(16) !== CHUNK_JSON) throw new Error('GLB: first chunk is not JSON');
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'));
  let bin = Buffer.alloc(0);
  const binHeader = 20 + jsonLength;
  if (buffer.length >= binHeader + 8 && buffer.readUInt32LE(binHeader + 4) === CHUNK_BIN) {
    const binLength = buffer.readUInt32LE(binHeader);
    bin = buffer.subarray(binHeader + 8, binHeader + 8 + binLength);
  }
  return { json, bin };
}

/** Joins a JSON object and a binary chunk into GLB bytes (both chunks padded to 4 bytes). */
export function writeGlbChunks(json, bin) {
  let jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
  jsonBuffer = Buffer.concat([jsonBuffer, Buffer.alloc((4 - (jsonBuffer.length % 4)) % 4, 0x20)]);
  const binBuffer = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuffer.length + (binBuffer.length ? 8 + binBuffer.length : 0), 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBuffer.length, 0);
  jsonHeader.writeUInt32LE(CHUNK_JSON, 4);
  const parts = [header, jsonHeader, jsonBuffer];
  if (binBuffer.length) {
    const binHeader = Buffer.alloc(8);
    binHeader.writeUInt32LE(binBuffer.length, 0);
    binHeader.writeUInt32LE(CHUNK_BIN, 4);
    parts.push(binHeader, binBuffer);
  }
  return Buffer.concat(parts);
}

/** The image a texture info object points at, or null. */
function imageOf(json, info) {
  if (!info || info.index === undefined) return null;
  const texture = json.textures?.[info.index];
  if (!texture) return null;
  const source = texture.source ?? texture.extensions?.EXT_texture_webp?.source;
  return source === undefined ? null : source;
}

/**
 * Parses a GLB with three's GLTFLoader, images stripped. Returns the three scene plus, per glTF
 * material index, its texture slots (image indices) and per image its name, MIME type and bytes.
 */
export async function parseGlb(bytes) {
  const { json, bin } = readGlb(bytes);
  for (const name of json.extensionsRequired ?? []) {
    if (name !== 'KHR_materials_clearcoat' && name !== 'KHR_materials_emissive_strength') {
      throw new Error(`GLB requires ${name}; the packager reads plain glTF only`);
    }
  }
  const images = (json.images ?? []).map((image, index) => {
    if (image.bufferView === undefined) throw new Error(`Image ${index} is not embedded`);
    const view = json.bufferViews[image.bufferView];
    const data = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    return { name: image.name ?? `image_${index}`, mimeType: image.mimeType, bytes: Buffer.from(data) };
  });
  const materialMaps = (json.materials ?? []).map((material) => {
    const pbr = material.pbrMetallicRoughness ?? {};
    const maps = {
      base: imageOf(json, pbr.baseColorTexture),
      mr: imageOf(json, pbr.metallicRoughnessTexture),
      normal: imageOf(json, material.normalTexture),
      occlusion: imageOf(json, material.occlusionTexture),
      emissive: imageOf(json, material.emissiveTexture),
    };
    for (const [slot, info] of [
      ['base', pbr.baseColorTexture],
      ['mr', pbr.metallicRoughnessTexture],
      ['normal', material.normalTexture],
      ['occlusion', material.occlusionTexture],
      ['emissive', material.emissiveTexture],
    ]) {
      if (info && (info.texCoord ?? 0) !== 0) {
        throw new Error(`Material ${material.name}: ${slot} map uses TEXCOORD_${info.texCoord}`);
      }
      if (info?.extensions?.KHR_texture_transform) {
        throw new Error(`Material ${material.name}: KHR_texture_transform is not supported`);
      }
    }
    return {
      maps,
      normalScale: material.normalTexture?.scale ?? 1,
      occlusionStrength: material.occlusionTexture?.strength ?? 1,
    };
  });

  // Strip everything image-related so GLTFLoader never tries to decode a picture.
  const stripped = structuredClone(json);
  delete stripped.images;
  delete stripped.textures;
  delete stripped.samplers;
  for (const material of stripped.materials ?? []) {
    const pbr = material.pbrMetallicRoughness;
    if (pbr) {
      delete pbr.baseColorTexture;
      delete pbr.metallicRoughnessTexture;
    }
    delete material.normalTexture;
    delete material.occlusionTexture;
    delete material.emissiveTexture;
    if (material.extensions) {
      for (const extension of Object.values(material.extensions)) {
        for (const key of Object.keys(extension)) if (key.endsWith('Texture')) delete extension[key];
      }
    }
  }
  const strippedBytes = writeGlbChunks(stripped, bin);
  const arrayBuffer = strippedBytes.buffer.slice(
    strippedBytes.byteOffset,
    strippedBytes.byteOffset + strippedBytes.byteLength,
  );
  const gltf = await new GLTFLoader().parseAsync(arrayBuffer, '');
  const materialIndexOf = (material) => {
    const index = gltf.parser.associations.get(material)?.materials;
    if (index === undefined) throw new Error(`Material ${material.name} has no glTF index`);
    return index;
  };
  return { json, scene: gltf.scene, images, materialMaps, materialIndexOf };
}

/**
 * Exports a three scene as GLB, then injects the images and texture slots. `textures` maps a
 * material's pack key (`userData.packKey`, else its name) to { slot: imageKey } (slots of TEXTURE_SLOTS); `images` lists
 * { key, name, mimeType, bytes } in the order they are written.
 */
export async function exportGlb(scene, { asset, textures, images }) {
  const exported = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: false });
  const { json, bin } = readGlb(Buffer.from(exported));
  const chunks = [bin];
  let offset = bin.length;
  json.bufferViews ??= [];
  const imageIndex = new Map();
  if (images.length) {
    json.images = [];
    json.textures = [];
    json.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
  }
  for (const image of images) {
    const pad = (4 - (offset % 4)) % 4;
    if (pad) {
      chunks.push(Buffer.alloc(pad));
      offset += pad;
    }
    json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: image.bytes.length });
    chunks.push(image.bytes);
    offset += image.bytes.length;
    json.images.push({
      name: image.name,
      mimeType: image.mimeType,
      bufferView: json.bufferViews.length - 1,
    });
    json.textures.push({ sampler: 0, source: json.images.length - 1, name: image.name });
    imageIndex.set(image.key, json.textures.length - 1);
  }
  for (const material of json.materials ?? []) {
    // Materials are matched by their pack key (names repeat across levels), which is then dropped.
    const packKey = material.extras?.packKey ?? material.name;
    if (material.extras) {
      delete material.extras.packKey;
      if (!Object.keys(material.extras).length) delete material.extras;
    }
    const slots = textures.get(packKey);
    if (!slots) continue;
    const index = (slot) => {
      const key = slots[slot];
      if (key === undefined) return undefined;
      const texture = imageIndex.get(key);
      if (texture === undefined) throw new Error(`Image ${key} was not written`);
      return texture;
    };
    const pbr = (material.pbrMetallicRoughness ??= {});
    if (index('base') !== undefined) pbr.baseColorTexture = { index: index('base') };
    if (index('mr') !== undefined) pbr.metallicRoughnessTexture = { index: index('mr') };
    if (index('normal') !== undefined) material.normalTexture = { index: index('normal') };
    if (index('occlusion') !== undefined) material.occlusionTexture = { index: index('occlusion') };
    if (index('emissive') !== undefined) material.emissiveTexture = { index: index('emissive') };
  }
  json.buffers = [{ byteLength: 0 }];
  const body = Buffer.concat(chunks);
  json.buffers[0].byteLength = body.length + ((4 - (body.length % 4)) % 4);
  json.asset = asset;
  return writeGlbChunks(json, body);
}
