"""Coarse random search over the layout parameters: closure is solved exactly by build.close_loop
(Ladder + back straight for position, Hollow apex for heading); this scores the soft targets."""
import sys, os, math, random, json, copy
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', 'tools'))
import build
from geom import close_loop, integrate, seg_len

RANGES = dict(
    main=(240, 280), t1=(68, 82), brook=(70, 110), saw=(20, 32), link=(30, 50), wood=(10, 24),
    brow=(18, 44), ridge=(30, 120), wh=(3.5, 5.0), appr=(80, 140), k_tight=(60, 75), k_hold=(75, 95),
    talon=(16, 34), fern=(50, 110), drop=(24, 44), dive=(95, 150), beck=(-7, 7), hstr=(255, 290), sw=(90, 100),
)
import numpy as np
sys.path.insert(0, os.path.join(HERE, 'tools'))
from layout_check import integrate as ck_integrate
def _res(pts, N=200):
    P_ = np.array(pts, float); d = np.r_[0, np.cumsum(np.hypot(*np.diff(P_, axis=0).T))]
    t = np.linspace(0, d[-1], N, endpoint=False)
    return np.c_[np.interp(t, d, P_[:, 0]), np.interp(t, d, P_[:, 1])]
def _pr(A, B):
    a = A - A.mean(0); a /= np.sqrt((a ** 2).sum()); best = 9
    for Bm in (B, B * np.array([-1, 1])):
        for B2 in (Bm, Bm[::-1]):
            b0 = B2 - B2.mean(0); b0 /= np.sqrt((b0 ** 2).sum())
            for sh in range(0, len(b0), 2):
                b = np.roll(b0, sh, axis=0); M = b.T @ a
                U, s, Vt = np.linalg.svd(M); dd = np.sign(np.linalg.det(U @ Vt)); e = 2 - 2 * (s[0] + dd * s[1])
                best = min(best, e)
    return best
_D = _res([(p[0], p[1]) for p in ck_integrate(json.load(open(os.path.join(HERE, '..', 'd', 'base.layout.json'))), 2.0)[0]], 100)
W_D = float(os.environ.get('W_D', '0'))
ASPECT = float(os.environ.get('ASPECT', '9'))


def evaluate(P):
    build.lap(P)
    S = build.SEGS
    try:
        close_loop(S, build.START_Z, (build.idx('the Ladder'), build.idx('back straight')),
                   build.idx('the Hollow apex'), target_turns=1)
    except ValueError:
        return None
    pts, ends = integrate(S, build.START_Z, step=2.0)
    L = pts[-1][3]
    lad = S[build.idx('the Ladder')]['length']
    back = S[build.idx('back straight')]['length']
    hol = math.degrees(S[build.idx('the Hollow apex')]['arc'])
    # separation (> 500 m apart along lap)
    sub = pts[::int(os.environ.get("SUB", "5"))]
    sep = 1e9
    for i in range(len(sub)):
        for j in range(i + 1, len(sub)):
            da = abs(sub[i][3] - sub[j][3])
            if min(da, L - da) < 500:
                continue
            d = math.hypot(sub[i][0] - sub[j][0], sub[i][1] - sub[j][1])
            sep = min(sep, d)
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    bbox = (max(xs) - min(xs), max(ys) - min(ys))
    gmax = 0.0; z0 = build.START_Z
    for s in S:
        gmax = max(gmax, abs(s['zEnd'] - z0) / seg_len(s)); z0 = s['zEnd']
    climb = gmax
    cost = 0.0
    cost += (max(0, L - 3395) + max(0, 3360 - L)) ** 2 * 0.05
    cost += (max(0, 180 - lad) + max(0, lad - 225)) ** 2 * 0.1
    cost += (max(0, 395 - back) + max(0, back - 425)) ** 2 * 0.1
    cost += (max(0, 50 - hol) + max(0, hol - 78)) ** 2 * 0.2
    cost += max(0, float(os.environ.get("SEP", "120")) - sep) ** 2 * 1.0
    cost += max(0, climb - 0.065) * 1e5
    aspect = bbox[1] / bbox[0]
    cost += max(0, aspect - ASPECT) ** 2 * 300
    dd = None
    if W_D > 0:
        dd = _pr(_res([(p[0], p[1]) for p in pts], 100), _D)
        cost += max(0, W_D - dd) ** 2 * 2e5
    return cost, dict(L=round(L, 1), ladder=round(lad, 1), back=round(back, 1), hol=round(hol, 1),
                      sep=round(sep, 1), bbox=(round(bbox[0]), round(bbox[1])), climb=round(climb * 100, 2), dd=dd and round(dd, 3))


if __name__ == '__main__':
    random.seed(int(sys.argv[1]) if len(sys.argv) > 1 else 1)
    best = copy.deepcopy(build.P)
    r = evaluate(best)
    bc = r[0] if r else 1e18
    print('start', r)
    for it in range(int(os.environ.get('ITERS', '1500'))):
        cand = copy.deepcopy(best)
        keys = random.sample(list(RANGES), random.randint(1, 3))
        for k in keys:
            lo, hi = RANGES[k]
            span = (hi - lo) * (0.35 if it < 600 else 0.12)
            cand[k] = min(hi, max(lo, cand[k] + random.uniform(-span, span)))
            if k not in ('wh',):
                cand[k] = round(cand[k])
            else:
                cand[k] = round(cand[k], 1)
        r = evaluate(cand)
        if r and r[0] < bc:
            bc, best = r[0], cand
            print(it, round(bc, 2), r[1])
    print(json.dumps(best))
