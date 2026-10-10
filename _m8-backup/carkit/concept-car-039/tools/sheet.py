import sys, glob, os
from PIL import Image, ImageDraw
# usage: sheet.py out.png cols label1 img1 label2 img2 ...
out, cols = sys.argv[1], int(sys.argv[2]); items = list(zip(sys.argv[3::2], sys.argv[4::2]))
ims = [(l, Image.open(p).convert('RGB')) for l, p in items]
w, h = ims[0][1].size; rows = (len(ims) + cols - 1) // cols
S = Image.new('RGB', (w * cols, h * rows), 'white'); d = ImageDraw.Draw(S)
for i, (l, im) in enumerate(ims):
    x, y = (i % cols) * w, (i // cols) * h; S.paste(im, (x, y)); d.rectangle([x, y, x + 8 * len(l) + 8, y + 16], fill='black'); d.text((x + 4, y + 2), l, fill='white')
S.save(out)
