"""Map objects: obj_<key>.png, origin bottom-centre (image bottom = bottom edge of the hex).

Shapes are blocked out as primitives, then texture is painted per pixel from
surface coordinates (bricks, stones, planks, ornaments) with ordered dithering.
"""
import math
import sys
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, __import__('os').path.dirname(__file__))
from r3d import (set_elev, Rx, Ry, Rz, nrm, basis_z, ell, box, cyl, capsule, raycast, shade, add_outline, project)
from common import PAL, OUTLINE, save, rng, ramp

PAL.update({
    'sand': ramp('#c2ab7c', '#a88f62', '#8c744c', '#6c583a'),
    'hole': ramp('#2a201a', '#221a14', '#1a1410', '#140f0c'),
    'smoke': ramp('#8a8680', '#76726c', '#625e58', '#4e4a46'),
})

HEXR = 25.0
SQ = np.diag([1.0, 48.0 / (math.sqrt(3) * HEXR), 1.0])  # stretch regular hex to the 48x24 grid


def hex_prism(z0, z1, tag, r=HEXR, frame=None):
    """flat-top hexagon prism = union of 3 inscribed rectangles"""
    out = []
    hh = (z1 - z0) / 2
    fr = frame if frame is not None else (np.array([0, 0, 0.0]), np.eye(3))
    for a in (0, 60, -60):
        M = SQ @ Rz(a)
        out.append(box((0, 0, (z0 + z1) / 2), (r / 2, r * math.sqrt(3) / 2, hh), tag, M=M, frame=fr))
    return out


def face_uv(lp, ln):
    """horizontal coordinate along a vertical face, plus height"""
    s = np.where(np.abs(ln[:, 0]) > np.abs(ln[:, 1]), lp[:, 1], lp[:, 0])
    # make it continuous around the hex by adding angle-based offset
    ang = np.arctan2(ln[:, 1], ln[:, 0])
    return s + np.round(ang * 3 / math.pi) * 7.3, lp[:, 2]


def render(prims, mat, w, h, dither=0.07, thresholds=(0.6, 0.28, -0.35), edge=3.0, outline=True, cy_off=12):
    set_elev(30)
    res = raycast(prims, w, h, w / 2, h - cy_off)
    def mf(tag, lp, n, p):
        fo, fM = p.frame
        ln = n @ fM
        return mat(tag, lp, ln, p)
    img, mats, sh = shade(res, mf, PAL, thresholds=thresholds, dither=dither, edge=edge, outline=None, edge_by_tag=True)
    if outline:
        img = add_outline(img, OUTLINE)
    return img, res


def ground_shadow(img, cx, cy, rx, ry, a=70):
    base = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(base).ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=(0, 0, 0, a))
    base.alpha_composite(img)
    return base


def hn(lp, seed=0, f=1.0):
    q = np.floor(lp * f).astype(np.int64)
    hsh = (q[:, 0] * 73856093) ^ (q[:, 1] * 19349663) ^ (q[:, 2] * 83492791) ^ (seed * 2654435761)
    return (hsh & 0xffff) / 65536.0


# --------------------------------------------------------------------------- walls
def masonry(lp, ln, base, dark, mortar, bw, bh, seed, top='stone_dk'):
    N = len(lp)
    out = np.full(N, base, object)
    s, z = face_uv(lp, ln)
    row = np.floor(z / bh)
    off = (row % 2) * bw / 2
    sx = (s + off) % bw
    sz = z % bh
    out[(sx < 1.0) | (sz < 1.0)] = mortar
    nb = hn(np.stack([np.floor((s + off) / bw), row, row * 0], 1), seed)
    out[(nb < 0.3) & (out == base)] = dark
    out[ln[:, 2] > 0.7] = top
    return out


