"""Shape comparison of the final layout against every closed Speed Dreams track and candidates a-d.
Turning-function distance (judge_t1 method) and Procrustes error (judge_t1 'pr', mirror + reverse + shift)."""
import json, math, glob, os, sys, importlib.util
import numpy as np
S = '/tmp/claude-0/-home-user-game-gang/8e5cf0a2-6c34-58a5-b66f-d0d21f7d6bf9/scratchpad'
spec = importlib.util.spec_from_file_location('sdt', S + '/tools/sd_tracks.py'); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
sys.path.insert(0, S + '/tools')
from layout_check import integrate
def lay_pts(path):
    d = json.load(open(path)); return [(p[0], p[1]) for p in integrate(d, 1.0)[0]]
def resample(pts, N=400):
    P = np.array(pts, float); d = np.r_[0, np.cumsum(np.hypot(*np.diff(P, axis=0).T))]
    t = np.linspace(0, d[-1], N, endpoint=False)
    return np.c_[np.interp(t, d, P[:, 0]), np.interp(t, d, P[:, 1])]
def tdist(A, B):
    def norm(P):
        D = np.diff(np.r_[P, P[:1]], axis=0); a = np.unwrap(np.arctan2(D[:, 1], D[:, 0]))
        if a[-1] - a[0] < 0:
            P = P[::-1]; D = np.diff(np.r_[P, P[:1]], axis=0); a = np.unwrap(np.arctan2(D[:, 1], D[:, 0]))
        return a - np.linspace(0, 2 * np.pi, len(a), endpoint=False)
    fa = norm(A); best = 1e9
    for B2 in (B, B * np.array([-1, 1])):
        fb = norm(B2)
        for sh in range(0, len(fb), 2):
            diff = fa - np.roll(fb, sh); diff = diff - diff.mean()
            best = min(best, math.sqrt((diff ** 2).mean()))
    return best
def pr(A, B):
    A = A[::2]; B = B[::2]
    a = A - A.mean(0); a /= np.sqrt((a ** 2).sum()); best = 9
    for Bm in (B, B * np.array([-1, 1])):
        for B2 in (Bm, Bm[::-1]):
            b0 = B2 - B2.mean(0); b0 /= np.sqrt((b0 ** 2).sum())
            for sh in range(len(b0)):
                b = np.roll(b0, sh, axis=0); M = b.T @ a
                U, s, Vt = np.linalg.svd(M); d = np.sign(np.linalg.det(U @ Vt)); e = 2 - 2 * (s[0] + d * s[1])
                best = min(best, e)
    return best
final = resample(lay_pts(sys.argv[1]))
cands = {k: resample(lay_pts(f'{S}/layouts/{k}/base.layout.json')) for k in 'abcd'}
sd = {}
for f in glob.glob(S + '/sd-extract/usr/share/games/speed-dreams/tracks/*/*/*.xml'):
    n = os.path.basename(os.path.dirname(f))
    if os.path.basename(f) != n + '.xml': continue
    try:
        pts, L, gap = m.outline(m.segments(open(f, encoding='latin1').read()))
        if L < 500 or gap > 200: continue
        sd[n] = resample(pts)
    except Exception: pass
r = sorted((tdist(final, B), n) for n, B in sd.items())
print('turning distance, nearest SD:', [(n, round(v, 2)) for v, n in r[:5]])
print('  g-track-2 %.2f  Corkscrew %.2f  ruudskogen %.2f' % (tdist(final, sd['g-track-2']), tdist(final, sd['Corkscrew']), tdist(final, sd['ruudskogen'])))
rp = sorted((pr(final, B), n) for n, B in sd.items())
print('procrustes, nearest SD:', [(n, round(v, 3)) for v, n in rp[:5]])
print('  g-track-2 %.3f  Corkscrew %.3f  ruudskogen %.3f' % (pr(final, sd['g-track-2']), pr(final, sd['Corkscrew']), pr(final, sd['ruudskogen'])))
print('vs candidates (turning / procrustes):', {k: (round(tdist(final, c), 2), round(pr(final, c), 3)) for k, c in cands.items()})
