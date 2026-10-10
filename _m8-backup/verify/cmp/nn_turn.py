import os, sys
import numpy as np
SCR = sys.argv[1]
sys.argv = [sys.argv[0], SCR, '/tmp/unused']
sys.path.insert(0, os.path.join(SCR, 'verify/cmp'))
import shapes
S = shapes.load_all()
names = [n for n in S if (n.startswith('OSM:') or n.startswith('SD:')) and 'speedway' not in n and n != 'SD:michigan']
P = {n: shapes.ccw(shapes.norm(shapes.resample(S[n], 256)[0])) for n in names}
pairs = []
for i, a in enumerate(names):
    for b in names[i + 1:]:
        pairs.append((shapes.shape_dist(P[a], P[b])[0], a, b))
pairs.sort()
out = []
for d, a, b in pairs[:150]:
    out.append((shapes.turn_dist(P[a], P[b]), d, a, b))
out.sort()
for t in out[:15]:
    print(f'turn {t[0]:.3f} procr {t[1]:.3f} {t[2]} ~ {t[3]}')
