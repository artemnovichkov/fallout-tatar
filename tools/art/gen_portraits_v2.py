"""v2 NPC portraits: same hand-composed grayscale bust approach + CRT filter as gen_portraits.py."""
import math
import os
import sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..'))
from common import save
from portrait import crt
from gen_portraits import (Canvas, E, PG, union, eye, head_base, nose, mouth, wrinkles, shoulders, noise, blur,
                           YY, XX, SZ)


def jumpsuit(c, vest=False):
    shoulders(c, 0.48, w=70)                                              # blue suit (mid grey on CRT)
    if vest:
        for s in (-1, 1):
            c.paint(c.mask(PG([(80 + s * 10, 122), (80 + s * 62, 128), (80 + s * 70, 160), (80 + s * 8, 160)])), 0.22, bump=6)
        c.paint(c.mask(PG([(72, 120), (88, 120), (84, 160), (76, 160)])), 0.7, bump=3)     # shirt
        c.paint(c.mask(PG([(77, 124), (83, 124), (85, 150), (80, 156), (75, 150)])), 0.3, bump=2)  # tie
        c.paint(c.mask(PG([(76, 120), (84, 120), (83, 126), (77, 126)])), 0.35, bump=1)
    else:
        c.stroke(lambda d: d.line((80, 128, 80, 160), fill=255, width=3), 0.85)              # yellow zip stripe
    # yellow collar (bright)
    for s in (-1, 1):
        c.paint(c.mask(PG([(80 + s * 4, 128), (80 + s * 22, 116), (80 + s * 26, 122), (80 + s * 8, 134)])), 0.88, bump=2)
    for s in (-1, 1):
        c.stroke(lambda d, s=s: d.line((80 + s * 58, 134, 80 + s * 66, 160), fill=255, width=3), 0.82)  # shoulder piping


def overseer():
    c = Canvas()
    jumpsuit(c, vest=True)
    head_base(c, 0.6, cy=72, rx=26, ry=33)
    # grey hair on the sides, receding top
    for s in (-1, 1):
        c.paint(c.mask(PG([(80 + s * 27, 50), (80 + s * 30, 62), (80 + s * 28, 80), (80 + s * 23, 76), (80 + s * 22, 56)])),
                0.82, bump=3, tex=noise(21 + s, 0.7), tex_amt=0.15)
    c.paint(c.mask(lambda d: d.chord((56, 37, 104, 70), 200, 340, fill=255)), 0.74, bump=3, tex=noise(23, 0.8), tex_amt=0.12)
    eye(c, 68, 74, w=5.5, open_=2.2, brow=0.8, brow_dy=-7, brow_tilt=1)
    eye(c, 92, 74, w=5.5, open_=2.2, brow=0.8, brow_dy=-7, brow_tilt=-1)
    # round glasses
    for x in (68, 92):
        c.stroke(lambda d, x=x: d.ellipse((x - 9, 66, x + 9, 82), outline=255, width=2), 0.18)
    c.stroke(lambda d: d.line((77, 72, 83, 72), fill=255, width=2), 0.18)
    c.stroke(lambda d: d.line((50, 71, 59, 72), fill=255, width=2), 0.18)
    c.stroke(lambda d: d.line((101, 72, 110, 71), fill=255, width=2), 0.18)
    nose(c, 80, 88, 0.6, w=5.5, l=12)
    # moustache
    c.paint(c.mask(PG([(66, 96), (76, 92), (80, 94), (84, 92), (94, 96), (92, 100), (84, 98), (80, 99), (76, 98), (68, 100)])),
            0.84, bump=2)
    c.stroke(lambda d: d.line((73, 104, 87, 104), fill=255, width=2), 0.25)
    wrinkles(c, [(57, 76, 59, 82), (103, 76, 101, 82), (66, 60, 76, 59), (84, 59, 94, 60), (64, 92, 62, 100), (96, 92, 98, 100)], 0.32)
    return c.g


