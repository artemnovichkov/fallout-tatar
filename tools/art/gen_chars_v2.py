"""v2 character sheets (same 48x80 / 4x15 layout and rig as gen_chars.py).

Humanoids (dweller, overseer, shurale, settler) reuse the shared Rig + POSES.
Robot (floating Mr.-Handy-style helper) and rat (giant mutant rat) are non-humanoid:
they get their own posed primitive builds but the exact same ray-cast / shading /
outline / ground-shadow pipeline so they match the rest of the cast.
"""
import math
import sys
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, __import__('os').path.dirname(__file__))
from r3d import set_elev, Rx, Ry, Rz, nrm, basis_z, ell, box, cyl, capsule, raycast, shade, project, visible, CV, add_outline
from common import PAL, OUTLINE, save, rng, ramp
import gen_chars as gc
from gen_chars import W, H, CX, CY, YAW, ROWS, noise, generic_mat, hair_spikes, put, render_sheet

PAL.update({
    'jump': ramp('#5a86c4', '#3e68a6', '#2c4e80', '#1e365a'),
    'vest': ramp('#4e4a46', '#3a3734', '#2a2826', '#1c1a19'),
    'tie': ramp('#a83a30', '#862c24', '#62201a', '#421410'),
    'chrome': ramp('#eef2f4', '#a4adb4', '#6a747c', '#3c444c'),
    'brass': ramp('#e8cc7a', '#c4a050', '#967636', '#6a5024'),
    'lens': ramp('#b8f0a0', '#7cd06a', '#3e8638', '#2a5c26'),
    'bark': ramp('#a29c90', '#807a6e', '#5e5a50', '#3e3b35'),
    'bark_dk': ramp('#77726a', '#5c5850', '#44413b', '#2c2a26'),
    'moss': ramp('#7c8450', '#5e663a', '#444a2a', '#2c301c'),
    'bone': ramp('#e2d8bc', '#c0b498', '#968a72', '#6a604e'),
    'rat': ramp('#8a7866', '#6c5c4c', '#4e4238', '#342c26'),
    'pink': ramp('#e4a4a0', '#c4807e', '#9a5e5e', '#6a3e40'),
    'scarf': ramp('#b84a3a', '#943628', '#6e261e', '#4a1814'),
})

# 3x5 pixel font for the '116' on the jumpsuit back; columns read on screen left->right
DIGITS = {'1': [".#", "##", ".#", ".#", ".#"],
          '6': ["###", "#..", "###", "#.#", "###"]}


def number_mask(x, z, text='116', z_top=50.0, x_left=4.5):
    """back of torso: screen-left = local +x when facing away from the camera"""
    m = np.zeros(len(x), bool)
    col = np.floor(x_left - x).astype(int)
    row = np.floor(z_top - z).astype(int)
    c0 = 0
    for ch in text:
        g = DIGITS[ch]
        for r, line in enumerate(g):
            for c, v in enumerate(line):
                if v == '#':
                    m |= (row == r) & (col == c0 + c)
        c0 += len(g[0]) + 1
    return m


# =========================================================================== humanoids
_make_pose = gc.make_pose


def make_pose_v2(yaw, col, kind):
    """adds 'swipe' (Shurale long-finger sideways rake / tickle) to the shared pose table"""
    p = _make_pose(yaw, col, kind)
    if kind == 'swipe' and 7 <= col <= 9:
        f = col - 7
        p['armR'] = [(35, 10, 80), (50, -6, 70), (35, -20, 75)][f]
        p['armL'] = [(30, 10, 60), (40, 8, 55), (30, -5, 60)][f]
        p['lean'] = [-2, 10, 8][f]; p['twist'] = [10, -2, -10][f]
        p['legL'] = (14, 10, 0); p['legR'] = (-10, 5, 0)
    if kind == 'swipe' and col == 10:
        p['armL'] = (-10, 10, 50); p['armR'] = (-10, 10, 50); p['head'] = -4; p['lean'] = -8
    return p


gc.make_pose = make_pose_v2

def suit_extra(tag, lp, out, number=True):
    x, y, z = lp[:, 0], lp[:, 1], lp[:, 2]
    if tag == 'torso':
        front = y > 0.6
        out[front & (np.abs(x) < 0.6) & (z > 38.6)] = 'yellow'          # zip stripe
        out[(z > 52.3)] = 'yellow'                                        # collar
        out[(z < 38.8)] = 'leather_dk'                                    # belt
        out[front & (z < 38.8) & (np.abs(x) < 1.0)] = 'brass'             # buckle
        if number:
            out[(y < -0.5) & number_mask(x, z)] = 'yellow'
    elif tag.startswith('farm'):
        out[z > 8.0] = 'yellow'                                           # cuffs
    elif tag.startswith('shin'):
        out[z > 12.4] = 'yellow'
    elif tag.startswith('shoulder'):
        out[(z > 1.4)] = 'yellow'                                         # shoulder piping
    return out


