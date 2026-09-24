# Textures Rocketbox → jpg/png du convertisseur de tidewater (tools/characters), sans ImageMagick :
#   couleur/relief → JPEG (corps 2048², tête 1024²), spéculaire → ORM (R 1, G = 0,92 − 0,6·spéc, B 0 — la règle de tidewater),
#   opacité (cheveux) → PNG avec alpha. Option --ciel : les BLANCS du maillot (peu saturés, clairs) passent en bleu ciel,
#   ombrage conservé (valeur relative) — la peau (saturée) et les noirs ne bougent pas.
import sys, os, numpy as np
from PIL import Image
src, out, p = sys.argv[1:4]; ciel = '--ciel' in sys.argv
os.makedirs(out, exist_ok=True)
def recolor(img, rgb=(0.36, 0.68, 0.93)):
    a = np.asarray(img).astype(np.float32) / 255
    mx, mn = a.max(2), a.min(2); v = mx; s = np.where(mx > 1e-4, (mx - mn) / np.maximum(mx, 1e-4), 0)
    sm = lambda x, e0, e1: np.clip((x - e0) / (e1 - e0), 0, 1) ** 2 * (3 - 2 * np.clip((x - e0) / (e1 - e0), 0, 1))
    w = sm(v, 0.38, 0.72) * (1 - sm(s, 0.10, 0.22))            # blanc : clair ET peu saturé
    tgt = np.array(rgb, np.float32)[None, None, :] * np.clip(v / 0.86, 0, 1.15)[..., None]
    o = a * (1 - w[..., None]) + np.clip(tgt, 0, 1) * w[..., None]
    return Image.fromarray((o * 255 + 0.5).astype(np.uint8)), float(w.mean())
for k, S in (('body', 2048), ('head', 1024)):
    c = Image.open(f'{src}/{p}_{k}_color.tga').convert('RGB')
    if ciel and k == 'body': c, frac = recolor(c); print('recoloré', f'{100 * frac:.1f} % de la texture')
    c.resize((S, S), Image.LANCZOS).save(f'{out}/{p}_{k}_color.jpg', quality=90)
    Image.open(f'{src}/{p}_{k}_normal.tga').convert('RGB').resize((S, S), Image.LANCZOS).save(f'{out}/{p}_{k}_normal.jpg', quality=92)
    sp = np.asarray(Image.open(f'{src}/{p}_{k}_specular.tga').convert('L').resize((1024, 1024), Image.LANCZOS)).astype(np.float32) / 255
    orm = np.stack([np.ones_like(sp), np.clip(0.92 - 0.6 * sp, 0, 1), np.zeros_like(sp)], 2)
    Image.fromarray((orm * 255 + 0.5).astype(np.uint8)).save(f'{out}/{p}_{k}_orm.jpg', quality=92)
op = f'{src}/{p}_opacity_color.tga'
if os.path.exists(op): Image.open(op).convert('RGBA').save(f'{out}/{p}_opacity.png'); print('opacité', Image.open(op).size, Image.open(op).mode)
print(sorted(os.listdir(out)))
