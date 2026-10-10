import numpy as np, math
exec(open(__file__.replace('tonecalc2.py', 'tonecalc.py')).read().split('base = dict')[0])
def colm(*cols): return np.array(cols).T
S2R = colm((0.6274, 0.0691, 0.0164), (0.3293, 0.9195, 0.0880), (0.0433, 0.0113, 0.8956))
R2S = colm((1.6605, -0.1246, -0.0182), (-0.5876, 1.1329, -0.1006), (-0.0728, -0.0083, 1.1187))
INS = colm((0.856627153315983, 0.137318972929847, 0.11189821299995), (0.0951212405381588, 0.761241990602591, 0.0767994186031903), (0.0482516061458583, 0.101439036467562, 0.811302368396859))
OUTS = colm((1.1271005818144368, -0.1413297634984383, -0.14132976349843826), (-0.11060664309660323, 1.157823702216272, -0.11060664309660294), (-0.016493938717834573, -0.016493938717834257, 1.2519364065950405))
def agx(c):
    c = INS @ (S2R @ c)
    c = np.log2(np.maximum(c, 1e-10))
    c = np.clip((c + 12.47393) / (4.026069 + 12.47393), 0, 1)
    x2 = c * c; x4 = x2 * x2
    c = 15.5 * x4 * x2 - 40.14 * x4 * c + 31.96 * x4 - 6.868 * x2 * c + 0.4298 * x2 + 0.1191 * c - 0.00232
    c = OUTS @ c
    c = np.maximum(c, 0) ** 2.2
    return np.clip(R2S @ c, 0, 1)
def neutral(c):
    c = c.copy()
    x = c.min(); off = x - 6.25 * x * x if x < 0.08 else 0.04
    c -= off
    peak = c.max(); start = 0.76
    if peak < start: return np.clip(c, 0, 1)
    d = 1 - start; newPeak = 1 - d * d / (peak + d - start)
    c *= newPeak / peak
    g = 1 - 1 / (0.15 * (peak - newPeak) + 1)
    return np.clip(c + (newPeak - c) * g, 0, 1)
def contrast(c, k, pivot=0.18):
    # log-space contrast around pivot, applied before the curve
    return pivot * (np.maximum(c, 1e-6) / pivot) ** k
TM = {'aces': lambda c: aces(c), 'agx': agx, 'neutral': neutral}
def grade(L, P):
    c = L * P['exposure'] * np.array(P['tint'])
    if P.get('contrast', 1) != 1: c = contrast(c, P['contrast'])
    g = c @ np.array([0.2126, 0.7152, 0.0722])
    c = np.maximum(g + (c - g) * P['sat'], 0)
    c = TM[P.get('tm', 'aces')](c)
    return np.round(srgb(c) * 255).astype(int)
SKY_H = np.array([0.379, 0.583, 1.014])
exec(open(__file__.replace('tonecalc2.py', 'tonecalc.py')).read().split('SKY_H = np.array([0.379, 0.583, 1.014])  # syferfontein capped-8 horizontal irradiance')[1].split('cur = dict')[0])
hero = dict(base, sunHex='#ffe2b4', tint=[1.0, 1.0, 1.0], sat=1.0,
    road=0.065, grass=np.array([0.118, 0.152, 0.03]) * np.array([0.72, 0.86, 1.35]), gravel=np.array([0.213, 0.198, 0.16]) * np.array([1.0, 0.97, 0.92]),
    kerbW=s2l('#e6e4de'), floor=np.array([0.222, 0.114, 0.044]) * np.array([0.62, 0.78, 0.95]),
    pineTip=s2l('#3f5a3c'), pineMid=s2l('#2e4733'), pineAO=s2l('#1a2b20'), trunk=s2l('#8a5a3a'))
import sys
keys = ['road lit', 'road shadow', 'rubber lit', 'grass lit', 'grass shadow', 'gravel lit', 'kerb white lit', 'kerb red lit', 'floor lit',
        'pine tip, sun side (vert)', 'pine mid, sun side', 'pine shadow side', 'pine inner AO', 'trunk upper sunlit', 'armco/concrete lit vert', 'concrete shadow vert',
        'sky horizon away', 'sky 10deg away', 'sky zenith', 'sky toward sun 2deg']

_scene = scene
def scene(P):
    global SKY_H
    if P.get('misty'):
        SKY_H = np.array([3.358, 3.457, 3.763]); P['sky'] = {'horizon away': [0.73, 0.76, 0.835], 'horizon side': [0.676, 0.677, 0.723], '10deg away': [0.639, 0.708, 0.847], 'zenith': [0.382, 0.444, 0.576], 'toward sun 2deg': [3.161, 3.053, 2.883]}
    hi = P.get('hemi', 0.0)
    if hi:
        skyc = s2l(P.get('hemiSky', '#dfe4e2')); grc = s2l(P.get('hemiGround', '#3a4430'))
        # fold hemisphere into the sky irradiance used by scene(): horizontal sees sky colour, vertical sees the mean
        old = SKY_H.copy()
        SKY_H = old + hi * skyc / max(P['env'], 1e-6)
        r = _scene(P)
        SKY_H = old
        return r
    return _scene(P)
variants = []
for spec in sys.argv[1:]:
    kv = dict(x.split('=') for x in spec.split(','))
    P = dict(hero)
    for k, v in kv.items():
        P[k] = [float(t) for t in v.split('/')] if k == 'tint' else v if k in ('tm', 'sunHex', 'hemiSky', 'hemiGround') else (s2l(v) if k in ('kerbR','kerbW','pineTip','pineMid','pineAO','trunk') else float(v))
    variants.append((spec, scene(P)))
print('%-26s' % 'surface' + ''.join('| V%d %-12s' % (i, '') for i in range(len(variants))))
for i, (s, _) in enumerate(variants): print('V%d = %s' % (i, s))
for k in keys:
    print('%-26s' % k + ''.join('| %-15s' % ' '.join('%3d' % x for x in r[k]) for _, r in variants))