def dweller_extra(tag, lp, n, p, out):
    x, y, z = lp[:, 0], lp[:, 1], lp[:, 2]
    if tag == 'head':
        out[:] = 'skin'
        out[(z > 3.0 - 0.18 * np.maximum(y, 0)) | ((y < -1.4) & (z > -1.6))] = 'hair_brown'
        return out
    return suit_extra(tag, lp, out)


def dweller_acc(ctx, up, low):
    hc, HR, hr, fr = ctx['hc'], ctx['HR'], ctx['P']['head_r'], ctx['hframe']
    up.append(ell(hc + HR @ np.array([0, -1.2, 2.2]), (hr[0] + 0.25, hr[1] + 0.05, hr[2] - 1.2), 'hair', M=HR, frame=fr))
    up.append(cyl((0, -0.3, 53.6), 3.2, 2.8, 0.9, 'collar', frame=ctx['tframe']))


def overseer_extra(tag, lp, n, p, out):
    x, y, z = lp[:, 0], lp[:, 1], lp[:, 2]
    if tag == 'head':
        out[:] = 'skin_old'
        out[((y < -1.0) & (z > -2.2)) | ((np.abs(x) > 3.6) & (z > -0.5) & (z < 3.4))] = 'hair_grey'
        out[(z > 3.6) & (y < 2.5)] = 'hair_grey'
        return out
    if tag == 'torso':
        out[:] = 'vest'
        front = y > 0.6
        op = front & (np.abs(x) < np.clip((z - 41.5) * 0.48, 0, 4.0)) & (z > 41.5)
        out[op] = 'shirt_white'
        out[op & (np.abs(x) < 0.75 - (z - 41.5) * 0.02) & (z < 52.4)] = 'tie'
        out[front & (np.abs(x) < 0.4) & (z < 41.5) & (z > 38.8) & (np.floor(z) % 2 == 0)] = 'brass'  # vest buttons
        out[(z > 52.3)] = 'yellow'
        out[(z < 38.8)] = 'leather_dk'
        out[(y < -0.5) & number_mask(x, z, z_top=49.0)] = 'yellow'        # stitched on the vest too
        return out
    return suit_extra(tag, lp, out, number=False)


def overseer_acc(ctx, up, low):
    hc, HR, hr, fr = ctx['hc'], ctx['HR'], ctx['P']['head_r'], ctx['hframe']
    up.append(ell(hc + HR @ np.array([0, hr[1] - 0.5, -2.0]), (2.0, 0.9, 0.75), 'moust', M=HR, frame=fr))
    up.append(cyl((0, -0.3, 53.6), 3.3, 2.9, 0.9, 'collar', frame=ctx['tframe']))
    if ctx['pose'].get('attack') is not None:
        S, E, Wr, d1, d2, h = ctx['arms'][-1]
        M = basis_z(d2, (0, 0, 1))
        up.append(box(h + d2 * 1.6 + M @ np.array([0, 0.6, 0]), (0.65, 1.0, 2.4), 'gun', M=M))
        up.append(box(h + M @ np.array([0, -0.4, 0.4]), (0.6, 1.2, 0.7), 'gun', M=M))
        ctx['muzzle'] = (h + d2 * 4.6 + M @ np.array([0, 0.6, 0]), d2)


def shurale_extra(tag, lp, n, p, out):
    x, y, z = lp[:, 0], lp[:, 1], lp[:, 2]
    skin = tag in ('head', 'neck', 'ear', 'nose', 'torso', 'finger') or tag[:-1] in ('hand', 'uarm', 'farm', 'thigh', 'shin', 'shoulder', 'foot')
    if skin:
        out[:] = 'bark'
        st = noise(lp * np.array([1.0, 1.0, 0.25]), 21, 1.3)               # vertical bark grain
        out[st < 0.28] = 'bark_dk'
        out[noise(lp, 22, 0.7) < 0.07] = 'moss'
        if tag == 'head':
            out[(y < 0) & (z > 0)] = 'moss'
    if tag == 'pelvis':
        out[:] = 'moss'
        out[noise(lp, 23, 0.8) < 0.35] = 'rag_dk'
    return out