def dweller():
    c = Canvas()
    jumpsuit(c)
    head_base(c, 0.62, cy=72, rx=25, ry=32)
    hair = c.mask(union(E(80, 46, 27, 14), PG([(53, 48), (60, 40), (100, 40), (107, 48), (106, 62), (100, 52), (60, 52), (54, 62)])))
    c.paint(hair, 0.28, bump=4, tex=noise(31, 0.7), tex_amt=0.12)
    eye(c, 69, 74, w=5.5, open_=2.6, brow=0.25, brow_dy=-7)
    eye(c, 91, 74, w=5.5, open_=2.6, brow=0.25, brow_dy=-7)
    nose(c, 80, 88, 0.62, w=4.5, l=12)
    mouth(c, 80, 99, w=7, val=0.28, smile=1.0)
    return c.g


def robot():
    c = Canvas()
    # sphere body filling the lower frame, eye stalks rising
    body = c.mask(E(80, 112, 54, 52))
    c.paint(body, 0.7, bump=18, k=14)
    # specular highlight + reflections (chrome)
    c.stroke(E(58, 86, 12, 8), 1.0, 0.8)
    c.stroke(E(52, 80, 5, 3), 1.0)
    c.stroke(lambda d: d.arc((30, 64, 130, 164), 200, 340, fill=255, width=3), 0.35, 0.8)
    # brass band with Tatar zigzag/tulip engraving
    band = c.mask(lambda d: d.chord((26, 110, 134, 150), 180, 360, fill=255)) * (YY > 116) * (YY < 132)
    c.paint(band, 0.62, bump=3)
    pts = []
    for i in range(14):
        pts += [(30 + i * 8, 126), (34 + i * 8, 119)]
    c.stroke(lambda d: d.line(pts, fill=255, width=2), 0.25)
    for x in range(36, 128, 16):
        c.stroke(lambda d, x=x: d.polygon([(x, 136), (x + 3, 141), (x, 146), (x - 3, 141)], fill=255), 0.3)
    # three stalks + eyes
    for (bx, tx, ty) in ((62, 40, 40), (80, 80, 26), (98, 120, 40)):
        c.paint(c.mask(lambda d, a=(bx, 74, tx, ty): d.line(a, fill=255, width=5)), 0.45, bump=2)
        c.paint(c.mask(E(tx, ty, 13, 13)), 0.85, bump=6, k=10)
        c.stroke(E(tx + 2, ty + 2, 6, 6), 0.35)
        c.stroke(E(tx + 2, ty + 2, 3, 3), 0.05)
        c.stroke(E(tx - 4, ty - 4, 2, 2), 1.0)
    c.paint(c.mask(E(80, 72, 16, 6)), 0.5, bump=3)                       # top cap
    # buzzsaw arm poking in from the side
    c.paint(c.mask(lambda d: d.line((150, 160, 136, 104), fill=255, width=6)), 0.5, bump=2)
    saw = c.mask(E(136, 98, 16, 16))
    c.paint(saw, 0.6, bump=3)
    for i in range(12):
        a = math.radians(i * 30)
        c.stroke(lambda d, a=a: d.polygon([(136 + 15 * math.cos(a), 98 + 15 * math.sin(a)),
                                           (136 + 20 * math.cos(a + 0.2), 98 + 20 * math.sin(a + 0.2)),
                                           (136 + 15 * math.cos(a + 0.4), 98 + 15 * math.sin(a + 0.4))], fill=255), 0.75)
    c.stroke(E(136, 98, 4, 4), 0.2)
    return c.g


