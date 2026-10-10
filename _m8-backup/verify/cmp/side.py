"""Side by side (no overlay): ours in its own north-up frame, and each reference rotated/mirrored into our frame.
Usage: python3 -I side.py SCRATCH OUT.png REF1.xy.json[:label] ..."""
import json, math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
SCR, OUT = sys.argv[1], sys.argv[2]
refs = sys.argv[3:]
sys.argv = [sys.argv[0], SCR, '/tmp/unused']
import shapes
from PIL import Image, ImageDraw

zo, Lo = shapes.resample(shapes.layout_pts(os.path.join(SCR, 'layouts/final/base.layout.json')))
a = (zo - zo.mean()); a = a / np.sqrt(np.mean(np.abs(a) ** 2))
items = [('Kestrel Pines (as designed)', a)]
for r in refs:
    path, _, lab = r.partition(':')
    zr, Lr = shapes.resample(np.array(json.load(open(path))))
    b = zr - zr.mean(); b = b / np.sqrt(np.mean(np.abs(b) ** 2))
    best = None
    for mir in (False, True):
        bb = np.conj(b) if mir else b
        d, s, rot = shapes.procrustes(shapes.ccw(a), shapes.ccw(bb))
        if best is None or d < best[0]:
            best = (d, mir, rot)
    d, mir, rot = best
    bb = (np.conj(b) if mir else b) * np.exp(-1j * rot)
    items.append((f'{lab or os.path.basename(path)} rotated{" + mirrored" if mir else ""} ({d:.3f})', bb))
size = 360
img = Image.new('RGB', (size * len(items), size + 30), (16, 18, 24))
dr = ImageDraw.Draw(img)
for i, (lab, z) in enumerate(items):
    mx, Mx, my, My = z.real.min(), z.real.max(), z.imag.min(), z.imag.max()
    sc = (size - 40) / max(Mx - mx, My - my)
    ox = i * size + 20 + ((size - 40) - (Mx - mx) * sc) / 2
    oy = 20 + ((size - 40) - (My - my) * sc) / 2
    pts = [(ox + (q.real - mx) * sc, oy + (My - q.imag) * sc) for q in np.append(z, z[:1])]
    dr.line(pts, fill=(70, 200, 255) if i == 0 else (255, 138, 31), width=5)
    dr.text((i * size + 10, size + 6), lab, fill=(230, 230, 230))
img.save(OUT)