def shurale_acc(ctx, up, low):
    hc, HR, hr, fr = ctx['hc'], ctx['HR'], ctx['P']['head_r'], ctx['hframe']
    up += hair_spikes(41, 26, hc, HR, hr, fr, tag='whair', length=2.9, rad=0.9, fwd=-0.25, zmin=-0.2)
    hb = hc + HR @ np.array([0, hr[1] * 0.55, hr[2] * 0.72])
    hd = HR @ nrm([0, 0.55, 1.0])
    up.append(cyl(hb + hd * 4.0, 1.6, 0.25, 4.2, 'horn', M=basis_z(hd)))
    for side in (1, -1):
        S, E, Wr, d1, d2, h = ctx['arms'][side]
        M = basis_z(d2, np.array([side, 0, 0.0]))
        for k, (sx, sy) in enumerate(((-0.55, 0.45), (0.0, 0.6), (0.55, 0.45))):
            dd = nrm(d2 + M @ np.array([sx * 0.35, sy * 0.35, 0]))
            a = h + d2 * 0.8 + M @ np.array([sx, sy * 0.4, 0])
            up += capsule(a, a + dd * (6.6 - abs(sx) * 1.8), 0.6, 0.4, 'finger', side=np.array([side, 0, 0.0]))


def settler_extra(tag, lp, n, p, out):
    x, y, z = lp[:, 0], lp[:, 1], lp[:, 2]
    if tag == 'head':
        out[:] = 'skin_tan'
        out[(z < -1.7) & (y > -0.5)] = 'stubble'
        out[(y < -1.5) & (z > -1.8) & (z < 1.5)] = 'hair_brown'
    elif tag == 'torso':
        out[:] = 'rag'
        nz = noise(lp, 31, 0.45)
        out[nz < 0.18] = 'rag_dk'
        out[(nz > 0.9)] = 'khaki'                                         # patches
        out[(y > 0.6) & (np.abs(x) < 0.4) & (z > 40)] = 'rag_dk'           # button placket
        out[z < 38.8] = 'leather_dk'
    elif tag == 'scarf':
        out[:] = 'scarf'
        orn = (np.abs(z) < 0.5) & (np.floor(np.arctan2(y, x) * 4) % 2 == 0)
        out[orn] = 'yellow'
    elif tag == 'cap':
        out[:] = 'olive_dk'
        out[(np.abs(x) < 0.4) & (z > 0)] = 'oil'
    elif tag.startswith('shin'):
        out[z > 11] = 'rag'                                              # leg wraps
        out[(z > 11) & (np.floor(z * 1.2) % 2 == 0)] = 'rag_dk'
    return out


def settler_acc(ctx, up, low):
    hc, HR, hr, fr = ctx['hc'], ctx['HR'], ctx['P']['head_r'], ctx['hframe']
    cc = hc + HR @ np.array([0, -0.3, 2.6])
    up.append(ell(cc, (hr[0] + 0.55, hr[1] + 0.6, 2.6), 'cap', M=HR, frame=(cc, HR)))
    vc = hc + HR @ np.array([0, hr[1] + 0.6, 2.0])
    up.append(box(vc, (3.6, 1.6, 0.35), 'cap', M=HR @ Rx(-12), frame=(cc, HR)))
    tf = (np.array([0, -0.3, 53.8]), np.eye(3))
    up.append(cyl((0, -0.3, 53.8), 4.6, 3.4, 1.4, 'scarf', frame=tf, ey=0.85))
    up += capsule((1.5, 3.2, 53.0), (2.4, 4.0, 47.5), 1.0, 0.8, 'scarf', frame=tf)


