"""Floor tiles 50x26 (flat-top hex, transparent corners).

Every texel is computed from lattice-periodic functions: pixel -> coordinates on the
torus spanned by the hex grid vectors a=(36,12), b=(0,24). Neighbouring tiles
therefore agree exactly in their overlap, so tiles repeat with no visible seams.
"""
import math
import sys
import numpy as np
from PIL import Image

sys.path.insert(0, __import__('os').path.dirname(__file__))
from common import PAL, ramp, save, hex_mask, rng
from r3d import BAYER4

TW, TH = 50, 26
AX, AY, BY = 36.0, 12.0, 24.0

PAL.update({
    'sand': ramp('#c2ab7c', '#a88f62', '#8c744c', '#6c583a', '#54442e'),
    'asphalt': ramp('#6a6864', '#575552', '#474542', '#383634', '#2a2826'),
    'dirt': ramp('#9c8662', '#82704e', '#6a5a3e', '#524530', '#3e3424'),
    'grass': ramp('#aaa06a', '#8c8652', '#706c40', '#565432', '#403e26'),
    'water': ramp('#4a7272', '#38605f', '#2a4c4e', '#203c3e', '#172c2e'),
    'floor': ramp('#8e877a', '#7a7468', '#686258', '#565048', '#443f38'),
    'carpet': ramp('#9c3a2e', '#863024', '#70271e', '#5a1e18', '#441612'),
})


def coords():
    ys, xs = np.mgrid[0:TH, 0:TW]
    x = xs + 0.5 - TW / 2
    y = ys + 0.5 - TH / 2
    u = x / AX
    v = (y - AY * u) / BY
    return x, y, u % 1.0, v % 1.0


def torus_noise(u, v, K, seed, octaves=3):
    r = np.random.default_rng(seed)
    out = np.zeros_like(u); amp = 1.0; tot = 0
    for o in range(octaves):
        k = K * (2 ** o)
        g = r.random((k, k))
        fu, fv = u * k, v * k
        i0, j0 = np.floor(fu).astype(int), np.floor(fv).astype(int)
        tu, tv = fu - i0, fv - j0
        tu = tu * tu * (3 - 2 * tu); tv = tv * tv * (3 - 2 * tv)
        i1, j1 = (i0 + 1) % k, (j0 + 1) % k
        i0 %= k; j0 %= k
        val = (g[i0, j0] * (1 - tu) * (1 - tv) + g[i1, j0] * tu * (1 - tv) + g[i0, j1] * (1 - tu) * tv + g[i1, j1] * tu * tv)
        out += amp * val; tot += amp; amp *= 0.5
    return out / tot


def tdist(u, v, pu, pv):
    """pixel-space vector from feature (pu,pv) to pixels, wrapped on the torus"""
    du = (u - pu + 0.5) % 1.0 - 0.5
    dv = (v - pv + 0.5) % 1.0 - 0.5
    return du * AX, du * AY + dv * BY


