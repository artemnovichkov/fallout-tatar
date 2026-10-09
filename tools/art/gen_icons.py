"""Inventory icons, 32x32 each, single row in ICONS order. Drawn shape by shape."""
import math
import sys
from PIL import Image, ImageDraw

sys.path.insert(0, __import__('os').path.dirname(__file__))
from common import PAL, OUTLINE, save, rng, ramp
from r3d import add_outline

S = 32
PAL.update({
    'brass': ramp('#e8cc7a', '#c4a050', '#967636', '#6a5024'),
    'copper': ramp('#d89a6a', '#b07248', '#865234', '#5a3622'),
    'pastry': ramp('#e8c27c', '#c99a58', '#a0723c', '#6e4a26'),
    'honey': ramp('#f4d070', '#d8a640', '#b07a28', '#7a5018'),
    'shell': ramp('#c45a48', '#a03e32', '#7a2c24', '#521c18'),
    'card': ramp('#c8b48a', '#a8946a', '#86744e', '#5e5236'),
    'milk': ramp('#f0ece0', '#d4d0c4', '#aeaa9e', '#82807a'),
    'redfluid': ramp('#e05a4a', '#c03a30', '#902822', '#601a16'),
    'iron': ramp('#6a6a66', '#4a4a48', '#343432', '#222220'),
})


def C(name, i=1):
    return PAL[name][i] + (255,)


class Icon:
    def __init__(self):
        self.im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)

    def poly(self, pts, col):
        self.d.polygon([tuple(p) for p in pts], fill=col)

    def rect(self, x0, y0, x1, y1, col):
        self.d.rectangle((x0, y0, x1, y1), fill=col)

    def ell(self, x0, y0, x1, y1, col):
        self.d.ellipse((x0, y0, x1, y1), fill=col)

    def line(self, pts, col, w=1):
        self.d.line([tuple(p) for p in pts], fill=col, width=w)

    def px(self, x, y, col):
        if 0 <= x < S and 0 <= y < S:
            self.im.putpixel((x, y), col)

    def done(self):
        return add_outline(self.im, OUTLINE)


def thick_line(ic, a, b, w, ramp_name):
    """a bar from a to b with lit top edge and dark bottom edge"""
    ax, ay = a; bx, by = b
    L = math.hypot(bx - ax, by - ay)
    nx, ny = -(by - ay) / L, (bx - ax) / L  # normal
    hw = w / 2
    pts = [(ax + nx * hw, ay + ny * hw), (bx + nx * hw, by + ny * hw), (bx - nx * hw, by - ny * hw), (ax - nx * hw, ay - ny * hw)]
    ic.poly(pts, C(ramp_name, 1))
    up = -1 if ny > 0 else 1
    ic.line([(ax + nx * hw * up * 0.9, ay + ny * hw * up * 0.9), (bx + nx * hw * up * 0.9, by + ny * hw * up * 0.9)], C(ramp_name, 0))
    ic.line([(ax - nx * hw * up * 0.9, ay - ny * hw * up * 0.9), (bx - nx * hw * up * 0.9, by - ny * hw * up * 0.9)], C(ramp_name, 2))


def i_knife():
    ic = Icon()
    ic.poly([(13, 19), (25, 5), (27, 4), (26, 7), (15, 21)], C('metal', 1))
    ic.line([(14, 19), (25, 6)], C('metal', 0))
    ic.line([(15, 21), (26, 7)], C('metal', 2))
    ic.line([(11, 18), (16, 23)], C('metal_dk', 1), 2)
    thick_line(ic, (5, 28), (12, 21), 4, 'wood_dk')
    for t in (0.3, 0.6):
        ic.px(int(5 + 7 * t), int(28 - 7 * t), C('wood_dk', 3))
    return ic.done()


def i_pistol():
    ic = Icon()
    ic.rect(6, 10, 26, 15, C('gun', 1))
    ic.line([(6, 10), (26, 10)], C('gun', 0))
    ic.line([(7, 15), (26, 15)], C('gun', 2))
    for x in range(8, 13, 2):
        ic.line([(x, 11), (x, 13)], C('gun', 2))
    ic.rect(26, 11, 27, 13, C('gun', 2))
    ic.poly([(8, 15), (15, 15), (14, 26), (7, 26)], C('wood_dk', 1))
    ic.line([(8, 16), (7, 25)], C('wood_dk', 0))
    for y in (18, 21, 24):
        ic.line([(9, y), (13, y)], C('wood_dk', 2))
    ic.line([(15, 16), (15, 19), (19, 19), (19, 16)], C('gun', 2))
    ic.px(17, 17, C('gun', 1))
    ic.px(24, 9, C('gun', 1))
    return ic.done()


