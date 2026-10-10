"""Draw a layout next to chosen Speed Dreams tracks at the same scale (mirror/rotation not normalised)."""
import json, math, sys, importlib.util, os
from PIL import Image, ImageDraw
sc_dir = sys.argv[2]; sdt = sys.argv[3]
spec = importlib.util.spec_from_file_location('sdt', sdt); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
spec2 = importlib.util.spec_from_file_location('chk', sys.argv[4]); chk = importlib.util.module_from_spec(spec2); spec2.loader.exec_module(chk)
lay = json.load(open(sys.argv[1]))
pts, _, _ = chk.integrate(lay)
shapes = [('candidate', [(p[0], p[1]) for p in pts])]
for nm in sys.argv[5:]:
    f = os.path.join(sc_dir, 'tracks', 'circuit', nm, nm + '.xml')
    if not os.path.exists(f):
        f = os.path.join(sc_dir, 'tracks', 'road', nm, nm + '.xml')
    p2, L, gap = m.outline(m.segments(open(f, encoding='latin1').read()))
    shapes.append((nm, p2))
S = 420
img = Image.new('RGB', (S * len(shapes), S + 30), (16, 18, 24)); d = ImageDraw.Draw(img)
span = max(max(max(p[0] for p in s) - min(p[0] for p in s), max(p[1] for p in s) - min(p[1] for p in s)) for _, s in shapes)
sc = (S - 40) / span
for i, (nm, s) in enumerate(shapes):
    xs = [p[0] for p in s]; ys = [p[1] for p in s]
    ox = i * S + 20 + ((S - 40) - (max(xs) - min(xs)) * sc) / 2; oy = 20 + ((S - 40) - (max(ys) - min(ys)) * sc) / 2
    line = [(ox + (x - min(xs)) * sc, oy + (max(ys) - y) * sc) for x, y in s]
    d.line(line, fill=(255, 170, 60) if i == 0 else (90, 190, 255), width=3)
    d.ellipse([line[0][0] - 5, line[0][1] - 5, line[0][0] + 5, line[0][1] + 5], fill=(255, 255, 255))
    d.text((i * S + 20, S + 5), nm, fill=(230, 230, 230))
img.save(sys.argv[-0] if False else 'compare.png')
