"""NPC portraits: hand-composed grayscale busts (shape by shape, bump-shaded), then the CRT filter
from tools/portrait.py so they match Ravil's photo portrait."""
import math
import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..'))
from common import save
from portrait import crt

SZ = 160
LIGHT = np.array([-0.55, -0.6, 0.6]); LIGHT = LIGHT / np.linalg.norm(LIGHT)
YY, XX = np.mgrid[0:SZ, 0:SZ].astype(float)


def blur(a, s):
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(s)), float) / 255


def noise(seed, s):
    r = np.random.default_rng(seed)
    return blur(r.random((SZ, SZ)), s) * 2 - 0.5 if s else r.random((SZ, SZ))


class Canvas:
    def __init__(self):
        yy, xx = YY / SZ, XX / SZ
        self.g = 0.06 + 0.13 * np.exp(-(((xx - 0.5) / 0.38) ** 2 + ((yy - 0.38) / 0.34) ** 2))

    def mask(self, fn):
        im = Image.new('L', (SZ, SZ), 0)
        fn(ImageDraw.Draw(im))
        return np.asarray(im, float) / 255

    def paint(self, m, albedo, bump=6.0, k=7.0, tex=None, tex_amt=0.0, amb=0.38, dif=0.8):
        """m: mask 0..1; shade using a height field from the blurred mask (pillow shading)."""
        h = blur(m, bump) if bump else m
        gy, gx = np.gradient(h)
        nx, ny, nz = -gx * k, -gy * k, np.ones_like(h)
        ln = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
        I = (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / ln
        alb = albedo if np.isscalar(albedo) else albedo
        v = alb * (amb + dif * np.clip(I, 0, 1))
        if tex is not None:
            v = v + tex * tex_amt
        self.g = self.g * (1 - m) + v * m

    def stroke(self, fn, val, alpha=1.0):
        m = self.mask(fn)
        self.g = self.g * (1 - m * alpha) + val * m * alpha


def E(cx, cy, rx, ry):
    return lambda d: d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)


def PG(pts):
    return lambda d: d.polygon(pts, fill=255)


def union(*fns):
    def f(d):
        for fn in fns:
            fn(d)
    return f


def eye(c, x, y, w=7, open_=3.2, iris=0.15, white=0.7, lid=0.3, brow=0.18, brow_dy=-7, brow_tilt=0.0, glow=False):
    c.stroke(E(x, y + 0.5, w + 2, open_ + 2.5), lid, 0.5)       # socket shadow
    c.stroke(E(x, y, w, open_), white)
    if glow:
        c.stroke(E(x, y, 3.0, 3.0), 1.0)
    else:
        c.stroke(E(x, y, 2.6, min(2.6, open_)), iris)
        c.stroke(E(x - 0.8, y - 1, 0.8, 0.8), 0.95)
    c.stroke(lambda d: d.line((x - w, y - open_ + 0.5, x, y - open_ - 0.8, x + w, y - open_ + 0.5), fill=255, width=2), 0.12)
    c.stroke(lambda d: d.line((x - w - 2, y + brow_dy + brow_tilt, x, y + brow_dy - 1.5, x + w + 2, y + brow_dy - brow_tilt), fill=255, width=3), brow)


def head_base(c, skin=0.62, cx=80, cy=70, rx=27, ry=34, jaw=0.85, neck=0.5, ears=True):
    c.paint(c.mask(PG([(cx - 13, cy + 20), (cx + 13, cy + 20), (cx + 15, cy + 55), (cx - 15, cy + 55)])), skin * neck, bump=4)
    if ears:
        for s in (-1, 1):
            c.paint(c.mask(E(cx + s * rx, cy + 4, 6, 10)), skin * 0.9, bump=3)
            c.stroke(E(cx + s * (rx + 1), cy + 4, 2.5, 5.5), skin * 0.5, 0.6)
    face = c.mask(union(E(cx, cy, rx, ry), E(cx, cy + ry * 0.35, rx * jaw, ry * 0.68)))
    c.paint(face, skin, bump=9, k=9)
    return face


