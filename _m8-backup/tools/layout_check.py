"""Validate and plot a splitways-layout@1 file: closure, length, radii, grades, leg separation, grid straight.

Usage: python3 -I layout_check.py LAYOUT.json OUT.png
Heading 0 = +X, counter-clockwise positive; 'left' turns CCW. Spirals: curvature linear in arc length,
length = 2*arc / (1/r0 + 1/r1). Elevation: linear per segment from previous zEnd (smooth joins are the
generator's job, so grades here are segment averages).
"""
import json, math, sys

def integrate(layout, step=0.5):
    x = y = h = 0.0
    z = layout.get('startZ', 0.0)
    s = 0.0
    pts = [(0.0, 0.0, z, 0.0)]
    segs = []
    for seg in layout['segments']:
        t = seg['type']
        z0 = z
        if t == 'straight':
            L = seg['length']
            k0 = k1 = 0.0
        else:
            r0, r1, arc = seg['radiusStart'], seg['radiusEnd'], seg['arc']
            L = 2 * arc / (1 / r0 + 1 / r1)
            sign = 1 if t == 'left' else -1
            k0, k1 = sign / r0, sign / r1
        n = max(1, int(math.ceil(L / step)))
        ds = L / n
        for i in range(n):
            k = k0 + (k1 - k0) * (i + 0.5) / n
            hm = h + k * ds / 2
            x += math.cos(hm) * ds
            y += math.sin(hm) * ds
            h += k * ds
            s += ds
            zz = z0 + (seg['zEnd'] - z0) * (i + 1) / n
            pts.append((x, y, zz, s))
        z = seg['zEnd']
        grade = (seg['zEnd'] - z0) / L if L > 0 else 0
        segs.append({'name': seg['name'], 'type': t, 'length': L, 'grade': grade,
                     'rmin': min(seg.get('radiusStart') or 1e9, seg.get('radiusEnd') or 1e9) if t != 'straight' else None,
                     'start': s - L, 'end': s})
    return pts, segs, h

def check(layout):
    pts, segs, h = integrate(layout)
    L = pts[-1][3]
    gap = math.hypot(pts[-1][0], pts[-1][1])
    zgap = abs(pts[-1][2] - pts[0][2])
    turns = h / (2 * math.pi)
    herr = math.degrees(h - 2 * math.pi * round(turns))
    rmin = min(s['rmin'] for s in segs if s['rmin'])
    gmax = max(abs(s['grade']) for s in segs)
    zs = [p[2] for p in pts]
    # leg separation: min distance between points more than 500 m apart along the track (both ways)
    sub = pts[::8]
    sep = 1e9
    where = None
    for i in range(len(sub)):
        for j in range(i + 1, len(sub)):
            da = abs(sub[i][3] - sub[j][3])
            if min(da, L - da) < 500:
                continue
            d = math.hypot(sub[i][0] - sub[j][0], sub[i][1] - sub[j][1])
            if d < sep:
                sep = d; where = (round(sub[i][3]), round(sub[j][3]))
    grid = 0.0
    for s in reversed(segs):
        if s['type'] != 'straight':
            break
        grid += s['length']
    first = 0.0
    for s in segs:
        if s['type'] != 'straight':
            break
        first += s['length']
    longest = 0.0; run = 0.0; braking = []
    for i, s in enumerate(segs + segs[:1]):
        if s['type'] == 'straight':
            run += s['length']
        else:
            if run >= 250 and s['rmin'] and s['rmin'] <= 70:
                braking.append((round(run), s['name'], s['rmin']))
            longest = max(longest, run); run = 0.0
    corners = sum(1 for s in segs if s['type'] != 'straight')
    return {
        'length_m': round(L, 1), 'closure_gap_m': round(gap, 2), 'heading_error_deg': round(herr, 3),
        'net_turns': round(turns, 3), 'z_closure_m': round(zgap, 2), 'min_radius_m': rmin,
        'max_grade_pct': round(gmax * 100, 2), 'elevation_range_m': round(max(zs) - min(zs), 1),
        'min_leg_separation_m': round(sep, 1), 'closest_legs_at_s': where,
        'straight_behind_start_m': round(grid, 1), 'straight_after_start_m': round(first, 1),
        'longest_straight_m': round(longest, 1), 'heavy_braking_zones': braking, 'corners': corners,
    }, pts, segs

