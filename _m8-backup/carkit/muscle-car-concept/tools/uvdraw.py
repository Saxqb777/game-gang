# usage: python3 -I uvdraw.py <uv.json> <texture> <out.png> [size]
import sys, json
from PIL import Image, ImageDraw
d = json.load(open(sys.argv[1])); S = int(sys.argv[4]) if len(sys.argv) > 4 else 1024
im = Image.open(sys.argv[2]).convert('RGB').resize((S, S)); dr = ImageDraw.Draw(im)
cols = [(0,255,0),(255,0,255),(0,255,255),(255,255,0),(255,0,0),(0,0,255)]
for i, (k, tris) in enumerate(d.items()):
    for t in tris:
        pts = [((u % 1) * S, (v % 1) * S) for u, v in t]
        dr.polygon(pts, outline=cols[i % len(cols)])
im.save(sys.argv[3])