def nose(c, x=80, y=84, skin=0.62, w=5, l=14):
    c.paint(c.mask(PG([(x - 2, y - l), (x + 2, y - l), (x + w, y), (x + w - 1, y + 3), (x - w + 1, y + 3), (x - w, y)])), skin, bump=2.5, k=10)
    c.stroke(E(x - 3, y + 1, 1.5, 1.2), 0.15)
    c.stroke(E(x + 3, y + 1, 1.5, 1.2), 0.15)
    c.stroke(lambda d: d.line((x + w, y - 2, x + w - 1, y + 3), fill=255, width=1), skin * 0.5, 0.7)


def mouth(c, x=80, y=99, w=9, val=0.2, lip=0.45, smile=0.0):
    c.stroke(lambda d: d.line((x - w, y - smile, x, y + 0.5, x + w, y - smile), fill=255, width=2), val)
    c.stroke(lambda d: d.line((x - w + 3, y + 3.5, x + w - 3, y + 3.5), fill=255, width=1), lip, 0.6)


def wrinkles(c, pts_list, val=0.35, a=0.6):
    for pts in pts_list:
        c.stroke(lambda d, p=pts: d.line(p, fill=255, width=1), val, a)


def shoulders(c, val, cx=80, top=118, w=70, tex=None, amt=0.0):
    m = c.mask(union(E(cx, top + 40, w, 42), PG([(cx - w, 160), (cx + w, 160), (cx + w, top + 40), (cx - w, top + 40)])))
    c.paint(m, val, bump=10, k=10, tex=tex, tex_amt=amt)
    return m


# --------------------------------------------------------------------------- busts
def trader():
    c = Canvas()
    shoulders(c, 0.62)                                                   # white shirt
    for s in (-1, 1):                                                    # vest panels
        c.paint(c.mask(PG([(80 + s * 8, 122), (80 + s * 64, 128), (80 + s * 72, 160), (80 + s * 6, 160)])), 0.3, bump=6)
        c.paint(c.mask(PG([(80 + s * 40, 120), (80 + s * 50, 121), (80 + s * 46, 160), (80 + s * 36, 160)])), 0.22, bump=3)  # straps
    for y in (134, 144, 154):
        c.stroke(E(80, y, 1.6, 1.6), 0.7)
    head_base(c, 0.58, cy=72)
    # tubeteika
    cap = c.mask(union(PG([(52, 52), (108, 52), (104, 34), (56, 34)]), E(80, 35, 24, 7)))
    c.paint(cap, 0.36, bump=4)
    for i in range(9):
        x = 56 + i * 6
        c.stroke(lambda d, x=x: d.polygon([(x, 44), (x + 3, 40), (x + 6, 44), (x + 3, 48)], fill=255), 0.85)
    c.stroke(lambda d: d.line((54, 51, 106, 51), fill=255, width=2), 0.75)
    c.stroke(lambda d: d.line((56, 37, 104, 37), fill=255, width=1), 0.7)
    eye(c, 68, 74, w=6, open_=2.4, brow=0.8, brow_dy=-7)
    eye(c, 92, 74, w=6, open_=2.4, brow=0.8, brow_dy=-7)
    nose(c, 80, 88, 0.58, w=6, l=13)
    # beard + moustache
    beard = c.mask(PG([(55, 82), (60, 100), (68, 118), (80, 124), (92, 118), (100, 100), (105, 82), (98, 92), (90, 96), (80, 95), (70, 96), (62, 92)]))
    c.paint(beard, 0.78, bump=5, tex=noise(3, 0.8), tex_amt=0.18)
    c.paint(c.mask(PG([(68, 95), (80, 92), (92, 95), (95, 100), (86, 98), (80, 99), (74, 98), (65, 100)])), 0.85, bump=2)
    c.stroke(lambda d: d.line((74, 102, 86, 102), fill=255, width=2), 0.25)
    wrinkles(c, [(59, 70, 61, 76), (101, 70, 99, 76), (66, 64, 74, 63), (86, 63, 94, 64)], 0.3)
    return c.g


