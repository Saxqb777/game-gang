"""Quick lap-time / braking-zone estimate and a shape comparison against g-track-2.

Usage: python3 -I analyse.py LAYOUT.json [G_TRACK_2_XML]
Speed model = the M8 racing-line model run on the centre line (slower than a relaxed racing line):
v = min(51, sqrt(15/|k|)), braking 11 m/s^2, a = min(5, 11500*(1-(v/52)^2)/1300).
A second pass uses a 'relaxed line' estimate: curvature smoothed over +-25 m and scaled by 0.8.
"""
import json, math, sys

def stations(layout, ds=1.0):
    ks, names, zs = [], [], []
    z = layout['startZ']
    for seg in layout['segments']:
        if seg['type'] == 'straight':
            L = seg['length']; k0 = k1 = 0.0
        else:
            r0, r1, a = seg['radiusStart'], seg['radiusEnd'], seg['arc']
            L = 2 * a / (1 / r0 + 1 / r1)
            sg = 1 if seg['type'] == 'left' else -1
            k0, k1 = sg / r0, sg / r1
        n = max(1, round(L / ds))
        z0 = z
        for i in range(n):
            t = (i + 0.5) / n
            ks.append(k0 + (k1 - k0) * t); names.append(seg['name'])
            zs.append(z0 + (seg['zEnd'] - z0) * t)
        z = seg['zEnd']
    return ks, names, zs

def speed_profile(ks, zs, vmax=51.0, lat=15.0, brake=11.0, g=9.81):
    n = len(ks)
    vlim = [min(vmax, math.sqrt(lat / abs(k))) if abs(k) > 1e-9 else vmax for k in ks]
    v = vlim[:]
    for _ in range(3):
        for i in range(2 * n):  # forward (accel)
            a, b = i % n, (i + 1) % n
            grade = zs[b] - zs[a]
            acc = min(5.0, 11500 * max(0.0, 1 - (v[a] / 52) ** 2) / 1300) - g * grade * 0.3
            v[b] = min(vlim[b], math.sqrt(max(1.0, v[a] ** 2 + 2 * acc)))
        for i in range(2 * n, 0, -1):  # backward (brake)
            a, b = i % n, (i - 1) % n
            v[b] = min(v[b], math.sqrt(v[a] ** 2 + 2 * brake))
    t = sum(1.0 / max(1.0, x) for x in v)
    return v, t

def smooth(ks, half=25, scale=0.8):
    n = len(ks)
    out = []
    acc = sum(ks[i % n] for i in range(-half, half + 1))
    for i in range(n):
        out.append(acc / (2 * half + 1) * scale)
        acc += ks[(i + half + 1) % n] - ks[(i - half) % n]
    return out

def report(path):
    lay = json.load(open(path))
    ks, names, zs = stations(lay)
    for label, kk in (('centre line', ks), ('relaxed line', smooth(ks))):
        v, t = speed_profile(kk, zs)
        print(f'{label}: lap {t:6.1f} s  ({int(t // 60)}:{t % 60:04.1f})  avg {len(v) / t * 3.6:5.1f} km/h  '
              f'top {max(v) * 3.6:5.1f} km/h')
    v, t = speed_profile(smooth(ks), zs)
    n = len(v)
    # braking zones: speed drop > 12 m/s
    print('braking zones (relaxed line):')
    i = 0
    seen = set()
    for i in range(n):
        if v[i] > v[(i - 1) % n] + 1e-6 or v[i] < v[(i + 1) % n] - 1e-6:
            continue
        # local minimum
        j = i
        while v[(j - 1) % n] >= v[j % n] - 1e-9 and i - j < n:
            j -= 1
        drop = v[j % n] - v[i]
        if drop > 12 and names[i] not in seen:
            seen.add(names[i])
            print(f'  {names[i]:28s} at {i:5d} m: {v[j % n] * 3.6:5.0f} -> {v[i] * 3.6:4.0f} km/h over {i - j:4d} m')
    # per corner minimum speed
    print('corner minimum speeds (relaxed line):')
    cur, vmin = None, 1e9
    groups = []
    for i in range(n):
        base = names[i].replace(' entry', '').replace(' exit', '').replace(' in', '').replace(' out', '')
        if base != cur:
            if cur is not None:
                groups.append((cur, vmin))
            cur, vmin = base, 1e9
        vmin = min(vmin, v[i])
    groups.append((cur, vmin))
    for g, vm in groups:
        if vm < 50.9:
            print(f'  {g:28s} {vm * 3.6:5.0f} km/h')

def turning_function(ks, N=720):
    """heading vs normalised arc length, resampled to N points (mean removed)."""
    h, hs = 0.0, []
    for k in ks:
        h += k; hs.append(h)
    L = len(hs)
    out = [hs[int(i * L / N)] - 2 * math.pi * i / N * (1 if hs[-1] > 0 else -1) for i in range(N)]
    m = sum(out) / N
    return [x - m for x in out]

def shape_distance(ka, kb):
    """min RMS distance between turning functions over start shifts, travel direction and mirror image."""
    A = turning_function(ka)
    N = len(A)
    sa = sum(ka) > 0
    best = 1e9
    variants = [kb, [-k for k in kb[::-1]], [-k for k in kb], kb[::-1]]
    for kk in variants:
        if (sum(kk) > 0) != sa:
            continue
        B = turning_function(kk)
        for sh in range(0, N, 2):
            d = math.sqrt(sum((A[i] - B[(i + sh) % N]) ** 2 for i in range(N)) / N)
            best = min(best, d)
    return best

def sd_curvature(m, path):
    segs = m.segments(open(path, encoding='latin1').read())
    kb = []
    for s in segs:
        if s.get('type') == 'str':
            kb += [0.0] * max(1, round(s.get('lg', 0)))
        elif s.get('type') in ('lft', 'rgt'):
            arc = math.radians(s.get('arc', 0)); r0 = s.get('radius'); r1 = s.get('end radius', r0)
            L = arc * (r0 + r1) / 2
            sg = 1 if s['type'] == 'lft' else -1
            nn = max(1, round(L))
            kb += [sg * arc / L] * nn
    return kb

if __name__ == '__main__':
    report(sys.argv[1])
    if len(sys.argv) > 3:
        import importlib.util, glob, os
        spec = importlib.util.spec_from_file_location('sdt', sys.argv[3])
        m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
        ka, _, _ = stations(json.load(open(sys.argv[1])))
        res = []
        for f in sorted(glob.glob(os.path.join(sys.argv[2], 'tracks/*/*/*.xml'))):
            nm = f.split('/')[-2]
            if os.path.basename(f) != nm + '.xml' or 'speedway' in f:
                continue
            kb = sd_curvature(m, f)
            if len(kb) < 500:
                continue
            res.append((shape_distance(ka, kb), nm))
        res.sort()
        print('turning-function distance (rad RMS; 0 = same shape) to Speed Dreams tracks, closest first:')
        print('  ' + ', '.join(f'{n} {d:.2f}' for d, n in res[:6]))
        print('  g-track-2: ' + ', '.join(f'{d:.2f}' for d, n in res if n == 'g-track-2'))
