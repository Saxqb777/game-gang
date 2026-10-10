"""Annotated track map: speed-coloured line (from laptime.py), turn numbers, overtaking zones, elevation.

Usage: python3 -I map.py LAYOUT.json OUT.png
"""
import json, math, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from laptime import run
from PIL import Image, ImageDraw, ImageFont

def font(sz):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf'):
        if os.path.exists(p):
            return ImageFont.truetype(p, sz)
    return ImageFont.load_default()

def main(path, out):
    layout = json.load(open(path))
    t, L, v, sm, apex = run(layout)
    # integrate positions on the same 1 m samples
    x = y = h = 0.0; pts = []
    z = layout['startZ']; zs = []
    for seg in layout['segments']:
        if seg['type'] == 'straight':
            Ls = seg['length']; k0 = k1 = 0.0
        else:
            Ls = 2 * seg['arc'] / (1 / seg['radiusStart'] + 1 / seg['radiusEnd'])
            sg = 1 if seg['type'] == 'left' else -1
            k0, k1 = sg / seg['radiusStart'], sg / seg['radiusEnd']
        n = max(1, int(math.ceil(Ls / 1.0))); ds = Ls / n
        for i in range(n):
            k = k0 + (k1 - k0) * (i + 0.5) / n
            hm = h + k * ds / 2
            pts.append((x, y, seg['name']))
            zs.append(z + (seg['zEnd'] - z) * i / n)
            x += math.cos(hm) * ds; y += math.sin(hm) * ds; h += k * ds
        z = seg['zEnd']
    W, H = 1600, 1150
    img = Image.new('RGB', (W, H), (14, 20, 17))
    d = ImageDraw.Draw(img)
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    sc = min(1100 / (max(xs) - min(xs)), 700 / (max(ys) - min(ys)))
    ox = 60 - min(xs) * sc + (1100 - (max(xs) - min(xs)) * sc) / 2
    oy = 150 + max(ys) * sc
    P = lambda px, py: (ox + px * sc, oy - py * sc)
    vmin, vmax = min(v), max(v)
    def col(sp):
        f = (sp - vmin) / (vmax - vmin)
        stops = [(0, (230, 70, 60)), (0.35, (240, 170, 60)), (0.7, (120, 200, 110)), (1, (90, 170, 240))]
        for (fa, ca), (fb, cb) in zip(stops, stops[1:]):
            if f <= fb:
                u = (f - fa) / (fb - fa)
                return tuple(int(ca[j] + (cb[j] - ca[j]) * u) for j in range(3))
        return stops[-1][1]
    # overtaking zones: the braking zones into T1, T7, T8 (highlight under the line)
    zones = {'T1 Hatchet': 'OT1', 'T7 the Kettle': 'OT2', "T8 Badger's Drop": 'OT3'}
    for i in range(len(pts) - 1):
        nxt = (i + 1) % len(v)
        if v[nxt] < v[i] - 1e-6:
            # find which corner this braking zone leads into
            j = i
            while v[(j + 1) % len(v)] < v[j % len(v)] - 1e-6:
                j += 1
            target = sm[j % len(v)][5]
            if any(target.startswith(k) for k in zones) and (v[i] - v[j % len(v)]) * 3.6 > 60:
                d.line([P(*pts[i][:2]), P(*pts[i + 1][:2])], fill=(255, 255, 255), width=22)
    for i in range(len(pts) - 1):
        d.line([P(*pts[i][:2]), P(*pts[i + 1][:2])], fill=col(v[i]), width=10)
    d.line([P(*pts[-1][:2]), P(*pts[0][:2])], fill=col(v[-1]), width=10)
    # start line + direction arrow
    sx, sy = P(0, 0)
    d.rectangle([sx - 3, sy - 16, sx + 3, sy + 16], fill=(255, 255, 255))
    d.text((sx - 40, sy + 22), 'START / FINISH', fill=(255, 255, 255), font=font(15))
    d.polygon([(sx + 60, sy - 26), (sx + 80, sy - 20), (sx + 60, sy - 14)], fill=(255, 255, 255))
    # turn labels at the tightest point of each turn, pushed outward from the centroid
    cx = sum(xs) / len(xs); cy = sum(ys) / len(ys)
    seen = {}
    for i, (px, py, nm) in enumerate(pts):
        if not (nm[:1] == "T" and nm[1:2].isdigit()):
            continue
        key = nm.split(' ')[0]
        if key not in seen or v[i] < v[seen[key]]:
            seen[key] = i
    names = {'T1': 'T1 Hatchet', 'T2': 'T2 Lynx', 'T3': 'T3 Lynx', 'T4': 'T4 Timberline',
             'T6': "T5-T6 Ranger's flick", 'T7': 'T7 THE KETTLE', 'T8': "T8 Badger's Drop",
             'T9': "T9 Badger's tail", 'T10': 'T10 Splinters', 'T11': 'T11 Campfire'}
    f16 = font(16)
    for key, i in seen.items():
        if key == 'T5':
            continue
        px, py, _ = pts[i]
        dx, dy = px - cx, py - cy
        n = math.hypot(dx, dy) or 1
        lx, ly = P(px + dx / n * 45, py + dy / n * 45)
        label = f'{names.get(key, key)}  {v[i] * 3.6:.0f}'
        tw = d.textlength(label, font=f16)
        lx = min(max(lx - tw / 2, 10), 1180 - tw)
        d.text((lx, ly - 9), label, fill=(255, 230, 150) if key != 'T7' else (255, 140, 90), font=f16)
    # header
    d.text((40, 24), layout['name'], fill=(255, 255, 255), font=font(30))
    d.text((40, 62), f'{L:.0f} m  -  counter-clockwise  -  11 turns  -  est. lap {int(t // 60)}:{t % 60:04.1f} '
           f'(grippy point-mass model)  -  white halo = overtaking braking zones', fill=(200, 210, 200), font=font(15))
    # legend
    lx0 = 1230; ly0 = 140
    d.text((lx0, ly0), 'speed (km/h)', fill=(220, 220, 220), font=f16)
    for k in range(200):
        sp = vmin + (vmax - vmin) * k / 199
        d.line([(lx0 + k, ly0 + 26), (lx0 + k, ly0 + 40)], fill=col(sp))
    d.text((lx0, ly0 + 44), f'{vmin * 3.6:.0f}', fill=(200, 200, 200), font=font(13))
    d.text((lx0 + 170, ly0 + 44), f'{vmax * 3.6:.0f}', fill=(200, 200, 200), font=font(13))
    yy = ly0 + 90
    for line in ['OT1  main straight -> T1 Hatchet', 'OT2  Firebreak + Plunge -> T7 Kettle',
                 "OT3  Kettle climb -> T8 Badger's Drop", '', 'Signature: T7 the Kettle',
                 '180 deg banked (0.12 rad)', 'downhill carousel, R 55 m', '',
                 "Corkscrew: T8-T9 Badger's Drop", 'right over a blind crest,', '7% drop, flick left']:
        d.text((lx0, yy), line, fill=(220, 220, 220), font=font(15)); yy += 22
    # elevation strip
    ex, ey, ew, eh = 60, 930, 1480, 170
    d.rectangle([ex, ey, ex + ew, ey + eh], outline=(70, 90, 80))
    zmin, zmax = min(zs), max(zs)
    prof = [(ex + i / len(zs) * ew, ey + eh - 10 - (zz - zmin) / (zmax - zmin) * (eh - 30)) for i, zz in enumerate(zs)]
    for a, b in zip(prof, prof[1:]):
        d.line([a, b], fill=(140, 220, 160), width=3)
    d.text((ex + 6, ey + 4), f'elevation {zmin:.0f}-{zmax:.0f} m', fill=(220, 220, 220), font=font(14))
    for key, i in seen.items():
        if key in ('T1', 'T4', 'T7', 'T8', 'T11'):
            px = ex + i / len(zs) * ew
            d.line([(px, ey + eh - 4), (px, ey + 22)], fill=(80, 100, 90))
            d.text((px + 3, ey + 22), key, fill=(255, 230, 150), font=font(13))
    img.save(out)
    print('wrote', out)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
