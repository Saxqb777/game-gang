"""Annotated design map: track coloured by estimated speed, named corners, overtaking zones,
elevation and speed profiles (two separate charts, one axis each).

Usage: python3 -I map.py LAYOUT.json OUT.png
"""
import json, math, sys, os, importlib.util
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('an', os.path.join(HERE, 'analyse.py'))
an = importlib.util.module_from_spec(spec); spec.loader.exec_module(an)

FONT_DIR = '/usr/share/fonts/opentype/inter/'
def font(size, weight='Regular'):
    try:
        return ImageFont.truetype(FONT_DIR + f'Inter-{weight}.otf', size)
    except OSError:
        return ImageFont.load_default(size=size)

SURFACE = (252, 252, 251); INK = (11, 11, 11); INK2 = (82, 81, 78); MUTED = (150, 149, 144)
GRID = (230, 229, 225); OT = (235, 104, 52)  # categorical slot 2 (orange) for overtaking zones
# sequential blue ramp, step 250 -> 700 (slow -> fast)
RAMP = ['#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b']
RAMP = [tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in RAMP]

def ramp(t):
    t = min(1.0, max(0.0, t)) * (len(RAMP) - 1)
    i = min(len(RAMP) - 2, int(t)); f = t - i
    return tuple(int(RAMP[i][k] + (RAMP[i + 1][k] - RAMP[i][k]) * f) for k in range(3))

GROUPS = [  # (label, segment-name prefix, label offset in px (dx, dy) from the group's midpoint)
    ('Main straight', 'main straight grid', (0, 22)),
    ('T1 Gatehouse', 'T1 Gatehouse', (22, -18)),
    ('Bracken drop', 'Bracken drop', (20, 0)),
    ('Fernbrook kink', 'Fernbrook', (22, 0)),
    ('Pinewood Esses', 'Esses', (34, 0)),
    ('Hilltop', 'Hilltop', (22, 12)),
    ('The crest', 'crest', (0, -34)),
    ('The Cathedral', 'Cathedral', (-24, 22)),
    ('Back straight', 'back straight', (26, 18)),
    ('Kingfisher hairpin', 'Kingfisher', (30, 0)),
    ('Owl rise', 'Owl rise', (0, 22)),
    ('Lookout', 'Lookout entry', (-26, 16)),
    ('Lookout brow', 'Lookout brow', (-26, 0)),
    ('Last Pines', 'Last Pines', (-24, -18)),
]
OVERTAKE = [('1', 'T1 Gatehouse entry', 260), ('2', 'Kingfisher entry', 260), ('3', 'Cathedral entry', 200)]