HUMANS = {
    'dweller': dict(mat=generic_mat({'torso': 'jump', 'pelvis': 'jump', 'thigh': 'jump', 'shin': 'jump', 'foot': 'boot',
                                     'uarm': 'jump', 'farm': 'jump', 'hand': 'skin', 'shoulder': 'jump', 'neck': 'skin',
                                     'ear': 'skin', 'nose': 'skin', 'hair': 'hair_brown', 'collar': 'yellow'}, dweller_extra),
                    acc=dweller_acc, attack='punch'),
    'overseer': dict(mat=generic_mat({'torso': 'vest', 'pelvis': 'jump', 'thigh': 'jump', 'shin': 'jump', 'foot': 'boot',
                                      'uarm': 'jump', 'farm': 'jump', 'hand': 'skin_old', 'shoulder': 'vest', 'neck': 'skin_old',
                                      'ear': 'skin_old', 'nose': 'skin_old', 'moust': 'hair_grey', 'collar': 'yellow',
                                      'gun': 'gun'}, overseer_extra),
                     acc=overseer_acc, attack='pistol', eyes='glasses', mouth=False,
                     prop=dict(torso=[(37.0, 5.6), (43.0, 6.4), (48.5, 6.8), (52.0, 6.6)], belly=1.0, hunch=2, wscale=1.06)),
    'shurale': dict(mat=generic_mat({'whair': 'moss', 'horn': 'bone', 'pelvis': 'moss'}, shurale_extra),
                    acc=shurale_acc, attack='swipe', eye_col=(240, 176, 60), mouth_col=(40, 26, 20), mouth_wide=True,
                    prop=dict(hip_z=35.5, thigh=16.2, shin=15.8, sh_z=53.0, sh_x=6.4, head_z=61.4, head_r=(4.6, 5.0, 6.2),
                              uarm=12.5, farm=12.0, hunch=16,
                              torso=[(38.5, 4.0), (44.5, 4.8), (49.8, 5.8), (53.0, 5.6)], torso_ey=0.6,
                              r_thigh=(2.0, 1.5), r_shin=(1.5, 1.1), r_uarm=(1.7, 1.35), r_farm=(1.4, 1.1),
                              foot=(1.5, 3.4, 1.2))),
    'settler': dict(mat=generic_mat({'torso': 'rag', 'pelvis': 'rag_dk', 'thigh': 'rag_dk', 'shin': 'rag_dk', 'foot': 'boot',
                                     'uarm': 'rag', 'farm': 'rag', 'hand': 'skin_tan', 'shoulder': 'rag', 'neck': 'skin_tan',
                                     'ear': 'skin_tan', 'nose': 'skin_tan', 'scarf': 'scarf', 'cap': 'olive_dk'}, settler_extra),
                    acc=settler_acc, attack='punch', mouth=False,
                    prop=dict(torso=[(37.0, 5.2), (43.0, 6.2), (48.5, 6.9), (52.0, 6.8)])),
}


# =========================================================================== non-humanoid pipeline
def render_custom(build, facing, col, shadow=(10, 3), blood=False, scale=1.0):
    """build(yaw, col) -> (prims, matfn(tag, lp, n, p), info dict with optional 'post' / 'over' callables)"""
    set_elev(14)
    SCALE[0] = scale
    prims, mat, info = build(YAW[facing], col)
    res = raycast(prims, W, H, CX, CY, scale)
    img, mats, sh = shade(res, mat, PAL, outline=None, edge=2.6)
    if info.get('post'):
        info['post'](img, res)
    img = add_outline(img, OUTLINE)
    if info.get('over'):
        info['over'](img, res)
    base = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(base)
    sx, sy = shadow
    d.ellipse((CX - sx, CY - sy, CX + sx, CY + sy), fill=(0, 0, 0, info.get('shadow_a', 70)))
    if blood and info.get('blood'):
        bx, by = info['blood']
        bc = PAL['blood']
        d.ellipse((bx - 5, by - 1, bx + 6, by + 4), fill=bc[1] + (230,))
        d.ellipse((bx - 3, by, bx + 3, by + 3), fill=bc[2] + (230,))
    base.alpha_composite(img)
    return base


def custom_sheet(build, **kw):
    sheet = Image.new('RGBA', (W * 15, H * 4), (0, 0, 0, 0))
    for r, f in enumerate(ROWS):
        for c in range(15):
            sheet.alpha_composite(render_custom(build, f, c, **kw), (c * W, r * H))
    set_elev(30)
    return sheet


def xf_all(prims, R, t):
    return [p.xf(R, t) for p in prims]


SCALE = [1.0]


def scr_pt(p):
    x, y = project(p, CX, CY, SCALE[0])
    return int(math.floor(x)), int(math.floor(y))


