import sys, numpy as np
from PIL import Image
# usage: nmcheck.py colour.jpg normal.jpg  -> correlation of normal R/G with height gradients (height = colour luminance)
c = np.asarray(Image.open(sys.argv[1]).convert('L'), dtype=np.float32) / 255
n = np.asarray(Image.open(sys.argv[2]).convert('RGB'), dtype=np.float32) / 255 * 2 - 1
from PIL import ImageFilter
c = np.asarray(Image.fromarray((c * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)), dtype=np.float32) / 255
dx = np.gradient(c, axis=1); dy = np.gradient(c, axis=0)  # dy: image-down
m = (np.abs(dx) + np.abs(dy)) > 0.01
def corr(a, b): a = a[m] - a[m].mean(); b = b[m] - b[m].mean(); return float((a * b).sum() / np.sqrt((a * a).sum() * (b * b).sum()))
cr = corr(n[..., 0], -dx); cg = corr(n[..., 1], dy)
print('corr(R,-dH/dx)=%.3f corr(G,+dH/dy_down)=%.3f' % (cr, cg))
print('=> if signs agree: OpenGL (+Y up, glTF ok); if opposite: DirectX (flip G)')
