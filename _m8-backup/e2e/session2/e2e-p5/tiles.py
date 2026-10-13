# Split-screen tile check: usage tiles.py <png> <views>. Exit 0 if clean, 1 otherwise.
# Mirrors render/viewports.ts (1 full, 2 top/bottom, 3-4 a 2x2 grid, gap 4 px). Each tile must be
# rendered (not flat: std > 6), the seam must be a dark uniform band of about the gap width, and
# no tile edge row/column next to the seam may be blank (unrendered strip or off-by-one gap).
import sys
from PIL import Image
import numpy as np

path, views = sys.argv[1], int(sys.argv[2])
img = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
H, W, _ = img.shape
GAP = 4
half = GAP / 2
ok = True
msgs = []

def rect(x, y, w, h):
    x0, y0 = round(x), round(y)
    return x0, y0, round(x + w) - x0, round(y + h) - y0

if views <= 1:
    rects = [rect(0, 0, W, H)]
elif views == 2:
    h = H / 2 - half
    rects = [rect(0, 0, W, h), rect(0, H / 2 + half, W, h)]
else:
    w, h = W / 2 - half, H / 2 - half
    rects = [rect(0, 0, w, h), rect(W / 2 + half, 0, w, h), rect(0, H / 2 + half, w, h), rect(W / 2 + half, H / 2 + half, w, h)]

for i, (x, y, w, h) in enumerate(rects):
    tile = img[y:y + h, x:x + w]
    s = float(tile.std())
    edges = {'top': tile[0], 'bottom': tile[-1], 'left': tile[:, 0], 'right': tile[:, -1]}
    flat = [k for k, e in edges.items() if float(e.std()) < 1.0 and float(e.mean()) < 12]
    good = s > 6 and not flat
    ok &= good
    msgs.append(f'tile {i} {x},{y} {w}x{h} mean {tile.mean():.0f} std {s:.1f}' + (f' blank edge {flat}' if flat else '') + ('' if good else ' BAD'))

if views >= 2:
    seams = []
    yy = slice(round(H / 2 - half), round(H / 2 + half))
    seams.append(('h', img[yy, :]))
    if views >= 3:
        xx = slice(round(W / 2 - half), round(W / 2 + half))
        seams.append(('v', img[:, xx]))
    for name, band in seams:
        m, sd = float(band.mean()), float(band.std())
        good = m < 60 and sd < 25
        ok &= good
        msgs.append(f'seam {name} mean {m:.0f} std {sd:.1f}' + ('' if good else ' BAD'))

print('\n'.join(msgs))
print('OK' if ok else 'SEAM PROBLEM')
sys.exit(0 if ok else 1)
