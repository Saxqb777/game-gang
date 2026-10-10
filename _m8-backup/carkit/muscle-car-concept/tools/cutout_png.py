# Writes <tex>/<atlas>_basecolor_cutout.png: the RGBA atlas kept only where cut-out triangles sample it
# (dilated), flat elsewhere, so the PNG stays small.  usage: python3 -I cutout_png.py <tex dir> <uv json>
import sys, json, os
from PIL import Image, ImageDraw, ImageFilter
tex, uvjson = sys.argv[1], sys.argv[2]
d = json.load(open(uvjson))
for atlas, tris in d.items():
    src = Image.open(os.path.join(tex, f'{atlas}_basecolor_alpha.png')).convert('RGBA'); S = src.width
    mask = Image.new('L', (S, S), 0); dr = ImageDraw.Draw(mask)
    for t in tris:
        fu = min(int(u // 1) for u, v in t); fv = min(int(v // 1) for u, v in t)
        pts = [((u - fu) * S, (1 - (v - fv)) * S) for u, v in t]
        for ox in (0, -S):
            for oy in (0, S):
                dr.polygon([(x + ox, y + oy) for x, y in pts], fill=255)
    mask = mask.filter(ImageFilter.MaxFilter(9))
    flat = Image.new('RGBA', (S, S), (128, 128, 128, 255))
    out = Image.composite(src, flat, mask)
    p = os.path.join(tex, f'{atlas}_basecolor_cutout.png'); out.save(p, optimize=True)
    print(p, os.path.getsize(p), 'tris', len(tris))
