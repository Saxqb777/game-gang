"""Convert the Sketchfab spec/gloss-style maps to glTF metal/rough. Run with python3 -I."""
import sys, os
import numpy as np
from PIL import Image
KIT = sys.argv[1]
SRC = os.path.join(KIT, 'src', 'textures')
OUT = os.path.join(KIT, 'work', 'tex'); os.makedirs(OUT, exist_ok=True)
def load(name, mode='RGB'):
    return np.asarray(Image.open(os.path.join(SRC, name)).convert(mode), dtype=np.float32) / 255.0
def to_lin(c): return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def to_srgb(c):
    c = np.clip(c, 0, 1); return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)
def save(arr, name, size, quality=90):
    im = Image.fromarray(np.clip(arr * 255 + 0.5, 0, 255).astype(np.uint8))
    if im.size != size: im = im.resize(size, Image.LANCZOS)
    path = os.path.join(OUT, name)
    if name.endswith('.jpg'): im.save(path, quality=quality, optimize=True, subsampling=0 if 'arm' in name else 2)
    else: im.save(path, optimize=True)
    print(name, im.size, os.path.getsize(path))
# ---- body atlas: albedo + specular F0 colour -> baseColor + metallic (KHR spec-gloss converter maths)
diff = to_lin(load('Goblin2017_albedo.png'))
spec = to_lin(load('Goblin2017_spec.png'))
rough = load('Goblin2017_rough.png')[..., 0]
ao = load('Goblin2017_ao.png')[..., 0]
A = 0.04
def bright(c): return np.sqrt(0.299 * c[..., 0] ** 2 + 0.587 * c[..., 1] ** 2 + 0.114 * c[..., 2] ** 2)
one_minus = 1 - spec.max(axis=-1)
pd, ps = bright(diff), bright(spec)
b = pd * one_minus / (1 - A) + ps - 2 * A
c = A - ps
D = np.maximum(b * b - 4 * A * c, 0)
metal = np.clip((-b + np.sqrt(D)) / (2 * A), 0, 1)
metal = np.where(ps < A, 0, metal)
from_diff = diff * (one_minus / (1 - A) / np.maximum(1 - metal, 1e-4))[..., None]
from_spec = (spec - A * (1 - metal)[..., None]) / np.maximum(metal, 1e-4)[..., None]
m2 = (metal ** 2)[..., None]
base = np.clip(from_diff * (1 - m2) + from_spec * m2, 0, 1)
# Light lenses / glass areas: the artist used near-white specular over dark or coloured albedo (a
# Sketchfab look for shiny lenses). Converting that literally gives white chrome and erases the LED
# art, so treat those texels as dielectric with the original albedo.
srgb_d = load('Goblin2017_albedo.png'); srgb_s = load('Goblin2017_spec.png')
sat = srgb_d.max(-1) - srgb_d.min(-1)
lens = (srgb_s.min(-1) > 0.75) & ((srgb_d.max(-1) < 0.55) | (sat > 0.35))
metal = np.where(lens, 0.0, metal)
base = np.where(lens[..., None], diff, base)
print('lens texels', lens.mean())
size = (2048, 1024)
save(to_srgb(base), 'body_basecolor.jpg', size)
save(np.stack([ao, rough, metal], -1), 'body_arm.jpg', size)
# ---- tyre: no albedo shipped (tire_albedo.png missing) -> constant colour in material; ARM from roughness
tr = load('tire_roughness.png')[..., 0]
save(np.stack([np.ones_like(tr), tr, np.zeros_like(tr)], -1), 'tyre_arm.jpg', (1024, 512))
tn = load('tire_normals.png')
save(tn, 'tyre_normal.png', (1024, 512))
# glass opacity (kept for reference; R channel)
op = load('Goblin2017_opacity.png')
save(op, 'glass_opacity_ref.jpg', size)
print('metal stats: mean', metal.mean(), 'paint px', (metal > 0.9).mean())
