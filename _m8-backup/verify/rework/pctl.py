import os, sys, random, json
import numpy as np
SCR = sys.argv[1]
sys.argv = [sys.argv[0], SCR, '/tmp/unused']
sys.path.insert(0, os.path.join(SCR, 'verify/cmp'))
import shapes
S = shapes.load_all()
R = {n: shapes.ccw(shapes.norm(shapes.resample(p, 256)[0])) for n, p in S.items()}
names = sorted(R)
def key(n):  # crude identity grouping so duplicates (F1/TUM/OSM of the same circuit) are skipped
    return n.split(':', 1)[1].lower().replace(' ', '')[:5]
pr = []; tr = []
random.seed(1)
pairs = [(a, b) for i, a in enumerate(names) for b in names[i + 1:] if key(a) != key(b)]
for a, b in pairs:
    pr.append(shapes.shape_dist(R[a], R[b])[0])
sample = random.sample(pairs, 2500)
for a, b in sample:
    tr.append(shapes.turn_dist(R[a], R[b]))
pr = np.array(pr); tr = np.array(tr)
for v in (0.132, 0.2, 0.203, 0.211, 0.217):
    print(f'procr < {v}: {100 * (pr < v).mean():.1f}% of {len(pr)} pairs')
for v in (0.349, 0.478, 0.547):
    print(f'turn  < {v}: {100 * (tr < v).mean():.1f}% of {len(tr)} sampled pairs')
print('procr median', round(float(np.median(pr)), 3), 'turn median', round(float(np.median(tr)), 3))
