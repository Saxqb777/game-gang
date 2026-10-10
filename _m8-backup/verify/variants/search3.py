import itertools, json, math, os, sys, time
SCR = sys.argv[1]
sys.path.insert(0, os.path.join(SCR, 'verify/variants'))
import search as SR
import shapes, build
A = ['the Ladder', 'Kestrel approach', 'Fernside dive', 'Brook run', 'Fernside', 'Ridge top']
B = ['main straight', 'grid straight', 'Hollow straight', 'back straight', 'back straight 2', 'the Ladder', 'Kestrel approach']
pairs = sorted({tuple(sorted((a, b))) for a in A for b in B if a != b})
arcs = ['the Hollow apex', 'Kestrel hold', 'the Drop apex']
out = []; t0 = time.time()
for sw, kink, (saw, wood), pr, arc in itertools.product((85, 75, 70, 65), (0, 10, 15, 20, -10), ((20, 24), (30, 34)), pairs, arcs):
    if kink == 0 and 'back straight 2' in pr:
        continue
    ch = {'sw': sw, 'saw': saw, 'wood': wood}
    try:
        lay = SR.make(ch, kink, pr, arc)
        res, fails, bi, oth, a = SR.score(lay)
    except Exception:
        continue
    if fails or res['straight_behind_start_m'] < 180 or len(res['heavy_braking_zones']) < 3:
        continue
    seg = {s['name']: s for s in lay['segments']}
    out.append(dict(min=min(bi, oth[0]), brands=bi, other=oth, length=res['length_m'], sep=res['min_leg_separation_m'], ch=ch, kink=kink,
                    adj=pr, arc=arc, adjlen={k: round(seg[k]['length']) for k in pr}, arcdeg=round(math.degrees(seg[arc]['arc'])),
                    brk=res['heavy_braking_zones'], longest=res['longest_straight_m']))
out.sort(key=lambda r: -r['min'])
json.dump(out[:80], open(os.path.join(SCR, 'verify/variants/search3_top.json'), 'w'), indent=1)
for r in out[:20]:
    print(f"min {r['min']:.3f} Brands {r['brands']:.3f} other {r['other'][1]} {r['other'][0]:.3f} | len {r['length']} sep {r['sep']} | {r['ch']} kink {r['kink']} | {r['adj']} {r['arc']} -> {r['adjlen']} {r['arcdeg']}deg | brk {[(b[0], b[1][:10], b[2]) for b in r['brk']]}")
print(len(out), 'valid', round(time.time() - t0), 's')