def wall_mat(kind):
    def f(tag, lp, ln, p):
        if tag == 'rub':
            return np.full(len(lp), 'stone_dk' if kind != 'brick' else 'brick_dk', object)
        if kind == 'stone':
            out = masonry(lp, ln, 'stone', 'stone_dk', 'mortar', 9.0, 5.0, 1)
            n2 = hn(lp, 7, 0.5)
            out[(n2 < 0.05) & (ln[:, 2] < 0.7)] = 'hole'
        elif kind == 'brick':
            out = masonry(lp, ln, 'brick', 'brick_dk', 'mortar', 6.0, 3.0, 2, top='brick_dk')
            # plaster patches
            pl = hn(lp, 3, 0.18)
            out[(pl < 0.25) & (ln[:, 2] < 0.7) & (lp[:, 2] < 30)] = 'concrete'
        else:
            out = masonry(lp, ln, 'white_stone', 'white_stone', 'stone', 11.0, 6.0, 3, top='white_stone')
            out[(lp[:, 2] < 6) & (ln[:, 2] < 0.7)] = 'stone'
            dirt = hn(lp, 9, 0.3)
            out[(dirt < 0.12) & (ln[:, 2] < 0.7)] = 'stone'
            if tag == 'merlon':
                out[:] = 'white_stone'
                out[(np.abs(lp[:, 0]) < 0.7) & (lp[:, 2] > -1) & (lp[:, 2] < 2.5) & (ln[:, 2] < 0.7)] = 'hole'
        return out
    return f


def obj_wall(kind):
    H = {'stone': 44, 'brick': 46, 'kremlin': 52}[kind]
    prims = hex_prism(0, H, 'wall')
    r = rng({'stone': 48882, 'brick': 16797}.get(kind, 0))  # fixed seeds (were str-hash based, non-deterministic)
    if kind == 'kremlin':
        for a in range(0, 360, 60):
            for off in (0.0,):
                ang = math.radians(a + 30)
                c = SQ @ np.array([math.cos(ang) * HEXR * 0.78, math.sin(ang) * HEXR * 0.78, H + 4])
                M = Rz(a + 30 + 90)
                prims.append(box(c, (3.6, 2.2, 4.0), 'merlon', M=M, frame=(c, M)))
    else:
        for i in range(5):  # broken chunks on top
            c = np.array([r.uniform(-14, 14), r.uniform(-14, 14), H + 1.5])
            prims.append(box(c, (r.uniform(2, 4), r.uniform(2, 4), r.uniform(1, 2.5)), 'wall', M=Rz(r.uniform(0, 90)),
                             frame=(np.zeros(3), np.eye(3))))
    hpx = int(H * 0.866 + 24 + (10 if kind == 'kremlin' else 6))
    img, _ = render(prims, wall_mat(kind), 52, hpx)
    return img


