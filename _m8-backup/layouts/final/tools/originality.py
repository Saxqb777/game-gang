"""Originality check of base.layout.json against the 196 reference outlines (real circuits + Speed Dreams).

Uses the reviewers' loaders and metrics in verify/cmp/shapes.py: Procrustes RMS (shift, rotation, mirror,
both directions) and turning-function distance. Draws compare.png: the layout, then aligned overlays against
Brands Hatch Indy (before and after the fix), g-track-2 and the nearest real circuits.

Usage: python3 -I tools/originality.py SCRATCH OUT.png
"""
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw

SCR, OUT = sys.argv[1], sys.argv[2]
sys.argv = [sys.argv[0], SCR, '/tmp/unused']
sys.path.insert(0, os.path.join(SCR, 'verify/cmp'))
import shapes  # noqa: E402

NEW = os.path.join(SCR, 'layouts/final/base.layout.json')
OLD = os.path.join(SCR, 'layouts/final_prev_brands/base.layout.json')
S = shapes.load_all()


def prep_layout(path):
    return shapes.ccw(shapes.norm(shapes.resample(shapes.layout_pts(path))[0]))


ours = prep_layout(NEW)
rows = []
for name, p in S.items():
    z = shapes.ccw(shapes.norm(shapes.resample(p)[0]))
    d, mir, s, r, bb = shapes.shape_dist(ours, z)
    rows.append((d, shapes.turn_dist(ours, z), name, mir, s, r, bb))
rows.sort(key=lambda t: t[0])
real = [t for t in rows if not t[2].startswith('SD:')]
print('outlines compared: %d' % len(rows))
print('nearest by silhouette (Procrustes, lower = more alike):')
for d, td, n, mir, *_ in rows[:12]:
    print('  %-40s procr %.3f  turn %.3f%s' % (n, d, td, '  mirrored' if mir else ''))
print('nearest real circuit: %s %.3f' % (real[0][2], real[0][0]))
print('real circuits under 0.200: %d' % sum(1 for t in real if t[0] < 0.2))
byturn = sorted(rows, key=lambda t: t[1])
print('nearest by turning function:', ', '.join('%s %.3f' % (t[2], t[1]) for t in byturn[:5]))
for key in ('OSM:BrandsHatchIndy', 'SD:g-track-2', 'OSM:LagunaSeca', 'SD:Corkscrew', 'OSM:Bathurst', 'OSM:Sonoma',
            'OSM:BrandsHatch'):
    t = [r for r in rows if r[2] == key]
    if t:
        rank = rows.index(t[0]) + 1
        print('  %-22s procr %.3f (rank %d of %d)  turn %.3f' % (key, t[0][0], rank, len(rows), t[0][1]))

# ----------------------------------------------------------------------------- compare.png
def aligned(a, name):
    z = shapes.ccw(shapes.norm(shapes.resample(S[name])[0]))
    d, mir, s, r, bb = shapes.shape_dist(a, z)
    return np.roll(bb, -s) * np.exp(-1j * r), d, mir


old = prep_layout(OLD) if os.path.exists(OLD) else None
panels = [('Kestrel Pines (final)', [(ours, (40, 120, 220))], '')]
if old is not None:
    b, d, _ = aligned(old, 'OSM:BrandsHatchIndy')
    panels.append(('BEFORE vs Brands Indy', [(b, (220, 40, 40)), (old, (150, 150, 150))], 'procr %.3f' % d))
for name, label in (('OSM:BrandsHatchIndy', 'NOW vs Brands Indy'), ('SD:g-track-2', 'vs SD g-track-2'),
                    (real[0][2], 'vs ' + real[0][2].split(':', 1)[1]), ('OSM:Pembrey', 'vs Pembrey')):
    b, d, mir = aligned(ours, name)
    panels.append((label, [(b, (220, 40, 40)), (ours, (40, 120, 220))], 'procr %.3f%s' % (d, ', mirrored' if mir else '')))
W = 260
img = Image.new('RGB', (W * len(panels), W + 50), (250, 250, 250))
dr = ImageDraw.Draw(img)
for i, (label, curves, note) in enumerate(panels):
    allz = np.concatenate([c for c, _ in curves])
    mx, Mx, my, My = allz.real.min(), allz.real.max(), allz.imag.min(), allz.imag.max()
    sc = (W - 30) / max(Mx - mx, My - my)
    for z, col in curves:
        q = np.append(z, z[:1])
        dr.line([(i * W + 15 + (p.real - mx) * sc, 15 + (My - p.imag) * sc) for p in q], fill=col, width=3)
    dr.text((i * W + 8, W + 6), label, fill=(0, 0, 0))
    dr.text((i * W + 8, W + 22), note, fill=(60, 60, 60))
dr.text((8, W + 36), 'blue = Kestrel Pines, red = reference (scaled, rotated, mirrored if closer); grey = the pre-fix layout',
        fill=(90, 90, 90))
img.save(OUT)
print('saved', OUT)
