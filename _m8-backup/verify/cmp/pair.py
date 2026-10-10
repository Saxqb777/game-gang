"""Side-by-side and overlay of our layout vs one reference loop, aligned into the reference's north-up frame.
Usage: python3 -I pair.py SCRATCH REF.xy.json OUT.png [label]"""
import json, math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.argv_saved = list(sys.argv)
SCR, REF, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
label = sys.argv[4] if len(sys.argv) > 4 else os.path.basename(REF)
sys.argv = [sys.argv[0], SCR, '/tmp/unused']
import shapes
from PIL import Image, ImageDraw

lay = json.load(open(os.path.join(SCR, 'layouts/final/base.layout.json')))
# our points with segment index
x = y = h = 0.0
P = [(0.0, 0.0, -1)]
marks = []
for si, seg in enumerate(lay['segments']):
    if seg['type'] == 'straight':
        L = seg['length']; k0 = k1 = 0.0
    else:
        r0, r1, arc = seg['radiusStart'], seg['radiusEnd'], seg['arc']
        L = 2 * arc / (1 / r0 + 1 / r1); s = 1 if seg['type'] == 'left' else -1
        k0, k1 = s / r0, s / r1
    n = max(1, int(math.ceil(L)))
    ds = L / n
    for i in range(n):
        k = k0 + (k1 - k0) * (i + 0.5) / n
        hm = h + k * ds / 2
        x += math.cos(hm) * ds; y += math.sin(hm) * ds; h += k * ds
        P.append((x, y, si))
    marks.append((si, len(P) - 1 - n // 2))
ours_raw = np.array([p[0] + 1j * p[1] for p in P])
ref_pts = np.array(json.load(open(REF)))
zr, Lr = shapes.resample(ref_pts)
zr_c = zr - zr.mean(); rs = np.sqrt(np.mean(np.abs(zr_c) ** 2))
zo, Lo = shapes.resample(ours_raw[:, None].view(float).reshape(-1, 2) if False else np.c_[ours_raw.real, ours_raw.imag])
mo = zo.mean(); so = np.sqrt(np.mean(np.abs(zo - mo) ** 2))
a = (zr_c / rs)
a_ccw = shapes.ccw(a)
best = None
for mir in (False, True):
    b = (zo - mo) / so
    b = np.conj(b) if mir else b
    bb = shapes.ccw(b)
    d, s, r = shapes.procrustes(a_ccw, bb)
    if best is None or d < best[0]:
        best = (d, mir, r)
d, mir, r = best
def T(z):
    b = (z - mo) / so
    b = np.conj(b) if mir else b
    return b * np.exp(-1j * r)
# a_ccw may be reversed relative to a, but orientation of the plane is unchanged (only order), so T maps into ref frame
ours_t = T(ours_raw)
W, H = 1500, 760
img = Image.new('RGB', (W, H), (16, 18, 24)); dr = ImageDraw.Draw(img)
def panel(ox, zs_list, cols, widths):
    allz = np.concatenate(zs_list)
    mx, Mx, my, My = allz.real.min(), allz.real.max(), allz.imag.min(), allz.imag.max()
    sc = 640 / max(Mx - mx, My - my)
    f = lambda q: (ox + 40 + (q.real - mx) * sc, 60 + (My - q.imag) * sc)
    for z, c, w in zip(zs_list, cols, widths):
        dr.line([f(q) for q in np.append(z, z[:1])], fill=c, width=w)
    return f
f1 = panel(0, [a], [(255, 138, 31)], [4])
dr.text((40, 20), f'{label} (OSM, north up), start of OSM way marked', fill=(255, 255, 255))
q = f1(a[0]); dr.ellipse([q[0] - 5, q[1] - 5, q[0] + 5, q[1] + 5], fill=(255, 255, 255))
f2 = panel(750, [a, ours_t], [(120, 80, 30), (70, 200, 255)], [3, 3])
dr.text((790, 20), f'Kestrel Pines aligned into same frame ({"mirrored" if mir else "not mirrored"}), procr {d:.3f}', fill=(255, 255, 255))
for si, idx in marks:
    seg = lay['segments'][si]
    if seg['type'] == 'straight' and seg['length'] < 150:
        continue
    q = f2(ours_t[idx]); dr.text((q[0] + 6, q[1] - 6), seg['name'][:16], fill=(255, 220, 120))
q = f2(ours_t[0]); dr.rectangle([q[0] - 5, q[1] - 5, q[0] + 5, q[1] + 5], fill=(255, 255, 255))
img.save(OUT)
print('procr', round(d, 3), 'mirrored', mir, 'ref length', round(Lr), 'ours', round(Lo))
