"""v2 inventory icons (32x32), drawn shape by shape in the same style as gen_icons.py.
gen_icons.main() appends these after the original 18, in ICONS_V2 order."""
import math
import sys

sys.path.insert(0, __import__('os').path.dirname(__file__))
from common import PAL, ramp
from gen_icons import Icon, C, thick_line, S

PAL.update({
    'chip': ramp('#5ca85a', '#3e8a40', '#2a6a2e', '#1a4a1e'),
    'jump': ramp('#5a86c4', '#3e68a6', '#2c4e80', '#1e365a'),
    'meat': ramp('#d0766a', '#b0564c', '#8a3c36', '#5e2622'),
    'bone': ramp('#eee6d0', '#d0c6aa', '#a89e84', '#7a725e'),
    'towel': ramp('#f4f0e4', '#d8d4c8', '#b0ac9e', '#848074'),
    'valve': ramp('#e05a44', '#b83c2c', '#8a2a20', '#5a1a14'),
    'card_y': ramp('#f0d468', '#d4b044', '#a8862c', '#76601c'),
    'paper': ramp('#ece6d4', '#d0c8b2', '#a8a08a', '#7c7664'),
    'horn': ramp('#e8dcb8', '#c8b88c', '#9c8a62', '#6a5c40'),
})


def i_water_chip():
    ic = Icon()
    # pins
    for i in range(6):
        x = 8 + i * 3
        ic.rect(x, 4, x + 1, 7, C('metal', 0)); ic.rect(x, 24, x + 1, 27, C('metal', 1))
    for i in range(4):
        y = 10 + i * 3
        ic.rect(3, y, 6, y + 1, C('metal', 0)); ic.rect(25, y, 28, y + 1, C('metal', 1))
    ic.rect(6, 7, 25, 24, C('chip', 1))
    ic.line([(6, 7), (25, 7)], C('chip', 0)); ic.line([(6, 7), (6, 24)], C('chip', 0))
    ic.line([(7, 24), (25, 24)], C('chip', 3)); ic.line([(25, 8), (25, 24)], C('chip', 3))
    # traces
    for pts in (((8, 10), (12, 10), (14, 12)), ((8, 21), (11, 18), (13, 18)), ((23, 10), (19, 10), (18, 12)),
                ((23, 21), (20, 21), (18, 19))):
        ic.line(pts, C('gold', 0))
    # central die
    ic.rect(12, 12, 19, 19, C('iron', 2)); ic.line([(12, 12), (19, 12)], C('iron', 0))
    ic.rect(14, 14, 17, 17, C('gold', 1)); ic.px(14, 14, C('gold', 0))
    ic.px(9, 9, C('milk', 0))
    return ic.done()


def i_valve():
    ic = Icon()
    cx, cy, r = 16, 16, 12
    ic.ell(cx - r, cy - r, cx + r, cy + r, C('valve', 1))
    ic.ell(cx - r + 3, cy - r + 3, cx + r - 3, cy + r - 3, (0, 0, 0, 0))
    # rim shading
    ic.d.arc((cx - r, cy - r, cx + r, cy + r), 180, 270, fill=C('valve', 0), width=2)
    ic.d.arc((cx - r, cy - r, cx + r, cy + r), 0, 90, fill=C('valve', 2), width=2)
    for a in (45, 135, 225, 315):
        ax, ay = cx + math.cos(math.radians(a)) * (r - 2), cy + math.sin(math.radians(a)) * (r - 2)
        thick_line(ic, (cx, cy), (ax, ay), 3, 'valve')
    ic.ell(cx - 4, cy - 4, cx + 4, cy + 4, C('metal', 1))
    ic.ell(cx - 2, cy - 2, cx + 2, cy + 2, C('metal_dk', 2))
    ic.px(cx - 3, cy - 2, C('metal', 0))
    return ic.done()


