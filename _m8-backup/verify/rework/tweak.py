"""Small extra tweaks on top of the rebuilt final (build.py as edited): does any raise the Brands turning distance?"""
import itertools, json, math, os, sys, importlib
SCR = sys.argv[1]
FINAL = os.path.join(SCR, 'layouts/final')
sys.path.insert(0, FINAL)
import build
sys.path.insert(0, os.path.join(SCR, 'verify/cmp'))
sys.argv = [sys.argv[0], SCR, '/tmp/unused']
import shapes
sys.path.insert(0, os.path.join(SCR, 'tools'))
import layout_check
S = shapes.load_all()
REFS = {n: shapes.ccw(shapes.norm(shapes.resample(p, 256)[0])) for n, p in S.items()}
BASE = dict(build.P)
tmp = os.path.join(SCR, 'verify/rework/_tw.json')
out = []
for saw, wood, drop, wh, brow, talon in itertools.product((20, 26), (24, 30), (27, 34), (6.0, 8.0), (24, 30), (17, 24)):
    P = dict(BASE); P.update(saw=saw, wood=wood, drop=drop, wh=wh, brow=brow, talon=talon)
    build.lap(P)
    try:
        lay = build.build(close=True)
    except Exception:
        continue
    res, pts, segs = layout_check.check(lay)
    fails = [k for k, (lo, hi) in layout_check.RULES.items() if not (lo <= abs(res[k]) <= hi)]
    if fails or len(res['heavy_braking_zones']) < 2:
        continue
    json.dump(lay, open(tmp, 'w'))
    a = shapes.ccw(shapes.norm(shapes.resample(shapes.layout_pts(tmp), 256)[0]))
    rows = sorted((shapes.shape_dist(a, b)[0], n) for n, b in REFS.items())
    real = [r for r in rows if not r[1].startswith('SD:')]
    tb = shapes.turn_dist(a, REFS['OSM:BrandsHatchIndy'])
    tg = shapes.turn_dist(a, REFS['SD:g-track-2'])
    seg = {s['name']: s for s in lay['segments']}
    out.append((round(min(real[0][0], 0.2 + (tb - 0.478)), 3), round(real[0][0], 3), real[0][1], round(tb, 3), round(tg, 3), dict(saw=saw, wood=wood, drop=drop, wh=wh, brow=brow, talon=talon),
                res['length_m'], round(seg['Hollow straight']['length']), round(seg['the Ladder']['length']), round(math.degrees(seg['the Hollow apex']['arc']))))
out.sort(key=lambda r: (-(r[1] >= 0.2), -r[3]))
for r in out[:20]:
    print(r)
print(len(out))
