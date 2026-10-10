"""Embed the converted textures into the GLB written by build.mjs, keyed by material name."""
import json, struct, sys, os
glb_in, tex_dir, glb_out = sys.argv[1:4]
data = open(glb_in, 'rb').read()
magic, version, length = struct.unpack_from('<III', data, 0)
assert magic == 0x46546C67 and version == 2
jlen, jtype = struct.unpack_from('<II', data, 12)
gltf = json.loads(data[20:20 + jlen])
blen, btype = struct.unpack_from('<II', data, 20 + jlen)
bin_ = bytearray(data[28 + jlen:28 + jlen + blen])

SETS = {
    'body': dict(base='body_basecolor.jpg', orm='body_orm.jpg', normal='body_normal.png'),
    'interior': dict(base='interior_basecolor.jpg', orm='interior_orm.jpg', normal='interior_normal.png'),
    'chassis': dict(base='chassis_basecolor.jpg', orm='chassis_orm.jpg', normal='chassis_normal.png'),
    'wheel': dict(base='wheel_basecolor.jpg', orm='wheel_orm.jpg', normal='wheel_normal.png'),
    'tyre': dict(base='tyre_basecolor.jpg', orm='tyre_orm.jpg', normal='tyre_normal.png'),
    'grille': dict(base='grille_basecolor.png'),
    'screen': dict(base='screen_basecolor.jpg', emissive='screen_basecolor.jpg'),
}
MATERIAL_SET = {'paint': 'body', 'body_trim': 'body', 'interior': 'interior', 'chassis': 'chassis',
                'rim': 'wheel', 'brake': 'wheel', 'tyre': 'tyre', 'grille': 'grille', 'screen': 'screen'}
gltf.setdefault('images', []); gltf.setdefault('textures', []); gltf.setdefault('samplers', [])
gltf['samplers'].append({'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497})
sampler = len(gltf['samplers']) - 1
tex_index = {}
def texture(fname):
    if fname in tex_index:
        return tex_index[fname]
    raw = open(os.path.join(tex_dir, fname), 'rb').read()
    while len(bin_) % 4: bin_.append(0)
    gltf['bufferViews'].append({'buffer': 0, 'byteOffset': len(bin_), 'byteLength': len(raw)})
    bin_.extend(raw)
    gltf['images'].append({'name': fname.rsplit('.', 1)[0], 'bufferView': len(gltf['bufferViews']) - 1,
                           'mimeType': 'image/jpeg' if fname.endswith('.jpg') else 'image/png'})
    gltf['textures'].append({'sampler': sampler, 'source': len(gltf['images']) - 1})
    tex_index[fname] = len(gltf['textures']) - 1
    return tex_index[fname]
for mat in gltf['materials']:
    s = MATERIAL_SET.get(mat['name'])
    if not s:
        continue
    t = SETS[s]
    pbr = mat.setdefault('pbrMetallicRoughness', {})
    pbr['baseColorTexture'] = {'index': texture(t['base'])}
    if 'orm' in t:
        pbr['metallicRoughnessTexture'] = {'index': texture(t['orm'])}
        pbr['metallicFactor'] = 1.0 if mat['name'] != 'tyre' else 0.0
        pbr['roughnessFactor'] = 1.0
    if 'normal' in t:
        mat['normalTexture'] = {'index': texture(t['normal'])}
    if 'emissive' in t:
        mat['emissiveTexture'] = {'index': texture(t['emissive'])}
        mat['emissiveFactor'] = [0.85, 0.85, 0.85]
    if mat['name'] == 'grille':
        mat['alphaMode'] = 'MASK'; mat['alphaCutoff'] = 0.5; mat['doubleSided'] = True
gltf['asset']['copyright'] = 'Generic Sport Coupe by MMC Works, CC BY 4.0 (converted for M12 prep; not debranded)'
gltf['asset'].setdefault('extras', {})['license'] = 'CC-BY-4.0'
while len(bin_) % 4: bin_.append(0)
gltf['buffers'][0]['byteLength'] = len(bin_)
j = json.dumps(gltf, separators=(',', ':')).encode()
while len(j) % 4: j += b' '
out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(j) + 8 + len(bin_)) + struct.pack('<II', len(j), 0x4E4F534A) + j + struct.pack('<II', len(bin_), 0x004E4942) + bytes(bin_)
open(glb_out, 'wb').write(out)
print('wrote', glb_out, len(out), 'images', len(gltf['images']))
for m in gltf['materials']:
    print(' ', m['name'], {k: v for k, v in m.items() if k not in ('name',)})
