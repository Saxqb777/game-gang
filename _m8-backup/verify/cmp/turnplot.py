import os, sys, math, json
import numpy as np
from PIL import Image, ImageDraw
SCR, OUT, REF = sys.argv[1], sys.argv[2], sys.argv[3]
sys.argv = [sys.argv[0], SCR, '/tmp/unused']
sys.path.insert(0, os.path.join(SCR, 'verify/cmp'))
import shapes
S = shapes.load_all()
lay = json.load(open(os.path.join(SCR, 'layouts/final/base.layout.json')))
a = shapes.ccw(shapes.norm(shapes.resample(shapes.layout_pts(os.path.join(SCR, 'layouts/final/base.layout.json')))[0]))
b0 = shapes.norm(shapes.resample(S[REF])[0])
best = None
for mir in (False, True):
    bb = shapes.ccw(np.conj(b0) if mir else b0)
    ta, tb = shapes.turning(a), shapes.turning(bb)
    for s in range(len(ta)):
        d = ta - np.roll(tb, -s); off = d.mean(); v = math.sqrt(np.mean((d - off) ** 2))
        if best is None or v < best[0]: best = (v, mir, s, off, ta, np.roll(tb, -s) + off)
v, mir, s, off, ta, tb = best
# ours ccw: is the layout order ccw already? the layout is CCW so 'a' keeps order; index 0 = start line
W, H = 1400, 500
img = Image.new('RGB', (W, H), (250, 250, 250)); dr = ImageDraw.Draw(img)
add = np.linspace(0, 2 * np.pi, len(ta), endpoint=False)
A = ta + add; B = tb + add
lo, hi = min(A.min(), B.min()), max(A.max(), B.max())
f = lambda i, y: (40 + i / len(A) * (W - 80), H - 40 - (y - lo) / (hi - lo) * (H - 100))
dr.line([f(i, y) for i, y in enumerate(A)], fill=(0, 90, 200), width=3)
dr.line([f(i, y) for i, y in enumerate(B)], fill=(220, 0, 0), width=3)
# label our segments (cumulative arc length fraction)
from math import ceil
L = 0; marks = []
for sg in lay['segments']:
    l = sg['length'] if sg['type'] == 'straight' else 2 * sg['arc'] / (1 / sg['radiusStart'] + 1 / sg['radiusEnd'])
    marks.append((L + l / 2, sg)); L += l
k = 0
for m, sg in marks:
    if sg['type'] == 'straight' or not sg['name'].endswith(('apex', 'hold', 'in', 'Talon')) and sg['type'] != 'straight' and 'apex' not in sg['name']:
        if sg['name'] not in ('Talon',) and not sg['name'].endswith(('apex', 'hold', 'right in', 'left in', 'bridge in')):
            continue
    i = int(m / L * len(A))
    x, y = f(i, A[i]); dr.text((x - 20, 30 + (k % 3) * 14), sg['name'][:14], fill=(0, 0, 0)); dr.line([(x, 44 + (k % 3) * 14), (x, y)], fill=(180, 180, 180)); k += 1
dr.text((40, 8), f'heading vs arc fraction: Kestrel Pines (blue, from start line, CCW) vs {REF} (red, aligned, {"mirrored" if mir else "same handedness"}), turn dist {v:.3f}', fill=(0, 0, 0))
img.save(OUT)
print(v, mir)
