"""Green-phosphor CRT portrait filter + Ravil's portrait from the reference photo.

usage: python3 -I tools/portrait.py [ref.jpg]   -> public/assets/portraits/portrait_ravil.png
The reference photo stays in tools/ref/ (gitignored) and is never copied to public/.
"""
import os
import sys
import numpy as np
from PIL import Image, ImageFilter, ImageDraw, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'public', 'assets', 'portraits')
SIZE = 160
GREEN = np.array([(5, 14, 7), (12, 40, 18), (26, 84, 36), (52, 142, 62), (108, 214, 104), (190, 255, 170)], float)
BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


def crt(gray, px=2, levels=None):
    """gray: float array (SIZE,SIZE) in 0..1 -> RGBA PIL image in CRT style."""
    levels = levels or len(GREEN)
    g = np.asarray(gray, float)
    h, w = g.shape
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.hypot((xx - w / 2) / (w / 2), (yy - h / 2) / (h / 2))
    g = g * np.clip(1.12 - 0.35 * r ** 2.2, 0, 1)                  # tube vignette
    small = Image.fromarray((np.clip(g, 0, 1) * 255).astype(np.uint8)).resize((w // px, h // px), Image.BOX)
    s = np.asarray(small, float) / 255
    sh, sw = s.shape
    by = np.tile(BAYER4, (sh // 4 + 1, sw // 4 + 1))[:sh, :sw]
    q = np.clip(np.floor(s * (levels - 1) + by), 0, levels - 1).astype(int)
    q = np.kron(q, np.ones((px, px), int))
    rgb = GREEN[q]
    rgb[1::2] *= 0.62                                               # scanlines
    rgb[:, ::3] *= 0.94                                             # faint aperture grille
    # rounded tube corners
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), radius=14, fill=255)
    a = np.asarray(m)
    rgb[a == 0] = (3, 8, 4)
    out = np.dstack([np.clip(rgb, 0, 255), np.full((h, w), 255.0)]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def photo_gray(path, box):
    im = Image.open(path).convert('RGB').crop(box).resize((SIZE, SIZE), Image.LANCZOS)
    # background removal: flood-fill the smooth grey wall from the top corners
    blur = np.asarray(im.filter(ImageFilter.GaussianBlur(1.5)), float)
    mx, mn = blur.max(2), blur.min(2)
    sat = (mx - mn) / np.maximum(mx, 1)
    cand = (sat < 0.12) & (mx > 120)
    mark = Image.fromarray((cand * 255).astype(np.uint8))
    seeds = [(x, 1) for x in range(1, SIZE, 6)] + [(1, y) for y in range(1, SIZE * 2 // 3, 6)] + [(SIZE - 2, y) for y in range(1, SIZE * 2 // 3, 6)]
    for sd in seeds:
        if mark.getpixel(sd) == 255:
            ImageDraw.floodfill(mark, sd, 128)
    bg = np.asarray(mark) == 128
    bgm = Image.fromarray((bg * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.5))
    bgm = np.asarray(bgm, float) / 255
    g = ImageOps.grayscale(im)
    g = ImageOps.autocontrast(g, cutoff=(1, 1))
    g = g.filter(ImageFilter.UnsharpMask(radius=2, percent=120, threshold=2))
    a = np.asarray(g, float) / 255
    a = np.clip((a - 0.06) / 0.88, 0, 1) ** 1.15
    # posterize-ish contrast curve to make features pop
    a = 0.5 + np.tanh((a - 0.5) * 1.7) / (2 * np.tanh(0.85))
    yy, xx = np.mgrid[0:SIZE, 0:SIZE] / SIZE
    bgval = 0.07 + 0.16 * np.exp(-(((xx - 0.5) / 0.38) ** 2 + ((yy - 0.38) / 0.34) ** 2))
    return a * (1 - bgm) + bgval * bgm


def main(ref=None):
    ref = ref or os.path.join(HERE, 'ref', 'ravil_ref1.jpg')
    if not os.path.exists(ref):
        print('skip portrait_ravil: no reference photo at', ref)
        return
    g = photo_gray(ref, (50, 10, 590, 550))
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, 'portrait_ravil.png')
    crt(g).save(p)
    print('wrote', p)


if __name__ == '__main__':
    main(*(sys.argv[1:2]))
