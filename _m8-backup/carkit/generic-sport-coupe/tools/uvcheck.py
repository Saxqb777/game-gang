"""Livery feasibility: UV overlap, out-of-range UVs and texel density spread for the paint mesh."""
import json, struct, sys
import numpy as np
from PIL import Image, ImageDraw
glb, out_png = sys.argv[1], sys.argv[2]
d = open(glb, 'rb').read()
jl = struct.unpack_from('<I', d, 12)[0]; g = json.loads(d[20:20 + jl]); b0 = 20 + jl + 8
def acc(i):
    a = g['accessors'][i]; bv = g['bufferViews'][a['bufferView']]
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[a['type']]
    dt = {5126: np.float32, 5123: np.uint16, 5125: np.uint32}[a['componentType']]
    return np.frombuffer(d, dt, a['count'] * n, b0 + bv.get('byteOffset', 0) + a.get('byteOffset', 0)).reshape(-1, n)
names = {n.get('mesh'): n['name'] for n in g['nodes'] if 'mesh' in n}
for mi, m in enumerate(g['meshes']):
    if names[mi] not in ('paint', 'body_trim'): continue
    p = m['primitives'][0]
    pos = acc(p['attributes']['POSITION']).astype(np.float64); uv = acc(p['attributes']['TEXCOORD_0']).astype(np.float64)
    idx = acc(p['indices']).ravel().reshape(-1, 3)
    P = pos[idx]; U = uv[idx]
    a3 = 0.5 * np.linalg.norm(np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0]), axis=1)
    e1 = U[:, 1] - U[:, 0]; e2 = U[:, 2] - U[:, 0]
    a2 = 0.5 * np.abs(e1[:, 0] * e2[:, 1] - e1[:, 1] * e2[:, 0])
    ok = (a3 > 1e-9) & (a2 > 1e-12)
    dens = np.sqrt(a2[ok] / a3[ok]) * 2048  # px per metre at 2048
    w = a3[ok]
    print(names[mi], 'tris', len(idx), 'area m2 %.2f' % a3.sum(), 'uv area %.3f' % a2.sum(),
          'uv range', U.reshape(-1, 2).min(0).round(3), U.reshape(-1, 2).max(0).round(3))
    q = np.percentile(dens, [5, 25, 50, 75, 95])
    print('   texel density px/m @2048 (5/25/50/75/95%):', q.round(0))
    # overlap: rasterise each triangle and count coverage
    N = 1024
    cov = np.zeros((N, N), np.uint16)
    for t in range(len(idx)):
        if not ok[t]: continue
        img = Image.new('L', (N, N), 0)
        pts = [((u % 1) * N, (v % 1) * N) for u, v in U[t]]
        ImageDraw.Draw(img).polygon(pts, fill=1)
        cov += np.asarray(img, np.uint16)
    covered = (cov > 0).sum(); over = (cov > 1).sum()
    print('   uv coverage %.1f%% of atlas, overlapping texels %.1f%% of covered' % (100 * covered / N / N, 100 * over / max(covered, 1)))
    if names[mi] == 'paint':
        vis = np.zeros((N, N, 3), np.uint8); vis[cov == 1] = (60, 160, 60); vis[cov > 1] = (220, 40, 40)
        Image.fromarray(vis).save(out_png)
    # mirrored left/right check: compare uv of triangles with x>0 vs x<0
    cx = P[:, :, 0].mean(1)
    print('   tris left %d right %d centre(|x|<0.02) %d' % ((cx > 0.02).sum(), (cx < -0.02).sum(), (np.abs(cx) <= 0.02).sum()))
