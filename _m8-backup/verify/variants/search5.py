"""Jogs (heading-neutral S-bends) on the back straight / Hollow straight, and flipped esses."""
import copy, json, math, os, sys, time, itertools
SCR = sys.argv[1]
sys.path.insert(0, os.path.join(SCR, 'verify/variants'))
import search as SR
import shapes, build, layout_check
PAIRS = [('the Ladder', 'Fernside'), ('the Ladder', 'Kestrel approach'), ('the Ladder', 'Brook run'), ('Fernside', 'Kestrel approach'),
         ('Brook run', 'Kestrel approach'), ('the Ladder', 'back straight'), ('the Ladder', 'Hollow straight'), ('Fernside dive', 'the Ladder'),
         ('Fernside dive', 'Kestrel approach'), ('Brook run', 'Fernside dive'), ('the Ladder', 'back straight B'), ('the Ladder', 'Hollow straight B')]
ARCS = ['the Hollow apex', 'Kestrel hold', 'the Drop apex']
def corner(name, typ, deg, r=150.0, z=0.0):
    tmpl = copy.deepcopy(build.SEGS[build.idx('Windhover right in')])
    a, b = copy.deepcopy(tmpl), copy.deepcopy(tmpl)
    for s, nm, r0, r1 in ((a, name + ' in', 900, r), (b, name + ' out', r, 900)):
        s['name'] = nm; s['type'] = typ; s['arc'] = math.radians(deg / 2); s['radiusStart'] = r0; s['radiusEnd'] = r1
        s['zEnd'] = z; s['bankStart'] = s['bankEnd'] = 0.0
    return [a, b]
def jog(straight, first, deg, link=40.0, r=150.0):
    i = build.idx(straight); bs = build.SEGS[i]
    L = bs['length']; z = bs['zEnd']
    A = copy.deepcopy(bs); B = copy.deepcopy(bs); M = copy.deepcopy(bs)
    A['length'] = L / 2 - link / 2; B['length'] = L / 2 - link / 2; M['length'] = link
    A['name'] = straight; M['name'] = straight + ' jog'; B['name'] = straight + ' B'
    second = 'left' if first == 'right' else 'right'
    build.SEGS[i:i + 1] = [A] + corner(straight + ' jog1', first, deg, r, z) + [M] + corner(straight + ' jog2', second, deg, r, z) + [B]
out = []; t0 = time.time()
opts = []
for where in ('back straight', 'Hollow straight', None):
    for first in ('right', 'left'):
        for deg in (20, 30, 40):
            for esses in ('base', 'flip30', 'flip45'):
                if where is None and esses == 'base':
                    continue
                opts.append((where, first, deg, esses))
opts = sorted(set(o if o[0] else (None, 'right', 0, o[3]) for o in opts), key=str)
for (where, first, deg, esses), pr, arc in itertools.product(opts, PAIRS, ARCS):
    try:
        P = dict(SR.BASE)
        if esses != 'base':
            P['saw'] = P['wood'] = int(esses[4:]) - 22  # apex so that total ~ esses deg
        build.lap(P)
        if esses != 'base':
            for s in build.SEGS:
                if s['name'].startswith('Sawpit'):
                    s['type'] = 'left'; s['bankStart'] = -s['bankStart']; s['bankEnd'] = -s['bankEnd']
                elif s['name'].startswith('Woodcutter'):
                    s['type'] = 'right'; s['bankStart'] = -s['bankStart']; s['bankEnd'] = -s['bankEnd']
        if where:
            jog(where, first, deg)
        names = {s['name'] for s in build.SEGS}
        if pr[0] not in names or pr[1] not in names:
            continue
        build.ADJ_STRAIGHTS = pr; build.ADJ_ARC = arc
        lay = build.build(close=True)
        res, fails, bi, oth, a = SR.score(lay)
    except Exception as ex:
        continue
    if fails or res['straight_behind_start_m'] < 180:
        continue
    seg = {s['name']: s for s in lay['segments']}
    out.append(dict(min=min(bi, oth[0]), brands=bi, other=oth, opt=[where, first, deg, esses], adj=pr, arc=arc, length=res['length_m'],
                    sep=res['min_leg_separation_m'], adjlen={k: round(seg[k]['length']) for k in pr}, arcdeg=round(math.degrees(seg[arc]['arc'])),
                    brk=res['heavy_braking_zones'], nbrk=len(res['heavy_braking_zones'])))
out.sort(key=lambda r: (-(r['nbrk'] >= 3), -r['min']))
json.dump(out, open(os.path.join(SCR, 'verify/variants/search5_all.json'), 'w'), indent=1)
print(len(out), 'valid', round(time.time() - t0), 's')
for r in out[:20]:
    print(f"min {r['min']:.3f} Brands {r['brands']:.3f} other {r['other'][1]} {r['other'][0]:.3f} brk {r['nbrk']} | len {r['length']} sep {r['sep']} | {r['opt']} | {r['adj']} {r['arc']} -> {r['adjlen']} {r['arcdeg']}deg")
