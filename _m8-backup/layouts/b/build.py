"""Build the Track 1 candidate B layout, close it numerically and write base.layout.json.

Usage: python3 -I build.py [OUT.json] [--open]
The plan lists straights and corners (entry spiral, apex arc(s), exit spiral) with elevation control
points. The solver closes the lap exactly with the checker's own integrator: heading via one apex arc,
position via two straights. --open skips the solver (to inspect the raw plan).
"""
import json, math, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
DEG = math.pi / 180
BIG = 3000.0  # radius at the straight end of a spiral (curvature ~0)
STARTZ = 40.0  # plan elevations below are terrain heights (m); the start line sits at 40 m
Z_DATUM = 40.0  # written layout is relative to the start line, so startZ = 0 (as trackgen expects)
NAME = 'Owlwood Ring'

# ---------------------------------------------------------------- side specs
def side(kerb=0.0, kh=0.05, r0=10, r1=None, surf='grass', barrier='armco'):
    return {'kerbWidth': kerb, 'kerbHeight': kh if kerb else 0.0, 'runoffStart': r0,
            'runoffEnd': r0 if r1 is None else r1, 'runoffSurface': surf, 'barrier': barrier}

def GRASS(r0=12, r1=None):
    return side(0.0, 0.0, r0, r1, 'grass', 'armco')

def GRAVEL(r0=22, r1=None):  # gravel trap, tyre wall behind it
    return side(0.0, 0.0, r0, r1, 'gravel', 'tyres')

def APEX(r0=8, r1=None, kerb=1.2):  # inside kerb at the apex
    return side(kerb, 0.06, r0, r1, 'grass', 'armco')

def EXIT(r0=14, r1=None, surf='grass', bar='armco'):  # outside kerb on the exit
    return side(1.5, 0.04, r0, r1, surf, bar)

def EXITG(r0=24, r1=None):  # outside exit kerb backed by gravel
    return side(1.5, 0.04, r0, r1, 'gravel', 'tyres')

def PIT(r0=14, r1=None):  # paved apron + pit wall along the main straight
    return side(0.0, 0.0, r0, r1, 'asphalt', 'wall')

def APRON(r0=16, r1=None):
    return side(0.0, 0.0, r0, r1, 'asphalt', 'armco')

# ---------------------------------------------------------------- plan
# Rows: (name, kind, prm, zEnd|None, (left, right), width)
#   kind 'S': prm = length;  'L'/'R': prm = (radiusStart, radiusEnd, arcDeg)
#   zEnd None = interpolate linearly by distance between control points.
P0 = dict(main=280.0, crest=250.0, back=310.0, owl=150.0, lkS=150.0, lpa=45.0, grid=220.0)

