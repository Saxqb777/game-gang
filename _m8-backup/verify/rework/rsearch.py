"""Search around candidate A: kink position/angle, switchback angle, closure segments.
Usage: python3 -I rsearch.py SCR"""
import copy, json, math, os, sys, itertools, time
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

def make(ch, kink=0.0, frac=0.5, adj=("the Ladder", "Hollow straight"), arc="the Hollow apex", kr=200, kin=900):
    P = dict(BASE); P.update(ch)
    build.lap(P)
    if kink:
        i = build.idx('back straight')
        bs = build.SEGS[i]
        first = copy.deepcopy(bs); second = copy.deepcopy(bs)
        first['name'] = 'Meadow run'; first['length'] = bs['length'] * frac
        second['name'] = 'back straight'; second['length'] = bs['length'] * (1 - frac)
        zmid = build.SEGS[i - 1]['zEnd'] + (bs['zEnd'] - build.SEGS[i - 1]['zEnd']) * frac
        first['zEnd'] = zmid
        k1 = copy.deepcopy(build.SEGS[build.idx('Windhover right in')]); k2 = copy.deepcopy(build.SEGS[build.idx('Windhover right out')])
        sgn = 'right' if kink > 0 else 'left'
        for k, nm in ((k1, 'Larch kink in'), (k2, 'Larch kink out')):
            k['name'] = nm; k['type'] = sgn; k['arc'] = math.radians(abs(kink) / 2)
            k['radiusStart'] = kin if nm.endswith('in') else kr; k['radiusEnd'] = kr if nm.endswith('in') else kin
            k['zEnd'] = zmid; k['bankStart'] = k['bankEnd'] = 0.0; k['roadWidth'] = 14.0
        build.SEGS[i:i + 1] = [first, k1, k2, second]
    build.ADJ_STRAIGHTS = adj
    build.ADJ_ARC = arc
    return build.build(close=True)

def score(lay, tmp):
    res, pts, segs = layout_check.check(lay)
    fails = [k for k, (lo, hi) in layout_check.RULES.items() if not (lo <= abs(res[k]) <= hi)]
    if res['straight_behind_start_m'] < 180: fails.append('grid')
    json.dump(lay, open(tmp, 'w'))
    a = shapes.ccw(shapes.norm(shapes.resample(shapes.layout_pts(tmp), 256)[0]))
    rows = sorted((shapes.shape_dist(a, b)[0], n) for n, b in REFS.items())
    bi = [d for d, n in rows if n == 'OSM:BrandsHatchIndy'][0]
    return res, fails, bi, rows, a

if __name__ == '__main__':
    tmp = os.path.join(SCR, 'verify/rework/_tmp.json')
    out = []
    t0 = time.time()
    closures = [(("the Ladder", "Hollow straight"), "the Hollow apex"),
                (("the Ladder", "Meadow run"), "the Hollow apex"),
                (("the Ladder", "Hollow straight"), "Kestrel hold"),
                (("Kestrel approach", "Hollow straight"), "the Hollow apex"),
                (("the Ladder", "Fernside dive"), "the Hollow apex")]
    for sw, kink, frac, back, (adj, arc) in itertools.product((60, 65, 70), (0, 8, 10, 12, 15), (0.2, 0.3, 0.37, 0.5),
                                                          (400, 430), closures):
        if kink == 0 and (frac != 0.5 or adj[1] == 'Meadow run'):
            continue
        try:
            lay = make({'sw': sw, 'back': back}, kink, frac, adj, arc)
            res, fails, bi, rows, a = score(lay, tmp)
        except Exception as ex:
            continue
        if fails:
            continue
        seg = {s['name']: s for s in lay['segments']}
        real = [r for r in rows if not r[1].startswith('SD:') or r[1] in ('SD:corkscrew', 'SD:g-track-2')]
        out.append(dict(minall=rows[0][0], nearest=rows[0][1], brands=bi, sw=sw, kink=kink, frac=frac, back=back, adj=adj, arc=arc,
                        hstr=round(seg['Hollow straight']['length']), ladder=round(seg['the Ladder']['length']),
                        arcdeg=round(math.degrees(seg[arc]['arc'])), L=res['length_m'], sep=res['min_leg_separation_m'],
                        grade=res['max_grade_pct'], braking=[b[1] for b in res['heavy_braking_zones']]))
    print(len(out), 'valid', round(time.time() - t0), 's')
    json.dump(out, open(os.path.join(SCR, 'verify/rework/rsearch_all.json'), 'w'), indent=0)
    good = [o for o in out if o['minall'] >= 0.2]
    good.sort(key=lambda o: (-len(o['braking']), -o['hstr']))
    for o in good[:30]:
        print(o)