# --------------------------------------------------------------------------- Syuyumbike tower
def tower_mat(tag, lp, ln, p):
    N = len(lp)
    x, y, z = lp[:, 0], lp[:, 1], lp[:, 2]
    if tag == 'spire':
        out = np.full(N, 'green_roof', object)
        ang = np.arctan2(y, x)
        out[(np.abs(((ang * 8 / (2 * math.pi)) % 1) - 0.5) > 0.42)] = 'olive_dk'  # ribs
        out[hn(lp, 4, 0.6) < 0.12] = 'rust'
        return out
    if tag == 'gold':
        return np.full(N, 'gold', object)
    if tag == 'rub':
        return np.where(hn(lp, 2, 0.5) < 0.5, 'brick_dk', 'white_stone').astype(object)
    if tag == 'trim':
        out = np.full(N, 'white_stone', object)
        out[hn(lp, 6, 0.6) < 0.2] = 'stone'
        return out
    # brick tiers: lp in tower frame (z up the tower axis)
    s = np.where(np.abs(ln[:, 0]) > np.abs(ln[:, 1]), y, x)
    out = np.full(N, 'brick', object)
    row = np.floor(z / 2.6)
    sx = (s + (row % 2) * 2.5) % 5.0
    out[(sx < 0.8)] = 'brick_dk'
    out[(z % 2.6) < 0.7] = 'brick_dk'
    vert = np.abs(ln[:, 2]) < 0.5
    tier = p.data.get('tier', 0)
    z0, z1, half = p.data['z0'], p.data['z1'], p.data['half']
    lz = z - z0
    hgt = z1 - z0
    # arched windows / openings with white trim, on vertical faces
    if tier >= 1:
        wx = np.abs(s) if tier < 4 else np.abs(((s + half) % (half)) - half / 2)
        ww = {1: 3.0, 2: 2.6, 3: 2.4, 4: 1.6, 5: 1.4, 6: 1.6}.get(tier, 2)
        wz0, wz1 = hgt * 0.25, hgt * 0.75
        arch = wz1 + ww - np.sqrt(np.maximum(0, ww ** 2 - wx ** 2))
        inside = vert & (wx < ww) & (lz > wz0) & (lz < np.where(wx < ww, wz1 + np.sqrt(np.maximum(0, ww ** 2 - wx ** 2)), 0))
        rim = vert & (wx < ww + 1.1) & (lz > wz0 - 1.0) & (lz < wz1 + np.sqrt(np.maximum(0, (ww + 1.1) ** 2 - wx ** 2))) & ~inside
        out[rim] = 'white_stone'
        out[inside] = 'hole'
    elif tier == 0:
        ww = 7.0
        wx = np.abs(s)
        inside = vert & (wx < ww) & (lz < 18 + np.sqrt(np.maximum(0, ww ** 2 - wx ** 2))) & (wx < ww)
        rim = vert & (wx < ww + 1.4) & (lz < 18 + np.sqrt(np.maximum(0, (ww + 1.4) ** 2 - wx ** 2))) & ~inside
        out[rim] = 'white_stone'
        out[inside] = 'hole'
    # cornice band at tier top
    out[vert & (lz > hgt - 1.6)] = 'white_stone'
    out[ln[:, 2] > 0.7] = 'white_stone'
    # damage: holes and chipped brick
    d = hn(lp, 13 + tier, 0.35)
    out[vert & (d < 0.07)] = 'hole'
    out[vert & (d > 0.07) & (d < 0.12)] = 'brick_dk'
    return out


def obj_tower():
    prims = []
    tiers = [  # (z0, z1, half-width, octagonal)
        (0, 34, 19, False), (34, 58, 16, False), (58, 78, 13, False),
        (78, 96, 10.5, True), (96, 110, 8.5, True), (110, 122, 7.0, True)]
    lean = Ry(4.0) @ Rx(-1.5)
    base = Rz(45)
    for i, (z0, z1, hw, octo) in enumerate(tiers):
        fr = (np.zeros(3), lean @ base)
        for a in ((0, 45) if octo else (0,)):
            M = lean @ base @ Rz(a)
            c = lean @ np.array([0, 0, (z0 + z1) / 2])
            prims.append(box(c, (hw, hw, (z1 - z0) / 2), 'brick', M=M, frame=(np.zeros(3), lean @ base @ Rz(a)),
                             tier=i, z0=z0, z1=z1, half=hw))
        # cornice slab
        for a in ((0, 45) if octo else (0,)):
            M = lean @ base @ Rz(a)
            prims.append(box(lean @ np.array([0, 0, z1 - 0.8]), (hw + 1.2, hw + 1.2, 0.9), 'trim', M=M, frame=(np.zeros(3), M)))
    sp0, sp1 = 122, 166
    M = lean
    prims.append(cyl(lean @ np.array([0, 0, (sp0 + sp1) / 2]), 8.0, 0.4, (sp1 - sp0) / 2, 'spire', M=M,
                     frame=(lean @ np.array([0, 0, sp0]), lean)))
    prims.append(ell(lean @ np.array([0, 0, sp1 + 1.5]), (1.6, 1.6, 1.6), 'gold', M=M))
    prims += capsule(lean @ np.array([0, 0, sp1 + 2]), lean @ np.array([0, 0, sp1 + 9]), 0.5, 0.4, 'gold')
    prims.append(ell(lean @ np.array([0.0, 0, sp1 + 10]), (1.4, 0.6, 1.4), 'gold', M=M))
    r = rng(77)
    for i in range(14):  # rubble at the foot
        a = r.uniform(0, 2 * math.pi); d = r.uniform(18, 26)
        c = np.array([math.cos(a) * d, math.sin(a) * d * 0.9, 1.2])
        prims.append(box(c, (r.uniform(1.2, 2.8), r.uniform(1.2, 2.4), r.uniform(1, 2)), 'rub', M=Rz(r.uniform(0, 90))))
    img, _ = render(prims, tower_mat, 64, 184, dither=0.07)
    return img


