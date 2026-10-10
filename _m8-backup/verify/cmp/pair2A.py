import os, sys, math
import numpy as np
from PIL import Image, ImageDraw
SCR, OUT = sys.argv[1], sys.argv[2]; pairs = sys.argv[3:]
sys.argv = [sys.argv[0], SCR, '/tmp/unused']
sys.path.insert(0, os.path.join(SCR, 'verify/cmp'))
import shapes
S = shapes.load_all()
def get(n):
    if n == 'OURS':
        return shapes.norm(shapes.resample(shapes.layout_pts(os.path.join(SCR, 'verify/variants/A_open_switchback_kink.json')))[0])
    return shapes.norm(shapes.resample(S[n])[0])
size = 330
img = Image.new('RGB', (size * 3, (size + 24) * len(pairs)), (250, 250, 250)); dr = ImageDraw.Draw(img)
for row, p in enumerate(pairs):
    an, bn = p.split('~')
    a, b = get(an), get(bn)
    best = None
    for mir in (False, True):
        bb = np.conj(b) if mir else b
        d, s, rot = shapes.procrustes(shapes.ccw(a), shapes.ccw(bb))
        if best is None or d < best[0]: best = (d, mir, rot)
    d, mir, rot = best
    bt = (np.conj(b) if mir else b) * np.exp(-1j * rot)
    for col, (zs, cols) in enumerate([([a], [(0, 90, 200)]), ([bt], [(220, 0, 0)]), ([a, bt], [(0, 90, 200), (220, 0, 0)])]):
        allz = np.concatenate(zs)
        mx, Mx, my, My = allz.real.min(), allz.real.max(), allz.imag.min(), allz.imag.max()
        sc = (size - 30) / max(Mx - mx, My - my)
        y0 = row * (size + 24)
        for z, c in zip(zs, cols):
            dr.line([(col * size + 15 + (q.real - mx) * sc, y0 + 15 + (My - q.imag) * sc) for q in np.append(z, z[:1])], fill=c, width=4)
    dr.text((10, row * (size + 24) + size + 4), f'{an} (blue) vs {bn} (red, {"mirrored, " if mir else ""}rotated): procr {d:.3f}', fill=(0, 0, 0))
img.save(OUT)
