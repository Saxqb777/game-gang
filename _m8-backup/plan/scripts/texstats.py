import sys
from PIL import Image, ImageStat
def lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
for p in sys.argv[1:]:
    im = Image.open(p).convert('RGB')
    st = ImageStat.Stat(im)
    m = st.mean
    l = [lin(x) for x in m]
    lum = 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]
    print(p.split('/')[-1], 'mean sRGB', [round(x) for x in m], 'linear', [round(x, 3) for x in l], 'lum', round(lum, 3), 'std', [round(x) for x in st.stddev])