# --------------------------------------------------------------------------- misc
def simple(table):
    def f(tag, lp, ln, p):
        v = table[tag]
        return v(lp, ln, p) if callable(v) else np.full(len(lp), v, object)
    return f


def obj_barrel():
    def body(lp, ln, p):
        out = np.full(len(lp), 'rust', object)
        z = lp[:, 2]
        out[(np.abs(z - 4) < 0.7) | (np.abs(z + 4) < 0.7)] = 'metal_dk'
        out[(hn(lp, 3, 0.5) < 0.3)] = 'rust_dk' if False else 'metal_dk'
        out[(np.abs(z) < 2.0) & (lp[:, 1] > 2)] = 'yellow'
        out[(np.abs(z) < 2.0) & (lp[:, 1] > 2) & (np.abs(lp[:, 0]) < 1.4)] = 'oil'
        out[ln[:, 2] > 0.7] = 'metal_dk'
        out[(ln[:, 2] > 0.7) & (np.hypot(lp[:, 0] - 2, lp[:, 1] + 1) < 1.2)] = 'oil'
        return out
    prims = [cyl((0, 0, 10), 7.5, 7.5, 10, 'b')]
    prims.append(cyl((0, 0, 10), 8.0, 8.0, 0.6, 'b', frame=(np.array([0, 0, 10.0]), np.eye(3))))
    img, _ = render(prims, simple({'b': body}), 22, 34)
    return ground_shadow(img, 11, 22, 9, 4)


def obj_crate():
    def planks(lp, ln, p):
        out = np.full(len(lp), 'wood', object)
        s = np.where(np.abs(ln[:, 0]) > np.abs(ln[:, 1]), lp[:, 1], lp[:, 0])
        z = lp[:, 2]
        top = ln[:, 2] > 0.7
        out[(z % 4.0 < 0.7) & ~top] = 'wood_dk'
        out[top & ((lp[:, 0] % 4.0) < 0.7)] = 'wood_dk'
        edge = (np.abs(s) > 7.5) | (np.abs(z) > 6.6)
        out[edge & ~top] = 'wood_dk'
        out[top & ((np.abs(lp[:, 0]) > 7.5) | (np.abs(lp[:, 1]) > 7.5))] = 'wood_dk'
        diag = (np.abs(s - z * 1.15) < 0.9) & ~top
        out[diag] = 'wood_dk'
        out[hn(lp, 3, 0.7) < 0.08] = 'wood_dk'
        return out
    M = Rz(20)
    prims = [box((0, 0, 8), (9, 9, 8), 'c', M=M, frame=(np.array([0, 0, 8.0]), M))]
    img, _ = render(prims, simple({'c': planks}), 36, 40)
    return ground_shadow(img, 18, 28, 14, 6)


def obj_car():
    """burnt-out Volga GAZ-21 style sedan"""
    def body(lp, ln, p):
        out = np.full(len(lp), 'cloth_blue', object)
        r1 = hn(lp, 3, 0.35)
        out[r1 < 0.45] = 'rust'
        out[r1 < 0.15] = 'rust'
        out[hn(lp, 4, 0.8) < 0.06] = 'hole'
        return out
    def cabin(lp, ln, p):
        out = np.full(len(lp), 'cloth_blue', object)
        win = (lp[:, 2] > -0.5) & (ln[:, 2] < 0.8)
        out[win] = 'hole'
        out[win & (hn(lp, 8, 0.6) < 0.25)] = 'glass'
        out[(np.abs(lp[:, 0]) < 1.0) & win] = 'rust'
        out[(ln[:, 2] > 0.8)] = 'rust'
        return out
    M = Rz(-25)
    fr = (np.zeros(3), M)
    prims = [box((0, 0, 6.5), (20, 8.5, 3.6), 'body', M=M, frame=fr),
             ell(M @ np.array([10, 0, 9]), (11, 8.3, 4.2), 'body', M=M, frame=fr),
             ell(M @ np.array([-11, 0, 9]), (10, 8.3, 3.6), 'body', M=M, frame=fr),
             ell(M @ np.array([0, 0, 11.5]), (9.5, 7.2, 5.2), 'cabin', M=M, frame=(M @ np.array([0, 0, 11.5]), M)),
             box(M @ np.array([20.5, 0, 6]), (1, 7.5, 1.2), 'chrome', M=M)]
    for sx in (13, -13):
        for sy in (8, -8):
            c = M @ np.array([sx, sy, 4.2])
            prims.append(cyl(c, 4.0, 4.0, 1.4, 'tire', M=M @ Rx(90)))
    img, _ = render(prims, simple({'body': body, 'cabin': cabin, 'tire': 'oil', 'chrome': 'metal'}), 60, 46)
    return ground_shadow(img, 30, 33, 24, 8)


