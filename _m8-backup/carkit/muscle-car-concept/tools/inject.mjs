// Adds image textures to a GLB written by GLTFExporter, by material name.
// spec: { [materialName]: { baseColor?: file, mr?: file, normal?: file, emissive?: file, normalScale?, emissiveFactor? } }
import { readFileSync } from 'node:fs';
export function injectTextures(glb, spec, texDir) {
  const dv = new DataView(glb);
  const jsonLen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(glb, 20, jsonLen)));
  const binStart = 20 + jsonLen;
  const binLen = dv.getUint32(binStart, true);
  let bin = new Uint8Array(glb, binStart + 8, binLen);
  const chunks = [bin]; let offset = binLen;
  json.images ??= []; json.textures ??= []; json.samplers ??= [];
  json.samplers.push({ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 });
  const sampler = json.samplers.length - 1;
  const texCache = new Map();
  const tex = (file) => {
    if (texCache.has(file)) return texCache.get(file);
    const data = readFileSync(texDir + '/' + file);
    const pad = (4 - (offset % 4)) % 4; if (pad) { chunks.push(new Uint8Array(pad)); offset += pad; }
    json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.length });
    chunks.push(new Uint8Array(data.buffer, data.byteOffset, data.length)); offset += data.length;
    json.images.push({ name: file.replace(/\.\w+$/, ''), bufferView: json.bufferViews.length - 1, mimeType: file.endsWith('.png') ? 'image/png' : 'image/jpeg' });
    json.textures.push({ sampler, source: json.images.length - 1, name: file.replace(/\.\w+$/, '') });
    const i = json.textures.length - 1; texCache.set(file, i); return i;
  };
  for (const m of json.materials) {
    const s = spec[m.name]; if (!s) continue;
    m.pbrMetallicRoughness ??= {};
    if (s.baseColor) m.pbrMetallicRoughness.baseColorTexture = { index: tex(s.baseColor) };
    if (s.mr) m.pbrMetallicRoughness.metallicRoughnessTexture = { index: tex(s.mr) };
    if (s.normal) m.normalTexture = { index: tex(s.normal), ...(s.normalScale ? { scale: s.normalScale } : {}) };
    if (s.emissive) { m.emissiveTexture = { index: tex(s.emissive) }; m.emissiveFactor = s.emissiveFactor ?? [1, 1, 1]; }
  }
  const pad = (4 - (offset % 4)) % 4; if (pad) { chunks.push(new Uint8Array(pad)); offset += pad; }
  json.buffers[0].byteLength = offset;
  let jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jpad = (4 - (jsonBytes.length % 4)) % 4;
  const jb = new Uint8Array(jsonBytes.length + jpad).fill(0x20); jb.set(jsonBytes);
  const total = 12 + 8 + jb.length + 8 + offset;
  const out = new Uint8Array(total); const o = new DataView(out.buffer);
  o.setUint32(0, 0x46546c67, true); o.setUint32(4, 2, true); o.setUint32(8, total, true);
  o.setUint32(12, jb.length, true); o.setUint32(16, 0x4e4f534a, true); out.set(jb, 20);
  let p = 20 + jb.length; o.setUint32(p, offset, true); o.setUint32(p + 4, 0x004e4942, true); p += 8;
  for (const c of chunks) { out.set(c, p); p += c.length; }
  return out;
}