def main(path, out):
    lay = json.load(open(path))
    ks, names, zs = an.stations(lay)
    v, t_relaxed = an.speed_profile(an.smooth(ks), zs)
    _, t_centre = an.speed_profile(ks, zs)
    # station positions (same discretisation as an.stations)
    x = y = h = 0.0; P = []
    for k in ks:
        hm = h + k / 2; x += math.cos(hm); y += math.sin(hm); h += k; P.append((x, y))
    n = len(P); L = n
    W, H = 1500, 1180
    img = Image.new('RGB', (W, H), SURFACE); d = ImageDraw.Draw(img)
    # ---- header
    d.text((40, 28), lay['name'], font=font(30, 'SemiBold'), fill=INK)
    sub = (f'{L / 1000:.2f} km  ·  clockwise  ·  elevation range {max(zs) - min(zs):.1f} m  ·  '
           f'est. ideal lap {int(t_relaxed // 60)}:{t_relaxed % 60:04.1f}-{int(t_centre // 60)}:{t_centre % 60:04.1f} '
           f'(M8 racing-line model)')
    d.text((40, 70), sub, font=font(16), fill=INK2)
    # ---- map
    mx0, my0, mw, mh = 40, 110, 900, 720
    xs = [p[0] for p in P]; ys = [p[1] for p in P]
    sc = min((mw - 160) / (max(xs) - min(xs)), (mh - 80) / (max(ys) - min(ys)))
    ox = mx0 + (mw - (max(xs) - min(xs)) * sc) / 2; oy = my0 + (mh - (max(ys) - min(ys)) * sc) / 2
    T = lambda p: (ox + (p[0] - min(xs)) * sc, oy + (max(ys) - p[1]) * sc)
    vmin, vmax = min(v), max(v)
    # overtaking zones: orange band offset to the outside (left of travel for this clockwise lap)
    starts = {}
    for i, nm in enumerate(names):
        starts.setdefault(nm, i)
    fo = font(15, 'SemiBold')
    for tag, seg, span in OVERTAKE:
        i1 = starts[seg]; pts = []
        for i in range(i1 - span, i1 + 1):
            a = P[i % n]; b = P[(i + 1) % n]
            hx, hy = b[0] - a[0], b[1] - a[1]; ln = math.hypot(hx, hy) or 1
            nx, ny = -hy / ln, hx / ln  # left normal (outside of a clockwise loop)
            off = 13 / sc
            pts.append(T((a[0] + nx * off, a[1] + ny * off)))
        d.line(pts, fill=OT, width=6, joint='curve')
        px, py = pts[len(pts) // 2]
        lx, ly = pts[-1]
        r = 13
        cx, cy = px + (px - T(P[(i1 - span // 2) % n])[0]) * 1.6, py + (py - T(P[(i1 - span // 2) % n])[1]) * 1.6
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=OT, outline=SURFACE, width=2)
        tw = d.textlength(tag, font=fo)
        d.text((cx - tw / 2, cy - 10), tag, font=fo, fill=SURFACE)
    # track ribbon coloured by speed (surface casing first)
    for i in range(n):
        d.line([T(P[i]), T(P[(i + 1) % n])], fill=SURFACE, width=12)
    for i in range(n):
        d.line([T(P[i]), T(P[(i + 1) % n])], fill=ramp((v[i] - vmin) / (vmax - vmin)), width=7)
    # start line + direction arrow
    sx, sy = T(P[-1])
    d.rectangle([sx - 3, sy - 13, sx + 3, sy + 13], fill=INK)
    d.text((sx - 44, sy - 38), 'START / FINISH', font=font(13, 'SemiBold'), fill=INK)
    ax, ay = T(P[120]); bx, by = T(P[170])
    d.line([(ax, ay + 22), (bx, by + 22)], fill=INK2, width=2)
    d.polygon([(bx + 2, by + 22), (bx - 9, by + 16), (bx - 9, by + 28)], fill=INK2)
    # corner labels
    fl = font(15, 'Medium'); fs = font(12)
    for label, prefix, (dx, dy) in GROUPS:
        idx = [i for i, nm in enumerate(names) if nm.startswith(prefix)]
        if not idx:
            continue
        mid = idx[len(idx) // 2]
        px, py = T(P[mid])
        vm = min(v[i] for i in idx) * 3.6
        tw = d.textlength(label, font=fl)
        tx = px + dx - (tw if dx < 0 else 0) - (tw / 2 if dx == 0 else 0)
        ty = py + dy - 9
        d.text((tx, ty), label, font=fl, fill=INK)
        info = f'{vm:.0f} km/h'
        iw = d.textlength(info, font=fs)
        ix = px + dx - (iw if dx < 0 else 0) - (iw / 2 if dx == 0 else 0)
        d.text((ix, ty + 18), info, font=fs, fill=INK2)
    # scale bar
    d.line([(mx0 + 10, my0 + mh - 10), (mx0 + 10 + 200 * sc, my0 + mh - 10)], fill=INK2, width=2)
    d.text((mx0 + 10, my0 + mh - 30), '200 m', font=fs, fill=INK2)
    # ---- legend (right column)
    lx, ly = 990, 130
    d.text((lx, ly), 'Estimated speed (relaxed line)', font=font(15, 'SemiBold'), fill=INK)
    for k in range(260):
        d.line([(lx + k, ly + 30), (lx + k, ly + 44)], fill=ramp(k / 259))
    for val in (90, 120, 150, 180):
        kx = lx + (val / 3.6 - vmin) / (vmax - vmin) * 259
        if lx <= kx <= lx + 259:
            d.line([(kx, ly + 44), (kx, ly + 49)], fill=INK2)
            d.text((kx - 10, ly + 52), str(val), font=fs, fill=INK2)
    d.text((lx + 270, ly + 29), 'km/h', font=fs, fill=INK2)
    ly += 90
    d.line([(lx, ly + 8), (lx + 40, ly + 8)], fill=OT, width=6)
    d.text((lx + 50, ly), 'Overtaking zone (braking from top speed)', font=font(14), fill=INK)
    ly += 40
    notes = [
        ('1', 'Main straight (500 m) into T1 Gatehouse, R48 m'),
        ('2', 'Diagonal back straight (430 m) into Kingfisher, R30 m'),
        ('3', 'Crest run (386 m, downhill) into the Cathedral'),
    ]
    for tag, txt in notes:
        d.ellipse([lx, ly, lx + 22, ly + 22], fill=OT)
        tw = d.textlength(tag, font=fo)
        d.text((lx + 11 - tw / 2, ly + 2), tag, font=fo, fill=SURFACE)
        d.text((lx + 32, ly + 2), txt, font=font(14), fill=INK)
        ly += 32
    ly += 16
    d.text((lx, ly), 'Signature corner: The Cathedral', font=font(15, 'SemiBold'), fill=INK)
    for line in ['145 deg downhill double-apex right, ~200 m long.',
                 'Apex 1 R68, opens to R120, tightens to apex 2 R52.',
                 'Drops 8.5 m through the corner under tall pines.']:
        ly += 22
        d.text((lx, ly), line, font=font(14), fill=INK2)
    # ---- profiles: two separate charts, shared x (distance), one y-axis each
    def profile(y0, hgt, data, label, unit, lo, hi, ticks):
        x0, wdt = 90, W - 140
        d.text((40, y0 - 24), label, font=font(14, 'SemiBold'), fill=INK)
        for tv in ticks:
            yy = y0 + hgt - (tv - lo) / (hi - lo) * hgt
            d.line([(x0, yy), (x0 + wdt, yy)], fill=GRID, width=1)
            d.text((x0 - 40, yy - 8), f'{tv:g}', font=fs, fill=INK2)
        d.text((x0 + wdt + 6, y0 + hgt - 8), unit, font=fs, fill=INK2)
        pts = [(x0 + i / n * wdt, y0 + hgt - (data[i] - lo) / (hi - lo) * hgt) for i in range(0, n, 3)]
        d.line(pts, fill=RAMP[4], width=2)
        return x0, wdt
    zlo = 5 * math.floor(min(zs) / 5); zhi = 5 * math.ceil(max(zs) / 5)
    x0, wdt = profile(880, 95, zs, 'Elevation (relative to the start line)', 'm', zlo, zhi,
                      tuple(range(int(zlo), int(zhi) + 1, 5)))
    profile(1035, 95, [s * 3.6 for s in v], 'Estimated speed', 'km/h', 60, 200, (60, 100, 140, 180))
    # corner ticks along the distance axis
    for label, prefix, _ in GROUPS:
        idx = [i for i, nm in enumerate(names) if nm.startswith(prefix)]
        if not idx or label in ('Main straight', 'Back straight', 'Bracken drop', 'Owl rise', 'Lookout brow'):
            continue
        xx = x0 + idx[len(idx) // 2] / n * wdt
        d.line([(xx, 1132), (xx, 1138)], fill=MUTED)
        short = label.replace(' hairpin', '').replace('The ', '').replace('Pinewood ', '')
        tw = d.textlength(short, font=fs)
        d.text((xx - tw / 2, 1142), short, font=fs, fill=INK2)
    d.text((x0 + wdt - 120, 1160), 'distance from start line', font=fs, fill=MUTED)
    img.save(out)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
