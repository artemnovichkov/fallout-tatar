"""v2 map objects (vault interior + Sabantuy pole). Same primitive/ray-cast/shading pipeline
and conventions as gen_objects.py: obj_<key>.png, origin bottom-centre on the hex centre."""
import math
import sys
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, __import__('os').path.dirname(__file__))
from r3d import Rx, Ry, Rz, nrm, basis_z, ell, box, cyl, capsule, project
from common import PAL, OUTLINE, save, rng, ramp
from gen_objects import render, hex_prism, simple, ground_shadow, hn, face_uv, HEXR, SQ

PAL.update({
    'steel': ramp('#8e9aa6', '#6e7a88', '#525c6a', '#3a424e'),
    'steel_dk': ramp('#626c78', '#4c5560', '#3a424c', '#2a3038'),
    'screen': ramp('#b8f0a0', '#6cc860', '#3a8a38', '#1c4a20'),
    'crt_bg': ramp('#2a4a2a', '#1c361e', '#122614', '#0a160c'),
    'glow': ramp('#e8fff0', '#90f0c0', '#40c090', '#208060'),
    'paper': ramp('#e8e2d0', '#cfc8b4', '#a8a290', '#7e7a6c'),
    'valve': ramp('#d0503c', '#a83828', '#7e281e', '#541a14'),
    'copper': ramp('#d89a6a', '#b07248', '#865234', '#5a3622'),
    'greasy': ramp('#b08a58', '#8a6a40', '#644a2c', '#40301c'),
    'towel': ramp('#f0ece0', '#d4d0c4', '#aeaa9e', '#82807a'),
    'comb': ramp('#e04a36', '#b8301e', '#882216', '#58160e'),
    'rooster': ramp('#c87a3a', '#a05a28', '#783e1c', '#502812'),
    'tray': ramp('#b0b4b4', '#8e9292', '#6c7070', '#4a4e4e'),
    'brass': ramp('#e8cc7a', '#c4a050', '#967636', '#6a5024'),
    'water': ramp('#6aa0b4', '#4a7e94', '#345e70', '#22404e'),
})


def ident(c):
    return (np.asarray(c, float), np.eye(3))


# --------------------------------------------------------------------------- wall
def vault_wall_mat(tag, lp, ln, p):
    N = len(lp)
    out = np.full(N, 'steel', object)
    s, z = face_uv(lp, ln)
    top = ln[:, 2] > 0.7
    side = ~top
    ps = s % 12.0
    out[side & (ps < 1.0)] = 'steel_dk'                                 # vertical panel seams
    out[side & (ps >= 1.0) & (ps < 2.0)] = 'steel'                      # lit edge
    out[side & (np.abs(z - 26) < 0.6)] = 'steel_dk'                     # horizontal seam
    out[side & (np.abs(z - 40) < 0.6)] = 'steel_dk'
    riv = side & (np.abs(ps - 3.5) < 0.6) & ((np.abs(z - 28.5) < 0.6) | (np.abs(z - 23.5) < 0.6) | (np.abs(z - 42.5) < 0.6))
    out[riv] = 'metal'
    vent = side & (z > 31) & (z < 37) & (np.abs(ps - 7) < 2.6) & (np.floor(z) % 2 == 0)
    out[vent & (hn(np.stack([np.floor(s / 12), s * 0, s * 0], 1), 5) < 0.4)] = 'oil'
    # hazard band at the bottom
    band = side & (z < 6.0) & (z > 1.0)
    out[band] = 'yellow'
    out[band & (((s + z) % 6.0) < 3.0)] = 'oil'
    out[side & (z <= 1.0)] = 'steel_dk'
    out[side & (np.abs(z - 6.4) < 0.5)] = 'steel_dk'
    out[side & (hn(lp, 8, 1.0) < 0.012) & (z > 7)] = 'rust'
    out[top] = 'steel_dk'
    out[top & ((np.abs(lp[:, 0]) % 8) < 0.8) & ((np.abs(lp[:, 1]) % 8) < 4)] = 'steel'
    return out