def elder():
    c = Canvas()
    shoulders(c, 0.42, w=66)                                             # dark dress
    # scarf behind/around head
    c.paint(c.mask(union(E(80, 72, 40, 46), PG([(40, 80), (120, 80), (128, 140), (32, 140)]))), 0.42, bump=10, k=9)
    head_base(c, 0.62, cy=76, rx=24, ry=30, ears=False)
    # scarf front edge framing face
    edge = c.mask(lambda d: d.arc((50, 38, 110, 120), 170, 370, fill=255, width=7))
    c.paint(edge, 0.48, bump=3)
    for i in range(12):                                                  # ornament border dots
        a = math.radians(175 + i * 16)
        c.stroke(E(80 + 33 * math.cos(a), 79 + 44 * math.sin(a), 1.8, 1.8), 0.9)
    # knot under chin + ornament band
    c.paint(c.mask(PG([(70, 108), (90, 108), (96, 126), (80, 132), (64, 126)])), 0.5, bump=4)
    for x in range(48, 116, 8):
        c.stroke(lambda d, x=x: d.polygon([(x, 140), (x + 4, 135), (x + 8, 140), (x + 4, 145)], fill=255), 0.78)
    eye(c, 69, 78, w=5.5, open_=2.0, brow=0.42, brow_dy=-6, brow_tilt=1.5)
    eye(c, 91, 78, w=5.5, open_=2.0, brow=0.42, brow_dy=-6, brow_tilt=-1.5)
    nose(c, 80, 90, 0.62, w=4.5, l=11)
    mouth(c, 80, 100, w=7, val=0.3, smile=1.5)
    wrinkles(c, [(60, 80, 57, 84), (100, 80, 103, 84), (66, 96, 64, 103), (94, 96, 96, 103),
                 (70, 70, 76, 69), (84, 69, 90, 70), (72, 58, 88, 58)], 0.38)
    return c.g


def raider():
    c = Canvas()
    shoulders(c, 0.36, w=72, tex=noise(5, 1.2), amt=0.12)                  # leather
    for s in (-1, 1):
        c.paint(c.mask(E(80 + s * 52, 128, 22, 14)), 0.32, bump=5)        # pauldrons
        for k in range(4):
            x = 80 + s * (38 + k * 9)
            c.paint(c.mask(PG([(x - 3, 122 - k), (x + 3, 122 - k), (x, 106 - k * 2)])), 0.8, bump=1.5)
    c.paint(c.mask(PG([(70, 122), (90, 122), (86, 160), (74, 160)])), 0.55, bump=4)  # bare chest strip
    head_base(c, 0.52, cy=70)
    # shaved sides stipple + mohawk
    sides = c.mask(lambda d: d.chord((53, 36, 107, 104), 190, 350, fill=255))
    c.g = c.g * (1 - sides * 0.25 * (noise(8, 0) > 0.5))
    moh = c.mask(PG([(70, 50), (66, 24), (72, 30), (74, 12), (79, 22), (82, 6), (86, 22), (91, 14), (90, 30), (96, 26), (90, 50)]))
    c.paint(moh, 0.3, bump=3, tex=noise(9, 0.6), tex_amt=0.15)
    eye(c, 68, 72, w=6, open_=2.0, brow=0.12, brow_dy=-5, brow_tilt=-2.5)
    eye(c, 92, 72, w=6, open_=2.0, brow=0.12, brow_dy=-5, brow_tilt=2.5)
    # bandana over nose & mouth
    band = c.mask(PG([(52, 84), (108, 84), (104, 100), (80, 122), (56, 100)]))
    c.paint(band, 0.45, bump=5)
    for y0 in (92, 100, 108):
        c.stroke(lambda d, y0=y0: d.line((62 + (y0 - 92) * 0.8, y0, 80, y0 + 6, 98 - (y0 - 92) * 0.8, y0), fill=255, width=1), 0.25)
    for i in range(6):
        c.stroke(E(62 + i * 7, 88, 1.2, 1.2), 0.8)
    c.stroke(lambda d: d.line((92, 58, 99, 70), fill=255, width=2), 0.8)  # scar
    return c.g