def shurale():
    c = Canvas()
    bark = noise(41, 0) * 0.5 + blur(noise(42, 0), 0.6) * 0.5
    grain = np.sin(XX * 0.9 + 3 * noise(43, 2.0)) * 0.5 + 0.5
    shoulders(c, 0.42, w=50, tex=grain, amt=0.12)
    # long narrow face
    head_base(c, 0.5, cy=78, rx=21, ry=38, jaw=0.7, neck=0.55)
    face = c.mask(union(E(80, 78, 21, 38), E(80, 92, 15, 26)))
    c.g = c.g + face * (grain - 0.5) * 0.12
    # wild hair mass
    hair = c.mask(PG([(46, 70), (40, 40), (50, 48), (48, 22), (60, 34), (64, 12), (74, 30), (84, 8), (90, 30), (102, 14),
                      (104, 36), (118, 24), (112, 48), (122, 46), (114, 70), (104, 52), (90, 46), (70, 46), (56, 54)]))
    c.paint(hair, 0.36, bump=3, tex=noise(44, 0.6), tex_amt=0.25)
    # single horn from the forehead
    c.paint(c.mask(PG([(74, 52), (86, 52), (88, 34), (84, 14), (80, 4), (80, 20), (76, 34)])), 0.86, bump=3)
    for y in (46, 38, 30):
        c.stroke(lambda d, y=y: d.line((76, y, 86, y - 1), fill=255, width=1), 0.5)
    # glowing eyes, heavy brow
    eye(c, 70, 74, w=5, open_=3.2, lid=0.06, white=0.1, brow=0.12, brow_dy=-6, brow_tilt=-3, glow=True)
    eye(c, 90, 74, w=5, open_=3.2, lid=0.06, white=0.1, brow=0.12, brow_dy=-6, brow_tilt=3, glow=True)
    nose(c, 80, 92, 0.5, w=3.5, l=14)
    # wide grin
    c.stroke(lambda d: d.line((66, 104, 72, 108, 80, 110, 88, 108, 94, 104), fill=255, width=3), 0.06)
    for x in range(70, 92, 4):
        c.stroke(lambda d, x=x: d.rectangle((x, 106, x + 1, 108), fill=255), 0.7)
    # very long fingers creeping up beside the face
    for s in (-1, 1):
        for k in range(3):
            x0 = 80 + s * (44 + k * 9)
            pts = (x0, 160, x0 + s * 2, 128, x0 - s * (4 + k * 3), 98 - k * 6, x0 - s * (10 + k * 4), 76 - k * 8)
            c.paint(c.mask(lambda d, p=pts: d.line(p, fill=255, width=5, joint='curve')), 0.52, bump=2)
            c.stroke(E(pts[6], pts[7], 2.5, 2.5), 0.75)
    return c.g


def settler():
    c = Canvas()
    shoulders(c, 0.4, w=70, tex=noise(51, 1.2), amt=0.1)                 # rough jacket
    c.stroke(lambda d: d.line((66, 130, 60, 160), fill=255, width=2), 0.25)
    c.stroke(lambda d: d.line((94, 130, 100, 160), fill=255, width=2), 0.25)
    head_base(c, 0.56, cy=76)
    # scarf with ornament dots
    sc = c.mask(PG([(50, 112), (110, 112), (114, 128), (96, 136), (80, 132), (64, 136), (46, 128)]))
    c.paint(sc, 0.5, bump=4)
    c.paint(c.mask(PG([(88, 128), (100, 132), (98, 156), (88, 152)])), 0.48, bump=3)
    for i in range(7):
        c.stroke(E(56 + i * 8, 122, 1.6, 1.6), 0.88)
    # stubble
    st = c.mask(PG([(56, 88), (104, 88), (100, 106), (80, 114), (60, 106)]))
    c.g = c.g * (1 - st * 0.2 * (noise(52, 0) > 0.5))
    # flat cap with peak
    cap = c.mask(union(E(80, 48, 32, 14), PG([(48, 50), (112, 50), (108, 60), (52, 60)])))
    c.paint(cap, 0.32, bump=5, tex=noise(53, 0.8), tex_amt=0.08)
    c.paint(c.mask(E(80, 61, 30, 5)), 0.22, bump=2)
    c.stroke(lambda d: d.line((52, 58, 108, 58), fill=255, width=1), 0.45)
    eye(c, 68, 76, w=6, open_=2.2, brow=0.22, brow_dy=-6, brow_tilt=1)
    eye(c, 92, 76, w=6, open_=2.2, brow=0.22, brow_dy=-6, brow_tilt=-1)
    nose(c, 80, 90, 0.56)
    mouth(c, 80, 101, w=8, val=0.24)
    wrinkles(c, [(60, 82, 58, 86), (100, 82, 102, 86)], 0.35)
    return c.g


BUSTS = {'overseer': overseer, 'dweller': dweller, 'robot': robot, 'shurale': shurale, 'settler': settler}


def main():
    for k, f in BUSTS.items():
        g = f()
        lo, hi = np.percentile(g, 1), np.percentile(g, 99.6)
        g = np.clip((g - lo) / (hi - lo), 0, 1) ** 0.8 * 0.97 + 0.02
        print('wrote', save(crt(g), 'portraits', f'portrait_{k}.png'))


if __name__ == '__main__':
    main()