def obj_wall_vault():
    H = 48
    prims = hex_prism(0, H, 'wall')
    img, _ = render(prims, vault_wall_mat, 52, int(H * 0.866 + 24 + 6))
    return img


# --------------------------------------------------------------------------- terminal
def obj_terminal():
    M = Rz(-24)
    fr = (np.zeros(3), M)
    prims = [box(M @ np.array([0, 0, 1.0]), (7, 5, 1.0), 'stand', M=M),
             box(M @ np.array([0, -1, 9]), (2.0, 1.6, 7), 'stand', M=M),
             box(M @ np.array([0, 1.5, 17]), (9, 5.5, 1.6), 'desk', M=M, frame=(M @ np.array([0, 1.5, 17]), M)),
             ]
    Ms = M @ Rx(-14)
    sc = M @ np.array([0, -1.0, 26])
    prims.append(box(sc, (8.5, 6.0, 7.0), 'case', M=Ms, frame=(sc, Ms)))
    prims.append(box(M @ np.array([0, 4.5, 19.2]), (6.5, 2.2, 0.6), 'keys', M=M, frame=(M @ np.array([0, 4.5, 19.2]), M)))

    def case(lp, ln, p):
        out = np.full(len(lp), 'olive_dk', object)
        x, y, z = lp[:, 0], lp[:, 1], lp[:, 2]
        front = ln[:, 1] > 0.7
        scr = front & (np.abs(x) < 6.2) & (np.abs(z) < 5.0)
        out[front & (np.abs(x) < 7.0) & (np.abs(z) < 5.8)] = 'oil'
        out[scr] = '!crt_bg'
        lines = scr & ((np.floor(z + 5) % 2) == 0) & (x > -5.5) & (x < 5.5 - (np.floor(z + 5) * 1.7) % 6)
        out[lines] = '!!screen'
        out[scr & (z > 3.6) & (x < -2.5)] = '!!screen'
        out[front & (z < -5.8) & (np.abs(x - 5) < 0.8)] = '!!flash'
        out[(~front) & (ln[:, 2] < 0.5) & ((np.floor(lp[:, 1] * 1.2) % 2) == 0) & (z > 2)] = 'olive'  # vents on the side
        return out

    def keys(lp, ln, p):
        out = np.full(len(lp), 'metal_dk', object)
        top = ln[:, 2] > 0.7
        out[top & ((np.floor(lp[:, 0] * 1.0) + np.floor(lp[:, 1] * 1.0)) % 2 == 0)] = 'cloth_cream'
        return out

    img, _ = render(prims, simple({'stand': 'metal_dk', 'desk': 'olive', 'case': case, 'keys': keys}), 30, 50)
    return ground_shadow(img, 15, 38, 10, 4)