def i_wrench():
    ic = Icon()
    thick_line(ic, (7, 25), (21, 11), 4, 'metal')
    # open jaw head (top-right)
    ic.ell(18, 3, 29, 14, C('metal', 1))
    ic.poly([(23, 3), (29, 3), (29, 7), (25, 9)], (0, 0, 0, 0))
    ic.d.arc((18, 3, 29, 14), 120, 220, fill=C('metal', 0), width=1)
    ic.d.arc((18, 3, 29, 14), 330, 60, fill=C('metal', 2), width=1)
    # ring end (bottom-left)
    ic.ell(2, 20, 12, 30, C('metal', 1))
    ic.ell(5, 23, 9, 27, (0, 0, 0, 0))
    ic.d.arc((2, 20, 12, 30), 150, 260, fill=C('metal', 0), width=1)
    ic.px(14, 17, C('metal', 0)); ic.px(15, 16, C('metal', 0))
    return ic.done()


def i_towel():
    ic = Icon()
    # folded embroidered towel, hanging fold seen at an angle
    ic.poly([(4, 8), (24, 4), (28, 24), (8, 28)], C('towel', 1))
    ic.line([(4, 8), (24, 4)], C('towel', 0)); ic.line([(4, 8), (8, 28)], C('towel', 0))
    ic.line([(8, 28), (28, 24)], C('towel', 3)); ic.line([(24, 4), (28, 24)], C('towel', 2))
    # red ornament bands near both ends + central tulip
    for t0 in (0.12, 0.8):
        a = (4 + 20 * t0, 8 - 4 * t0); b = (8 + 20 * t0, 28 - 4 * t0)
        ic.line([a, b], C('red', 1), 2)
    for k in range(5):
        y = 10 + k * 3.6
        x = 9 + (y - 8) * 0.2
        ic.px(int(x), int(y), C('red', 0)); ic.px(int(x) + 18, int(y) - 3, C('red', 0))
    cx, cy = 16, 16
    ic.poly([(cx, cy - 5), (cx + 3, cy - 2), (cx + 2, cy + 1), (cx - 2, cy + 1), (cx - 3, cy - 2)], C('red', 1))
    ic.px(cx, cy - 3, C('red', 0))
    ic.line([(cx, cy + 1), (cx, cy + 5)], C('green_roof', 2))
    ic.px(cx - 1, cy + 3, C('green_roof', 1)); ic.px(cx + 1, cy + 4, C('green_roof', 1))
    # fringe
    for k in range(6):
        x = 9 + k * 3.4; y = 28 - k * 0.7
        ic.line([(x, y + 1), (x, y + 3)], C('towel', 2))
    return ic.done()


def i_rat_meat():
    ic = Icon()
    # bone
    thick_line(ic, (5, 27), (13, 19), 3, 'bone')
    for (x, y) in ((3, 25), (5, 28)):
        ic.ell(x - 2, y - 2, x + 2, y + 2, C('bone', 1))
    ic.px(2, 24, C('bone', 0))
    # meat lump
    ic.ell(10, 5, 28, 23, C('meat', 1))
    ic.ell(12, 6, 22, 14, C('meat', 0))
    ic.d.arc((10, 5, 28, 23), 0, 120, fill=C('meat', 2), width=2)
    # fat streaks / char marks
    ic.line([(15, 16), (21, 10)], C('bone', 2))
    ic.line([(18, 19), (24, 13)], C('meat', 3))
    ic.px(14, 8, C('bone', 0)); ic.px(15, 8, C('bone', 0))
    return ic.done()


def i_jumpsuit():
    ic = Icon()
    # folded jumpsuit: stack of blue fabric with yellow collar and zip
    ic.rect(4, 10, 27, 27, C('jump', 1))
    ic.line([(4, 10), (27, 10)], C('jump', 0)); ic.line([(4, 10), (4, 27)], C('jump', 0))
    ic.line([(4, 27), (27, 27)], C('jump', 3)); ic.line([(27, 11), (27, 27)], C('jump', 2))
    ic.line([(5, 21), (26, 21)], C('jump', 2))  # fold
    # collar
    ic.poly([(10, 10), (16, 15), (22, 10), (20, 8), (16, 11), (12, 8)], C('yellow', 1))
    ic.line([(12, 8), (16, 11), (20, 8)], C('yellow', 0))
    ic.line([(16, 15), (16, 21)], C('yellow', 1))
    # '116' hint: yellow patch
    ic.rect(20, 23, 25, 25, C('yellow', 1))
    ic.px(21, 24, C('jump', 2)); ic.px(23, 24, C('jump', 2))
    # sleeve
    ic.line([(5, 15), (11, 19)], C('jump', 2))
    ic.rect(5, 23, 8, 25, C('yellow', 1))
    return ic.done()


