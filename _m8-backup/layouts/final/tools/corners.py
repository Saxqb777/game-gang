"""Per-corner report for DESIGN.md using the judges' shared speed model (judge_t1/lap.py):
grippy = 1.15 g, 1.05 g braking, 230 km/h; soft = 0.95 g, 0.9 g braking, 210 km/h."""
import json, math, sys, os
import numpy as np
S = '/tmp/claude-0/-home-user-game-gang/8e5cf0a2-6c34-58a5-b66f-d0d21f7d6bf9/scratchpad'
src = open(S + '/judge_t1/lap.py').read().split('def corners(d):')[0]
exec(src)
d = json.load(open(sys.argv[1]))
t1, v1, names, k = lap(d)
t2, v2, _, _ = lap(d, mu=0.95, brake=0.9, vmax=210 / 3.6, pw=200)
# also a 'party' model: 0.85 g, 0.8 g braking, 200 km/h (assists + touch steering)
t3, v3, _, _ = lap(d, mu=0.85, brake=0.8, vmax=200 / 3.6, pw=180)
print('lap: grippy %.1f s, soft %.1f s, party %.1f s' % (t1, t2, t3))
segs = d['segments']
# group segments into corners by base name (strip entry/apex/... suffixes)
def base(n):
    for suf in (' entry', ' apex', ' exit', ' crest', ' tighten', ' hold', ' in', ' out'):
        if n.endswith(suf):
            return n[:-len(suf)]
    return n
s0 = 0.0; groups = []; z = d['startZ']
for sg in segs:
    L = sg['length'] if sg['type'] == 'straight' else 2 * sg['arc'] / (1 / sg['radiusStart'] + 1 / sg['radiusEnd'])
    b = base(sg['name'])
    if groups and groups[-1]['name'] == b:
        g = groups[-1]
    else:
        g = {'name': b, 'type': sg['type'], 's0': s0, 'deg': 0, 'rmin': 1e9, 'z0': z, 'w': sg['roadWidth'], 'bank': 0}
        groups.append(g)
    g['s1'] = s0 + L; g['z1'] = sg['zEnd']
    if sg['type'] != 'straight':
        g['deg'] += math.degrees(sg['arc']); g['rmin'] = min(g['rmin'], sg['radiusStart'], sg['radiusEnd'])
        g['bank'] = max(g['bank'], abs(sg['bankStart']), abs(sg['bankEnd']))
    s0 += L; z = sg['zEnd']
n = len(v1)
for g in groups:
    i0, i1 = int(g['s0']), min(n - 1, int(g['s1']))
    seg = slice(i0, max(i0 + 1, i1))
    vmin1 = v1[seg].min() * 3.6; vmin2 = v2[seg].min() * 3.6; vmin3 = v3[seg].min() * 3.6
    vin1 = v1[i0] * 3.6; vout1 = v1[i1] * 3.6
    L = g['s1'] - g['s0']
    if g['type'] == 'straight':
        print('%-18s straight  s %4.0f-%4.0f L %4.0f  z %5.1f->%5.1f (%+.1f%%) w %.1f  v %3.0f->%3.0f peak %3.0f (soft peak %3.0f)' % (
            g['name'], g['s0'], g['s1'], L, g['z0'], g['z1'], 100 * (g['z1'] - g['z0']) / L, g['w'], vin1, vout1, v1[seg].max() * 3.6, v2[seg].max() * 3.6))
    else:
        print('%-18s %-5s %3.0f deg Rmin %3.0f  s %4.0f-%4.0f L %4.0f  z %5.1f->%5.1f  w %.1f bank %.2f  min %3.0f (soft %3.0f, party %3.0f) in %3.0f out %3.0f' % (
            g['name'], g['type'], g['deg'], g['rmin'], g['s0'], g['s1'], L, g['z0'], g['z1'], g['w'], g['bank'], vmin1, vmin2, vmin3, vin1, vout1))