# --------------------------------------------------------------------------- purifier
def obj_purifier():
    prims = []
    prims.append(box((0, 0, 1.5), (26, 13, 1.5), 'base', frame=ident((0, 0, 1.5))))
    tanks = [(-15, -1), (15, -1)]
    for tx, ty in tanks:
        c = np.array([tx, ty, 26.0])
        prims.append(cyl(c, 8.5, 8.5, 22, 'tank', frame=(c, np.eye(3))))
        prims.append(ell(c + np.array([0, 0, 22]), (8.5, 8.5, 4.0), 'tank', frame=(c, np.eye(3))))
        for z in (8, 44):
            prims.append(cyl((tx, ty, z), 9.2, 9.2, 0.9, 'ring'))
    mc = np.array([0, 3, 18.0])
    prims.append(box(mc, (8.5, 7.5, 15), 'machine', frame=(mc, np.eye(3))))
    prims.append(box((0, 3, 34.5), (9.5, 8.5, 1.5), 'ring'))
    # gauges on the front, a valve wheel, pipes between tanks
    for gx, gz in ((-4, 26), (4, 26)):
        c = np.array([gx, 10.6, gz])
        prims.append(cyl(c, 2.6, 2.6, 0.5, 'gauge', M=Rx(-90), frame=(c, Rx(-90))))
    vc = np.array([0, 11.4, 13.0])
    prims.append(cyl(vc, 3.2, 3.2, 0.5, 'valve', M=Rx(-90), frame=(vc, Rx(-90))))
    for z in (40, 30):
        prims += capsule((-8, 2, z), (8, 2, z), 1.3, 1.3, 'pipe', ends=False)
    prims += capsule((-15, -1, 50), (-15, -1, 58), 1.5, 1.5, 'pipe')
    prims += capsule((-15, -1, 58), (15, -1, 58), 1.5, 1.5, 'pipe')
    prims += capsule((15, -1, 58), (15, -1, 50), 1.5, 1.5, 'pipe')
    prims += capsule((8, 10, 6), (22, 10, 6), 1.4, 1.4, 'pipe')

    def tank(lp, ln, p):
        out = np.full(len(lp), 'steel', object)
        z = lp[:, 2]
        ang = np.arctan2(lp[:, 1], lp[:, 0])
        out[(np.abs(z + 2) < 4.0) & (np.abs(ang - math.pi / 2) < 0.35)] = 'glass'   # sight glass
        out[(np.abs(z + 2) < 4.0) & (np.abs(ang - math.pi / 2) < 0.35) & (z < -1)] = '!water'
        out[(np.abs(z - 10) < 1.5)] = 'yellow'
        out[(np.abs(z - 10) < 1.5) & (((ang * 8 / math.pi) % 2) < 1)] = 'oil'
        out[hn(lp, 3, 0.4) < 0.06] = 'rust'
        return out

    def machine(lp, ln, p):
        out = np.full(len(lp), 'cloth_blue', object)
        front = ln[:, 1] > 0.7
        x, z = lp[:, 0], lp[:, 2]
        out[front & (np.abs(z - 2) < 3.5) & (np.abs(x) < 6.5)] = 'steel_dk'
        out[front & (np.abs(z - 2) < 2.4) & (np.abs(x) < 5.5) & ((np.floor(x) % 2) == 0)] = 'oil'
        out[front & (z < -10.5)] = 'yellow'
        out[front & (z < -10.5) & (((x + z) % 4) < 2)] = 'oil'
        out[front & (np.abs(z - 2) >= 3.5) & (np.abs(x - 5.5) < 0.8) & (np.abs(z + 5) < 0.8)] = '!!green'
        out[front & (np.abs(z - 2) >= 3.5) & (np.abs(x - 3.0) < 0.8) & (np.abs(z + 5) < 0.8)] = '!!flash'
        return out

    def gauge(lp, ln, p):
        out = np.full(len(lp), 'brass', object)
        rr = np.hypot(lp[:, 0], lp[:, 1])
        face = ln[:, 2] > 0.7
        out[face & (rr < 1.9)] = 'paper'
        out[face & (rr < 1.9) & (np.abs(lp[:, 0] + lp[:, 1] * 0.2) < 0.4) & (lp[:, 1] < 0.2)] = 'oil'
        return out

    def valve(lp, ln, p):
        out = np.full(len(lp), 'valve', object)
        rr = np.hypot(lp[:, 0], lp[:, 1])
        out[(rr < 2.2) & (rr > 0.8) & (np.minimum(np.abs(lp[:, 0]), np.abs(lp[:, 1])) > 0.5)] = '_'
        return out

    img, _ = render(prims, simple({'base': 'steel_dk', 'tank': tank, 'ring': 'steel_dk', 'machine': machine,
                                   'gauge': gauge, 'valve': valve, 'pipe': 'copper'}), 64, 90, edge=2.4)
    return ground_shadow(img, 32, 77, 28, 9)


