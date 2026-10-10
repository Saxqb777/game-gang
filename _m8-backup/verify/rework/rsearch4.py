import itertools, json, math, os, sys, time
SCR = sys.argv[1]
sys.path.insert(0, os.path.join(SCR, 'verify/rework'))
sys.argv = [sys.argv[0], SCR]
import rsearch as R
tmp = os.path.join(SCR, 'verify/rework/_tmp4.json')
out = []
t0 = time.time()
for sw, kink, meadow, second, (kin, kr) in itertools.product((60, 62, 65, 68), (9, 10, 11, 12), (50, 70, 90, 110, 130), (255, 265, 280, 295),
                                                          ((1200, 400), (1500, 420), (1000, 320))):
    back = meadow + second
    try:
        lay = R.make({'sw': sw, 'back': back}, kink, meadow / back, kr=kr, kin=kin)
        res, fails, bi, rows, a = R.score(lay, tmp)
    except Exception:
        continue
    if fails:
        continue
    seg = {s['name']: s for s in lay['segments']}
    out.append(dict(minall=rows[0][0], nearest=rows[0][1], brands=bi, sw=sw, kink=kink, meadow=meadow, second=second, kr=kr, kin=kin,
                    hstr=round(seg['Hollow straight']['length']), ladder=round(seg['the Ladder']['length']),
                    hol=round(math.degrees(seg['the Hollow apex']['arc'])), L=res['length_m'], sep=res['min_leg_separation_m'],
                    braking=[b[1] for b in res['heavy_braking_zones']]))
print(len(out), 'valid', round(time.time() - t0), 's')
out.sort(key=lambda o: -o['minall'])
json.dump(out, open(os.path.join(SCR, 'verify/rework/rsearch4_all.json'), 'w'), indent=0)
for o in out[:30]:
    print(round(o['minall'], 3), o['nearest'], round(o['brands'], 3), 'sw', o['sw'], 'k', o['kink'], o['meadow'], o['second'], o['kin'], o['kr'], 'hstr', o['hstr'], 'lad', o['ladder'], 'hol', o['hol'], o['L'], o['sep'], len(o['braking']))