# --------------------------------------------------------------------------- robot
def robot_pose(col):
    p = dict(bob=0.0, tilt=0.0, roll=0.0, z=0.0, arms=[(30, 30), (24, 40), (30, 30)], saw=0, flame=1, dead=-1,
             stalk=0.0, eyes=True, spark=False, smoke=False)
    if 1 <= col <= 6:
        ph = 2 * math.pi * (col - 1) / 6
        p['bob'] = 2.2 * math.sin(ph); p['tilt'] = 9
        sw = 10 * math.sin(ph)
        p['arms'] = [(34 + sw, 34), (26 - sw, 44), (40, 30)]
        p['flame'] = 2 if col % 2 else 3
        p['saw'] = col
    elif 7 <= col <= 9:
        f = col - 7
        p['tilt'] = [-6, 14, 10][f]
        p['bob'] = [1.0, 0.0, -0.5][f]
        p['arms'] = [[(40, 30), (150, 20), (40, 30)], [(30, 30), (95, -2), (30, 30)], [(30, 30), (60, 4), (30, 30)]][f]
        p['saw'] = f * 2 + 1
        p['flame'] = 2
        p['attack'] = f
    elif col == 10:
        p['tilt'] = -20; p['roll'] = 10; p['bob'] = 1.0
        p['arms'] = [(80, 60), (80, 60), (70, 50)]
        p['flame'] = 0; p['spark'] = True
    elif col >= 11:
        f = col - 11
        p['dead'] = f
        p['tilt'] = [-18, 30, 62, 66][f]
        p['roll'] = [12, 18, 22, 22][f]
        p['z'] = [1.0, -9.0, -17.5, -18.0][f]
        p['arms'] = [[(90, 70)] * 3, [(100, 60)] * 3, [(60, 20)] * 3, [(50, 10)] * 3][f]
        p['flame'] = [1, 0, 0, 0][f]
        p['stalk'] = [10, 25, 45, 55][f]
        p['eyes'] = f < 2
        p['spark'] = f == 1
        p['smoke'] = f >= 2
    return p