# --------------------------------------------------------------------------- reactor
def obj_reactor():
    prims = []
    prims.append(cyl((0, 0, 3), 22, 22, 3, 'plinth', frame=ident((0, 0, 3))))
    prims.append(cyl((0, 0, 10), 16, 16, 4, 'shell', frame=ident((0, 0, 10))))
    core = np.array([0, 0, 40.0])
    prims.append(cyl(core, 13, 13, 26, 'core', frame=(core, np.eye(3))))
    prims.append(cyl((0, 0, 70), 15, 10, 4, 'shell', frame=ident((0, 0, 70))))
    prims.append(ell((0, 0, 74), (10, 10, 5), 'shell', frame=ident((0, 0, 74))))
    for z in (16, 30, 50, 64):
        prims.append(cyl((0, 0, z), 14.4, 14.4, 1.2, 'ring', frame=ident((0, 0, z))))
    for a in (30, 150, 270):
        d = np.array([math.cos(math.radians(a)), math.sin(math.radians(a)), 0])
        prims += capsule(d * 13.5 + [0, 0, 68], d * 20 + [0, 0, 60], 1.6, 1.6, 'pipe')
        prims += capsule(d * 20 + [0, 0, 60], d * 20 + [0, 0, 6], 1.6, 1.6, 'pipe')
    prims += capsule((0, 0, 78), (0, 0, 84), 2.5, 1.5, 'shell')

    def core(lp, ln, p):
        out = np.full(len(lp), 'steel', object)
        z = lp[:, 2]
        ang = np.arctan2(lp[:, 1], lp[:, 0])
        win = (np.abs(z) < 9) & ((((ang * 6 / math.pi) % 2) - 1) ** 2 < 0.45)
        out[win] = '!!glow'
        out[win & (np.abs(z) > 6.5)] = '!glow'
        out[(np.abs(z) >= 9) & (np.abs(z) < 10.5)] = 'yellow'
        out[(np.abs(z) >= 9) & (np.abs(z) < 10.5) & (((ang * 10 / math.pi) % 2) < 1)] = 'oil'
        out[(z > 15) & (((ang * 8 / math.pi) % 2) < 0.15)] = 'steel_dk'
        out[(z < -15) & (((ang * 8 / math.pi) % 2) < 0.15)] = 'steel_dk'
        return out

    def shell(lp, ln, p):
        out = np.full(len(lp), 'steel_dk', object)
        out[hn(lp, 4, 0.4) < 0.08] = 'rust'
        return out

    def plinth(lp, ln, p):
        out = np.full(len(lp), 'concrete', object)
        side = ln[:, 2] < 0.7
        ang = np.arctan2(lp[:, 1], lp[:, 0])
        out[side] = 'yellow'
        out[side & (((ang * 12 / math.pi + lp[:, 2] * 0.3) % 2) < 1)] = 'oil'
        return out

    img, _ = render(prims, simple({'plinth': plinth, 'shell': shell, 'core': core, 'ring': 'steel_dk', 'pipe': 'copper'}),
                    64, 104, edge=2.4)
    # soft glow halo around the windows
    a = np.array(img)
    glow = np.all(a[..., :3] == np.array(PAL['glow'][0]), axis=2)
    halo = np.zeros(glow.shape, bool)
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            if dx * dx + dy * dy <= 9:
                halo |= np.roll(np.roll(glow, dy, 0), dx, 1)
    halo &= a[..., 3] == 0
    a[halo] = PAL['glow'][2] + (70,)
    img = Image.fromarray(a, 'RGBA')
    return ground_shadow(img, 32, 91, 27, 10)


