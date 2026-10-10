import itertools, json, math, os, sys, time
SCR = sys.argv[1]
sys.path.insert(0, os.path.join(SCR, 'verify/rework'))
sys.argv = [sys.argv[0], SCR]
import rsearch as R
tmp = os.path.join(SCR, 'verify/rework/_tmp2.json')
out = []
t0 = time.time()
for sw, kink, frac, back, kr in itertools.product((62, 65, 68), (9, 10, 11, 12), (0.3, 0.34, 0.37, 0.4), (390, 400, 410, 420), (200, 300)):
    if back * (1 - frac) < 252:
        continue
    try:
        lay = R.make({'sw': sw, 'back': back}, kink, frac, kr=kr)
        res, fails, bi, rows, a = R.score(lay, tmp)
    except Exception:
        continue
    if fails:
        continue
    seg = {s['name']: s for s in lay['segments']}
    out.append(dict(minall=rows[0][0], nearest=rows[0][1], second=rows[1], brands=bi, sw=sw, kink=kink, frac=frac, back=back, kr=kr,
                    hstr=round(seg['Hollow straight']['length']), ladder=round(seg['the Ladder']['length']),
                    hol=round(math.degrees(seg['the Hollow apex']['arc'])), L=res['length_m'], sep=res['min_leg_separation_m'],
                    braking=[b[1] for b in res['heavy_braking_zones']]))
print(len(out), 'valid', round(time.time() - t0), 's')
out.sort(key=lambda o: -o['minall'])
json.dump(out, open(os.path.join(SCR, 'verify/rework/rsearch2_all.json'), 'w'), indent=0)
for o in out[:25]:
    print(round(o['minall'], 3), o['nearest'], round(o['brands'], 3), 'sw', o['sw'], 'k', o['kink'], o['frac'], o['back'], o['kr'], 'hstr', o['hstr'], 'lad', o['ladder'], 'hol', o['hol'], o['L'], o['sep'], len(o['braking']))