def obj_tree():
    prims = []
    r = rng(5)
    def branch(a, d, L, rad, depth):
        b = a + d * L
        prims.extend(capsule(a, b, rad, rad * 0.65, 'wood'))
        if depth == 0 or rad < 0.5:
            return
        for k in range(r.choice([2, 2, 3])):
            nd = nrm(d + np.array([r.uniform(-0.9, 0.9), r.uniform(-0.9, 0.9), r.uniform(0.0, 0.6)]))
            branch(b, nd, L * r.uniform(0.55, 0.75), rad * 0.62, depth - 1)
    branch(np.array([0, 0, 0.0]), nrm([0.1, 0, 1]), 24, 2.6, 4)
    prims.extend(capsule((0, 0, 0), (5, 2, -0.5), 1.6, 0.8, 'wood'))
    prims.extend(capsule((0, 0, 0), (-4, -3, -0.5), 1.6, 0.8, 'wood'))
    def bark(lp, ln, p):
        out = np.full(len(lp), 'wood_dk', object)
        out[hn(lp, 2, np.array([1.2, 1.2, 0.25])) < 0.25] = 'ash'
        return out
    img, _ = render(prims, simple({'wood': bark}), 56, 84)
    return ground_shadow(img, 28, 72, 9, 3)


def obj_vault():
    def rock(lp, ln, p):
        out = np.full(len(lp), 'rock', object)
        out[hn(lp, p.data.get('s', 1), 0.3) < 0.3] = 'stone_dk'
        return out
    def door(lp, ln, p):
        out = np.full(len(lp), 'vault', object)
        rr = np.hypot(lp[:, 0], lp[:, 1])
        front = ln[:, 2] > 0.5
        out[front & (rr < 11.5)] = 'vault_blue'
        out[front & (np.abs(rr - 11.5) < 0.8)] = 'vault'
        out[front & (rr < 4.2)] = 'vault'
        out[front & (rr < 2.2)] = 'metal_dk'
        # bolt ring
        ang = np.arctan2(lp[:, 1], lp[:, 0])
        bolts = front & (np.abs(rr - 13.6) < 0.9) & ((ang * 12 / math.pi) % 2 < 0.7)
        out[bolts] = 'metal_dk'
        # hazard stripes on rim
        out[(~front) & (((ang * 16 / math.pi) % 2) < 1)] = 'yellow'
        out[(~front) & (((ang * 16 / math.pi) % 2) >= 1)] = 'oil'
        out[hn(lp, 9, 0.6) < 0.03] = 'rust'
        return out
    prims = []
    r = rng(9)
    for i in range(16):
        a = r.uniform(0, 2 * math.pi)
        c = np.array([math.cos(a) * r.uniform(15, 22), -10 + r.uniform(-4, 2), 22 + math.sin(a) * r.uniform(15, 22)])
        c[2] = max(c[2], 6)
        prims.append(ell(c, (r.uniform(7, 11), r.uniform(6, 9), r.uniform(6, 10)), 'rock', M=Rz(r.uniform(0, 90)) @ Rx(r.uniform(-30, 30)), s=i))
    prims.append(ell((0, -14, 26), (25, 9, 27), 'rock', s=99))
    Md = Rx(-90) @ Rz(12)  # disc facing the viewer (local z -> +Y)
    prims.append(cyl((0, 1, 21), 16, 16, 2.4, 'door', M=Md, frame=(np.array([0, 1, 21.0]), Md)))
    prims.append(cyl((0, -3, 21), 19.5, 19.5, 2.0, 'frame', M=Md))
    for k in range(10):  # cog teeth
        a = math.radians(k * 36 + 12)
        c = np.array([math.cos(a) * 16.5, 1.0, 21 + math.sin(a) * 16.5])
        prims.append(box(c, (2.0, 2.0, 2.0), 'door', M=Ry(-k * 36 - 12), frame=(np.array([0, 1, 20.0]), Md)))
    img, _ = render(prims, simple({'rock': rock, 'door': door, 'frame': 'metal_dk'}), 64, 72, dither=0.07)
    return img