# --------------------------------------------------------------------------- pipes
def obj_pipes():
    prims = []
    M = Rz(-30)
    def P(x, y, z):
        return M @ np.array([x, y, z], float)
    for x, r in ((-9, 2.6), (-3, 2.0), (3, 2.6), (9, 1.6)):
        prims += capsule(P(x, -4, 0), P(x, -4, 34), r, r, 'pipe', ends=False)
        prims.append(cyl(P(x, -4, 1.0), r + 0.9, r + 0.9, 1.0, 'flange'))
    prims += capsule(P(-9, -4, 26), P(-9, 6, 26), 2.6, 2.6, 'pipe')
    prims += capsule(P(-9, 6, 26), P(-9, 6, 0), 2.6, 2.6, 'pipe', ends=False)
    prims += capsule(P(3, -4, 14), P(14, -4, 14), 2.0, 2.0, 'pipe2')
    prims += capsule(P(14, -4, 14), P(14, 4, 14), 2.0, 2.0, 'pipe2')
    prims += capsule(P(-12, -4, 34), P(12, -4, 34), 2.2, 2.2, 'pipe2')
    for (x, y, z) in ((-9, 2.0, 26), (3, -4, 24), (14, 1.5, 14)):
        c = P(x, y, z)
        Mv = M @ Rx(-90)
        prims.append(cyl(c + M @ np.array([0, 3.2, 0]), 3.0, 3.0, 0.45, 'valve', M=Mv, frame=(c + M @ np.array([0, 3.2, 0]), Mv)))
        prims += capsule(c, c + M @ np.array([0, 3.2, 0]), 0.6, 0.6, 'flange')
    for (x, z) in ((-3, 20), (9, 10)):
        c = P(x, -1.0, z)
        Mg = M @ Rx(-90)
        prims.append(cyl(c, 2.2, 2.2, 0.4, 'gauge', M=Mg, frame=(c, Mg)))

    def pipe(lp, ln, p):
        out = np.full(len(lp), 'steel', object)
        out[hn(lp, 2, 0.35) < 0.18] = 'rust'
        out[(lp[:, 2] % 9) < 0.8] = 'steel_dk'
        return out

    def valve(lp, ln, p):
        out = np.full(len(lp), 'valve', object)
        rr = np.hypot(lp[:, 0], lp[:, 1])
        out[(rr < 2.1) & (rr > 0.7) & (np.minimum(np.abs(lp[:, 0]), np.abs(lp[:, 1])) > 0.5)] = '_'
        return out

    def gauge(lp, ln, p):
        out = np.full(len(lp), 'brass', object)
        rr = np.hypot(lp[:, 0], lp[:, 1])
        face = ln[:, 2] > 0.7
        out[face & (rr < 1.6)] = 'paper'
        out[face & (rr < 1.6) & (np.abs(lp[:, 0] - lp[:, 1]) < 0.45) & (lp[:, 1] > -0.2)] = 'oil'
        return out

    img, _ = render(prims, simple({'pipe': pipe, 'pipe2': 'copper', 'flange': 'steel_dk', 'valve': valve, 'gauge': gauge}),
                    48, 58, edge=2.2)
    return ground_shadow(img, 24, 46, 18, 6)


# --------------------------------------------------------------------------- table
def obj_table():
    M = Rz(-30)
    fr = (np.zeros(3), M)
    prims = [box(M @ np.array([0, 0, 13]), (17, 8, 0.8), 'top', M=M, frame=(M @ np.array([0, 0, 13]), M))]
    for sx in (-15, 15):
        for sy in (-6, 6):
            prims += capsule(M @ np.array([sx, sy, 0]), M @ np.array([sx, sy, 12.4]), 0.8, 0.8, 'leg', ends=False)
    for sx in (-15, 15):
        prims += capsule(M @ np.array([sx, -6, 3]), M @ np.array([sx, 6, 3]), 0.5, 0.5, 'leg', ends=False)
    # benches
    for sy in (-12.5, 12.5):
        prims.append(box(M @ np.array([0, sy, 7.5]), (15, 2.6, 0.7), 'top', M=M, frame=(M @ np.array([0, sy, 7.5]), M)))
        for sx in (-12, 12):
            prims += capsule(M @ np.array([sx, sy, 0]), M @ np.array([sx, sy, 7]), 0.6, 0.6, 'leg', ends=False)
    # trays + cups
    for tx, ty in ((-7, -3), (6, 3)):
        c = M @ np.array([tx, ty, 14.2])
        prims.append(box(c, (4.0, 2.8, 0.4), 'tray', M=M, frame=(c, M)))
        prims.append(ell(c + M @ np.array([-1.2, 0, 0.6]), (1.4, 1.2, 0.6), 'food'))
    prims.append(cyl(M @ np.array([0, 0, 15.2]), 1.0, 1.1, 1.4, 'cup'))

    def top(lp, ln, p):
        out = np.full(len(lp), 'steel', object)
        t = ln[:, 2] > 0.7
        out[t & ((np.abs(lp[:, 0]) > 15.8) | (np.abs(lp[:, 1]) > 7.0))] = 'steel_dk'
        out[t & (hn(lp, 6, 0.5) < 0.08)] = 'tray'
        out[~t] = 'steel_dk'
        return out

    def tray(lp, ln, p):
        out = np.full(len(lp), 'tray', object)
        out[(ln[:, 2] > 0.7) & (np.abs(lp[:, 0]) < 3.2) & (np.abs(lp[:, 1]) < 2.0) & (lp[:, 0] > 0.4)] = 'tray'
        return out

    img, _ = render(prims, simple({'top': top, 'leg': 'steel_dk', 'tray': tray, 'food': 'olive', 'cup': 'cloth_blue'}), 52, 40)
    return ground_shadow(img, 26, 28, 22, 8)


