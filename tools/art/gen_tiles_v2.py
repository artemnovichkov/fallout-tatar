"""v2 floor tiles (vault interior): metal (riveted steel plates), grate (grating over pipes).

Same lattice-periodic construction as gen_tiles.py: every feature is periodic under the
hex grid vectors a=(36,12), b=(0,24) so tiles join seamlessly. Horizontal features use a
period dividing 12 px, vertical ones a period dividing 36 px.
"""
import math
import sys
import numpy as np

sys.path.insert(0, __import__('os').path.dirname(__file__))
from common import PAL, ramp, save
from gen_tiles import coords, torus_noise, quant, finish, contrast, TW, TH, AX, BY

STEEL = ramp('#94a0aa', '#7e8a96', '#6a7682', '#56606c', '#424a54', '#2c3238')


def plate_val(x, y, pw, ph, seed):
    """per-plate brightness offset, constant within each plate and lattice periodic"""
    xc = (np.floor(x / pw) + 0.5) * pw
    yc = (np.floor(y / ph) + 0.5) * ph
    u = xc / AX
    v = (yc - 12.0 * u) / BY
    return torus_noise(u % 1.0, v % 1.0, 2, seed, 1)


def t_metal():
    x, y, u, v = coords()
    pw, ph = 18.0, 12.0
    pal = STEEL
    n = torus_noise(u, v, 6, 31, 2)
    pv = plate_val(x, y, pw, ph, 32)
    val = contrast(0.45 * n + 0.55 * pv, 1.3)
    q = np.clip(4 - quant(val, pal[:5], 0.35), 1, 3)
    # brushed streaks, horizontal
    st = torus_noise(u, v, 12, 33, 1)
    q = np.where((st > 0.72) & (((y + 0.5) % 3) < 1), np.maximum(q - 1, 1), q)
    px = x % pw; py = y % ph
    seam_v = px < 1.0
    seam_h = py < 1.0
    q = np.where(seam_v | seam_h, 5, q)
    # bevel: lit top/left edges, dark bottom/right edges
    q = np.where(~seam_v & ~seam_h & ((py >= 1) & (py < 2)), 0, q)
    q = np.where(~seam_v & ~seam_h & ((px >= 1) & (px < 2)) & (py >= 2), np.minimum(q, 1), q)
    q = np.where(~seam_v & ~seam_h & (py >= ph - 1), 4, q)
    q = np.where(~seam_v & ~seam_h & (px >= pw - 1) & (py >= 1), 4, q)
    # rivets 3px in from each plate corner: lit pixel + shadow pixel below-right
    for cx in (3.0, pw - 3.0):
        for cy in (3.0, ph - 3.0):
            on = (np.abs(px - cx) < 0.5) & (np.abs(py - cy) < 0.5)
            sh = (np.abs(px - cx - 1) < 0.5) & (np.abs(py - cy - 1) < 0.5)
            q = np.where(sh, 4, q)
            q = np.where(on, 0, q)
    # a few oil/rust stains
    stain = torus_noise(u, v, 2, 34, 2)
    q = np.where((stain > 0.66) & (q >= 1) & (q <= 3), np.minimum(q + 1, 4), q)
    return finish(q, pal)


def t_grate():
    x, y, u, v = coords()
    pal = STEEL + [PAL['rust'][0], PAL['rust'][1], PAL['rust'][2], PAL['rust'][3],
                   PAL['metal_dk'][1], PAL['metal_dk'][2], (14, 13, 12)]
    R0, M0, VOID = 6, 10, 12
    # what lies beneath: dark void with a diagonal copper pipe and a vertical grey pipe
    q = np.full(x.shape, VOID)
    under_n = torus_noise(u, v, 4, 41, 1)
    q = np.where(under_n > 0.7, 11, q)
    dv = (v - 0.36) % 1.0
    w = 0.2
    pipe = dv < w
    t = dv / w                                     # 0..1 across the pipe (top -> bottom)
    q = np.where(pipe, R0 + np.clip((np.abs(t - 0.3) * 4.5).astype(int), 0, 3), q)
    pipe2 = (np.abs((x % 36) - 26) < 2.0) & ~pipe
    q = np.where(pipe2, M0 + (((x % 36) - 26) > 0.5), q)
    q = np.where((np.abs((x % 36) - 26) < 2.5) & (np.abs(((v + 0.5) % 1.0) * BY - 12) < 1.2) & ~pipe, 9, q)  # pipe clamp
    # grating: 1px slats every 4 rows + 2px cross bars every 18 px, frame bars every 12 rows
    py = y % 4; px = x % 18
    slat = (py < 1)
    bar = px < 2
    frame = (y % 12) < 2
    solid = slat | bar | frame
    n = torus_noise(u, v, 5, 42, 2)
    base = np.clip(3 - quant(contrast(n, 1.2), pal[:4], 0.3), 1, 3)
    g = np.where(solid, base, q)
    g = np.where(solid & ((y % 12) < 1), np.minimum(base, 1) - (n > 0.6), g)   # lit top edges
    g = np.where(slat & ~bar & ~frame, 2, g)
    g = np.where(bar & ~frame & (px >= 1), 3, g)
    g = np.where(frame & ((y % 12) >= 1), np.maximum(base, 2), g)
    # bolts where frame bars cross the 18px bars
    g = np.where(((y % 12) < 1) & (px < 1), 0, g)
    g = np.where(((y % 12) >= 1) & ((y % 12) < 2) & (px >= 1) & (px < 2), 4, g)
    return finish(np.clip(g, 0, len(pal) - 1), pal)


TILES = {'metal': t_metal, 'grate': t_grate}


def main():
    for k, f in TILES.items():
        print('wrote', save(f(), 'tiles', f'{k}.png'))


if __name__ == '__main__':
    main()