def obj_tent():
    def felt(lp, ln, p):
        out = np.full(len(lp), 'felt', object)
        z = lp[:, 2]
        ang = np.arctan2(lp[:, 1], lp[:, 0])
        band = np.abs(z - 2.0) < 1.5
        out[band] = 'cloth_wine'
        orn = band & (np.abs(((ang * 10 / math.pi) % 1) - 0.5) < 0.18) & (np.abs(z - 2.0) < 0.8)
        out[orn] = 'gold'
        out[np.abs(z + 7) < 0.6] = 'canvas'
        # door facing viewer
        door = (lp[:, 1] > 10) & (np.abs(lp[:, 0]) < 3.6) & (z < 4)
        out[door] = 'cloth_wine'
        out[door & (np.abs(lp[:, 0]) < 2.6) & (z < 3)] = 'gold'
        out[door & (np.abs(lp[:, 0]) < 1.8) & (z < 2.2)] = 'cloth_wine'
        out[hn(lp, 3, 0.5) < 0.08] = 'canvas'
        return out
    def roof(lp, ln, p):
        out = np.full(len(lp), 'canvas', object)
        ang = np.arctan2(lp[:, 1], lp[:, 0])
        out[((ang * 12 / math.pi) % 2) < 0.25] = 'wood_dk'  # ropes/ribs
        z = lp[:, 2]
        out[np.abs(z + 4.5) < 0.7] = 'cloth_wine'
        out[hn(lp, 5, 0.4) < 0.1] = 'felt'
        return out
    prims = [cyl((0, 0, 8), 19.5, 19.5, 8, 'felt', frame=(np.array([0, 0, 8.0]), np.eye(3))),
             cyl((0, 0, 22), 21.5, 4.5, 6.2, 'roof', frame=(np.array([0, 0, 22.0]), np.eye(3))),
             cyl((0, 0, 28.6), 4.8, 4.0, 0.8, 'crown')]
    img, _ = render(prims, simple({'felt': felt, 'roof': roof, 'crown': 'wood'}), 50, 50)
    return ground_shadow(img, 25, 38, 23, 9)


def obj_campfire():
    prims = []
    r = rng(4)
    for k in range(9):
        a = k * 40 + r.uniform(-8, 8)
        c = np.array([math.cos(math.radians(a)) * 7.5, math.sin(math.radians(a)) * 7.5, 1.0])
        prims.append(ell(c, (2.0, 1.6, 1.6), 'stone', M=Rz(a)))
    for a in (20, 100, 160):
        d = np.array([math.cos(math.radians(a)), math.sin(math.radians(a)), 0])
        prims += capsule(-d * 5 + [0, 0, 1.2], d * 5 + [0, 0, 2.6], 1.1, 1.0, 'log')
    prims.append(ell((0, 0, 0.6), (5, 4, 0.8), 'ash'))
    img, res = render(prims, simple({'stone': lambda lp, ln, p: np.where(hn(lp, 1, 1.0) < 0.3, 'stone_dk', 'stone').astype(object),
                                     'log': 'wood_dk', 'ash': 'ash'}), 28, 40)
    # hand-drawn flame
    fl = [
        "....3.....",
        "...32..3..",
        "...321.3..",
        "..3221.32.",
        "..32112322",
        ".3211012 3",
        ".3210001 3",
        "3211000123",
        "3221000122",
        ".32211223.",
    ]
    fire = PAL['fire']
    ox, oy = 9, 40 - 12 - 13
    for y, row in enumerate(fl):
        for x, ch in enumerate(row):
            if ch.isdigit():
                img.putpixel((ox + x, oy + y), fire[int(ch)] + (255,))
    for (x, y) in ((13, 13), (11, 10), (15, 11), (14, 8)):
        img.putpixel((x, y), PAL['fire'][2] + (255,))
    return ground_shadow(img, 14, 29, 11, 4, a=50)