# --------------------------------------------------------------------------- shelf
def obj_shelf():
    M = Rz(-28)
    prims = []
    hw, hd = 11.0, 5.0
    for sx in (-hw, hw):
        for sy in (-hd, hd):
            prims += capsule(M @ np.array([sx, sy, 0]), M @ np.array([sx, sy, 40]), 0.7, 0.7, 'post', ends=False)
    levels = (1.5, 14, 26.5, 39)
    for z in levels:
        c = M @ np.array([0, 0, z])
        prims.append(box(c, (hw + 0.4, hd + 0.4, 0.5), 'board', M=M, frame=(c, M)))
    r = rng(12)
    for li, z in enumerate(levels[:3]):
        x = -hw + 1.0
        while x < hw - 2.5:
            kind = r.choice(['box', 'can', 'can', 'box', 'jar', None])
            if kind == 'box':
                w = r.uniform(2.5, 4.0); h = r.uniform(2.5, 4.5)
                c = M @ np.array([x + w, r.uniform(-1, 1), z + 0.5 + h])
                prims.append(box(c, (w, 3.4, h), 'box', M=M @ Rz(r.uniform(-8, 8)), frame=(c, M), s=r.randint(0, 99)))
                x += 2 * w + 0.6
            elif kind == 'can':
                c = M @ np.array([x + 1.4, r.uniform(-1.5, 2), z + 0.5 + 2.0])
                prims.append(cyl(c, 1.3, 1.3, 2.0, 'can', frame=(c, np.eye(3)), s=r.randint(0, 2)))
                x += 3.0
            elif kind == 'jar':
                c = M @ np.array([x + 1.4, r.uniform(-1, 2), z + 0.5 + 2.4])
                prims.append(cyl(c, 1.4, 1.2, 2.4, 'jar'))
                x += 3.2
            else:
                x += 2.5

    def box_m(lp, ln, p):
        out = np.full(len(lp), 'canvas' if p.data.get('s', 0) % 3 else 'wood', object)
        out[np.abs(lp[:, 2]) < 0.4] = 'wood_dk'
        return out

    def can(lp, ln, p):
        lab = ['red', 'cloth_blue', 'olive'][p.data.get('s', 0)]
        out = np.full(len(lp), lab, object)
        out[np.abs(lp[:, 2]) > 1.4] = 'metal'
        out[(np.abs(lp[:, 2]) < 0.5) & (lp[:, 1] > 0.6)] = 'cloth_cream'
        return out

    img, _ = render(prims, simple({'post': 'steel_dk', 'board': 'steel', 'box': box_m, 'can': can, 'jar': 'glass'}), 34, 62,
                    edge=2.2)
    return ground_shadow(img, 17, 50, 13, 5)


