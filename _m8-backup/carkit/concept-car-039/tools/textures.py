"""Prepare glTF textures from the extracted source (read-only) into ../tex.
- normal maps in the source are DirectX-style (green down): flip G for glTF.
- tread spec -> ARM (R=AO 1, G=roughness, B=metal 0).
- generic (debranded) sidewall: per-radius median of colour and of polar-frame normals removes all text."""
import os, shutil, numpy as np
from PIL import Image
KIT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(KIT, 'src', 'textures'); OUT = os.path.join(KIT, 'tex')
def load(name, mode='RGB'): return Image.open(os.path.join(SRC, name)).convert(mode)
def cap(im, n=2048):
    if max(im.size) > n: im = im.resize((n, n * im.size[1] // im.size[0]), Image.LANCZOS)
    return im
def save_jpg(im, name, q=90): p = os.path.join(OUT, name); cap(im).save(p, 'JPEG', quality=q, optimize=True); print(name, im.size, os.path.getsize(p))
def flip_g(im): a = np.asarray(im).copy(); a[..., 1] = 255 - a[..., 1]; return Image.fromarray(a)

side_c = load('Bridgestone_Potenza_RE_050A_Pole_Position.jpg')
side_n = load('Bridgestone_Potenza_RE_050A_Pole_Position_.jpg')
shutil.copyfile(os.path.join(SRC, 'Bridgestone_Potenza_RE_050A_Pole_Position.jpg'), os.path.join(OUT, 'tyre_sidewall_basecolor.jpg'))
save_jpg(flip_g(side_n), 'tyre_sidewall_normal.jpg', 92)
shutil.copyfile(os.path.join(SRC, 'tireProtector.jpg'), os.path.join(OUT, 'tyre_tread_basecolor.jpg'))
save_jpg(flip_g(load('tireProtector_NM.jpg')), 'tyre_tread_normal.jpg', 95)
spec = np.asarray(load('tireProtector_spec.jpg', 'L'), dtype=np.float32) / 255
arm = np.stack([np.full_like(spec, 1.0), 1.0 - 0.45 * spec, np.zeros_like(spec)], -1)
save_jpg(Image.fromarray((arm * 255 + 0.5).astype(np.uint8)), 'tyre_tread_arm.jpg', 95)

# ---- generic sidewall (no text) ----
c = np.asarray(side_c, dtype=np.float32); H, W = c.shape[:2]
grey = c.mean(-1) > 40
ys, xs = np.nonzero(grey); cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
print('ring centre', cx, cy, 'outer radius', (xs.max() - xs.min()) / 2)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
dx, dy = xx - cx, cy - yy  # dy: up
r = np.sqrt(dx * dx + dy * dy); th = np.arctan2(dy, dx)
rb = np.round(r * 2).astype(np.int32)  # half-pixel radial bins
nb = rb.max() + 1
order = np.argsort(rb.ravel(), kind='stable'); rbs = rb.ravel()[order]
starts = np.searchsorted(rbs, np.arange(nb + 1))
def radial_median(vals):
    v = vals.reshape(-1, vals.shape[-1])[order]; out = np.zeros((nb, v.shape[1]), np.float32)
    for b in range(nb):
        s, e = starts[b], starts[b + 1]
        if e > s: out[b] = np.median(v[s:e], axis=0)
    return out
gc = radial_median(c)[rb]
Image.fromarray(np.clip(gc, 0, 255).astype(np.uint8)).save(os.path.join(OUT, 'generic', 'tyre_sidewall_generic_basecolor.jpg'), quality=90)
n = np.asarray(flip_g(side_n), dtype=np.float32) / 127.5 - 1  # glTF convention now: x right, y up
cs, sn = np.cos(th), np.sin(th)
nr = n[..., 0] * cs + n[..., 1] * sn; nt = -n[..., 0] * sn + n[..., 1] * cs
med = radial_median(np.stack([nr, nt, n[..., 2]], -1))[rb]
gx = med[..., 0] * cs - med[..., 1] * sn; gy = med[..., 0] * sn + med[..., 1] * cs
gz = np.sqrt(np.clip(1 - gx * gx - gy * gy, 0, 1))
gn = np.stack([gx, gy, gz], -1)
Image.fromarray(np.clip((gn + 1) * 127.5, 0, 255).astype(np.uint8)).save(os.path.join(OUT, 'generic', 'tyre_sidewall_generic_normal.jpg'), quality=92)
print('generic sidewall written')