def ghoul():
    c = Canvas()
    shoulders(c, 0.34, w=60, tex=noise(11, 1.5), amt=0.25)                # rags
    for i, x in enumerate((44, 60, 98, 114)):
        c.stroke(PG([(x, 125), (x + 8, 125), (x + 3, 140)]), 0.12)        # tears
    face = head_base(c, 0.5, cy=70, rx=25, ry=33, jaw=0.75, neck=0.55)
    # peeling patches
    pn = noise(12, 3.0)
    raw = (pn > 0.62) & (face > 0.5)
    c.g = np.where(raw, c.g * 0.6, c.g)
    hi = (pn < 0.12) & (face > 0.5)
    c.g = np.where(hi, c.g * 1.25, c.g)
    eye(c, 69, 70, w=5.5, open_=4.0, lid=0.08, white=0.08, brow=0.3, glow=True)
    eye(c, 91, 70, w=5.5, open_=4.0, lid=0.08, white=0.08, brow=0.3, glow=True)
    c.stroke(PG([(76, 84), (79, 84), (78, 90)]), 0.08)                    # nose holes
    c.stroke(PG([(81, 84), (84, 84), (82, 90)]), 0.08)
    c.stroke(E(80, 101, 11, 5), 0.06)                                      # lipless grin
    for i in range(-9, 10, 3):
        c.stroke(lambda d, i=i: d.rectangle((80 + i, 98, 81 + i, 101), fill=255), 0.8)
        c.stroke(lambda d, i=i: d.rectangle((80 + i, 102, 81 + i, 104), fill=255), 0.6)
    c.stroke(lambda d: d.line((60, 52, 64, 46, 63, 40), fill=255, width=1), 0.7)   # stray hairs
    c.stroke(lambda d: d.line((96, 50, 99, 43), fill=255, width=1), 0.7)
    return c.g


def guard():
    c = Canvas()
    shoulders(c, 0.42, w=72)
    for s in (-1, 1):
        c.paint(c.mask(E(80 + s * 50, 130, 26, 16)), 0.62, bump=6)        # metal pads
        c.stroke(E(80 + s * 44, 126, 1.6, 1.6), 0.2)
    for (x0, y0, x1, y1, v) in ((62, 128, 80, 145, 0.5), (80, 128, 98, 145, 0.35), (62, 145, 80, 160, 0.3), (80, 145, 98, 160, 0.55)):
        c.paint(c.mask(lambda d, b=(x0, y0, x1, y1): d.rectangle(b, fill=255)), v, bump=2)
    c.stroke(lambda d: d.line((40, 120, 120, 160), fill=255, width=4), 0.18)   # rifle sling
    head_base(c, 0.58, cy=74)
    # stubble
    st = c.mask(PG([(56, 86), (104, 86), (100, 104), (80, 112), (60, 104)]))
    c.g = c.g * (1 - st * 0.18 * (noise(14, 0) > 0.5))
    helm = c.mask(union(E(80, 52, 34, 26), PG([(42, 58), (118, 58), (120, 64), (40, 64)])))
    c.g = np.where(YY > 64, c.g, c.g)
    hm = helm * (YY < 64)
    c.paint(hm, 0.46, bump=6, tex=noise(15, 1.0), tex_amt=0.08)
    c.stroke(lambda d: d.line((40, 63, 120, 63), fill=255, width=2), 0.25)
    c.stroke(lambda d: d.line((56, 64, 58, 100, 70, 114), fill=255, width=2), 0.25)   # chin strap
    c.stroke(lambda d: d.line((104, 64, 102, 100, 90, 114), fill=255, width=2), 0.25)
    eye(c, 68, 76, w=6, open_=2.2, brow=0.2, brow_dy=-6, brow_tilt=-1)
    eye(c, 92, 76, w=6, open_=2.2, brow=0.2, brow_dy=-6, brow_tilt=1)
    nose(c, 80, 89, 0.58)
    mouth(c, 80, 101, w=8, val=0.22)
    return c.g


BUSTS = {'trader': trader, 'elder': elder, 'raider': raider, 'ghoul': ghoul, 'guard': guard}


def main():
    for k, f in BUSTS.items():
        g = f()
        lo, hi = np.percentile(g, 1), np.percentile(g, 99.6)
        g = np.clip((g - lo) / (hi - lo), 0, 1) ** 0.8 * 0.97 + 0.02
        print('wrote', save(crt(g), 'portraits', f'portrait_{k}.png'))


if __name__ == '__main__':
    main()