# --------------------------------------------------------------------------- desk
def obj_desk():
    M = Rz(-30)
    prims = []
    c = M @ np.array([0, 0, 14.6])
    prims.append(box(c, (17, 8, 0.9), 'top', M=M, frame=(c, M)))
    for sx in (-11.5, 11.5):
        cc = M @ np.array([sx, 0, 7])
        prims.append(box(cc, (5.0, 7.4, 7), 'ped', M=M, frame=(cc, M)))
    prims.append(box(M @ np.array([0, -7, 9]), (6.5, 0.5, 5), 'ped', M=M, frame=(M @ np.array([0, -7, 9]), M)))
    # papers, folder, lamp, phone, nameplate
    for (px, py, rot, z) in ((-3, 1, 10, 15.6), (-1, 2, -14, 15.75), (5, -2, 25, 15.6)):
        cc = M @ np.array([px, py, z])
        prims.append(box(cc, (2.6, 3.4, 0.15), 'paper', M=M @ Rz(rot), frame=(cc, M @ Rz(rot))))
    cc = M @ np.array([-12, 1, 15.9])
    prims.append(box(cc, (2.6, 3.4, 0.4), 'folder', M=M @ Rz(-6)))
    lb = M @ np.array([12, -4, 15.8])
    prims.append(cyl(lb, 1.8, 1.4, 0.5, 'lamp'))
    prims += capsule(lb, lb + M @ np.array([-1.0, 0, 7.5]), 0.45, 0.45, 'lamp')
    prims += capsule(lb + M @ np.array([-1.0, 0, 7.5]), lb + M @ np.array([-4.0, 1.5, 7.0]), 0.45, 0.45, 'lamp')
    sh = lb + M @ np.array([-4.5, 1.8, 5.8])
    prims.append(cyl(sh, 2.8, 1.0, 1.6, 'shade'))
    prims.append(ell(sh + np.array([0, 0, -1.6]), (2.2, 2.2, 0.4), 'bulb'))
    cc = M @ np.array([9, 4, 16.6])
    prims.append(box(cc, (2.0, 1.5, 1.0), 'phone', M=M))
    prims.append(box(M @ np.array([2, 6.2, 16.1]), (3.4, 0.4, 0.6), 'brassp', M=M))

    def top(lp, ln, p):
        out = np.full(len(lp), 'wood', object)
        t = ln[:, 2] > 0.7
        out[t & ((lp[:, 0] % 4.5) < 0.6)] = 'wood_dk'
        out[t & (np.abs(lp[:, 0]) < 9) & (np.abs(lp[:, 1]) < 5)] = 'olive_dk'   # blotter
        out[~t] = 'wood_dk'
        return out

    def ped(lp, ln, p):
        out = np.full(len(lp), 'wood_dk', object)
        front = ln[:, 1] < -0.7
        out[(np.abs(lp[:, 2] % 4.6) < 0.5)] = 'wood'
        out[(np.abs(lp[:, 2] % 4.6 - 2.3) < 0.5) & (np.abs(lp[:, 0]) < 1.0)] = 'brass'
        return out

    def paper(lp, ln, p):
        out = np.full(len(lp), 'paper', object)
        out[((np.floor(lp[:, 1] * 1.6)) % 2 == 0) & (np.abs(lp[:, 0]) < 1.8) & (lp[:, 1] < 2.6)] = 'stone'
        return out

    img, _ = render(prims, simple({'top': top, 'ped': ped, 'paper': paper, 'folder': 'red', 'lamp': 'brass',
                                   'shade': 'green_roof', 'bulb': '!!lamp', 'phone': 'oil', 'brassp': 'brass'}), 52, 46)
    return ground_shadow(img, 26, 34, 22, 8)


