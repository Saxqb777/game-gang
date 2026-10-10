"""Small raw RGB copies of the atlas maps that build.mjs samples for triangle classification. Run with python3 -I samples.py <kit>."""
import sys, os
import numpy as np
from PIL import Image
KIT = sys.argv[1]
for n in ['albedo', 'spec', 'rough', 'ao']:
    im = Image.open(os.path.join(KIT, 'src', 'textures', f'Goblin2017_{n}.png')).convert('RGB').resize((1024, 512), Image.BOX)
    np.asarray(im, dtype=np.uint8).tofile(os.path.join(KIT, 'work', f'{n}_1024x512.rgb'))
