import itertools, json, math, os, sys
SCR = sys.argv[1]
sys.path.insert(0, os.path.join(SCR, 'verify/variants'))
import search as SR  # reuses loaded refs
import shapes, build
out = []
adjs = [(("main straight", "Hollow straight"), "the Hollow apex"), (("the Ladder", "Hollow straight"), "the Hollow apex"),
        (("the Ladder", "back straight"), "Kestrel hold"), (("main straight", "back straight"), "the Hollow apex"),
        (("grid straight", "Hollow straight"), "the Hollow apex"), (("the Ladder", "back straight"), "the Hollow apex")]
for sw, kink, (saw, wood), hstr, (adj, arc) in itertools.product((85, 75, 70, 65, 60), (0, 10, 20, 30, -10, -20), ((20, 24), (30, 34)), (254, 200), adjs):
    ch = {'sw': sw, 'saw': saw, 'wood': wood, 'hstr': hstr}
    try:
        lay = SR.make(ch, kink, adj, arc)
        res, fails, bi, oth, a = SR.score(lay)
    except Exception:
        continue
    if fails or res['straight_behind_start_m'] < 180:
        continue
    seg = {s['name']: s for s in lay['segments']}
    edit = abs(85 - sw) / 15 + abs(kink) / 20 + (saw != 20) + (hstr != 254) * 0.5
    out.append((min(bi, oth[0]), bi, oth, res['length_m'], res['min_leg_separation_m'], ch, kink, adj, arc,
                {k: round(seg[k]['length']) for k in adj}, round(math.degrees(seg[arc]['arc'])), edit, res['heavy_braking_zones']))
out.sort(key=lambda r: -r[0])
for r in out[:30]:
    print(f'min {r[0]:.3f} Brands {r[1]:.3f} other {r[2][1]} {r[2][0]:.3f} | len {r[3]} sep {r[4]} | {r[5]} kink {r[6]} | {r[7]} {r[8]} -> {r[9]} {r[10]}deg | edit {r[11]:.1f} | brk {[(b[0], b[1][:12]) for b in r[12]]}')
print(len(out))
json.dump([[r[0], r[1], r[2], r[5], r[6], list(r[7]), r[8]] for r in out[:60]], open(os.path.join(SCR, 'verify/variants/search2_top.json'), 'w'))
