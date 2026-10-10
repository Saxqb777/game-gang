"""Rough point-mass lap-time estimate for a splitways layout (sim-lite car, assists on).

Usage: python3 -I laptime.py LAYOUT.json
Car: ~235 km/h top speed, 250 W/kg, lateral grip 1.15 g (+ banking), braking 1.1 g, grade included.
Prints lap time, average speed, apex speeds per corner group and the main braking zones.
"""
import json, math, sys

G = 9.81
MU_LAT, MU_BRK = 1.15, 1.10
PW = 250.0                        # W/kg
VTOP = 65.0                       # m/s (~235 km/h)
CD = PW / VTOP ** 3               # drag so that power balances drag at VTOP
STEP = 1.0

def samples(layout):
    out = []                      # (s, curvature, bank, grade, name)
    z = layout['startZ']; s = 0.0
    for seg in layout['segments']:
        if seg['type'] == 'straight':
            L = seg['length']; k0 = k1 = 0.0
        else:
            r0, r1, arc = seg['radiusStart'], seg['radiusEnd'], seg['arc']
            L = 2 * arc / (1 / r0 + 1 / r1)
            k0, k1 = 1 / r0, 1 / r1
        n = max(1, int(math.ceil(L / STEP))); ds = L / n
        grade = (seg['zEnd'] - z) / L
        for i in range(n):
            f = (i + 0.5) / n
            k = k0 + (k1 - k0) * f
            b = seg['bankStart'] + (seg['bankEnd'] - seg['bankStart']) * f
            sg = 1 if seg['type'] == 'left' else -1
            out.append((s, ds, k, sg * b, grade, seg['name']))
            s += ds
        z = seg['zEnd']
    return out

def vcorner(k, bank):
    if k < 1e-6:
        return VTOP
    t = max(-0.2, min(0.2, bank))   # + = banked toward the inside of this corner
    num = MU_LAT + math.tan(t); den = max(0.2, 1 - MU_LAT * math.tan(t))
    return min(VTOP, math.sqrt(G / k * num / den))

def run(layout):
    sm = samples(layout)
    n = len(sm)
    vlim = [vcorner(k, b) for (_, _, k, b, _, _) in sm]
    v = vlim[:]
    # two laps of forward/backward passes so the lap wraps cleanly
    for _ in range(3):
        for i in range(2 * n):            # forward: traction / power limited
            a, b = i % n, (i + 1) % n
            va = v[a]; ds = sm[a][1]
            acc = min(MU_LAT * G, PW / max(va, 5.0)) - CD * va * va - G * sm[a][4]
            v[b] = min(vlim[b], math.sqrt(max(0.0, va * va + 2 * acc * ds)))
        for i in range(2 * n, 0, -1):     # backward: braking limited
            a, b = i % n, (i - 1) % n
            va = v[a]; ds = sm[b][1]
            dec = MU_BRK * G + CD * va * va + G * sm[b][4]
            v[b] = min(v[b], math.sqrt(va * va + 2 * dec * ds))
    t = sum(sm[i][1] / max(1.0, 0.5 * (v[i] + v[(i + 1) % n])) for i in range(n))
    L = sum(x[1] for x in sm)
    # apex (minimum) speed per corner group (strip entry/exit suffixes)
    groups = {}
    order = []
    for i, x in enumerate(sm):
        if x[2] < 1e-6:
            continue
        nm = x[5]
        for suf in (' entry', ' exit'):
            if nm.endswith(suf):
                nm = nm[: -len(suf)]
        groups.setdefault(nm, []).append(v[i])
        if nm not in order:
            order.append(nm)
    return t, L, v, sm, [(nm, min(groups[nm]) * 3.6) for nm in order]

if __name__ == '__main__':
    layout = json.load(open(sys.argv[1]))
    t, L, v, sm, apex = run(layout)
    print(f'lap {int(t // 60)}:{t % 60:05.2f}  length {L:.0f} m  avg {L / t * 3.6:.0f} km/h  vmax {max(v) * 3.6:.0f} km/h')
    for nm, kmh in apex:
        print(f'  {nm:26s} min {kmh:5.0f} km/h')
    # braking zones: speed drop > 60 km/h
    n = len(v); i = 0
    print('braking zones (> 50 km/h shed):')
    while i < n:
        if v[(i + 1) % n] < v[i] - 1e-6:
            j = i
            while v[(j + 1) % n] < v[j % n] - 1e-6 and j < i + n:
                j += 1
            if (v[i] - v[j % n]) * 3.6 > 50:
                print(f'  s={sm[i][0]:6.0f} {v[i] * 3.6:4.0f} -> {v[j % n] * 3.6:4.0f} km/h over {j - i:4d} m  into {sm[j % n][5]}')
            i = j + 1
        else:
            i += 1
