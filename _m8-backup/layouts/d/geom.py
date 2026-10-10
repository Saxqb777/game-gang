"""Geometry helpers for the layout builder: integration, closure solve, lap-time estimate, preview plot."""
import math

STRAIGHT_R = 0.0


def seg_len(s):
    if s['type'] == 'straight':
        return s['length']
    return 2 * s['arc'] / (1 / s['radiusStart'] + 1 / s['radiusEnd'])


def integrate(segs, startZ, step=0.5):
    """Return list of points (x, y, z, s, heading, curvature) and per-seg end states."""
    x = y = h = 0.0
    z = startZ
    s = 0.0
    pts = [(0.0, 0.0, z, 0.0, 0.0, 0.0)]
    ends = []
    for seg in segs:
        L = seg_len(seg)
        if seg['type'] == 'straight':
            k0 = k1 = 0.0
        else:
            sign = 1 if seg['type'] == 'left' else -1
            k0, k1 = sign / seg['radiusStart'], sign / seg['radiusEnd']
        n = max(1, int(math.ceil(L / step)))
        ds = L / n
        z0 = z
        for i in range(n):
            k = k0 + (k1 - k0) * (i + 0.5) / n
            hm = h + k * ds / 2
            x += math.cos(hm) * ds
            y += math.sin(hm) * ds
            h += k * ds
            s += ds
            zz = z0 + (seg['zEnd'] - z0) * (i + 1) / n
            pts.append((x, y, zz, s, h, k))
        z = seg['zEnd']
        ends.append((x, y, h, s))
    return pts, ends


def close_loop(segs, startZ, adjust_straights, adjust_arc, target_turns=1):
    """Fix heading with one arc, then position with two straights (linear solve). Mutates segs."""
    # heading: total signed turning must equal target_turns * 2pi
    def total_turn():
        t = 0.0
        for s in segs:
            if s['type'] == 'left':
                t += s['arc']
            elif s['type'] == 'right':
                t -= s['arc']
        return t
    err = target_turns * 2 * math.pi - total_turn()
    a = segs[adjust_arc]
    sign = 1 if a['type'] == 'left' else -1
    a['arc'] += sign * err
    if a['arc'] <= 0:
        raise ValueError('arc went negative: %s' % a['name'])
    for _ in range(4):
        pts, ends = integrate(segs, startZ)
        gx, gy = pts[-1][0], pts[-1][1]
        i, j = adjust_straights
        # heading of straight i = heading at its start
        hi = ends[i - 1][2] if i > 0 else 0.0
        hj = ends[j - 1][2] if j > 0 else 0.0
        a11, a21 = math.cos(hi), math.sin(hi)
        a12, a22 = math.cos(hj), math.sin(hj)
        det = a11 * a22 - a12 * a21
        if abs(det) < 1e-6:
            raise ValueError('parallel adjust straights')
        # want dLi*(a11,a21) + dLj*(a12,a22) = (-gx, -gy)
        dLi = (-gx * a22 + gy * a12) / det
        dLj = (-gy * a11 + gx * a21) / det
        segs[i]['length'] += dLi
        segs[j]['length'] += dLj
        if segs[i]['length'] < 5 or segs[j]['length'] < 5:
            raise ValueError('straight too short after closure: %s=%.1f %s=%.1f' % (
                segs[i]['name'], segs[i]['length'], segs[j]['name'], segs[j]['length']))
    return segs


def lap_sim(segs, startZ, vmax=64.0, a_lat=10.0, a_brake=9.5, a_acc0=6.5, step=1.0):
    """Quasi-steady point-mass lap time. vmax ~ 230 km/h. Returns (time, speeds, pts)."""
    pts, _ = integrate(segs, startZ, step=step)
    n = len(pts)
    # grade per point
    vlim = []
    for p in pts:
        k = abs(p[5])
        vlim.append(min(vmax, math.sqrt(a_lat / k)) if k > 1e-6 else vmax)
    grade = [0.0] * n
    for i in range(1, n):
        ds = pts[i][3] - pts[i - 1][3]
        grade[i] = (pts[i][2] - pts[i - 1][2]) / ds if ds > 0 else 0
    # periodic: run 2 laps forward, take second
    v = [0.0] * n
    vf = [0.0] * n
    cur = 20.0
    for lap in range(2):
        for i in range(n):
            if i > 0:
                ds = pts[i][3] - pts[i - 1][3]
                acc = a_acc0 * (1 - (cur / vmax) ** 2) - 9.81 * grade[i]
                cur = math.sqrt(max(1.0, cur * cur + 2 * acc * ds))
            cur = min(cur, vlim[i])
            vf[i] = cur
    # backward braking pass (periodic)
    vb = vf[:]
    cur = vb[0]
    for lap in range(2):
        for i in range(n - 1, -1, -1):
            if i < n - 1:
                ds = pts[i + 1][3] - pts[i][3]
                dec = a_brake + 9.81 * grade[i + 1]
                cur = math.sqrt(cur * cur + 2 * max(3.0, dec) * ds)
            cur = min(cur, vf[i])
            vb[i] = cur
    t = 0.0
    for i in range(1, n):
        ds = pts[i][3] - pts[i - 1][3]
        t += ds / max(1.0, (vb[i] + vb[i - 1]) / 2)
    return t, vb, pts
