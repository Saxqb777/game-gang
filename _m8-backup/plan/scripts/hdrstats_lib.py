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
