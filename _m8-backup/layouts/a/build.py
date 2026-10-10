"""Build base.layout.json for the Track 1 design, closing the loop numerically.

Usage: python3 -I build.py [--noclose]
Free variables for closure are marked in the plan with FREE_* tags below.
"""
import json, math, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
D = math.radians

# ---------- side presets ----------
def side(kerb=0.0, kh=0.05, r0=8, r1=None, surf='grass', bar='armco'):
    return {'kerbWidth': kerb, 'kerbHeight': kh if kerb else 0.0, 'runoffStart': r0,
            'runoffEnd': r0 if r1 is None else r1, 'runoffSurface': surf, 'barrier': bar}

# ---------- plan ----------
# Each entry: dict(name, kind, ...). kind 'S' straight (L), 'L'/'R' arc (r0, r1, deg).
# z = absolute elevation at segment end. bank in rad (+ = right edge higher).
PLAN = []
def S(name, L, z, w=12, b0=0.0, b1=0.0, left=None, right=None, free=None):
    PLAN.append(dict(name=name, kind='S', L=L, z=z, w=w, b0=b0, b1=b1,
                     left=left or side(), right=right or side(), free=free))
def C(name, kind, r0, r1, deg, z, w=12, b0=0.0, b1=0.0, left=None, right=None, free=None):
    PLAN.append(dict(name=name, kind=kind, r0=r0, r1=r1, arc=D(deg), z=z, w=w, b0=b0, b1=b1,
                     left=left or side(), right=right or side(), free=free))

def seglen(p):
    if p['kind'] == 'S':
        return p['L']
    return 2 * p['arc'] / (1 / p['r0'] + 1 / p['r1'])

def integrate(plan, step=0.5):
    x = y = h = 0.0
    pts = [(0.0, 0.0, 0.0)]
    s = 0.0
    for p in plan:
        L = seglen(p)
        if p['kind'] == 'S':
            k0 = k1 = 0.0
        else:
            sg = 1 if p['kind'] == 'L' else -1
            k0, k1 = sg / p['r0'], sg / p['r1']
        n = max(1, int(math.ceil(L / step)))
        ds = L / n
        for i in range(n):
            k = k0 + (k1 - k0) * (i + 0.5) / n
            hm = h + k * ds / 2
            x += math.cos(hm) * ds; y += math.sin(hm) * ds; h += k * ds; s += ds
            pts.append((x, y, s))
    return x, y, h, pts

def residual(plan):
    x, y, h, _ = integrate(plan, step=1.0)
    return [x, y, h + 2 * math.pi]   # clockwise lap: net heading -2*pi

def close(plan, iters=40):
    """Newton on three free variables: tags 'x' and 'y' (straight lengths) and 'h' (arc angle)."""
    fv = {}
    for p in plan:
        if p.get('free'):
            fv[p['free']] = p
    keys = ['L1', 'L2', 'A']
    def get(k):
        p = fv[k]; return p['L'] if k.startswith('L') else p['arc']
    def put(k, v):
        p = fv[k]
        if k.startswith('L'): p['L'] = v
        else: p['arc'] = v
    for it in range(iters):
        r = residual(plan)
        if math.hypot(r[0], r[1]) < 0.02 and abs(r[2]) < 1e-6:
            break
        J = []
        for k in keys:
            v = get(k); e = 1e-3 if k.startswith('L') else 1e-6
            put(k, v + e); r2 = residual(plan); put(k, v)
            J.append([(a - b) / e for a, b in zip(r2, r)])
        # solve J^T dx = -r (J is list of columns)
        import numpy as np
        A = np.array(J).T
        dx = np.linalg.solve(A, -np.array(r))
        for k, d in zip(keys, dx):
            put(k, get(k) + d)
    return residual(plan)

# ---------- lap time estimate (point mass) ----------
def laptime(plan, vmax=64.0, glat=1.30, gbrk=1.20, accel=6.0, step=2.0):
    g = 9.81
    ks = []
    for p in plan:
        L = seglen(p)
        n = max(1, int(math.ceil(L / step)))
        for i in range(n):
            if p['kind'] == 'S':
                k = 0.0
            else:
                k = 1 / (p['r0'] + (p['r1'] - p['r0']) * (i + 0.5) / n)
            ks.append((k, L / n))
    N = len(ks)
    vlim = [min(vmax, math.sqrt(glat * g / k) if k > 0 else vmax) for k, _ in ks]
    v = vlim[:]
    for _ in range(2):
        for i in range(1, 2 * N):
            a, b = (i - 1) % N, i % N
            ds = ks[b][1]
            acc = accel * max(0.0, 1 - (v[a] / vmax) ** 2) + 0.3
            v[b] = min(v[b], math.sqrt(v[a] ** 2 + 2 * acc * ds))
        for i in range(2 * N, 0, -1):
            a, b = i % N, (i - 1) % N
            ds = ks[a][1]
            v[b] = min(v[b], math.sqrt(v[a] ** 2 + 2 * gbrk * g * ds))
    t = sum(ds / max(1.0, vv) for (k, ds), vv in zip(ks, v))
    return t, max(v) * 3.6, min(v) * 3.6

def to_layout(plan, name, startZ):
    segs = []
    for p in plan:
        if p['kind'] == 'S':
            seg = dict(name=p['name'], type='straight', length=round(p['L'], 4), radiusStart=0, radiusEnd=0, arc=0)
        else:
            seg = dict(name=p['name'], type='left' if p['kind'] == 'L' else 'right', length=0,
                       radiusStart=p['r0'], radiusEnd=p['r1'], arc=round(p['arc'], 7))
        seg.update(zEnd=p['z'], tangentStart=None, tangentEnd=None, bankStart=p['b0'], bankEnd=p['b1'],
                   roadWidth=p['w'], left=p['left'], right=p['right'])
        segs.append(seg)
    return {
        'format': 'splitways-layout@1', 'name': name,
        'licence': 'Proprietary - (C) 2026 Gamer Gang project. All rights reserved.',
        'credits': ['Original layout by the Gamer Gang project, 2026'],
        'source': {'package': 'original', 'file': '', 'readme': '', 'readmeLicence': '',
                   'notes': 'Original design, not derived from any existing track'},
        'startZ': startZ, 'segments': segs,
    }

if __name__ == '__main__':
    sys.path.insert(0, HERE)
    import design  # noqa: E402  (fills PLAN via S/C)
    plan = design.build(S, C, side)
    if '--noclose' not in sys.argv:
        r = close(PLAN)
        print('residual', [round(v, 4) for v in r])
    for p in PLAN:
        tag = f"  [{p['free']}]" if p.get('free') else ''
        if p['kind'] == 'S':
            print(f"{p['name']:<28} S  L={p['L']:7.1f}{tag}")
        else:
            print(f"{p['name']:<28} {p['kind']}  r={p['r0']:>5}->{p['r1']:<5} arc={math.degrees(p['arc']):6.1f}  len={seglen(p):6.1f}{tag}")
    t, vtop, vmin = laptime(PLAN)
    t2, _, _ = laptime(PLAN, vmax=60.0, glat=1.05, gbrk=1.0, accel=5.0)
    print(f'lap est (fast): {t:.1f} s  vtop {vtop:.0f} km/h  vmin {vmin:.0f} km/h | (party pace) {t2:.1f} s')
    lay = to_layout(PLAN, design.NAME, design.START_Z)
    json.dump(lay, open(os.path.join(HERE, 'base.layout.json'), 'w'), indent=1)
