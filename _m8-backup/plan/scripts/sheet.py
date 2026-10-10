import sys
from PIL import Image, ImageDraw
paths = sys.argv[2:]
tiles = []
for p in paths:
    im = Image.open(p).convert('RGB').resize((256, 256))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 256, 14], fill=(0, 0, 0))
    d.text((3, 2), p.split('/')[-1][:40], fill=(255, 255, 255))
    tiles.append(im)
cols = 4
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new('RGB', (256 * cols, 256 * rows), (40, 40, 40))
for i, t in enumerate(tiles):
    sheet.paste(t, ((i % cols) * 256, (i // cols) * 256))
sheet.save(sys.argv[1])
