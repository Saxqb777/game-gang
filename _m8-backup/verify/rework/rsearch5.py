import itertools, json, math, os, sys, time
SCR = sys.argv[1]
sys.path.insert(0, os.path.join(SCR, 'verify/rework'))
sys.argv = [sys.argv[0], SCR]
import rsearch as R
import shapes
tmp = os.path.join(SCR, 'verify/rework/_tmp5.json')
out = []
t0 = time.time()
GB = R.REFS['OSM:BrandsHatchIndy']
for sw, meadow, second, (kin, kr), esses in itertools.product((62, 65), (60, 80, 100, 120, 140), (255, 265, 275, 285, 295),
                                                          ((1000, 320), (1200, 400)), ((20, 24), (26, 30))):
    back = meadow + second
    try:
        lay = R.make({'sw': sw, 'back': back, 'saw': esses[0], 'wood': esses[1]}, 10, meadow / back, kr=kr, kin=kin)
        res, fails, bi, rows, a = R.score(lay, tmp)
    except Exception:
        continue
    if fails or not (3250 <= res['length_m'] <= 3390):
        continue
    real = [r for r in rows if not r[1].startswith('SD:')]
    sd = [r for r in rows if r[1].startswith('SD:')]
    g2 = [d for d, n in rows if n == 'SD:g-track-2'][0]
    seg = {s['name']: s for s in lay['segments']}
    o = dict(real=real[0][0], realn=real[0][1], sd=sd[0][0], sdn=sd[0][1], brands=bi, g2=g2, sw=sw, meadow=meadow, second=second, kin=kin, kr=kr, esses=esses,
             hstr=round(seg['Hollow straight']['length']), ladder=round(seg['the Ladder']['length']),
             hol=round(math.degrees(seg['the Hollow apex']['arc'])), L=res['length_m'], sep=res['min_leg_separation_m'],
             nbrake=len(res['heavy_braking_zones']))
    o['score'] = min(o['real'], o['brands'] - 0.005, o['g2'] - 0.01)
    out.append(o)
print(len(out), 'valid', round(time.time() - t0), 's')
out.sort(key=lambda o: -o['score'])
json.dump(out, open(os.path.join(SCR, 'verify/rework/rsearch5_all.json'), 'w'), indent=0)
for o in out[:20]:
    o['turnB'] = None
    print(f"score {o['score']:.3f} real {o['real']:.3f} {o['realn']:16s} sd {o['sd']:.3f} {o['sdn']:12s} brands {o['brands']:.3f} g2 {o['g2']:.3f} | sw {o['sw']} m {o['meadow']} s {o['second']} {o['kin']}/{o['kr']} esses {o['esses']} hstr {o['hstr']} lad {o['ladder']} hol {o['hol']} L {o['L']} nb {o['nbrake']}")
