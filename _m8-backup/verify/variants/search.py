"""Grid search of small edits to Kestrel Pines that break the Brands Hatch Indy resemblance.
Never writes into layouts/final; writes candidates under verify/variants/."""
import copy, json, math, os, sys, itertools
SCR = sys.argv[1]
FINAL = os.path.join(SCR, 'layouts/final')
sys.path.insert(0, FINAL)
import build
sys.path.insert(0, os.path.join(SCR, 'verify/cmp'))
sys.argv = [sys.argv[0], SCR, '/tmp/unused']
import shapes
sys.path.insert(0, os.path.join(SCR, 'tools'))
import layout_check
import numpy as np

S = shapes.load_all()
REFS = {n: shapes.ccw(shapes.norm(shapes.resample(p, 256)[0])) for n, p in S.items()}
BASE = dict(build.P)

def make(ch, kink=0.0, adj=("the Ladder", "back straight"), arc="the Hollow apex"):
    P = dict(BASE); P.update(ch)
    build.lap(P)
    if kink:
        # split the back straight with a right kink of `kink` deg (R300 spiral pair); the closure arc absorbs it
        i = build.idx('back straight')
        bs = build.SEGS[i]
        first = copy.deepcopy(bs); second = copy.deepcopy(bs)
        first['name'] = 'back straight'; first['length'] = bs['length'] * 0.5
        second['name'] = 'back straight 2'; second['length'] = bs['length'] * 0.5
        k1 = copy.deepcopy(build.SEGS[build.idx('Windhover right in')]); k2 = copy.deepcopy(build.SEGS[build.idx('Windhover right out')])
        sgn = 'right' if kink > 0 else 'left'
        for k, nm in ((k1, 'Back kink in'), (k2, 'Back kink out')):
            k['name'] = nm; k['type'] = sgn; k['arc'] = math.radians(abs(kink) / 2)
            k['radiusStart'] = 900 if nm.endswith('in') else 200; k['radiusEnd'] = 200 if nm.endswith('in') else 900
            k['zEnd'] = bs['zEnd']; k['bankStart'] = k['bankEnd'] = 0.0
        build.SEGS[i:i + 1] = [first, k1, k2, second]
    build.ADJ_STRAIGHTS = adj
    build.ADJ_ARC = arc
    lay = build.build(close=True)
    return lay

def score(lay):
    res, pts, segs = layout_check.check(lay)
    fails = [k for k, (lo, hi) in layout_check.RULES.items() if not (lo <= abs(res[k]) <= hi)]
    tmp = os.path.join(SCR, 'verify/variants/_tmp.json'); json.dump(lay, open(tmp, 'w'))
    a = shapes.ccw(shapes.norm(shapes.resample(shapes.layout_pts(tmp), 256)[0]))
    rows = sorted((shapes.shape_dist(a, b)[0], n) for n, b in REFS.items())
    bi = [d for d, n in rows if n == 'OSM:BrandsHatchIndy'][0]
    other = [r for r in rows if r[1] != 'OSM:BrandsHatchIndy']
    return res, fails, bi, other[0], a

if __name__ == '__main__':
    out = []
    grid = []
    for saw, wood in ((20, 24), (35, 39), (50, 54)):
        for sw in (85, 70):
            for kink in (0, 20, -20):
                for brow in (24, 40):
                    grid.append(({'saw': saw, 'wood': wood, 'sw': sw, 'brow': brow}, kink))
    adjs = [(("the Ladder", "back straight"), "the Hollow apex"), (("the Ladder", "Hollow straight"), "the Hollow apex"),
            (("main straight", "Hollow straight"), "the Hollow apex"), (("the Ladder", "back straight"), "Kestrel hold")]
    for (ch, kink), (adj, arc) in itertools.product(grid, adjs):
        try:
            lay = make(ch, kink, adj, arc)
            res, fails, bi, oth, a = score(lay)
        except Exception as ex:
            continue
        if fails:
            continue
        seg = {s['name']: s for s in lay['segments']}
        out.append((bi, oth[0], oth[1], res['length_m'], res['min_leg_separation_m'], ch, kink, adj, arc,
                    {k: round(seg[k]['length']) for k in adj}, round(math.degrees(seg[arc]['arc']))))
    out.sort(key=lambda r: -min(r[0], r[1]))
    for r in out[:25]:
        print(f'Brands {r[0]:.3f} | nearest other {r[2]} {r[1]:.3f} | len {r[3]} sep {r[4]} | {r[5]} kink {r[6]} adj {r[7]} arc {r[8]} -> {r[9]} {r[10]}deg')
    print(len(out), 'valid variants')
