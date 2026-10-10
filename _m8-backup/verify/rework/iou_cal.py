"""IoU calibration on unrelated pairs, same alignment search as verify/cmp/iou.py (coarser grid)."""
import os, sys, math
import numpy as np
from PIL import Image, ImageDraw
SCR = sys.argv[1]; pairs = sys.argv[2:]
sys.argv = [sys.argv[0], SCR, '/tmp/unused']
sys.path.insert(0, os.path.join(SCR, 'verify/cmp'))
import shapes
S = shapes.load_all()
def get(n):
    if n == 'OURS':
        return shapes.norm(shapes.resample(shapes.layout_pts(os.path.join(SCR, 'layouts/final/base.layout.json')), 256)[0])
    if n == 'CANDA':
        return shapes.norm(shapes.resample(shapes.layout_pts(os.path.join(SCR, 'verify/variants/A_open_switchback_kink.json')), 256)[0])
    if n == 'PREV':
        return shapes.norm(shapes.resample(shapes.layout_pts(os.path.join(SCR, 'layouts/final_prev_brands/base.layout.json')), 256)[0])
    return shapes.norm(shapes.resample(S[n], 256)[0])
def raster(z, n):
    img = Image.new('L', (n, n), 0)
    ImageDraw.Draw(img).polygon([((q.real + 2.2) / 4.4 * n, (2.2 - q.imag) / 4.4 * n) for q in z], fill=255)
    return np.array(img) > 0
def best(A, b):
    RA = raster(A, 120); res = None
    for mir in (False, True):
        bb = np.conj(b) if mir else b
        for k in range(72):
            rot = np.exp(1j * math.radians(5 * k))
            for s in (0.9, 0.95, 1.0, 1.05, 1.1):
                for dx in (-0.1, 0, 0.1):
                    for dy in (-0.1, 0, 0.1):
                        z = bb * rot * s + dx + 1j * dy
                        RB = raster(z, 120)
                        iou = (RA & RB).sum() / max(1, (RA | RB).sum())
                        if res is None or iou > res[0]:
                            res = (iou, z)
    RA = raster(A, 300); RB = raster(res[1], 300)
    return (RA & RB).sum() / (RA | RB).sum()
for p in pairs:
    a, b = p.split('~')
    print(f'{a:24s} vs {b:24s} IoU {best(get(a), get(b)):.3f}', flush=True)