def build_plan(p):
    W = 12.0
    return [
        # ---- start line -> T1 (the grid half of the main straight is the last row)
        ('main straight', 'S', p['main'], 38.8, (PIT(14, 12), APRON(16, 14)), 14.0),
        # T1 Gatehouse: heavy braking from top speed, 105 deg right, gravel outside (left)
        ('T1 Gatehouse entry', 'R', (BIG, 48, 28), 38.4, (GRAVEL(20, 28), APEX(6)), 13.5),
        ('T1 Gatehouse', 'R', (48, 48, 50), 37.8, (GRAVEL(28), APEX(6)), 13.5),
        ('T1 Gatehouse exit', 'R', (48, BIG, 27), 36.8, (EXITG(26, 16), GRASS(10)), 13.0),
        # Bracken drop: downhill run to the brook
        ('Bracken drop', 'S', 80.0, 32.0, (GRASS(12), GRASS(12)), W),
        # Fernbrook: flat-out left kink over the brook at the valley floor
        ('Fernbrook kink in', 'L', (BIG, 260, 8), 30.8, (APEX(8), GRASS(14)), W),
        ('Fernbrook kink out', 'L', (260, BIG, 8), 30.2, (APEX(8), EXIT(14)), W),
        ('Fernbrook run', 'S', 25.0, None, (GRASS(12), GRASS(12)), W),
        # Pinewood Esses: three fast direction changes climbing through the trees
        ('Esses right in', 'R', (BIG, 125, 10), None, (GRASS(12), APEX(8)), W),
        ('Esses right', 'R', (125, 125, 14), None, (GRASS(14), APEX(8)), W),
        ('Esses right out', 'R', (125, BIG, 10), None, (EXIT(14), GRASS(10)), W),
        ('Esses left in', 'L', (BIG, 112, 14), None, (APEX(8), GRASS(12)), W),
        ('Esses left', 'L', (112, 112, 30), None, (APEX(8), GRASS(14)), W),
        ('Esses left out', 'L', (112, BIG, 14), None, (GRASS(10), EXIT(14)), W),
        ('Esses right 2 in', 'R', (BIG, 125, 10), None, (GRASS(12), APEX(8)), W),
        ('Esses right 2', 'R', (125, 125, 14), None, (GRASS(14), APEX(8)), W),
        ('Esses right 2 out', 'R', (125, BIG, 10), 42.0, (EXIT(14), GRASS(10)), W),
        ('Esses exit', 'S', 30.0, None, (GRASS(12), GRASS(12)), W),
        # Hilltop: fast uphill right onto the ridge
        ('Hilltop entry', 'R', (BIG, 90, 18), None, (GRASS(14), APEX(8)), W),
        ('Hilltop', 'R', (90, 90, 35), None, (GRASS(18), APEX(8)), W),
        ('Hilltop exit', 'R', (90, BIG, 18), 45.0, (EXIT(18, 12), GRASS(10)), W),
        # the crest: blind brow, then downhill into the Cathedral
        ('crest', 'S', 110.0, 49.5, (GRASS(12), GRASS(12)), W),
        ('crest run', 'S', p['crest'], 43.5, (GRASS(12), GRASS(14)), W),
        # The Cathedral: long downhill double-apex right (signature corner)
        ('Cathedral entry', 'R', (BIG, 68, 20), 42.7, (GRAVEL(18, 24), APEX(6)), 12.5),
        ('Cathedral apex 1', 'R', (68, 68, 40), 40.5, (GRAVEL(24), APEX(6)), 12.5),
        ('Cathedral nave', 'R', (68, 120, 12), 39.6, (GRASS(18), GRASS(10)), 12.5),
        ('Cathedral tightens', 'R', (120, 52, 20), 38.3, (GRAVEL(22, 26), APEX(6)), 12.5),
        ('Cathedral apex 2', 'R', (52, 52, 33), 36.8, (GRAVEL(26), APEX(6)), 12.5),
        ('Cathedral exit', 'R', (52, BIG, 20), 35.0, (EXITG(24, 16), GRASS(10)), 12.5),
        # back straight: dips through the valley, slight rise into the hairpin
        ('back straight', 'S', p['back'], 27.0, (GRASS(12), GRASS(12)), 12.5),
        ('back straight brake zone', 'S', 120.0, 29.0, (GRASS(12), GRASS(14)), 12.5),
        # Kingfisher hairpin: slowest corner, left, gravel trap outside (right)
        ('Kingfisher entry', 'L', (BIG, 30, 26), 29.3, (APEX(6), GRAVEL(24, 30)), 13.5),
        ('Kingfisher hairpin', 'L', (30, 30, 84), 29.8, (APEX(6), GRAVEL(30)), 14.0),
        ('Kingfisher exit', 'L', (30, BIG, 30), 30.6, (GRASS(10), EXITG(24, 14)), 13.5),
        # Owl rise: climb away from the hairpin
        ('Owl rise', 'S', p['owl'], None, (GRASS(12), GRASS(12)), W),
        ('Lookout entry', 'R', (BIG, 110, 18), None, (GRASS(14), APEX(8)), W),
        ('Lookout', 'R', (110, 110, 54), None, (GRASS(16), APEX(8)), W),
        ('Lookout exit', 'R', (110, BIG, 18), 40.5, (EXIT(14), GRASS(10)), W),
        ('Lookout brow', 'S', p['lkS'] / 2, 44.0, (GRASS(12), GRASS(12)), W),
        ('Lookout run', 'S', p['lkS'] / 2, 41.4, (GRASS(12), GRASS(14)), W),
        # Last Pines: final right onto the main straight
        ('Last Pines entry', 'R', (BIG, 80, 25), None, (GRASS(16), APEX(6)), 12.5),
        ('Last Pines', 'R', (80, 80, p['lpa']), None, (GRASS(18), APEX(6)), 13.0),
        ('Last Pines exit', 'R', (80, BIG, 25), 41.0, (EXIT(16, 12, 'asphalt'), GRASS(10)), 13.5),
        # grid straight: the 4-car grid sits here; the start line is at its end
        ('main straight grid', 'S', p['grid'], 40.0, (PIT(14), APRON(16)), 14.0),
    ]

HEADING_KEY = 'lpa'               # apex arc (deg) of a right-hander, solved for heading closure
POSITION_KEYS = ('crest', 'lkS')  # straights solved for position closure

# ---------------------------------------------------------------- geometry (same integrator as layout_check)
def seg_len(t, prm):
    if t == 'S':
        return prm
    r0, r1, a = prm
    return 2 * (a * DEG) / (1 / r0 + 1 / r1)