def obj_derrick():
    prims = []
    H = 118.0; b = 17.0; t = 3.5
    corners = [(1, 1), (1, -1), (-1, -1), (-1, 1)]
    def pt(c, z):
        w = b + (t - b) * z / H
        return np.array([c[0] * w, c[1] * w, z])
    for c in corners:
        prims += capsule(pt(c, 0), pt(c, H), 1.2, 0.8, 'steel', ends=False)
    levels = [0, 16, 31, 45, 58, 70, 81, 91, 100, 108, H]
    for i in range(len(levels) - 1):
        z0, z1 = levels[i], levels[i + 1]
        for j in range(4):
            c0, c1 = corners[j], corners[(j + 1) % 4]
            prims += capsule(pt(c0, z1), pt(c1, z1), 0.6, 0.6, 'steel', ends=False)
            if j in (0, 3) or True:
                prims += capsule(pt(c0, z0), pt(c1, z1), 0.45, 0.45, 'steel', ends=False)
    prims.append(box((0, 0, H + 2.5), (5, 5, 2.5), 'crown'))
    prims.append(box((0, 0, 1.5), (21, 21, 1.5), 'deck'))
    prims.append(box((8, 9, 7), (5, 4, 4), 'shed'))
    prims += capsule((0, 0, H), (0, 0, 20), 0.35, 0.35, 'cable', ends=False)
    prims.append(box((0, 0, 20), (1.5, 1.5, 2.2), 'crown'))
    img, _ = render(prims, simple({'steel': lambda lp, ln, p: np.where(hn(lp, 2, 0.3) < 0.35, 'rust', 'metal_dk').astype(object),
                                   'crown': 'rust', 'deck': 'wood_dk', 'shed': 'olive_dk', 'cable': 'oil'}),
                      64, 134, dither=0.06, edge=2.0)
    # oil stain
    return ground_shadow(img, 32, 120, 26, 11, a=60)


def obj_lamp():
    prims = []
    prims += capsule((0, 0, 0), (0, 0, 60), 1.3, 0.9, 'pole', ends=False)
    prims.append(cyl((0, 0, 2.5), 2.6, 1.6, 2.5, 'pole'))
    prims += capsule((0, 0, 58), (8, 2, 62), 0.7, 0.6, 'pole')
    prims.append(cyl((8.5, 2, 60.5), 3.4, 1.6, 1.4, 'head'))
    prims.append(ell((8.5, 2, 59.0), (2.0, 2.0, 0.9), 'glass'))
    img, _ = render(prims, simple({'pole': lambda lp, ln, p: np.where(hn(lp, 1, 0.4) < 0.3, 'rust', 'metal_dk').astype(object),
                                   'head': 'metal_dk', 'glass': 'glass'}), 30, 82, edge=2.0)
    return ground_shadow(img, 15, 70, 5, 2)


