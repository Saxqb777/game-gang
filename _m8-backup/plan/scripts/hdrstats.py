import sys, numpy as np
def read_hdr(path):
    with open(path, 'rb') as f:
        data = f.read()
    # header ends with blank line, then resolution line
    i = data.index(b'\n\n') + 2
    j = data.index(b'\n', i)
    res = data[i:j].decode().split()
    h, w = int(res[1]), int(res[3])
    p = j + 1
    img = np.zeros((h, w, 4), np.uint8)
    for y in range(h):
        if data[p] == 2 and data[p+1] == 2:
            p += 4
            for c in range(4):
                x = 0
                while x < w:
                    n = data[p]; p += 1
                    if n > 128:
                        n -= 128
                        img[y, x:x+n, c] = data[p]; p += 1
                    else:
                        img[y, x:x+n, c] = np.frombuffer(data[p:p+n], np.uint8); p += n
                    x += n
        else:
            raise SystemExit('flat scanlines not supported')
    e = img[..., 3].astype(np.int32)
    scale = np.where(e > 0, np.ldexp(1.0, e - 136), 0.0)
    rgb = img[..., :3].astype(np.float64) * scale[..., None]
    return rgb
for path in sys.argv[1:]:
    rgb = read_hdr(path)
    h, w, _ = rgb.shape
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722])
    y, x = np.unravel_index(np.argmax(lum), lum.shape)
    # centroid of pixels above 50% of max (sun disc)
    m = lum > lum.max() * 0.5
    ys, xs = np.nonzero(m)
    cy, cx = ys.mean(), xs.mean()
    u = (cx + 0.5) / w
    elev = 90 - (cy + 0.5) / h * 180
    upper = rgb[: h // 2]
    ul = lum[: h // 2]
    # mean radiance of the upper hemisphere weighted by cos(lat) (solid angle)
    lat = (90 - (np.arange(h // 2) + 0.5) / h * 180) * np.pi / 180
    wgt = np.cos(lat)[:, None]
    sky_mean = (upper * wgt[..., None]).sum((0, 1)) / (wgt.sum() * w)
    # irradiance on a horizontal plane from the upper hemisphere: E = sum L cos(theta) dOmega
    dO = (np.pi / (h)) * (2 * np.pi / w) * np.cos(lat)
    E = (upper * (np.sin(lat) * dO)[:, None, None]).sum((0, 1))
    # irradiance with radiance capped at 8 (as sky.ts skyLightCap)
    Ec = (np.minimum(upper, 8.0) * (np.sin(lat) * dO)[:, None, None]).sum((0, 1))
    # horizon colour 2 deg above horizon averaged around
    row = int(h / 2 - 2 / 180 * h)
    hor = rgb[row].mean(0)
    zen = rgb[0:int(h*0.05)].reshape(-1,3).mean(0)
    print(path.split('/')[-1], f'{w}x{h}', 'sun u=%.4f elev=%.2f deg' % (u, elev), 'peak=%.0f' % lum.max(),
          'skyMean=', np.round(sky_mean, 3), 'E_horiz=', np.round(E, 3), 'E_capped8=', np.round(Ec, 3),
          'horizon2deg=', np.round(hor, 3), 'zenith=', np.round(zen, 3))
