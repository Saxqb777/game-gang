import json, math, os, sys
SCR = sys.argv[1]
sys.path.insert(0, os.path.join(SCR, 'verify/rework'))
sys.argv = [sys.argv[0], SCR]
import rsearch as R
import shapes
tmp = os.path.join(SCR, 'verify/rework/_rank.json')
cands = []
for f in ('rsearch2_all.json', 'rsearch4_all.json'):
    for o in json.load(open(os.path.join(SCR, 'verify/rework', f))):
        if o['minall'] >= 0.198:
            cands.append(o)
print(len(cands))
rows_out = []
for o in cands:
    if 'meadow' in o:
        back = o['meadow'] + o['second']; frac = o['meadow'] / back; kin = o['kin']
    else:
        back = o['back']; frac = o['frac']; kin = 900
    lay = R.make({'sw': o['sw'], 'back': back}, o['kink'], frac, kr=o['kr'], kin=kin)
    res, fails, bi, rows, a = R.score(lay, tmp)
    real = [r for r in rows if not r[0:1] or not r[1].startswith('SD:')]
    sd = [r for r in rows if r[1].startswith('SD:')]
    tb = shapes.turn_dist(a, R.REFS['OSM:BrandsHatchIndy'])
    g2 = [d for d, n in rows if n == 'SD:g-track-2'][0]
    rows_out.append((real[0][0], real[0][1], sd[0][0], sd[0][1], bi, tb, g2, o))
rows_out.sort(key=lambda r: -min(r[0], r[4] - 0.005))
for r in rows_out[:20]:
    o = r[7]
    print(f"real {r[0]:.3f} {r[1]:22s} sd {r[2]:.3f} {r[3]:14s} brands {r[4]:.3f} turnB {r[5]:.3f} g2 {r[6]:.3f} | sw {o['sw']} k {o['kink']} {o.get('meadow', o.get('frac'))} {o.get('second', o.get('back'))} {o.get('kin', 900)}/{o['kr']} hstr {o['hstr']} lad {o['ladder']} hol {o['hol']} L {o['L']}")
