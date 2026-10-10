"""Preview: plot the (possibly unclosed) path with labels, speed colouring and a 100 m grid.
Usage: python3 -I preview.py [--close] out.png
"""
import sys, os, math, importlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
import geom
import build

close = '--close' in sys.argv
out = [a for a in sys.argv[1:] if not a.startswith('--')][0]
segs = build.SEGS
if close:
    geom.close_loop(segs, build.START_Z, (build.idx(build.ADJ_STRAIGHTS[0]), build.idx(build.ADJ_STRAIGHTS[1])),
                    build.idx(build.ADJ_ARC), target_turns=1)
t, v, pts = geom.lap_sim(segs, build.START_Z)
xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
W = H = 1100
pad = 60
span = max(max(xs) - min(xs), max(ys) - min(ys))
sc = (W - 2 * pad) / span
def P(x, y):
    return (pad + (x - min(xs)) * sc, H - pad - (y - min(ys)) * sc)
img = Image.new('RGB', (W, H + 180), (14, 18, 16))
d = ImageDraw.Draw(img)
# 100 m grid
gx0 = math.floor(min(xs) / 100) * 100
for gx in range(int(gx0), int(max(xs)) + 101, 100):
    d.line([P(gx, min(ys)), P(gx, max(ys))], fill=(30, 38, 34))
gy0 = math.floor(min(ys) / 100) * 100
for gy in range(int(gy0), int(max(ys)) + 101, 100):
    d.line([P(min(xs), gy), P(max(xs), gy)], fill=(30, 38, 34))
vmin, vmax = min(v), max(v)
for i in range(1, len(pts)):
    tt = (v[i] - vmin) / max(1e-6, vmax - vmin)
    col = (int(255 * (1 - tt)), int(80 + 175 * tt), 90)
    d.line([P(pts[i - 1][0], pts[i - 1][1]), P(pts[i][0], pts[i][1])], fill=col, width=int(max(3, 12 * sc)))
sx, sy = P(0, 0)
d.rectangle([sx - 6, sy - 6, sx + 6, sy + 6], fill=(255, 255, 255))
ex, ey = P(pts[-1][0], pts[-1][1])
d.ellipse([ex - 6, ey - 6, ex + 6, ey + 6], outline=(255, 60, 60), width=3)
s = 0.0
for seg in segs:
    L = geom.seg_len(seg)
    mid = s + L / 2
    p = min(pts, key=lambda q: abs(q[3] - mid))
    x, y = P(p[0], p[1])
    if seg['type'] != 'straight' and not seg['name'].endswith(('entry', 'exit')):
        d.text((x + 8, y - 6), seg['name'], fill=(255, 225, 140))
    elif seg['type'] == 'straight':
        d.text((x + 8, y - 6), seg['name'], fill=(150, 200, 255))
    s += L
d.text((10, 10), 'lap %.1fm  est %.1fs  gap %.1fm  100m grid' % (pts[-1][3], t, math.hypot(pts[-1][0], pts[-1][1])),
       fill=(230, 230, 230))
# elevation + speed profile
ey0 = H + 10
zs = [p[2] for p in pts]
zmin, zmax = min(zs), max(zs)
L = pts[-1][3]
d.rectangle([pad, ey0, W - pad, ey0 + 160], outline=(70, 80, 75))
d.line([(pad + p[3] / L * (W - 2 * pad), ey0 + 160 - (p[2] - zmin) / max(1, zmax - zmin) * 150) for p in pts[::4]],
       fill=(120, 220, 160), width=2)
d.line([(pad + pts[i][3] / L * (W - 2 * pad), ey0 + 160 - v[i] / 70 * 150) for i in range(0, len(pts), 4)],
       fill=(255, 140, 90), width=1)
d.text((pad + 4, ey0 + 4), 'elev %.0f..%.0f m (green), speed 0..250 km/h (orange)' % (zmin, zmax), fill=(220, 220, 220))
img.save(out)
print('saved', out, 'len %.1f gap %.1f est %.1fs' % (pts[-1][3], math.hypot(pts[-1][0], pts[-1][1]), t))

# separation report (same rule as the checker: points > 500 m apart along the lap)
names = []
s = 0.0
bounds = []
for seg in segs:
    L = geom.seg_len(seg); bounds.append((s, s + L, seg['name'])); s += L
def name_at(sv):
    for a, b, n in bounds:
        if a <= sv <= b:
            return n
    return '?'
Ltot = pts[-1][3]
sub = pts[::6]
best = []
for i in range(len(sub)):
    for j in range(i + 1, len(sub)):
        da = abs(sub[i][3] - sub[j][3])
        if min(da, Ltot - da) < 500:
            continue
        dd = math.hypot(sub[i][0] - sub[j][0], sub[i][1] - sub[j][1])
        if dd < 130:
            best.append((dd, name_at(sub[i][3]), name_at(sub[j][3])))
best.sort()
seen = set()
for dd, a, b in best:
    if (a, b) in seen:
        continue
    seen.add((a, b))
    print('  close: %6.1f m  %s <-> %s' % (dd, a, b))
    if len(seen) > 6:
        break
print('end x=%.1f y=%.1f heading=%.2f deg' % (pts[-1][0], pts[-1][1], math.degrees(pts[-1][4]) - 360))
