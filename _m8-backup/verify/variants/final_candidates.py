import json, math, os, sys
SCR = sys.argv[1]
sys.path.insert(0, os.path.join(SCR, 'verify/variants'))
import search as SR
import shapes, build, layout_check
import numpy as np
cands = {
  'A_open_switchback_kink': dict(ch={'sw': 65}, kink=10, adj=('the Ladder', 'Hollow straight'), arc='the Hollow apex'),
  'B_esses_drop': dict(ch={'saw': 30, 'wood': 34, 'drop': 40}, kink=0, adj=('the Ladder', 'back straight'), arc='the Hollow apex'),
  'C_sw70_kink10': dict(ch={'sw': 70}, kink=10, adj=('the Ladder', 'Hollow straight'), arc='the Hollow apex'),
}
for name, c in cands.items():
    lay = SR.make(c['ch'], c['kink'], c['adj'], c['arc'])
    path = os.path.join(SCR, 'verify/variants', name + '.json'); json.dump(lay, open(path, 'w'), indent=1)
    res, pts, segs = layout_check.check(lay)
    fails = [k for k, (lo, hi) in layout_check.RULES.items() if not (lo <= abs(res[k]) <= hi)]
    a = shapes.ccw(shapes.norm(shapes.resample(shapes.layout_pts(path), 256)[0]))
    rows = sorted((shapes.shape_dist(a, b)[0], n) for n, b in SR.REFS.items())
    tb = shapes.turn_dist(a, SR.REFS['OSM:BrandsHatchIndy'])
    seg = {s['name']: s for s in lay['segments']}
    corners = {}
    for s in lay['segments']:
        if s['type'] != 'straight':
            base = s['name'].rsplit(' ', 1)[0] if s['name'].split()[-1] in ('entry', 'apex', 'exit', 'in', 'out', 'hold', 'tighten', 'crest', 'flick') else s['name']
            corners[base] = corners.get(base, 0) + math.degrees(s['arc'])
    print(f"== {name}: len {res['length_m']} sep {res['min_leg_separation_m']} grade {res['max_grade_pct']} fails {fails} braking {res['heavy_braking_zones']}")
    print('   Brands Indy procr', round([d for d, n in rows if n == 'OSM:BrandsHatchIndy'][0], 3), 'turn', round(tb, 3))
    print('   nearest:', [(round(d, 3), n) for d, n in rows[:6]])
    print('   straights:', {k: round(seg[k]['length']) for k in seg if seg[k]['type'] == 'straight'})
    print('   corners deg:', {k: round(v) for k, v in corners.items()})
