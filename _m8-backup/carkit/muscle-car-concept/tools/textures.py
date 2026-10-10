# Downscale the two 4096 PBR atlases to 2048 and pack them for glTF.
# usage: python3 -I textures.py <kit dir>
import sys, os
from PIL import Image
kit = sys.argv[1]
src = os.path.join(kit, 'src', 'textures'); out = os.path.join(kit, 'tex')
S = 2048
for tag, pre in (('A', 'CarV8E_low_Bake_'), ('B', 'CarV8E_low_NotBake_')):
    p = lambda n: os.path.join(src, pre + n + '.png')
    bc = Image.open(p('BaseColor')).convert('RGBA').resize((S, S), Image.LANCZOS)
    bc.convert('RGB').save(os.path.join(out, f'{tag}_basecolor.jpg'), quality=90, optimize=True)
    bc.save(os.path.join(out, f'{tag}_basecolor_alpha.png'), optimize=True)
    bc.getchannel('A').save(os.path.join(out, f'{tag}_alpha.png'))
    rough = Image.open(p('Roughness')).convert('L').resize((S, S), Image.LANCZOS)
    metal = Image.open(p('Metallic')).convert('L').resize((S, S), Image.LANCZOS)
    white = Image.new('L', (S, S), 255)
    Image.merge('RGB', (white, rough, metal)).save(os.path.join(out, f'{tag}_mr.jpg'), quality=90, optimize=True)
    Image.open(p('Normal')).convert('RGB').resize((S, S), Image.LANCZOS).save(os.path.join(out, f'{tag}_normal.png'), optimize=True)
    Image.open(p('Emissive')).convert('RGB').resize((S, S), Image.LANCZOS).save(os.path.join(out, f'{tag}_emissive.jpg'), quality=90, optimize=True)
    print('done', tag)
for f in sorted(os.listdir(out)): print(f, os.path.getsize(os.path.join(out, f)))
