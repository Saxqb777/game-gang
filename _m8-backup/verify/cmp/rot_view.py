"""Ours rotated into the standard Wikipedia orientation of a reference (given ref rotation in degrees from OSM north-up), side by side."""
import os, sys, math, json
import numpy as np
from PIL import Image, ImageDraw
SCR, OUT, REF, refrot = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])
sys.argv = [sys.argv[0], SCR, '/tmp/unused']
sys.path.insert(0, os.path.join(SCR, 'verify/cmp'))
import shapes
zo, _ = shapes.resample(shapes.layout_pts(os.path.join(SCR, 'layouts/final/base.layout.json')))
a = shapes.norm(zo)
zr, _ = shapes.resample(np.array(json.load(open(REF))))
b = shapes.norm(zr) * np.exp(1j * math.radians(refrot))
best = None
for mir in (False, True):
    aa = np.conj(a) if mir else a
    d, s, rot = shapes.procrustes(shapes.ccw(b), shapes.ccw(aa))
    if best is None or d < best[0]: best = (d, mir, rot)
d, mir, rot = best
at = (np.conj(a) if mir else a) * np.exp(-1j * rot)
size = 420
img = Image.new('RGB', (size * 3, size + 30), (250, 250, 250)); dr = ImageDraw.Draw(img)
for i, (z, lab, col) in enumerate([(b, 'reference (standard map orientation)', (220, 0, 0)), (at, f'Kestrel Pines rotated {"+mirrored " if mir else ""}into that frame', (0, 90, 200)), (a, 'Kestrel Pines as designed', (0, 90, 200))]):
    mx, Mx, my, My = z.real.min(), z.real.max(), z.imag.min(), z.imag.max()
    sc = (size - 40) / max(Mx - mx, My - my)
    ox = i * size + 20 + ((size - 40) - (Mx - mx) * sc) / 2; oy = 20 + ((size - 40) - (My - my) * sc) / 2
    dr.line([(ox + (q.real - mx) * sc, oy + (My - q.imag) * sc) for q in np.append(z, z[:1])], fill=col, width=6)
    dr.text((i * size + 10, size + 8), lab, fill=(0, 0, 0))
img.save(OUT)
print('procr', round(d, 3), 'mirror', mir, 'rot', round(math.degrees(rot)))