def i_kystybyi():
    ic = Icon()
    # flatbread folded in half (half-moon) with mashed potato filling peeking out
    ic.d.chord((3, 6, 29, 32), 180, 360, fill=C('pastry', 1))
    ic.d.arc((3, 6, 29, 32), 190, 260, fill=C('pastry', 0), width=2)
    ic.d.arc((3, 6, 29, 32), 280, 350, fill=C('pastry', 2), width=1)
    # filling along the straight edge
    for x in range(5, 28, 2):
        ic.ell(x - 1, 17, x + 2, 21, C('milk', 0 if x % 4 else 1))
    ic.line([(4, 19), (28, 19)], C('pastry', 3))
    ic.line([(4, 21), (28, 21)], C('pastry', 2))
    ic.rect(4, 21, 28, 23, C('pastry', 1))
    ic.line([(4, 23), (28, 23)], C('pastry', 3))
    # toasted spots
    for (x, y) in ((10, 12), (16, 10), (21, 13), (13, 15), (24, 16)):
        ic.px(x, y, C('pastry', 3)); ic.px(x + 1, y, C('pastry', 2))
    return ic.done()


def i_note():
    ic = Icon()
    ic.poly([(6, 4), (24, 3), (27, 28), (8, 29)], C('paper', 1))
    ic.line([(6, 4), (24, 3)], C('paper', 0)); ic.line([(6, 4), (8, 29)], C('paper', 0))
    ic.line([(8, 29), (27, 28)], C('paper', 3)); ic.line([(24, 3), (27, 28)], C('paper', 2))
    # folded corner
    ic.poly([(21, 3), (24, 3), (24, 7)], C('paper', 2))
    # handwriting lines
    for k in range(7):
        y = 8 + k * 3
        x0 = 9 + k * 0.1; x1 = 22 - (k * 5) % 7
        for x in range(int(x0), int(x1)):
            if (x * 7 + k * 3) % 5 != 0:
                ic.px(x, y + (x % 3 == 0), C('iron', 1))
    ic.px(20, 26, C('red', 1)); ic.px(21, 25, C('red', 1))
    return ic.done()


def i_keycard():
    ic = Icon()
    ic.poly([(3, 12), (25, 6), (29, 20), (7, 26)], C('card_y', 1))
    ic.line([(3, 12), (25, 6)], C('card_y', 0)); ic.line([(3, 12), (7, 26)], C('card_y', 0))
    ic.line([(7, 26), (29, 20)], C('card_y', 3)); ic.line([(25, 6), (29, 20)], C('card_y', 2))
    # magnetic stripe
    ic.poly([(5, 17), (27, 11), (28, 14), (6, 20)], C('iron', 2))
    # chip + hole
    ic.rect(9, 21, 12, 23, C('gold', 0))
    ic.ell(21, 7, 23, 9, C('card_y', 3))
    # vault-tec style emblem dots
    ic.px(18, 21, C('jump', 1)); ic.px(19, 20, C('jump', 1)); ic.px(20, 21, C('jump', 1))
    return ic.done()


def i_horn():
    ic = Icon()
    # curved horn: thick at base (bottom-left) tapering to a point (top-right)
    pts_out, pts_in = [], []
    for i in range(13):
        t = i / 12
        a = math.radians(200 - 150 * t)
        r = 12
        cx, cy = 15 + math.cos(a) * r, 20 + math.sin(a) * r * 0.9 - t * 6
        w = 4.2 * (1 - t) + 0.4
        nx, ny = math.cos(a), math.sin(a)
        pts_out.append((cx + nx * w, cy + ny * w))
        pts_in.append((cx - nx * w, cy - ny * w))
    ic.poly(pts_out + pts_in[::-1], C('horn', 1))
    ic.line(pts_out[:11], C('horn', 2))
    ic.line(pts_in[:11], C('horn', 0))
    # growth rings
    for i in (2, 4, 6, 8):
        ic.line([pts_out[i], pts_in[i]], C('horn', 3))
    # broken base
    ic.line([pts_out[0], pts_in[0]], C('horn', 3), 2)
    return ic.done()


ICONS_V2 = ['water_chip', 'valve', 'wrench', 'towel', 'rat_meat', 'jumpsuit', 'kystybyi', 'note', 'keycard', 'horn']
