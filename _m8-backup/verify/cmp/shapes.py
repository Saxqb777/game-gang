"""Shape comparison of the candidate layout against real circuits and SD tracks.

Usage: python3 -I shapes.py SCRATCH OUTDIR
Loads: our layout (splitways), SD tracks (via tools/sd_tracks.py parsing), F1 geojson, TUM CSVs, extra OSM json.
Metrics: (1) Procrustes RMS over cyclic shift, both directions, mirror; (2) turning-function L2 distance.
"""
import json, math, os, sys, glob
import numpy as np

SCR = sys.argv[1]
OUT = sys.argv[2]
sys.path.insert(0, os.path.join(SCR, 'tools'))
import sd_tracks  # our own helper (scratch tools dir), parses SD XML as data

N = 512

def layout_pts(path):
    lay = json.load(open(path))
    x = y = h = 0.0
    pts = [(0.0, 0.0)]
    for seg in lay['segments']:
        if seg['type'] == 'straight':
            L = seg['length']; k0 = k1 = 0.0
        else:
            r0, r1, arc = seg['radiusStart'], seg['radiusEnd'], seg['arc']
            L = 2 * arc / (1 / r0 + 1 / r1)
            s = 1 if seg['type'] == 'left' else -1
            k0, k1 = s / r0, s / r1
        n = max(1, int(math.ceil(L / 1.0)))
        ds = L / n
        for i in range(n):
            k = k0 + (k1 - k0) * (i + 0.5) / n
            hm = h + k * ds / 2
            x += math.cos(hm) * ds; y += math.sin(hm) * ds; h += k * ds
            pts.append((x, y))
    return np.array(pts)

def resample(p, n=N):
    p = np.asarray(p, float)
    if np.hypot(*(p[0] - p[-1])) > 1e-6:
        p = np.vstack([p, p[:1]])
    d = np.hypot(*np.diff(p, axis=0).T)
    keep = np.concatenate([[True], d > 1e-9])
    p = p[keep]; d = np.hypot(*np.diff(p, axis=0).T)
    s = np.concatenate([[0], np.cumsum(d)])
    t = np.linspace(0, s[-1], n, endpoint=False)
    x = np.interp(t, s, p[:, 0]); y = np.interp(t, s, p[:, 1])
    return x + 1j * y, s[-1]

def norm(z):
    z = z - z.mean()
    return z / np.sqrt(np.mean(np.abs(z) ** 2))

def signed_area(z):
    x, y = z.real, z.imag
    return 0.5 * np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y)

def ccw(z):
    return z if signed_area(z) > 0 else z[::-1]

def procrustes(a, b):
    """min over cyclic shift, rotation, of RMS |a - R b_shift|; a,b normalised. Returns (d, shift, rot)."""
    A = np.fft.fft(a); B = np.fft.fft(b)
    c = np.fft.ifft(np.conj(A) * B)  # c[s] = sum conj(a_k) b_{k+s}
    s = int(np.argmax(np.abs(c)))
    val = np.abs(c[s]) / len(a)
    return math.sqrt(max(0.0, 2 - 2 * val)), s, np.angle(c[s])

def shape_dist(a, b):
    """a, b CCW-normalised. Compare b and mirrored b (mirror then re-orient CCW)."""
    best = None
    for mir in (False, True):
        bb = np.conj(b) if mir else b
        bb = ccw(bb)
        d, s, r = procrustes(a, bb)
        if best is None or d < best[0]:
            best = (d, mir, s, r, bb)
    return best

def turning(z):
    dz = np.roll(z, -1) - z
    h = np.unwrap(np.angle(dz))
    return h - np.linspace(0, 2 * np.pi, len(z), endpoint=False)  # remove the 2pi trend (CCW)

def turn_dist(a, b):
    best = 1e9
    for mir in (False, True):
        bb = ccw(np.conj(b) if mir else b)
        ta = turning(a); tb = turning(bb)
        n = len(ta)
        for s in range(0, n, 2):
            d = ta - np.roll(tb, -s)
            d = d - d.mean()
            v = math.sqrt(np.mean(d ** 2))
            if v < best:
                best = v
    return best