def i_sawedoff():
    ic = Icon()
    ic.rect(3, 11, 19, 13, C('gun', 1)); ic.line([(3, 11), (19, 11)], C('gun', 0))
    ic.rect(3, 14, 19, 16, C('gun', 1)); ic.line([(3, 16), (19, 16)], C('gun', 2))
    ic.px(3, 12, C('oil', 1)); ic.px(3, 15, C('oil', 1))
    ic.rect(7, 17, 16, 18, C('wood', 1))
    ic.poly([(18, 10), (24, 10), (28, 13), (29, 20), (26, 25), (22, 25), (24, 19), (20, 17), (18, 17)], C('wood', 1))
    ic.line([(19, 10), (24, 10), (27, 13)], C('wood', 0))
    ic.line([(28, 19), (26, 24), (23, 24)], C('wood', 2))
    ic.line([(19, 17), (21, 20)], C('gun', 2))
    ic.px(20, 13, C('metal', 0))
    return ic.done()


def bullet(ic, x, y, h, case='brass', tip='copper', w=3):
    ic.rect(x, y + 2, x + w - 1, y + h, C(case, 1))
    ic.line([(x, y + 2), (x, y + h)], C(case, 0))
    ic.line([(x + w - 1, y + 2), (x + w - 1, y + h)], C(case, 2))
    ic.rect(x, y, x + w - 1, y + 1, C(tip, 1))
    ic.px(x + w // 2, y - 1, C(tip, 1)) if w >= 3 else None
    ic.px(x, y, C(tip, 0))


def ammo_box(ic, x0, y0, x1, y1, label):
    # little iso box
    ic.poly([(x0, y0 + 3), (x1 - 4, y0 + 3), (x1, y0), (x0 + 4, y0)], C('card', 0))
    ic.rect(x0, y0 + 3, x1 - 4, y1, C('card', 1))
    ic.poly([(x1 - 4, y0 + 3), (x1, y0), (x1, y1 - 3), (x1 - 4, y1)], C('card', 2))
    ic.rect(x0 + 1, y0 + 6, x1 - 5, y0 + 9, C(label, 1))


def i_ammo9():
    ic = Icon()
    ammo_box(ic, 5, 14, 26, 27, 'olive_dk')
    for i, x in enumerate((8, 12, 16)):
        bullet(ic, x, 6 + (i % 2), 9)
    return ic.done()


def i_shells():
    ic = Icon()
    for i, (x, y) in enumerate(((4, 18), (9, 12), (14, 6))):
        # shell lying diagonally: red tube + brass head
        ic.poly([(x, y + 4), (x + 11, y + 7), (x + 12, y + 3), (x + 1, y)], C('shell', 1))
        ic.line([(x + 1, y), (x + 12, y + 3)], C('shell', 0))
        ic.line([(x, y + 4), (x + 11, y + 7)], C('shell', 2))
        ic.poly([(x + 11, y + 7), (x + 15, y + 8), (x + 16, y + 4), (x + 12, y + 3)], C('brass', 1))
        ic.line([(x + 12, y + 3), (x + 16, y + 4)], C('brass', 0))
    return ic.done()


def i_stimpak():
    ic = Icon()
    # plunger
    thick_line(ic, (5, 26), (9, 22), 2, 'metal')
    ic.line([(3, 24), (7, 28)], C('metal', 1), 2)
    # barrel
    ic.poly([(8, 19), (19, 8), (24, 13), (13, 24)], C('glass', 0))
    ic.poly([(10, 21), (19, 12), (22, 15), (13, 24)], C('redfluid', 1))
    ic.line([(10, 21), (19, 12)], C('redfluid', 0))
    for t in range(3):
        ic.px(12 + t * 3, 15 - t * 3 + 3, C('milk', 0))
    ic.line([(8, 19), (13, 24)], C('metal', 1), 2)
    ic.line([(19, 8), (24, 13)], C('metal', 1), 2)
    ic.line([(22, 10), (28, 4)], C('metal', 0))
    # gauge
    ic.ell(14, 4, 19, 9, C('milk', 1)); ic.px(16, 6, C('redfluid', 1)); ic.px(17, 6, C('redfluid', 1))
    return ic.done()


def i_echpochmak():
    ic = Icon()
    A, B, Cc = (16, 4), (29, 26), (3, 26)
    ic.poly([(15, 4), (17, 4), (29, 24), (28, 27), (4, 27), (3, 24)], C('pastry', 1))
    # lit left face, shaded right face
    ic.poly([(16, 6), (16, 15), (6, 25), (4, 25)], C('pastry', 0))
    ic.poly([(16, 15), (27, 25), (28, 25), (17, 6)], C('pastry', 2))
    ic.poly([(16, 15), (6, 25), (26, 25)], C('pastry', 1))
    # crimped seams
    for t in range(1, 8):
        x = 16 - t * 10 / 8; y = 15 + t * 10 / 8
        ic.px(int(x), int(y), C('pastry', 3))
        x2 = 16 + t * 10 / 8
        ic.px(int(x2), int(y), C('pastry', 3))
    ic.line([(16, 6), (16, 13)], C('pastry', 3))
    # steam hole with filling
    ic.ell(13, 12, 19, 17, C('pastry', 3))
    ic.ell(14, 13, 18, 16, C('wood_dk', 1))
    ic.px(15, 13, C('pastry', 0))
    ic.line([(4, 27), (28, 27)], C('pastry', 3))
    return ic.done()


def i_ayran():
    ic = Icon()
    ic.rect(13, 3, 18, 6, C('cloth_blue', 1)); ic.line([(13, 3), (18, 3)], C('cloth_blue', 0))
    ic.rect(14, 7, 17, 10, C('milk', 1))
    ic.poly([(14, 10), (17, 10), (22, 15), (22, 28), (9, 28), (9, 15)], C('milk', 1))
    ic.line([(10, 15), (10, 27)], C('milk', 0)); ic.line([(11, 15), (11, 27)], C('milk', 0))
    ic.line([(21, 15), (21, 27)], C('milk', 2))
    # label with Cyrillic Kha
    ic.rect(9, 17, 22, 25, C('cloth_blue', 1))
    ic.line([(9, 17), (22, 17)], C('cloth_blue', 0))
    for i in range(5):
        ic.px(13 + i, 19 + i, C('milk', 0))
        ic.px(17 - i, 19 + i, C('milk', 0))
    ic.px(14, 19, C('milk', 0)); ic.px(16, 23, C('milk', 0))
    return ic.done()


def i_chakchak():
    ic = Icon()
    ic.ell(3, 22, 29, 29, C('metal', 1)); ic.ell(5, 23, 27, 27, C('metal', 0))
    r = rng(3)
    pts = []
    for row in range(7):
        y = 23 - row * 2.4
        half = 11 - row * 1.6
        n = int(half * 2 / 2.4)
        for k in range(n + 1):
            x = 16 - half + k * (2 * half / max(n, 1)) + r.uniform(-0.6, 0.6)
            pts.append((x, y + r.uniform(-0.5, 0.5)))
    for x, y in pts:
        ic.ell(int(x) - 1, int(y) - 1, int(x) + 2, int(y) + 1, C('honey', 2))
        ic.px(int(x), int(y) - 1, C('honey', 1))
        ic.px(int(x) - 1, int(y), C('honey', 0 if r.random() < 0.4 else 1))
    for x, y in pts[::5]:
        ic.px(int(x) + 1, int(y) + 1, C('honey', 3))
    ic.px(16, 7, C('cloth_cream', 0)); ic.px(12, 12, C('honey', 0))
    return ic.done()


def i_leather():
    ic = Icon()
    body = [(8, 5), (13, 4), (16, 7), (19, 4), (24, 5), (28, 12), (25, 14), (24, 28), (8, 28), (7, 14), (4, 12)]
    ic.poly(body, C('leather', 1))
    ic.poly([(8, 5), (13, 4), (15, 8), (12, 28), (8, 28), (7, 14), (4, 12)], C('leather', 0))
    ic.poly([(24, 5), (28, 12), (25, 14), (24, 28), (20, 28), (18, 8)], C('leather', 2))
    ic.line([(16, 8), (16, 28)], C('leather_dk', 2))
    for y in (13, 19, 25):
        ic.line([(9, y), (23, y)], C('leather_dk', 1))
        ic.px(16, y, C('metal', 0))
    ic.line([(7, 14), (8, 28)], C('leather_dk', 1))
    for x, y in ((10, 9), (21, 9)):
        ic.px(x, y, C('metal', 0))
    return ic.done()


def i_tubeteika():
    ic = Icon()
    ic.ell(4, 16, 28, 27, C('cloth_wine', 2))
    ic.poly([(4, 21), (6, 11), (12, 7), (20, 7), (26, 11), (28, 21)], C('cloth_wine', 1))
    ic.ell(6, 5, 26, 13, C('cloth_wine', 0))
    ic.ell(4, 17, 28, 26, C('cloth_wine', 2))
    ic.ell(5, 16, 27, 24, C('cloth_wine', 1))
    # embroidered band and top rosette
    for i, x in enumerate(range(6, 27, 3)):
        y = 20 + int(1.5 * math.sin((x - 16) / 10 * math.pi / 2 + math.pi / 2))
        ic.px(x, y, C('gold', 0)); ic.px(x + 1, y - 1, C('gold', 1)); ic.px(x + 1, y + 1, C('gold', 2))
    for x in range(7, 26):
        ic.px(x, 23 + (1 if abs(x - 16) < 7 else 0), C('gold', 2))
    for dx, dy in ((0, 0), (-2, 0), (2, 0), (0, -1), (0, 1)):
        ic.px(16 + dx, 9 + dy, C('gold', 0))
    for x in (10, 22):
        ic.px(x, 11, C('green_roof', 0)); ic.px(x, 15, C('gold', 1))
    ic.line([(16, 11), (16, 16)], C('gold', 2))
    return ic.done()


def i_caps():
    ic = Icon()
    for (x, y, col) in ((5, 14, 'red'), (15, 17, 'cloth_blue'), (10, 6, 'metal')):
        ic.ell(x, y, x + 12, y + 9, C('metal', 2))
        ic.ell(x, y - 1, x + 12, y + 7, C('metal', 1))
        for k in range(10):
            a = k / 10 * 2 * math.pi
            ic.px(int(x + 6 + 6.4 * math.cos(a)), int(y + 3 + 4.4 * math.sin(a)), C('metal', 0 if math.sin(a) < 0 else 2))
        ic.ell(x + 2, y + 0, x + 10, y + 6, C(col, 1))
        ic.px(x + 4, y + 2, C(col, 0)); ic.px(x + 5, y + 1, C(col, 0))
    return ic.done()


def i_key():
    ic = Icon()
    ic.ell(3, 3, 13, 13, C('brass', 1)); ic.ell(6, 6, 10, 10, (0, 0, 0, 0))
    ic.px(5, 5, C('brass', 0)); ic.px(4, 7, C('brass', 0)); ic.px(11, 11, C('brass', 2))
    thick_line(ic, (11, 11), (26, 26), 3, 'brass')
    ic.poly([(21, 25), (24, 22), (27, 25), (24, 28)], C('brass', 1))
    ic.poly([(18, 22), (20, 20), (22, 22), (20, 24)], C('brass', 2))
    return ic.done()


def i_holotape():
    ic = Icon()
    ic.poly([(4, 9), (25, 6), (28, 22), (7, 26)], C('olive_dk', 1))
    ic.line([(4, 9), (25, 6)], C('olive_dk', 0))
    ic.line([(28, 22), (7, 26)], C('olive_dk', 3))
    ic.poly([(7, 11), (23, 9), (24, 15), (8, 17)], C('cloth_cream', 1))
    ic.line([(9, 13), (22, 11)], C('green', 2)); ic.line([(9, 15), (18, 14)], C('green', 2))
    ic.poly([(10, 19), (22, 17), (23, 21), (11, 23)], C('oil', 1))
    ic.ell(12, 19, 15, 22, C('metal', 1)); ic.ell(18, 18, 21, 21, C('metal', 1))
    ic.px(26, 9, C('green', 0))
    return ic.done()


def i_kazan():
    ic = Icon()
    ic.ell(3, 9, 29, 29, C('iron', 1))
    ic.ell(5, 11, 17, 25, C('iron', 0))
    ic.ell(8, 13, 25, 28, C('iron', 1))
    ic.ell(17, 13, 29, 29, C('iron', 2))
    ic.ell(5, 7, 27, 14, C('iron', 2))
    ic.ell(6, 8, 26, 13, C('oil', 2))
    ic.ell(8, 9, 24, 13, C('honey', 2))  # plov / broth glimmer
    ic.ell(10, 10, 20, 12, C('pastry', 1))
    ic.px(12, 10, C('pastry', 0)); ic.px(16, 11, C('khaki', 0)); ic.px(19, 11, C('red', 1))
    ic.line([(5, 8), (27, 8)], C('iron', 0))
    for x in (1, 27):
        ic.rect(x, 10, x + 3, 12, C('iron', 1))
    ic.px(9, 18, C('metal', 0)); ic.px(8, 19, C('metal', 0))
    return ic.done()


def i_junk():
    ic = Icon()
    # gear
    cx, cy = 11, 20
    for k in range(8):
        a = k / 8 * 2 * math.pi
        ic.rect(int(cx + 7 * math.cos(a)) - 1, int(cy + 7 * math.sin(a)) - 1, int(cx + 7 * math.cos(a)) + 1, int(cy + 7 * math.sin(a)) + 1, C('metal', 1))
    ic.ell(cx - 6, cy - 6, cx + 6, cy + 6, C('metal', 1))
    ic.ell(cx - 6, cy - 6, cx + 3, cy + 3, C('metal', 0))
    ic.ell(cx - 2, cy - 2, cx + 2, cy + 2, (0, 0, 0, 0))
    # spring
    for i in range(6):
        ic.line([(18 + i * 2, 5), (20 + i * 2, 11)], C('metal_dk', 0 if i % 2 else 1))
    # bent pipe
    thick_line(ic, (18, 28), (24, 18), 3, 'rust')
    thick_line(ic, (24, 18), (29, 17), 3, 'rust')
    ic.px(14, 15, C('rust', 1)); ic.px(15, 16, C('rust', 2))
    return ic.done()


def i_rifle():
    ic = Icon()
    # diagonal AK-style rifle, muzzle top-right
    def T(x, y):  # rotate 32 deg around centre
        a = math.radians(-32)
        x -= 16; y -= 16
        return (16 + x * math.cos(a) - y * math.sin(a), 16 + x * math.sin(a) + y * math.cos(a))
    def P(pts, col):
        ic.poly([T(*p) for p in pts], col)
    P([(-1, 15), (9, 13), (10, 18), (0, 21)], C('wood', 1))           # stock
    P([(-1, 15), (9, 13), (9, 14), (-1, 16)], C('wood', 0))
    P([(9, 13), (19, 13), (19, 17), (9, 17)], C('gun', 1))             # receiver
    P([(19, 13.5), (25, 13.5), (25, 16.5), (19, 16.5)], C('wood', 1))  # handguard
    P([(25, 14), (33, 14), (33, 15.4), (25, 15.4)], C('gun', 1))       # barrel
    P([(14, 17), (17, 17), (19, 23), (16, 24)], C('gun', 2))           # magazine
    P([(10, 17), (12, 17), (11, 21), (9, 21)], C('wood_dk', 1))        # grip
    ic.line([T(9, 13), T(19, 13)], C('gun', 0))
    return ic.done()


def i_ammo762():
    ic = Icon()
    ammo_box(ic, 4, 16, 27, 28, 'red')
    for i, x in enumerate((7, 11, 15, 19)):
        bullet(ic, x, 3 + (i % 2), 13, w=3)
    return ic.done()


ICONS = ['knife', 'pistol', 'sawedoff', 'ammo9', 'shells', 'stimpak', 'echpochmak', 'ayran', 'chakchak',
         'leather', 'tubeteika', 'caps', 'key', 'holotape', 'kazan', 'junk', 'rifle', 'ammo762']


def main():
    import gen_icons_v2  # v2 icons, appended after the original 18 (contract ICONS order)
    fns = {k: globals()['i_' + k] for k in ICONS}
    fns.update({k: getattr(gen_icons_v2, 'i_' + k) for k in gen_icons_v2.ICONS_V2})
    order = ICONS + gen_icons_v2.ICONS_V2
    sheet = Image.new('RGBA', (S * len(order), S), (0, 0, 0, 0))
    for i, k in enumerate(order):
        sheet.alpha_composite(fns[k](), (i * S, 0))
    print('wrote', save(sheet, 'ui', 'icons.png'))


if __name__ == '__main__':
    main()
