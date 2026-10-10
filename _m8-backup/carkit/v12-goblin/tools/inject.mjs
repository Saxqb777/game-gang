/** Stage 2: embed the converted textures into work/stage.glb -> v12-goblin.glb. */
import { readFileSync, writeFileSync } from 'node:fs';
const KIT = new URL('../', import.meta.url).pathname;
const glb = readFileSync(KIT + 'work/stage.glb');
const jsonLen = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'));
const binHeader = 20 + jsonLen;
const binLen = glb.readUInt32LE(binHeader);
let bin = glb.subarray(binHeader + 8, binHeader + 8 + binLen);
const chunks = [bin]; let offset = bin.length;
json.images = []; json.textures = []; json.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
const texIndex = {};
function texture(file) {
  if (texIndex[file] !== undefined) return texIndex[file];
  const data = readFileSync(KIT + 'work/tex/' + file);
  const pad = (4 - (offset % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; }
  json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.length });
  chunks.push(data); offset += data.length;
  json.images.push({ name: file.replace(/\.\w+$/, ''), mimeType: file.endsWith('.png') ? 'image/png' : 'image/jpeg', bufferView: json.bufferViews.length - 1 });
  json.textures.push({ sampler: 0, source: json.images.length - 1, name: file.replace(/\.\w+$/, '') });
  return (texIndex[file] = json.textures.length - 1);
}
const ATLAS = ['body', 'trim', 'interior', 'plate', 'headlight', 'taillight', 'rim', 'brake'];
for (const m of json.materials) {
  const pbr = (m.pbrMetallicRoughness ??= {});
  const name = m.name;
  if (['paint', 'trim', 'interior', 'plate', 'headlight', 'taillight', 'rim', 'brake'].includes(name)) {
    pbr.baseColorTexture = { index: texture('body_basecolor.jpg') };
    pbr.metallicRoughnessTexture = { index: texture('body_arm.jpg') };
    pbr.metallicFactor = 1; pbr.roughnessFactor = 1;
    m.occlusionTexture = { index: texture('body_arm.jpg') };
    if (name === 'headlight' || name === 'taillight') { m.emissiveTexture = { index: texture('body_basecolor.jpg') }; m.emissiveFactor = [1, 1, 1]; }
  } else if (name === 'tyre') {
    pbr.metallicRoughnessTexture = { index: texture('tyre_arm.jpg') };
    pbr.metallicFactor = 1; pbr.roughnessFactor = 1;
    m.normalTexture = { index: texture('tyre_normal.png') };
  }
}
for (const n of json.nodes) if (n.mesh !== undefined && n.name) json.meshes[n.mesh].name = n.name;
json.buffers[0].byteLength = offset;
json.asset.extras = { title: 'V12 Goblin (game prep, M12)', author: 'Olli Teittinen', license: 'CC BY 4.0', source: 'Sketchfab download (zip supplied by user)', notes: 'Converted for game prep; paint/textures unchanged except spec-gloss -> metal-rough conversion and 4096->2048 downscale.' };
bin = Buffer.concat(chunks);
const binPad = (4 - (bin.length % 4)) % 4; bin = Buffer.concat([bin, Buffer.alloc(binPad)]);
json.buffers[0].byteLength = bin.length;
let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + bin.length, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(jsonBuf.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
const out = Buffer.concat([header, jh, jsonBuf, bh, bin]);
writeFileSync(KIT + 'v12-goblin.glb', out);
console.log('v12-goblin.glb', out.length, 'bytes; images', json.images.map((i) => i.name), 'materials', json.materials.map((m) => m.name));
