"""Random search over a wider set of local edits; keeps the three heavy braking zones."""
import copy, json, math, os, random, sys, time
SCR = sys.argv[1]
sys.path.insert(0, os.path.join(SCR, 'verify/variants'))
import search as SR
import shapes, build, layout_check
random.seed(7)
PAIRS = [('the Ladder', 'Fernside'), ('the Ladder', 'Kestrel approach'), ('the Ladder', 'Brook run'), ('Fernside', 'Kestrel approach'),
         ('Brook run', 'Kestrel approach'), ('the Ladder', 'back straight'), ('the Ladder', 'Hollow straight'), ('Fernside dive', 'the Ladder'),
         ('Fernside dive', 'Kestrel approach'), ('Brook run', 'Fernside dive'), ('esses link', 'Kestrel approach'), ('Ridge top', 'Fernside dive')]
ARCS = ['the Hollow apex', 'Kestrel hold', 'the Drop apex', 'the Brow apex']
def edit_size(c):
    return (abs(85 - c['sw']) / 15 + abs(c['kink']) / 15 + abs(c['saw'] - 20) / 20 + abs(c['beck'] - 6) / 8 * (1 if c['beck_dir'] == 'left' else 1) +
            (c['beck_dir'] == 'right') * 1.0 + abs(c['drop'] - 27) / 20 + abs(c['brow'] - 24) / 15)
out = []; t0 = time.time(); n = 0
while time.time() - t0 < 900:
    c = dict(sw=random.choice([85, 85, 80, 75, 70, 65]), kink=random.choice([0, 0, 10, -10, 20, -20]),
             saw=random.choice([20, 20, 30, 40, 55]), beck=random.choice([6, 6, 10, 14, 18]), beck_dir=random.choice(['left', 'left', 'right']),
             drop=random.choice([27, 27, 40, 55]), brow=random.choice([24, 24, 32, 40]))
    pr = random.choice(PAIRS); arc = random.choice(ARCS)
    ch = {'sw': c['sw'], 'saw': c['saw'], 'wood': c['saw'] + 4, 'beck': c['beck'], 'drop': c['drop'], 'brow': c['brow']}
    n += 1
    try:
        # build with optional beck direction flip
        P = dict(SR.BASE); P.update(ch)
        build.lap(P)
        if c['beck_dir'] == 'right':
            for s in build.SEGS:
                if s['name'].startswith('Beck bridge'):
                    s['type'] = 'right'; s['bankStart'] = -s['bankStart']; s['bankEnd'] = -s['bankEnd']
        if c['kink']:
            i = build.idx('back straight'); bs = build.SEGS[i]
            f, s2 = copy.deepcopy(bs), copy.deepcopy(bs); f['length'] = s2['length'] = bs['length'] / 2; s2['name'] = 'back straight 2'
            k1 = copy.deepcopy(build.SEGS[build.idx('Windhover right in')]); k2 = copy.deepcopy(build.SEGS[build.idx('Windhover right out')])
            for k, nm, r0, r1 in ((k1, 'Back kink in', 900, 200), (k2, 'Back kink out', 200, 900)):
                k['name'] = nm; k['type'] = 'right' if c['kink'] > 0 else 'left'; k['arc'] = math.radians(abs(c['kink']) / 2)
                k['radiusStart'], k['radiusEnd'] = r0, r1; k['zEnd'] = bs['zEnd']
            build.SEGS[i:i + 1] = [f, k1, k2, s2]
        build.ADJ_STRAIGHTS = pr; build.ADJ_ARC = arc
        lay = build.build(close=True)
        res, fails, bi, oth, a = SR.score(lay)
    except Exception:
        continue
    if fails or res['straight_behind_start_m'] < 180 or len(res['heavy_braking_zones']) < 3:
        continue
    seg = {s['name']: s for s in lay['segments']}
    out.append(dict(min=min(bi, oth[0]), brands=bi, other=oth, c=c, adj=pr, arc=arc, length=res['length_m'], sep=res['min_leg_separation_m'],
                    adjlen={k: round(seg[k]['length']) for k in pr}, arcdeg=round(math.degrees(seg[arc]['arc'])), edit=round(edit_size(c), 2),
                    brk=res['heavy_braking_zones'], grade=res['max_grade_pct']))
out.sort(key=lambda r: -r['min'])
json.dump(out, open(os.path.join(SCR, 'verify/variants/search4_all.json'), 'w'), indent=1)
print(n, 'tried', len(out), 'valid')
for r in out[:15]:
    print(f"min {r['min']:.3f} Brands {r['brands']:.3f} other {r['other'][1]} {r['other'][0]:.3f} edit {r['edit']} | len {r['length']} sep {r['sep']} grade {r['grade']} | {r['c']} | {r['adj']} {r['arc']} -> {r['adjlen']} {r['arcdeg']}deg")
print('--- best per edit budget')
for budget in (1, 1.5, 2, 2.5, 3, 4):
    cand = [r for r in out if r['edit'] <= budget]
    if cand:
        r = cand[0]
        print(f"edit<={budget}: min {r['min']:.3f} Brands {r['brands']:.3f} other {r['other'][1]} {r['other'][0]:.3f} edit {r['edit']} | len {r['length']} | {r['c']} | {r['adj']} {r['arc']} -> {r['adjlen']} {r['arcdeg']}deg")
