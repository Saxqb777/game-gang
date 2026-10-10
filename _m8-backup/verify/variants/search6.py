import itertools, json, math, os, sys
SCR = sys.argv[1]
sys.path.insert(0, os.path.join(SCR, 'verify/variants'))
import search as SR
import shapes, build, layout_check
PAIRS = [('the Ladder', 'Fernside'), ('the Ladder', 'Kestrel approach'), ('the Ladder', 'Brook run'), ('Fernside', 'Kestrel approach'),
         ('Brook run', 'Kestrel approach'), ('Fernside dive', 'the Ladder'), ('Fernside dive', 'Kestrel approach'), ('Brook run', 'Fernside dive'),
         ('the Ladder', 'back straight'), ('the Ladder', 'back straight 2'), ('Fernside', 'back straight'), ('Kestrel approach', 'back straight')]
out = []
for sw, kink, hstr, pr, arc in itertools.product((60, 65, 70), (10, 15), (254, 230), PAIRS, ('the Hollow apex', 'Kestrel hold', 'the Drop apex')):
    try:
        lay = SR.make({'sw': sw, 'hstr': hstr}, kink, pr, arc)
        res, fails, bi, oth, a = SR.score(lay)
    except Exception:
        continue
    seg = {s['name']: s for s in lay['segments']}
    if fails or seg['Hollow straight']['length'] < 200:
        continue
    out.append((min(bi, oth[0]), bi, oth, sw, kink, hstr, pr, arc, {k: round(seg[k]['length']) for k in pr}, round(math.degrees(seg[arc]['arc'])), res['length_m'], res['min_leg_separation_m']))
out.sort(key=lambda r: -r[0])
for r in out[:12]:
    print(f'min {r[0]:.3f} Brands {r[1]:.3f} other {r[2][1]} {r[2][0]:.3f} | sw {r[3]} kink {r[4]} hstr {r[5]} | {r[6]} {r[7]} -> {r[8]} {r[9]}deg | len {r[10]} sep {r[11]}')
print(len(out), 'valid')
