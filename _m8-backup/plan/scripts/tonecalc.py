import numpy as np, math
def s2l(h):
    c = np.array([int(h[i:i+2], 16) / 255 for i in (1, 3, 5)])
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
IN = np.array([[0.59719, 0.35458, 0.04823], [0.07600, 0.90834, 0.01566], [0.02840, 0.13383, 0.83777]])
OUT = np.array([[1.60475, -0.53108, -0.07367], [-0.10208, 1.10813, -0.00605], [-0.00327, -0.07276, 1.07602]])
def aces(c):
    v = IN @ (c / 0.6)
    a = v * (v + 0.0245786) - 0.000090537
    b = v * (0.983729 * v + 0.4329510) + 0.238081
    return np.clip(OUT @ (a / b), 0, 1)
def srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)
def grade(L, P):
    c = L * P['exposure'] * np.array(P['tint'])
    g = c @ np.array([0.2126, 0.7152, 0.0722])
    c = np.maximum(g + (c - g) * P['sat'], 0)
    c = aces(c)
    # optional lift/gain/contrast in display-linear after ACES (proposal)
    out = srgb(c)
    return np.round(out * 255).astype(int)
SKY_H = np.array([0.379, 0.583, 1.014])  # syferfontein capped-8 horizontal irradiance
def scene(P):
    elev = math.radians(P['elev'])
    sun = P['sunI'] * s2l(P['sunHex'])
    env = P['env']
    skyH = SKY_H * env
    ground = np.array(P['ground'])
    skyV = 0.5 * skyH + 0.5 * math.pi * ground * env
    rows = {}
    def surf(name, alb, Esun, Esky):
        rows[name] = grade(alb / math.pi * (Esun + Esky), P)
    road = P['road']
    surf('road lit', road, sun * math.sin(elev), skyH)
    surf('road shadow', road, 0, skyH * 0.85)
    surf('rubber lit', road * 0.82, sun * math.sin(elev), skyH)
    surf('grass lit', P['grass'], sun * math.sin(elev), skyH)
    surf('grass shadow', P['grass'], 0, skyH * 0.85)
    surf('gravel lit', P['gravel'], sun * math.sin(elev), skyH)
    surf('kerb white lit', P['kerbW'], sun * math.sin(elev), skyH)
    surf('kerb red lit', P['kerbR'], sun * math.sin(elev), skyH)
    surf('floor lit', P['floor'], sun * math.sin(elev), skyH)
    surf('pine tip, sun side (vert)', P['pineTip'], sun * math.cos(elev) * 0.8, skyV)
    surf('pine mid, sun side', P['pineMid'], sun * math.cos(elev) * 0.6, skyV)
    surf('pine shadow side', P['pineMid'], 0, skyV)
    surf('pine inner AO', P['pineAO'], 0, skyV * 0.6)
    surf('trunk upper sunlit', P['trunk'], sun * math.cos(elev), skyV)
    surf('armco/concrete lit vert', P['concrete'], sun * math.cos(elev) * 0.7, skyV)
    surf('concrete shadow vert', P['concrete'], 0, skyV)
    for k, v in P.get('sky', {}).items():
        rows['sky ' + k] = grade(np.array(v), P)
    return rows
base = dict(elev=18.4, ground=[0.10, 0.12, 0.07],
    road=0.013 * 2 * 0 + 0.026, grass=np.array([0.118, 0.152, 0.03]), gravel=np.array([0.213, 0.198, 0.16]),
    kerbW=s2l('#f2f2f2'), kerbR=s2l('#c8102e'), floor=np.array([0.222, 0.114, 0.044]),
    pineTip=s2l('#3e6a35'), pineMid=s2l('#2b4a2a'), pineAO=s2l('#1a2b20'), trunk=s2l('#5a3d28'), concrete=s2l('#e4e2dc'),
    sky={'horizon away': [0.31, 0.30, 0.275], 'horizon side': [0.289, 0.312, 0.309], '10deg away': [0.181, 0.292, 0.444],
         'zenith': [0.036, 0.068, 0.145], 'toward sun 2deg': [1.948, 2.017, 1.738]})
cur = dict(base, sunI=6, sunHex='#ffd2a1', env=1.0, exposure=1.5, tint=[1.05, 1.0, 0.93], sat=1.1)
import sys
def show(name, P):
    r = scene(P)
    print('==', name, {k: P[k] for k in ('sunI', 'sunHex', 'env', 'exposure', 'tint', 'sat')})
    for k, v in r.items():
        print('  %-28s %s' % (k, v))
show('current (desert values)', cur)
hero = dict(base, sunI=8.0, sunHex='#ffe2b4', env=1.0, exposure=1.25, tint=[1.0, 1.0, 1.0], sat=1.0,
    road=0.065, grass=np.array([0.118, 0.152, 0.03]) * np.array([0.72, 0.86, 1.35]), gravel=np.array([0.213, 0.198, 0.16]) * np.array([1.0, 0.97, 0.92]),
    kerbW=s2l('#e6e4de'), floor=np.array([0.222, 0.114, 0.044]) * np.array([0.62, 0.78, 0.95]),
    pineTip=s2l('#3f5a3c'), pineMid=s2l('#2e4733'), pineAO=s2l('#1a2b20'), trunk=s2l('#8a5a3a'))
for e in [1.1, 1.25, 1.4]:
    for si in [7.0, 8.0, 9.0]:
        show('hero exp %.2f sun %.1f' % (e, si), dict(hero, exposure=e, sunI=si))
