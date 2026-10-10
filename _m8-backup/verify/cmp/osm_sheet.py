"""Draw all extracted OSM loops (north up) in a grid to eyeball extraction quality.
Usage: python3 -I osm_sheet.py OSMDIR OUT.png [OURS_LAYOUT]"""
import glob, json, math, os, sys
from PIL import Image, ImageDraw

files = sorted(glob.glob(os.path.join(sys.argv[1], '*.xy.json')))
cols, size = 8, 180
rows = math.ceil(len(files) / cols)
img = Image.new('RGB', (cols * size, rows * (size + 20)), (16, 18, 24))
d = ImageDraw.Draw(img)
for i, f in enumerate(files):
    pts = json.load(open(f))
    cx, cy = (i % cols) * size, (i // cols) * (size + 20)
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    span = max(max(xs) - min(xs), max(ys) - min(ys), 1)
    sc = (size - 20) / span
    ox = cx + 10 + ((size - 20) - (max(xs) - min(xs)) * sc) / 2
    oy = cy + 10 + ((size - 20) - (max(ys) - min(ys)) * sc) / 2
    line = [(ox + (x - min(xs)) * sc, oy + (max(ys) - y) * sc) for x, y in pts]
    d.line(line + line[:1], fill=(255, 138, 31), width=2)
    L = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(pts, pts[1:] + pts[:1]))
    d.text((cx + 4, cy + size + 2), f'{os.path.basename(f)[:-8][:18]} {L/1000:.2f}', fill=(230, 230, 230))
img.save(sys.argv[2])