def walk(rows, step=0.5, trace=False):
    x = y = h = 0.0
    out = []
    for row in rows:
        t, prm = row[1], row[2]
        L = seg_len(t, prm)
        if t == 'S':
            k0 = k1 = 0.0
        else:
            sg = 1 if t == 'L' else -1
            k0, k1 = sg / prm[0], sg / prm[1]
        n = max(1, int(math.ceil(L / step)))
        ds = L / n
        for i in range(n):
            k = k0 + (k1 - k0) * (i + 0.5) / n
            hm = h + k * ds / 2
            x += math.cos(hm) * ds; y += math.sin(hm) * ds; h += k * ds
        if trace:
            out.append((row[0], L, x, y, math.degrees(h)))
    return (x, y, h, out) if trace else (x, y, h)

def close(p, iters=8):
    p = dict(p)
    s1, s2 = POSITION_KEYS
    for _ in range(iters):
        plan = build_plan(p)
        tot = sum((r[2][2] if r[1] == 'L' else -r[2][2]) for r in plan if r[1] != 'S')
        p[HEADING_KEY] += tot + 360.0  # clockwise lap: total turning = -360 deg
        x, y, _ = walk(build_plan(p))
        J = []
        for s in (s1, s2):
            q = dict(p); q[s] += 1.0
            xx, yy, _ = walk(build_plan(q))
            J.append((xx - x, yy - y))
        (a, c), (b, d) = J
        det = a * d - b * c
        p[s1] += (-x * d + y * b) / det
        p[s2] += (-y * a + x * c) / det
        if abs(x) < 1e-5 and abs(y) < 1e-5:
            break
    return p

# ---------------------------------------------------------------- layout JSON
def to_layout(p):
    plan = build_plan(p)
    lens = [seg_len(r[1], r[2]) for r in plan]
    cum = [0.0]
    for L in lens:
        cum.append(cum[-1] + L)
    known = [(0, STARTZ)] + [(i + 1, r[3]) for i, r in enumerate(plan) if r[3] is not None]
    zfull = [None] * (len(plan) + 1)
    for i, z in known:
        zfull[i] = z
    for (ia, za), (ib, zb) in zip(known, known[1:]):
        for k in range(ia + 1, ib):
            zfull[k] = za + (zb - za) * (cum[k] - cum[ia]) / (cum[ib] - cum[ia])
    segments = []
    for i, (nm, t, prm, _, (lft, rgt), width) in enumerate(plan):
        if t == 'S':
            seg = dict(name=nm, type='straight', length=round(prm, 4), radiusStart=0, radiusEnd=0, arc=0)
            b0 = b1 = 0.0
        else:
            r0, r1, a = prm
            seg = dict(name=nm, type='left' if t == 'L' else 'right', length=0,
                       radiusStart=r0, radiusEnd=r1, arc=round(a * DEG, 7))
            # mild positive camber that follows curvature: outside edge higher (+ = right edge higher)
            sg = 1 if t == 'L' else -1
            bank = lambda r: min(0.06, 3.0 / r)
            b0, b1 = round(sg * bank(r0), 4), round(sg * bank(r1), 4)
        seg.update(zEnd=round(zfull[i + 1] - Z_DATUM, 3), tangentStart=None, tangentEnd=None,
                   bankStart=b0, bankEnd=b1, roadWidth=width, left=lft, right=rgt)
        segments.append(seg)
    return {
        'format': 'splitways-layout@1', 'name': NAME,
        'licence': 'Proprietary - (C) 2026 Gamer Gang project. All rights reserved.',
        'credits': ['Original layout by the Gamer Gang project, 2026'],
        'source': {'package': 'original', 'file': '', 'readme': '', 'readmeLicence': '',
                   'notes': 'Original design, not derived from any existing track'},
        'startZ': STARTZ - Z_DATUM, 'segments': segments,
    }

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    out = args[0] if args else os.path.join(HERE, 'base.layout.json')
    p = dict(P0) if '--open' in sys.argv else close(P0)
    for k in sorted(p):
        if abs(p[k] - P0[k]) > 1e-9:
            print(f'solved {k}: {P0[k]} -> {p[k]:.3f}')
    if '--trace' in sys.argv:
        for nm, L, x, y, h in walk(build_plan(p), trace=True)[3]:
            print(f'{nm:28s} L={L:7.1f} end=({x:8.1f},{y:8.1f}) hdg={h:7.1f}')
    json.dump(to_layout(p), open(out, 'w'), indent=1)
    print('wrote', out)