def quant(val, pal, dither=0.18, levels=None):
    by = np.tile(BAYER4, (TH // 4 + 1, TW // 4 + 1))[:TH, :TW]
    n = len(pal)
    q = np.clip(((val + (by - 0.5) * dither) * n).astype(int), 0, n - 1)
    return q


def finish(idx_or_rgb, pal=None):
    m = hex_mask(TW, TH)
    if pal is not None:
        rgb = np.array(pal, np.uint8)[idx_or_rgb]
    else:
        rgb = idx_or_rgb
    a = np.dstack([rgb, np.where(m, 255, 0).astype(np.uint8)])
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def contrast(n, c):
    return np.clip((n - 0.5) * c + 0.5, 0, 0.999)


def t_sand():
    x, y, u, v = coords()
    n = torus_noise(u, v, 3, 1)
    f = torus_noise(u, v, 9, 21, 1)
    rip = 0.5 + 0.5 * np.sin(2 * math.pi * (1 * u + 4 * v) + n * 5)
    val = contrast(0.55 * n + 0.25 * f + 0.2 * rip, 1.1)
    pal = PAL['sand']
    q = 4 - quant(val, pal, 0.45)
    q = np.clip(q, 1, 3)
    r = rng(5)
    for _ in range(5):  # pebbles
        dx, dy = tdist(u, v, r.random(), r.random())
        q = np.where((dx ** 2 + (dy * 1.6) ** 2) < 1.6, 3, q)
        q = np.where(((dx + 1) ** 2 + ((dy + 0.6) * 1.6) ** 2) < 0.5, 0, q)
    return finish(q, pal)


def cracks(u, v, seed, n, length, step=1.0):
    """random-walk cracks on torus -> bool mask"""
    r = rng(seed)
    mask = np.zeros(u.shape, bool)
    for _ in range(n):
        pu, pv = r.random(), r.random()
        ang = r.uniform(0, 2 * math.pi)
        for _ in range(length):
            dx, dy = tdist(u, v, pu, pv)
            mask |= (np.abs(dx) < 0.6) & (np.abs(dy) < 0.6)
            ang += r.uniform(-0.7, 0.7)
            sx, sy = math.cos(ang) * step, math.sin(ang) * step * 0.6
            du = sx / AX; dv = (sy - AY * du) / BY
            pu, pv = (pu + du) % 1, (pv + dv) % 1
    return mask


def t_asphalt():
    x, y, u, v = coords()
    n = torus_noise(u, v, 4, 2)
    fine = torus_noise(u, v, 12, 3, 1)
    val = contrast(0.6 * n + 0.4 * fine, 1.4)
    pal = PAL['asphalt']
    q = np.clip(4 - quant(val, pal, 0.5), 0, 3)
    c = cracks(u, v, 9, 3, 26)
    q = np.where(c, 4, q)
    # light chip edge next to cracks (top-left lit)
    sh = np.roll(np.roll(c, 1, 0), 1, 1) & ~c
    q = np.where(sh & (q > 0), q - 1, q)
    return finish(q, pal)


def t_rubble():
    x, y, u, v = coords()
    n = torus_noise(u, v, 3, 4)
    pal = PAL['dirt'] + [PAL['brick'][1], PAL['brick'][2], PAL['stone'][0], PAL['stone'][1], PAL['stone'][2]]
    q = np.clip(4 - quant(contrast(n, 1.4), PAL['dirt'], 0.35), 1, 3)
    r = rng(11)
    for i in range(16):
        pu, pv = r.random(), r.random()
        dx, dy = tdist(u, v, pu, pv)
        rx = r.uniform(1.2, 2.8); ry = rx * r.uniform(0.5, 0.8)
        kind = r.choice(['brick', 'stone', 'stone'])
        inside = (dx / rx) ** 2 + (dy / ry) ** 2 < 1
        top = inside & ((dx / rx) ** 2 + ((dy + ry * 0.45) / ry) ** 2 < 0.55)
        shadow = ((dx / rx) ** 2 + ((dy - 1) / ry) ** 2 < 1) & ~inside
        q = np.where(shadow, 4, q)
        if kind == 'brick':
            q = np.where(inside, 6, q); q = np.where(top, 5, q)
        else:
            q = np.where(inside, 8, q); q = np.where(top, 7, q)
            q = np.where(inside & (dx > rx * 0.4), 9, q)
    return finish(q, pal)


def t_grass():
    x, y, u, v = coords()
    n = torus_noise(u, v, 3, 6)
    pal = PAL['dirt'] + PAL['grass']
    q = np.clip(4 - quant(contrast(n, 1.3), PAL['dirt'], 0.3), 1, 3)
    patch = torus_noise(u, v, 2, 7, 2)
    q = np.where((patch > 0.58) & ((np.floor(u * 72) + np.floor(v * 48)) % 2 == 0), 8, q)
    r = rng(13)
    for i in range(9):  # tufts: sparse fans of 1px blades
        pu, pv = r.random(), r.random()
        dx, dy = tdist(u, v, pu, pv)
        ix, iy = np.round(dx).astype(int), np.round(dy).astype(int)
        h = r.randint(3, 5)
        q = np.where((iy == 1) & (np.abs(ix) <= 2), 4, q)
        for bx, slope in ((-2, -1), (-1, -1), (0, 0), (1, 1), (2, 1)):
            hh = h - abs(bx) // 2 - (1 if bx in (-1, 1) else 0)
            for k in range(hh):
                xo = bx + (slope if k >= 2 else 0)
                m = (ix == xo) & (iy == -k)
                q = np.where(m, 5 if k == hh - 1 else 6 if k > 0 else 7, q)
    return finish(q, pal)


def t_water():
    x, y, u, v = coords()
    n = torus_noise(u, v, 3, 8)
    pal = PAL['water']
    q = np.clip(4 - quant(contrast(n, 1.2), pal, 0.35), 1, 4)
    w = 0.5 + 0.5 * np.sin(2 * math.pi * (1 * u + 6 * v) + 3 * torus_noise(u, v, 2, 9, 1))
    q = np.where(w > 0.9, 1, q)
    r = rng(17)
    for i in range(7):
        dx, dy = tdist(u, v, r.random(), r.random())
        L = r.randint(2, 4)
        q = np.where((np.abs(dy) < 0.5) & (np.abs(dx) < L), 0, q)
        q = np.where((np.abs(dy - 1) < 0.5) & (np.abs(dx) < L - 1), 3, q)
    return finish(q, pal)


def t_floor():
    x, y, u, v = coords()
    n = torus_noise(u, v, 2, 10)
    f = torus_noise(u, v, 10, 11, 1)
    pal = PAL['floor']
    q = np.clip(4 - quant(contrast(0.7 * n + 0.3 * f, 1.5), pal, 0.4), 1, 3)
    stain = torus_noise(u, v, 2, 12, 2)
    q = np.where(stain > 0.68, np.minimum(q + 1, 4), q)
    c = cracks(u, v, 21, 1, 18)
    q = np.where(c, 4, q)
    # slab seams every 12px horizontally (lattice invariant), offset vertical seams at u=0
    q = np.where((np.abs((y + 6) % 24 - 12) < 0.5) & (n > 0.25), 3, q)
    return finish(q, pal)


def t_carpet():
    x, y, u, v = coords()
    pal = PAL['carpet'] + [PAL['gold'][0], PAL['gold'][1], PAL['gold'][2], PAL['cloth_cream'][1], PAL['green_roof'][2], (40, 18, 14)]
    n = torus_noise(u, v, 6, 13, 1)
    q = np.where(n > 0.6, 2, 1)
    # border diamonds at hex vertices (sub-lattice points 1/3, 2/3)
    for pu, pv in ((1 / 3, 1 / 3), (2 / 3, 2 / 3), (1 / 3, 5 / 6), (2 / 3, 1 / 6)):
        dx, dy = tdist(u, v, pu, pv)
        d = np.abs(dx) + np.abs(dy) * 1.6
        q = np.where(d < 4.5, 9, q)
        q = np.where(d < 3.4, 6, q)
        q = np.where(d < 2.0, 3, q)
    # tulip at hex centre (lattice point 0,0), hand-placed pixels
    dx, dy = tdist(u, v, 0.0, 0.0)
    ix, iy = np.round(dx - 0.5).astype(int), np.round(dy - 0.5).astype(int)
    tulip = [
        "....g....",
        "..g.g.g..",
        ".gGgGgGg.",
        ".gGGGGGg.",
        "..gGGGg..",
        "...gGg...",
        "....l....",
        "..ll.ll..",
        "...lll...",
    ]
    cmap = {'g': 7, 'G': 5, 'l': 10}
    for ty, row in enumerate(tulip):
        for tx, ch in enumerate(row):
            if ch in cmap:
                q = np.where((ix == tx - 4) & (iy == ty - 5), cmap[ch], q)
    # dotted ring around tulip
    rr = np.sqrt(dx ** 2 + (dy * 1.9) ** 2)
    q = np.where((np.abs(rr - 9.5) < 0.6) & ((np.round(dx) + np.round(dy)) % 2 == 0), 8, q)
    return finish(q, pal)


TILES = {'sand': t_sand, 'asphalt': t_asphalt, 'rubble': t_rubble, 'grass': t_grass,
         'water': t_water, 'floor': t_floor, 'carpet': t_carpet}


def main():
    for k, f in TILES.items():
        print('wrote', save(f(), 'tiles', f'{k}.png'))


if __name__ == '__main__':
    main()