RULES = {
    'length_m': (3200, 3400), 'closure_gap_m': (0, 0.5), 'heading_error_deg': (-0.05, 0.05),
    'z_closure_m': (0, 0.05), 'min_radius_m': (28, 1e9), 'max_grade_pct': (0, 8.0),
    'elevation_range_m': (12, 30), 'min_leg_separation_m': (90, 1e9),
}

def plot(pts, segs, layout, res, out):
    from PIL import Image, ImageDraw
    W, H = 1400, 1000
    img = Image.new('RGB', (W, H), (16, 18, 24))
    d = ImageDraw.Draw(img)
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; zs = [p[2] for p in pts]
    span = max(max(xs) - min(xs), max(ys) - min(ys))
    sc = 760 / span
    ox = 40 + (760 - (max(xs) - min(xs)) * sc) / 2; oy = 40 + (760 - (max(ys) - min(ys)) * sc) / 2
    zmin, zmax = min(zs), max(zs)
    def P(p):
        return (ox + (p[0] - min(xs)) * sc, oy + (max(ys) - p[1]) * sc)
    for a, b in zip(pts, pts[1:]):
        t = (a[2] - zmin) / max(1e-6, zmax - zmin)
        col = (int(60 + 195 * t), int(140 + 60 * (1 - t)), int(255 * (1 - t)))
        d.line([P(a), P(b)], fill=col, width=7)
    sx, sy = P(pts[0]); d.rectangle([sx - 6, sy - 6, sx + 6, sy + 6], fill=(255, 255, 255))
    # corner labels
    for i, s in enumerate(segs):
        if s['type'] == 'straight':
            continue
        mid = (s['start'] + s['end']) / 2
        p = min(pts, key=lambda q: abs(q[3] - mid))
        x, y = P(p)
        d.text((x + 8, y - 8), s['name'][:14], fill=(255, 220, 120))
    # elevation profile
    ex, ey, ew, eh = 40, 840, 1320, 130
    d.rectangle([ex, ey, ex + ew, ey + eh], outline=(80, 80, 90))
    L = pts[-1][3]
    prof = [(ex + p[3] / L * ew, ey + eh - (p[2] - zmin) / max(1e-6, zmax - zmin) * eh) for p in pts[::4]]
    d.line(prof, fill=(120, 220, 160), width=2)
    d.text((ex + 4, ey + 4), f'elevation {zmin:.0f}..{zmax:.0f} m', fill=(220, 220, 220))
    # stats
    tx = 840; ty = 50
    d.text((tx, ty), layout.get('name', ''), fill=(255, 255, 255)); ty += 24
    for k, v in res.items():
        ok = ''
        if k in RULES:
            lo, hi = RULES[k]
            ok = '  OK' if lo <= abs(v) <= hi else '  FAIL'
        d.text((tx, ty), f'{k}: {v}{ok}', fill=(220, 220, 220) if ok != '  FAIL' else (255, 110, 110)); ty += 20
    img.save(out)

if __name__ == '__main__':
    layout = json.load(open(sys.argv[1]))
    res, pts, segs = check(layout)
    fails = [k for k, (lo, hi) in RULES.items() if not (lo <= abs(res[k]) <= hi)]
    if res['straight_behind_start_m'] < 180:
        fails.append('straight_behind_start_m')
    res['FAILS'] = fails
    print(json.dumps(res, indent=1))
    if len(sys.argv) > 2:
        plot(pts, segs, layout, res, sys.argv[2])
