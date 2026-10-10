"""Filled-silhouette IoU + symmetric mean outline distance after alignment (rotation/mirror/scale/translation search)."""
import os, sys, math
import numpy as np
from PIL import Image, ImageDraw
SCR = sys.argv[1]; names = sys.argv[2:]
sys.argv = [sys.argv[0], SCR, '/tmp/unused']
sys.path.insert(0, os.path.join(SCR, 'verify/cmp'))
import shapes
S = shapes.load_all()
zo, _ = shapes.resample(shapes.layout_pts(os.path.join(SCR, 'layouts/final/base.layout.json')))
A = shapes.norm(zo)
def raster(z, n=300):
    img = Image.new('L', (n, n), 0)
    pts = [((q.real + 2.2) / 4.4 * n, (2.2 - q.imag) / 4.4 * n) for q in z]
    ImageDraw.Draw(img).polygon(pts, fill=255)
    return np.array(img) > 0
RA = raster(A)
def outline_dist(a, b):
    d1 = np.min(np.abs(a[:, None] - b[None, :]), axis=1)
    return 0.5 * (d1.mean() + np.min(np.abs(b[:, None] - a[None, :]), axis=1).mean()), max(d1.max(), np.min(np.abs(b[:, None] - a[None, :]), axis=1).max())
def best(b):
    res = None
    for mir in (False, True):
        bb = np.conj(b) if mir else b
        for k in range(72):
            rot = np.exp(1j * math.radians(5 * k))
            for s in (0.9, 0.95, 1.0, 1.05, 1.1):
                for dx in (-0.1, 0, 0.1):
                    for dy in (-0.1, 0, 0.1):
                        z = bb * rot * s + dx + 1j * dy
                        RB = raster(z, 120); RA2 = raster(A, 120)
                        iou = (RA2 & RB).sum() / max(1, (RA2 | RB).sum())
                        if res is None or iou > res[0]:
                            res = (iou, mir, k * 5, s, dx, dy, z)
    return res
for n in names:
    z, _ = shapes.resample(S[n], 256); b = shapes.norm(z)
    iou, mir, deg, s, dx, dy, zz = best(b)
    RB = raster(zz); iou_hi = (RA & RB).sum() / (RA | RB).sum()
    md, hd = outline_dist(shapes.resample(np.c_[A.real, A.imag], 256)[0], zz)
    print(f'{n:32s} IoU {iou_hi:.3f}  mean outline dist {md:.3f}  hausdorff {hd:.3f}  mirror {mir} rot {deg}')
