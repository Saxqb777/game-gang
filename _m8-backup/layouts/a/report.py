import json, math, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
lay = json.load(open(sys.argv[1]))
g = 9.81
def run(vmax, glat, gbrk, accel, step=1.0):
    st = []  # (k, ds, segidx)
    for i, s in enumerate(lay['segments']):
        if s['type'] == 'straight':
            L = s['length']; r0 = r1 = None
        else:
            r0, r1 = s['radiusStart'], s['radiusEnd']; L = 2 * s['arc'] / (1 / r0 + 1 / r1)
        n = max(1, int(math.ceil(L / step)))
        for j in range(n):
            k = 0.0 if r0 is None else 1 / r0 + (1 / r1 - 1 / r0) * (j + 0.5) / n
            st.append((k, L / n, i))
    N = len(st)
    v = [min(vmax, math.sqrt(glat * g / k) if k > 0 else vmax) for k, _, _ in st]
    for _ in range(2):
        for i in range(1, 2 * N):
            a, b = (i - 1) % N, i % N
            acc = accel * max(0.0, 1 - (v[a] / vmax) ** 2) + 0.3
            v[b] = min(v[b], math.sqrt(v[a] ** 2 + 2 * acc * st[b][1]))
        for i in range(2 * N, 0, -1):
            a, b = i % N, (i - 1) % N
            v[b] = min(v[b], math.sqrt(v[a] ** 2 + 2 * gbrk * g * st[a][1]))
    t = sum(ds / vv for (k, ds, _), vv in zip(st, v))
    return st, v, t
st, v, t = run(64, 1.30, 1.20, 6.0)
st2, v2, t2 = run(60, 1.05, 1.0, 5.0)
print(f'lap at the limit {t:.1f} s ({t//60:.0f}:{t%60:04.1f}); party pace {t2:.1f} s ({t2//60:.0f}:{t2%60:04.1f}); avg {3.6*sum(d for _,d,_ in st)/t:.0f} / {3.6*sum(d for _,d,_ in st)/t2:.0f} km/h')
s = 0.0; z = lay['startZ']
for i, seg in enumerate(lay['segments']):
    vs = [vv for (k, ds, si), vv in zip(st, v) if si == i]
    L = sum(ds for (k, ds, si) in st if si == i)
    gr = (seg['zEnd'] - z) / L * 100
    kind = seg['type'][0].upper()
    geo = f"L {L:5.0f}" if kind == 'S' else f"R{seg['radiusStart']:>3}->{seg['radiusEnd']:<3} {math.degrees(seg['arc']):5.1f}deg"
    print(f"{s:6.0f} m  {seg['name']:<18} {kind} {geo:<20} z {z:5.1f}->{seg['zEnd']:5.1f} ({gr:+5.1f}%)  v {min(vs)*3.6:4.0f}-{max(vs)*3.6:4.0f} km/h  w {seg['roadWidth']}")
    s += L; z = seg['zEnd']
# bbox
import build
x = y = h = 0; xs = [0]; ys = [0]
for (k, ds, si) in st:
    sg = 1 if lay['segments'][si]['type'] == 'left' else -1
    hm = h + sg * k * ds / 2; x += math.cos(hm) * ds; y += math.sin(hm) * ds; h += sg * k * ds; xs.append(x); ys.append(y)
print(f'bbox {max(xs)-min(xs):.0f} m x {max(ys)-min(ys):.0f} m')
