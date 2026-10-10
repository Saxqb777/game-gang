import itertools, json, math, os, sys
SCR = sys.argv[1]
sys.path.insert(0, os.path.join(SCR, 'layouts/final'))
import build
sys.path.insert(0, os.path.join(SCR, 'verify/cmp'))
sys.argv = [sys.argv[0], SCR, '/tmp/unused']
import shapes
sys.path.insert(0, os.path.join(SCR, 'tools'))
import layout_check
S = shapes.load_all()
REFS = {n: shapes.ccw(shapes.norm(shapes.resample(p, 256)[0])) for n, p in S.items()}
BASE = dict(build.P)
tmp = os.path.join(SCR, 'verify/rework/_tw2.json')
singles = [{}]
for k, vals in dict(wh=(4.0, 8.0, 10.0), beck=(4.0, 8.0, 10.0), talon=(12, 24), drop=(22, 34), kink=(8.0, 12.0, 14.0), meadow=(80, 120, 140),
                    back=(255, 285), k_hold=(78, 90), k_tight=(64, 76), brow=(20, 28), appr=(90, 120), fern=(40, 60), brook=(60, 80), link=(36, 56),
                    t1=(66, 76), sw_exit=(54, 66), hol_r=(44, 55)).items():
    for v in vals:
        singles.append({k: v})
out = []
for ch in singles:
    P = dict(BASE); P.update(ch)
    build.lap(P)
    try:
        lay = build.build(close=True)
    except Exception as e:
        print(ch, 'ERR', e); continue
    res, pts, segs = layout_check.check(lay)
    fails = [k for k, (lo, hi) in layout_check.RULES.items() if not (lo <= abs(res[k]) <= hi)]
    json.dump(lay, open(tmp, 'w'))
    a = shapes.ccw(shapes.norm(shapes.resample(shapes.layout_pts(tmp), 256)[0]))
    rows = sorted((shapes.shape_dist(a, b)[0], n) for n, b in REFS.items())
    real = [r for r in rows if not r[1].startswith('SD:')]
    bi = [d for d, n in rows if n == 'OSM:BrandsHatchIndy'][0]
    g2 = [d for d, n in rows if n == 'SD:g-track-2'][0]
    tb = shapes.turn_dist(a, REFS['OSM:BrandsHatchIndy'])
    seg = {s['name']: s for s in lay['segments']}
    print(ch, fails, res['length_m'], 'real', round(real[0][0], 3), real[0][1], 'brands', round(bi, 3), 'turnB', round(tb, 3), 'g2', round(g2, 3),
          'hstr', round(seg['Hollow straight']['length']), 'lad', round(seg['the Ladder']['length']), 'hol', round(math.degrees(seg['the Hollow apex']['arc'])), 'nb', len(res['heavy_braking_zones']), flush=True)