def load_all():
    shapes = {}
    for f in sorted(glob.glob(os.path.join(SCR, 'sd-extract/usr/share/games/speed-dreams/tracks/*/*/*.xml'))):
        cat, name = f.split('/')[-3], f.split('/')[-2]
        if os.path.basename(f) != name + '.xml':
            continue
        segs = sd_tracks.segments(open(f, encoding='latin1').read())
        if not segs:
            continue
        pts, length, gap = sd_tracks.outline(segs)
        if gap > 40:
            continue
        shapes['SD:' + name] = np.array(pts)
    g = json.load(open(os.path.join(SCR, 'verify/dl_f1/f1-circuits.geojson')))
    for ft in g['features']:
        coords = np.array(ft['geometry']['coordinates'])
        lat0 = math.radians(coords[:, 1].mean())
        xy = np.c_[coords[:, 0] * 111320 * math.cos(lat0), coords[:, 1] * 110540]
        shapes['F1:' + ft['properties']['Name']] = xy
    for f in sorted(glob.glob(os.path.join(SCR, 'verify/dl_tum/*.csv'))):
        a = np.loadtxt(f, delimiter=',', comments='#')
        shapes['TUM:' + os.path.basename(f)[:-4]] = a[:, :2]
    for f in sorted(glob.glob(os.path.join(SCR, 'verify/osm/*.xy.json'))):
        a = np.array(json.load(open(f)))
        if len(a) > 10:
            shapes['OSM:' + os.path.basename(f)[:-8]] = a
    return shapes

def draw_sheet(ours, items, out):
    from PIL import Image, ImageDraw
    cols, size = 4, 300
    rows = math.ceil(len(items) / cols)
    img = Image.new('RGB', (cols * size, rows * (size + 36)), (16, 18, 24))
    d = ImageDraw.Draw(img)
    for i, (name, dist, tdist, mir, s, r, bb) in enumerate(items):
        cx, cy = (i % cols) * size, (i // cols) * (size + 36)
        b_al = np.roll(bb, -s) * np.exp(-1j * r)  # aligned to ours
        allp = np.concatenate([ours, b_al])
        mx, Mx, my, My = allp.real.min(), allp.real.max(), allp.imag.min(), allp.imag.max()
        sc = (size - 30) / max(Mx - mx, My - my)
        def P(z):
            return [(cx + 15 + (q.real - mx) * sc, cy + 15 + (My - q.imag) * sc) for q in z]
        d.line(P(np.append(b_al, b_al[:1])), fill=(255, 138, 31), width=3)
        d.line(P(np.append(ours, ours[:1])), fill=(70, 200, 255), width=2)
        d.text((cx + 6, cy + size + 2), f'{name[:40]}', fill=(230, 230, 230))
        d.text((cx + 6, cy + size + 16), f'procr {dist:.3f}  turn {tdist:.3f}  {"mirrored" if mir else ""}', fill=(200, 200, 200))
    img.save(out)

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    zo, Lo = resample(layout_pts(os.path.join(SCR, 'layouts/final/base.layout.json')))
    ours = ccw(norm(zo))
    shapes = load_all()
    res = []
    for name, p in shapes.items():
        z, L = resample(p)
        z = ccw(norm(z))
        d, mir, s, r, bb = shape_dist(ours, z)
        td = turn_dist(ours, z)
        res.append((name, d, td, mir, s, r, bb, L))
    res.sort(key=lambda t: t[1])
    print(f'ours length {Lo:.0f} m')
    for name, d, td, mir, s, r, bb, L in res:
        print(f'{name:55s} procr {d:.3f}  turn {td:.3f}  {"M" if mir else " "}  len {L:7.0f}')
    draw_sheet(ours, [t[:7] for t in res[:16]], os.path.join(OUT, 'top_procrustes.png'))
    rt = sorted(res, key=lambda t: t[2])
    draw_sheet(ours, [t[:7] for t in rt[:16]], os.path.join(OUT, 'top_turning.png'))
    g2 = [t for t in res if t[0] == 'SD:g-track-2']
    if g2:
        draw_sheet(ours, [g2[0][:7]], os.path.join(OUT, 'g-track-2_overlay.png'))
