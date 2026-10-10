"""Convert source PBR textures to glTF-ready files: <=2048 px, JPEG for colour/ORM, PNG for normals
(DirectX -> OpenGL green flip) and for the alpha-masked grille."""
import sys, os
from PIL import Image
import numpy as np
SRC, OUT = sys.argv[1], sys.argv[2]
MAX = 2048
def load(name):
    return Image.open(os.path.join(SRC, name))
def fit(im):
    if max(im.size) > MAX:
        s = MAX / max(im.size)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    return im
def rgb_on(im, bg=(0, 0, 0)):
    im = im.convert('RGBA')
    base = Image.new('RGB', im.size, bg)
    base.paste(im, mask=im.split()[3])
    return base
def jpg(im, name, q=90):
    fit(im).save(os.path.join(OUT, name), quality=q, optimize=True, subsampling=0 if 'orm' in name else 2)
def gray(name, size):
    if name is None:
        return None
    im = load(name)
    im = im.convert('LA').split()[0] if im.mode in ('LA', 'RGBA') else im.convert('L')
    if im.size != size:
        im = im.resize(size, Image.LANCZOS)
    return im
def orm(rough, metal, size, name, rough_const=None, metal_const=0):
    r = Image.new('L', size, 255)
    g = gray(rough, size) if rough else Image.new('L', size, rough_const)
    b = gray(metal, size) if metal else Image.new('L', size, metal_const)
    jpg(Image.merge('RGB', (r, g, b)), name)
def normal_dx_to_gl(name, out):
    im = fit(load(name).convert('RGB'))
    a = np.asarray(im).copy()
    a[..., 1] = 255 - a[..., 1]
    Image.fromarray(a).save(os.path.join(OUT, out), optimize=True)

sets = {
    'body': ('Car_Body_Base_Color.png', 'Car_Body_Roughness.png', 'Car_Body_Metallic.png', 'Car_Body_Normal_DirectX.png'),
    'interior': ('interior_Base_Color.png', 'interior_Roughness.png', 'interior_Metallic.png', 'interior_Normal_DirectX.png'),
    'chassis': ('mechanics_Base_Color.png', 'mechanics_Roughness.png', 'mechanics_Metallic.png', 'mechanics_Normal_DirectX.png'),
    'wheel': ('wheel-brake-disc_Base_Color.png', 'wheel-brake-disc_roughness.png', 'wheel-brake-disc_Metallic.png', 'wheel-brake-disc_Normal_DirectX.png'),
    'tyre': ('tire-low-diffuse.png', 'tire-low-roughness.png', None, 'tire-low-normal.png'),
}
for key, (base, rough, metal, nrm) in sets.items():
    b = fit(rgb_on(load(base)))
    jpg(b, f'{key}_basecolor.jpg')
    orm(rough, metal, b.size, f'{key}_orm.jpg')
    normal_dx_to_gl(nrm, f'{key}_normal.png')
# grille: grey + alpha mask, keep PNG with alpha
g = load('front-grille-texture.png').convert('LA')
g.convert('RGBA').save(os.path.join(OUT, 'grille_basecolor.png'), optimize=True)
# dashboard screens (contains third-party UI, see branding notes)
jpg(rgb_on(load('media.png')), 'screen_basecolor.jpg')
for f in sorted(os.listdir(OUT)):
    im = Image.open(os.path.join(OUT, f))
    print(f, im.size, im.mode, os.path.getsize(os.path.join(OUT, f)))
