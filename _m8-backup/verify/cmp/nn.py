import os, sys, math
import numpy as np
SCR = sys.argv[1]
sys.argv = [sys.argv[0], SCR, '/tmp/unused']
sys.path.insert(0, os.path.join(SCR, 'verify/cmp'))
import shapes
S = shapes.load_all()
# use only OSM + SD to avoid duplicate sources of same circuit; plus F1 ones not in OSM by name heuristics skipped
names = [n for n in S if n.startswith('OSM:') or n.startswith('SD:')]
P = {n: shapes.ccw(shapes.norm(shapes.resample(S[n], 256)[0])) for n in names}
pairs = []
for i, a in enumerate(names):
    for b in names[i + 1:]:
        d = shapes.shape_dist(P[a], P[b])[0]
        pairs.append((d, a, b))
pairs.sort()
for p in pairs[:25]:
    print(f'{p[0]:.3f} {p[1]} ~ {p[2]}')
ds = np.array([p[0] for p in pairs])
print('pairs', len(ds), 'fraction below 0.132:', (ds < 0.132).mean(), 'below 0.15', (ds < 0.15).mean(), 'below 0.2', (ds < 0.2).mean())
