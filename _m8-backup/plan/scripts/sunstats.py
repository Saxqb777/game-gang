import sys, numpy as np
sys.path.insert(0, sys.argv[1])
from hdrstats_lib import read_hdr
for path in sys.argv[2:]:
    rgb = read_hdr(path)
    h, w, _ = rgb.shape
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722])
    m = lum > lum.max() * 0.1
    sun = rgb[m].sum(0)
    # solid angle weighting
    ys, xs = np.nonzero(m)
    lat = (90 - (ys + 0.5) / h * 180) * np.pi / 180
    dO = (np.pi / h) * (2 * np.pi / w) * np.cos(lat)
    sunE = (rgb[m] * dO[:, None]).sum(0)  # irradiance normal to sun
    c = sunE / sunE.max()
    # sky-only (exclude sun region within 5 deg) mean horizon colours by azimuth relative to sun
    print(path.split('/')[-1], 'sun pixels', m.sum(), 'sun E_normal', np.round(sunE, 2), 'sun colour (norm)', np.round(c, 3),
          'hex', '#%02x%02x%02x' % tuple(int(round(255 * (min(1, x) ** (1 / 2.2)))) for x in c))
    # horizon colour at 2 deg: toward sun, 90 deg, away
    row = int(h / 2 - 2 / 180 * h)
    cx = int(np.mean(xs))
    for name, off in [('toward', 0), ('side90', w // 4), ('away', w // 2)]:
        seg = rgb[row, [(cx + off + k) % w for k in range(-8, 9)]].mean(0)
        print('   horizon2deg', name, np.round(seg, 3))
    row10 = int(h / 2 - 10 / 180 * h)
    print('   10deg away', np.round(rgb[row10, [(cx + w // 2 + k) % w for k in range(-8, 9)]].mean(0), 3))
