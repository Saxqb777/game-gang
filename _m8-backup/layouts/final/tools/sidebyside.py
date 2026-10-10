import sys, os, numpy as np
sys.argv_saved = list(sys.argv)
here = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(here, 'shapecmp.py')).read().split("r = sorted(")[0])
from PIL import Image, ImageDraw
def draw(panels, out):
    W = 300; img = Image.new('RGB', (W * len(panels), 340), (16, 18, 22)); dr = ImageDraw.Draw(img)
    for i, (lab, P, col) in enumerate(panels):
        xs = P[:, 0]; ys = P[:, 1]; sc = 270 / max(np.ptp(xs), np.ptp(ys)); cx = (xs.max() + xs.min()) / 2; cy = (ys.max() + ys.min()) / 2
        Q = [(i * W + 150 + (x - cx) * sc, 160 - (y - cy) * sc) for x, y in P]; Q.append(Q[0])
        dr.line(Q, fill=col, width=3); dr.ellipse([Q[0][0] - 5, Q[0][1] - 5, Q[0][0] + 5, Q[0][1] + 5], fill=(255, 255, 255))
        dr.text((i * W + 10, 320), lab, fill=(220, 220, 220))
    img.save(out)
mir = lambda P: P * np.array([-1, 1])
O = (255, 170, 60); B = (90, 180, 255); G = (140, 220, 140)
draw([('FINAL Kestrel Pines', final, O), ('final mirrored', mir(final), O), ('d Kestrel Ridge', cands['d'], G),
      ('SD g-track-2', sd['g-track-2'], B), ('SD forza', sd['forza'], B), ('SD Corkscrew', sd['Corkscrew'], B)], sys.argv[2])
print('saved', sys.argv[2])