def robot_build(yaw, col):
    ps = robot_pose(col)
    zc = 27.0 + ps['bob'] + ps['z']
    BR = (8.5, 8.5, 7.8)
    prims = []
    I = np.eye(3)
    O = np.zeros(3)
    prims.append(ell(O, BR, 'body', frame=(O, I)))
    prims.append(ell((0, 0, BR[2] - 0.4), (3.4, 3.4, 1.6), 'cap'))
    prims.append(cyl((0, 0, -BR[2] - 1.4), 2.2, 4.6, 2.2, 'thr'))
    prims.append(cyl((0, 0, -BR[2] - 3.8), 2.6, 2.2, 0.5, 'thr'))
    thr_tip = np.array([0, 0, -BR[2] - 4.4])
    # eye stalks: three, splayed forward/up
    eyes = []
    for a in (-38, 0, 38):
        ar = math.radians(a)
        base = np.array([2.6 * math.sin(ar), 2.6 * math.cos(ar), BR[2] - 1.0])
        d = nrm([math.sin(ar) * 0.75, 0.25 + 0.2 * math.cos(ar), 1.0 - ps['stalk'] / 60.0])
        if ps['stalk']:
            d = nrm(d + np.array([0, 0.4, -ps['stalk'] / 40.0]))
        L = 9.0 if a == 0 else 7.5
        tip = base + d * L
        prims += capsule(base, tip, 0.6, 0.5, 'stalk')
        fwd = nrm([math.sin(ar) * 0.4, 1.0, 0.1])
        prims.append(ell(tip, (2.1, 2.1, 2.1), 'eye', M=basis_z(fwd), frame=(tip, basis_z(fwd))))
        eyes.append((tip, fwd))
    # three thin arms around the lower hemisphere
    tools = ['claw', 'saw', 'nozzle']
    tool_pts = []
    for i, (ang, (sh, el)) in enumerate(zip((55, -55, 180), ps['arms'])):
        ar = math.radians(ang)
        out = np.array([math.sin(ar), math.cos(ar), 0.0])
        S = out * 6.6 + np.array([0, 0, -3.6])
        # 'sh' = swing of the upper arm from hanging-down (0) towards outward/forward (90+)
        fwd = np.array([0, 1.0, 0]) if tools[i] == 'saw' else out
        d1 = nrm(math.cos(math.radians(sh)) * np.array([0, 0, -1.0]) + math.sin(math.radians(sh)) * nrm(fwd + out * 0.3))
        E = S + d1 * 6.5
        d2 = nrm(math.cos(math.radians(sh + el)) * np.array([0, 0, -1.0]) + math.sin(math.radians(sh + el)) * nrm(fwd + out * 0.3))
        T = E + d2 * 6.0
        prims.append(ell(S, (1.5, 1.5, 1.5), 'joint'))
        prims += capsule(S, E, 0.75, 0.65, 'arm')
        prims.append(ell(E, (0.9, 0.9, 0.9), 'joint'))
        prims += capsule(E, T, 0.65, 0.55, 'arm')
        if tools[i] == 'claw':
            M = basis_z(d2, out)
            for s in (1, -1):
                prims.append(box(T + d2 * 1.4 + M @ np.array([s * 0.8, 0, 0]), (0.35, 0.5, 1.5), 'tool', M=M @ Ry(s * 18)))
        elif tools[i] == 'saw':
            side = nrm(np.cross(d2, [0, 0, 1.0]) if abs(d2[2]) < 0.95 else np.array([1.0, 0, 0]))
            M = basis_z(side, d2)  # disc in the plane of motion
            c = T + d2 * 2.6
            prims.append(cyl(c, 3.2, 3.2, 0.35, 'saw', M=M, frame=(c, M), spin=ps['saw']))
            prims.append(cyl(c, 0.9, 0.9, 0.7, 'joint', M=M))
        else:
            M = basis_z(d2, out)
            prims.append(cyl(T + d2 * 1.2, 0.9, 0.6, 1.4, 'tool', M=M))
        tool_pts.append(T)
    # pose: tilt (pitch about local x), roll, then yaw; translate to hover height
    R = Rz(yaw) @ Ry(ps['roll']) @ Rx(-ps['tilt'])
    t = np.array([0, 0, zc])
    prims = xf_all(prims, R, t)
    tip_w = R @ thr_tip + t
    eyes_w = [(R @ e + t, R @ f) for e, f in eyes]

    def mat(tag, lp, n, p):
        N = len(lp)
        x, y, z = lp[:, 0], lp[:, 1], lp[:, 2]
        if tag == 'body':
            out = np.full(N, 'chrome', object)
            ang = np.arctan2(y, x)
            band = np.abs(z + 0.4) < 1.5
            out[band] = 'brass'
            # Tatar zigzag/tulip engraving on the brass belt
            t_ = (ang * 10 / math.pi) % 2.0
            zig = band & (np.abs((z + 0.4) - (np.abs(t_ - 1.0) * 2.4 - 1.2)) < 0.55)
            out[zig] = 'rust'
            # engraved dot ring + seam on the dome
            out[(np.abs(z - 4.6) < 0.45) & ((np.floor(ang * 14 / math.pi) % 2) == 0)] = 'metal_dk'
            out[(np.abs(z - 4.6) >= 0.45) & (z > 2.0) & (np.abs(((ang * 6 / math.pi) % 2) - 1) < 0.05)] = 'metal'
            out[z < -5.2] = 'metal_dk'
            out[(z < -5.2) & (np.floor(ang * 8 / math.pi) % 2 == 0)] = 'oil'   # vents
            return out
        if tag == 'eye':
            out = np.full(N, 'bone', object)
            if ps['eyes']:
                out[z > 1.1] = 'lens'
                out[z > 1.6] = 'oil'
            else:
                out[z > 1.1] = 'metal_dk'
            return out
        if tag == 'saw':
            out = np.full(N, 'metal', object)
            rr = np.hypot(x, y)
            a = np.arctan2(y, x) + p.data.get('spin', 0) * 0.45
            out[(rr > 2.5) & ((a * 8 / math.pi) % 2 < 1)] = 'chrome'
            out[(rr > 2.5) & ((a * 8 / math.pi) % 2 >= 1)] = 'metal_dk'
            out[rr < 1.6] = 'metal_dk'
            return out
        table = {'cap': 'brass', 'thr': 'metal_dk', 'stalk': 'metal', 'joint': 'brass', 'arm': 'chrome', 'tool': 'metal_dk'}
        return np.full(N, table.get(tag, 'metal'), object)

    def over(img, res):
        x, y = scr_pt(tip_w)
        fl = PAL['fire']
        n = ps['flame']
        if n:
            L = 1 + 2 * n
            for k in range(L):
                w = max(0, (L - k) // 2)
                for dx in range(-w, w + 1):
                    c = 0 if (dx == 0 and k < L - 1) else 1 if abs(dx) < w else 2
                    if k == L - 1:
                        c = 3
                    put(img, x + dx, y + 1 + k, fl[c])
        if ps['spark']:
            r = rng(col)
            for _ in range(6):
                put(img, x + r.randint(-10, 10), y - r.randint(6, 20), PAL['flash'][r.randint(0, 1)])
        if ps['smoke']:
            sm = [(-1, -24), (0, -25), (1, -24), (-2, -23), (0, -23), (1, -27), (2, -26), (-1, -28)] if ps['dead'] == 2 else \
                 [(0, -26), (1, -27), (-1, -27), (0, -28), (2, -29), (1, -31), (-1, -30), (0, -32), (2, -32)]
            for dx, dy in sm:
                put(img, CX + dx + 2, CY + dy + 12, (118, 112, 104, 200))

    return prims, mat, dict(over=over, shadow_a=55)


# --------------------------------------------------------------------------- rat
def rat_pose(col):
    p = dict(legs=[0, 0, 0, 0], bob=0.0, dy=0.0, pitch=0.0, roll=0.0, tail=0.0, jaw=0.0, dead=-1, head=0.0)
    if 1 <= col <= 6:
        ph = 2 * math.pi * (col - 1) / 6
        s = math.sin(ph)
        p['legs'] = [3.2 * s, -3.2 * s, -3.2 * s, 3.2 * s]  # FL, FR, BL, BR (diagonal pairs)
        p['bob'] = 0.7 * abs(math.cos(ph)); p['tail'] = ph; p['pitch'] = 3
    elif 7 <= col <= 9:
        f = col - 7
        p['dy'] = [-1.5, 3.0, 2.0][f]
        p['pitch'] = [-10, 10, 4][f]
        p['jaw'] = [10, 34, 6][f]
        p['legs'] = [[-2, -2, 2, 2], [4, 4, -4, -4], [3, 3, -3, -3]][f]
        p['bob'] = [-0.6, 1.4, 0.4][f]
        p['head'] = [-12, 8, 4][f]
        p['tail'] = 1.0 + f
    elif col == 10:
        p['dy'] = -1.5; p['pitch'] = -14; p['roll'] = 14; p['jaw'] = 20; p['head'] = -16
        p['legs'] = [2, 2, -1, -1]
    elif col >= 11:
        f = col - 11
        p['dead'] = f
        p['roll'] = [50, 110, 170, 180][f]
        p['jaw'] = [20, 24, 16, 16][f]
        p['legs'] = [[2, -2, 2, -2], [3, -3, 3, -3], [1, -1, 2, 0], [0, 0, 1, 1]][f]
        p['tail'] = 0.3
    return p


def rat_build(yaw, col):
    ps = rat_pose(col)
    prims = []
    Y0 = 3.5  # shift forward so head..tail is centred
    zb = 7.0 + ps['bob']
    I = np.eye(3)
    body = []
    body.append(ell((0, Y0 - 1.0, zb), (5.0, 7.5, 4.8), 'body', frame=(np.array([0, Y0, zb]), I)))
    body.append(ell((0, Y0 - 6.5, zb + 0.6), (5.6, 5.6, 5.3), 'body', frame=(np.array([0, Y0, zb]), I)))
    # spiky mutant ridge
    for k in range(5):
        c = np.array([0, Y0 - 9 + k * 2.6, zb + 5.0 - abs(k - 1.5) * 0.5])
        body.append(ell(c, (0.7, 0.7, 1.4), 'ridge'))
    # head group (pitches with ps['head'] around neck)
    neck = np.array([0, Y0 + 5.0, zb + 0.5])
    HRm = Rx(ps['head'])
    hp = []
    hc = np.array([0, Y0 + 9.0, zb])
    hp.append(ell(hc, (3.6, 4.6, 3.4), 'head', frame=(hc, I)))
    sn = hc + np.array([0, 3.6, -0.9])
    hp.append(ell(sn, (2.1, 2.8, 1.7), 'head', frame=(hc, I)))
    hp.append(ell(sn + np.array([0, 2.6, 0.2]), (0.8, 0.6, 0.7), 'nose'))
    for s in (1, -1):
        hp.append(ell(hc + np.array([s * 2.5, -1.4, 3.2]), (1.7, 0.6, 1.9), 'ear', M=Rz(s * 25)))
    # lower jaw
    jo = hc + np.array([0, 1.0, -1.8])
    JR = Rx(-ps['jaw'])
    hp.append(ell(jo + JR @ np.array([0, 3.2, -0.4]), (1.6, 2.6, 0.9), 'jaw', M=JR))
    for s in (0.5, -0.5):
        hp.append(box(sn + np.array([s, 2.2, -1.6]), (0.35, 0.3, 0.9), 'tooth'))
        hp.append(box(jo + JR @ np.array([s, 5.4, 0.5]), (0.3, 0.3, 0.6), 'tooth', M=JR))
    eyes = [(hc + np.array([s * 2.2, 2.6, 1.3]), nrm([s * 0.7, 0.6, 0.35])) for s in (1, -1)]
    hp = xf_all(hp, HRm, neck - HRm @ neck)
    eyes = [(HRm @ (e - neck) + neck, HRm @ n) for e, n in eyes]
    body += hp
    # legs
    for i, (lx, ly) in enumerate(((3.0, Y0 + 3.5), (-3.0, Y0 + 3.5), (3.6, Y0 - 7.0), (-3.6, Y0 - 7.0))):
        sw = ps['legs'][i]
        top = np.array([lx, ly, zb - 1.5])
        foot = np.array([lx * 1.1, ly + sw, 0.7])
        knee = (top + foot) / 2 + np.array([0, -1.2 if i < 2 else 1.4, 0.4])
        body += capsule(top, knee, 1.5 if i >= 2 else 1.2, 1.0, 'leg')
        body += capsule(knee, foot, 1.0, 0.7, 'leg')
        body.append(ell(foot + np.array([0, 0.8, 0]), (0.9, 1.3, 0.6), 'paw'))
    # tail: chain of segments curving to one side
    pt = np.array([0, Y0 - 11.0, zb - 0.5])
    d = np.array([0.0, -1.0, -0.25])
    r0 = 1.3
    for k in range(6):
        ang = 0.16 * math.sin(ps['tail'] + k * 0.8)
        d = nrm(Rz(math.degrees(ang)) @ d + np.array([0, 0, -0.05 if pt[2] > 1.2 else 0.08]))
        q = pt + d * 2.1
        rr = r0 * (1 - k / 7.0)
        body += capsule(pt, q, max(rr, 0.35), max(rr * 0.85, 0.3), 'tail', ends=(k == 0))
        body.append(ell(q, (max(rr * 0.85, 0.3),) * 3, 'tail'))
        pt = q
    # whole-body pose: lunge offset, pitch (around hips), death roll (around body axis)
    RP = Rx(ps['pitch'])
    pivot = np.array([0, Y0 - 4, 3.0])
    body = xf_all(body, RP, pivot - RP @ pivot + np.array([0, ps['dy'], 0]))
    eyes = [(RP @ (e - pivot) + pivot + np.array([0, ps['dy'], 0]), RP @ n) for e, n in eyes]
    roll = ps['roll']
    if roll:
        RR = Ry(roll)
        ax = np.array([0, 0, 6.0])
        lift = np.array([0, 0, -1.6 * math.sin(math.radians(min(roll, 180)) / 2) - (1.4 if roll > 150 else 0)])
        body = xf_all(body, RR, ax - RR @ ax + lift)
        eyes = [(RR @ (e - ax) + ax + lift, RR @ n) for e, n in eyes]
    R = Rz(yaw)
    prims = xf_all(body, R, np.zeros(3))
    eyes = [(R @ e, R @ n) for e, n in eyes]
    head_w = R @ (RP @ (hc - pivot) + pivot + np.array([0, ps['dy'], 0]))

    def mat(tag, lp, n, p):
        N = len(lp)
        if tag == 'body':
            out = np.full(N, 'rat', object)
            nz = noise(lp, 51, 0.5)
            out[nz < 0.08] = 'pink'                                        # mangy bald patches
            out[(nz > 0.8)] = 'rag_dk'
            out[(lp[:, 2] < -3.0)] = 'rag'                                 # lighter belly
            return out
        if tag == 'head':
            out = np.full(N, 'rat', object)
            out[lp[:, 1] > 4.6] = 'rag'
            return out
        table = {'ridge': 'rag_dk', 'nose': 'pink', 'ear': 'pink', 'jaw': 'rat', 'tooth': 'bone', 'leg': 'rat',
                 'paw': 'pink', 'tail': 'pink'}
        return np.full(N, table.get(tag, 'rat'), object)

    def post(img, res):
        if ps['dead'] >= 2:
            return
        for e, nn in eyes:
            if visible(res, e, nn, tol=2.0) and float(np.dot(nn, CV)) > 0.1:
                x, y = scr_pt(e)
                put(img, x, y, (226, 44, 32))
                if float(np.dot(nn, CV)) > 0.45:
                    put(img, x, y - 1, (255, 120, 90))

    info = dict(post=post, shadow_a=65)
    if ps['dead'] == 3:
        info['blood'] = scr_pt(head_w + np.array([0, 0, -6.0]))
    return prims, mat, info


def main(only=None):
    for k, spec in HUMANS.items():
        if only and k not in only:
            continue
        sheet = render_sheet(k, spec)
        set_elev(30)
        print('wrote', save(sheet, 'sprites', f'{k}.png'))
    if not only or 'robot' in only:
        print('wrote', save(custom_sheet(robot_build, shadow=(9, 2), scale=1.1), 'sprites', 'robot.png'))
    if not only or 'rat' in only:
        print('wrote', save(custom_sheet(rat_build, shadow=(10, 3), blood=True, scale=1.12), 'sprites', 'rat.png'))


if __name__ == '__main__':
    main(sys.argv[1:] or None)