# --------------------------------------------------------------------------- Sabantuy pole
def obj_pole():
    H = 128.0
    prims = []
    prims += capsule((0, 0, 0), (0, 0, H), 2.3, 1.6, 'pole', ends=False)
    prims.append(cyl((0, 0, 1.2), 3.2, 2.4, 1.2, 'base'))
    # wheel/hoop at the top with the prize
    prims.append(cyl((0, 0, H + 1), 6.5, 6.5, 0.5, 'hoop', frame=ident((0, 0, H + 1))))
    prims.append(cyl((0, 0, H + 2.5), 1.5, 0.8, 2.0, 'pole'))
    # embroidered towel hanging from the hoop
    tc = np.array([3.5, 4.5, H - 7.0])
    MT = Rz(-25)
    prims.append(box(tc, (3.4, 0.3, 8.0), 'towel', M=MT, frame=(tc, MT)))
    tc2 = np.array([-5.5, 1.0, H - 5.0])
    MT2 = Rz(75)
    prims.append(box(tc2, (2.6, 0.3, 6.0), 'towel', M=MT2, frame=(tc2, MT2)))
    # rooster sitting on top
    RR = Rz(-70)
    rb = np.array([0, 0, H + 9.0])
    prims.append(ell(rb, (3.4, 4.6, 3.4), 'rooster', M=RR))
    hd = rb + RR @ np.array([0, 3.8, 4.2])
    prims.append(ell(hd, (1.9, 2.0, 2.2), 'rooster'))
    prims.append(ell(hd + RR @ np.array([0, 0.2, 2.4]), (0.6, 1.6, 1.1), 'comb'))
    prims.append(ell(hd + RR @ np.array([0, 2.0, -0.4]), (0.6, 1.1, 0.5), 'beak'))
    prims.append(ell(hd + RR @ np.array([0, 1.3, -1.9]), (0.5, 0.5, 0.9), 'comb'))
    for s_ in (1, -1):
        prims += capsule(rb + np.array([s_ * 1.2, 0, -2.5]), rb + np.array([s_ * 1.2, 0, -6.5]), 0.4, 0.4, 'beak')
    for k, a in enumerate((-30, 0, 30)):
        d = RR @ nrm([math.sin(math.radians(a)) * 0.6, -1.0, 1.4])
        prims += capsule(rb + RR @ np.array([0, -3.4, 0.8]), rb + RR @ np.array([0, -3.4, 0.8]) + d * 6.0,
                         1.0, 0.6, 'tail%d' % k)

    def pole(lp, ln, p):
        out = np.full(len(lp), 'greasy', object)
        out[hn(lp, 3, np.array([1.0, 1.0, 0.2])) < 0.2] = 'wood_dk'
        return out

    def towel(lp, ln, p):
        out = np.full(len(lp), 'towel', object)
        x, z = lp[:, 0], lp[:, 2]
        out[(np.abs(z + 4.6) < 0.9)] = 'red'
        out[(np.abs(z + 2.6) < 0.5) & ((np.floor(x * 1.2) % 2) == 0)] = 'red'
        out[(np.abs(z + 6.2) < 0.4)] = 'red'
        out[(np.abs(z - 1.5) < 1.0) & (np.abs(np.abs(x) - (1.0 - np.abs(z - 1.5))) < 0.5)] = 'red'   # tulip-ish motif
        return out

    tbl = {'pole': pole, 'base': 'wood_dk', 'hoop': 'wood', 'towel': towel, 'rooster': 'rooster', 'comb': 'comb',
           'beak': 'yellow', 'tail0': 'green_roof', 'tail1': 'oil', 'tail2': 'green_roof'}
    img, _ = render(prims, simple(tbl), 28, 160, edge=2.0)
    return ground_shadow(img, 14, 148, 6, 2)


OBJS = {
    'wall_vault': obj_wall_vault, 'terminal': obj_terminal, 'purifier': obj_purifier, 'reactor': obj_reactor,
    'pipes': obj_pipes, 'table': obj_table, 'shelf': obj_shelf, 'desk': obj_desk, 'pole': obj_pole,
}


def main(only=None):
    for k, f in OBJS.items():
        if only and k not in only:
            continue
        print('wrote', save(f(), 'sprites', f'obj_{k}.png'))


if __name__ == '__main__':
    main(sys.argv[1:] or None)