def obj_counter():
    def wood(lp, ln, p):
        out = np.full(len(lp), 'wood', object)
        top = ln[:, 2] > 0.7
        s = np.where(np.abs(ln[:, 0]) > np.abs(ln[:, 1]), lp[:, 1], lp[:, 0])
        out[~top & ((s % 5) < 0.7)] = 'wood_dk'
        out[~top & (lp[:, 2] > 6.0)] = 'wood_dk'
        out[top] = 'wood'
        out[top & ((lp[:, 1] % 3.0) < 0.6)] = 'wood_dk'
        return out
    M = Rz(-30)
    fr = (np.array([0, 0, 8.0]), M)
    prims = [box((0, 0, 8), (20, 6.5, 7.5), 'w', M=M, frame=fr),
             box((0, 0, 16), (21, 7.5, 0.8), 'w', M=M, frame=fr)]
    prims.append(cyl(M @ np.array([-10, 0, 19.5]), 1.3, 0.8, 2.8, 'bottle'))
    prims.append(cyl(M @ np.array([-6, 1, 18.3]), 1.6, 1.6, 1.6, 'cup'))
    prims.append(box(M @ np.array([9, 0, 18]), (3.5, 2.5, 1.4), 'cash', M=M))
    img, _ = render(prims, simple({'w': wood, 'bottle': 'glass', 'cup': 'metal', 'cash': 'olive_dk'}), 52, 48)
    return ground_shadow(img, 26, 36, 22, 8)


def obj_bed():
    def blanket(lp, ln, p):
        out = np.full(len(lp), 'olive', object)
        out[(lp[:, 0] % 6) < 0.8] = 'olive_dk'
        return out
    M = Rz(-30)
    fr = (np.zeros(3), M)
    prims = []
    for sx in (-14, 14):
        for sy in (-6.5, 6.5):
            prims += capsule(M @ np.array([sx, sy, 0]), M @ np.array([sx, sy, 7 + (5 if sx < 0 else 1)]), 0.6, 0.6, 'frame')
    prims.append(box(M @ np.array([0, 0, 6]), (14.5, 7, 1.0), 'frame', M=M))
    prims.append(box(M @ np.array([0, 0, 8]), (14, 6.6, 1.5), 'matt', M=M))
    prims.append(box(M @ np.array([3, 0, 9.4]), (10, 6.9, 0.9), 'blank', M=M, frame=(np.zeros(3), M)))
    prims.append(ell(M @ np.array([-10.5, 0, 10]), (2.6, 4.8, 1.3), 'pillow', M=M))
    img, _ = render(prims, simple({'frame': 'metal_dk', 'matt': 'cloth_cream', 'blank': blanket, 'pillow': 'shirt_white'}), 44, 38)
    return ground_shadow(img, 22, 27, 18, 7)


def obj_locker():
    def metal(lp, ln, p):
        out = np.full(len(lp), 'cloth_blue', object)
        front = ln[:, 1] > 0.7
        x, z = lp[:, 0], lp[:, 2]
        out[front & (np.abs(x) < 0.4)] = 'oil'
        out[front & (z > 11) & (z < 15) & ((np.floor(z * 1.4)) % 2 == 0) & (np.abs(np.abs(x) - 3.2) < 2.0)] = 'oil'
        out[front & (np.abs(z - 1) < 1.2) & (np.abs(np.abs(x) - 1.2) < 0.5)] = 'metal'
        out[hn(lp, 4, 0.5) < 0.12] = 'rust'
        return out
    M = Rz(-28)
    prims = [box((0, 0, 17), (7.5, 5.5, 17), 'm', M=M, frame=(np.array([0, 0, 17.0]), M))]
    img, _ = render(prims, simple({'m': metal}), 26, 58)
    return ground_shadow(img, 13, 46, 10, 4)


OBJS = {
    'wall_stone': lambda: obj_wall('stone'), 'wall_brick': lambda: obj_wall('brick'),
    'wall_kremlin': lambda: obj_wall('kremlin'), 'tower_syuyumbike': obj_tower, 'tree_dead': obj_tree,
    'barrel': obj_barrel, 'crate': obj_crate, 'car_wreck': obj_car, 'vault_door': obj_vault, 'tent': obj_tent,
    'campfire': obj_campfire, 'derrick': obj_derrick, 'lamp_post': obj_lamp, 'counter': obj_counter,
    'bed': obj_bed, 'locker': obj_locker,
}


def main(only=None):
    for k, f in OBJS.items():
        if only and k not in only:
            continue
        print('wrote', save(f(), 'sprites', f'obj_{k}.png'))


if __name__ == '__main__':
    main(sys.argv[1:] or None)
