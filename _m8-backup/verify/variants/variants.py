"""Try small edits of the Kestrel Pines builder and measure resemblance to Brands Hatch Indy and all refs.
Writes variant layouts to verify/variants/<name>.json only (never touches layouts/final)."""
import copy, json, math, os, sys
SCR = sys.argv[1]
FINAL = os.path.join(SCR, 'layouts/final')
sys.path.insert(0, FINAL)
import build  # module-level only builds SEGS in memory; __main__ guard prevents writes
sys.path.insert(0, os.path.join(SCR, 'verify/cmp'))
sys.argv = [sys.argv[0], SCR, '/tmp/unused']
import shapes
sys.path.insert(0, os.path.join(SCR, 'tools'))
import layout_check
import numpy as np

S = shapes.load_all()
refs = {n: shapes.ccw(shapes.norm(shapes.resample(p)[0])) for n, p in S.items()}

def evaluate(name, P):
    build.lap(P)
    lay = build.build(close=True)
    out = os.path.join(SCR, 'verify/variants', name + '.json')
    json.dump(lay, open(out, 'w'), indent=1)
    res, pts, segs = layout_check.check(lay)
    fails = [k for k, (lo, hi) in layout_check.RULES.items() if not (lo <= abs(res[k]) <= hi)]
    a = shapes.ccw(shapes.norm(shapes.resample(shapes.layout_pts(out))[0]))
    rows = []
    for n, b in refs.items():
        d = shapes.shape_dist(a, b)[0]
        rows.append((d, n))
    rows.sort()
    bi = [d for d, n in rows if n == 'OSM:BrandsHatchIndy'][0]
    ti = shapes.turn_dist(a, refs['OSM:BrandsHatchIndy'])
    seg = {s['name']: s for s in lay['segments']}
    print(f"{name:26s} len {res['length_m']:7.1f} sep {res['min_leg_separation_m']:6.1f} fails {fails} | "
          f"ladder {seg['the Ladder']['length']:.0f} back {seg['back straight']['length']:.0f} hollow_apex {math.degrees(seg['the Hollow apex']['arc']):.0f}deg | "
          f"BrandsIndy procr {bi:.3f} turn {ti:.3f} | nearest {rows[0][1]} {rows[0][0]:.3f}, {rows[1][1]} {rows[1][0]:.3f}")

base = dict(build.P)
V = {
    'v0_baseline': {},
    'v1_switchback_118': {'sw': 40},
    'v2_switchback_133': {'sw': 55},
    'v3_esses_74': {'saw': 50, 'wood': 54},
    'v4_sw133_esses74': {'sw': 55, 'saw': 50, 'wood': 54},
    'v5_esses_90': {'saw': 66, 'wood': 70},
    'v6_sw118_esses74': {'sw': 40, 'saw': 50, 'wood': 54},
}
for name, ch in V.items():
    P = dict(base); P.update(ch)
    try:
        evaluate(name, P)
    except Exception as ex:
        print(name, 'FAILED', ex)
