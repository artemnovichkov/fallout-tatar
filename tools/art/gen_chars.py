"""Character sprite sheets: 48x80 frames, rows S/SE/NE/N, 15 cols (idle, walk6, attack3, hit, death4).

A parametric body (skeleton -> posed primitives) is shared by every character.
Each character is a stack of layers: body (proportions/skin), clothes (material
map per body part), head (face stamps), hair (extra primitives), accessories
(weapon, pack, helmet...). All animation logic lives in POSES and is shared.
"""
import math
import sys
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, __import__('os').path.dirname(__file__))
from r3d import set_elev, Rx, Ry, Rz, nrm, basis_z, ell, box, cyl, capsule, raycast, shade, project, visible, CV, add_outline
from common import PAL, OUTLINE, save, rng

W, H = 48, 80
CX, CY = 24, 72
YAW = {'S': 0.0, 'SE': -56.3, 'NE': -123.7, 'N': 180.0}
ROWS = ['S', 'SE', 'NE', 'N']


def noise(lp, seed=0, f=1.0):
    """cheap deterministic hash noise on 3D points -> [0,1)"""
    q = np.floor(lp * f).astype(np.int64)
    h = (q[:, 0] * 73856093) ^ (q[:, 1] * 19349663) ^ (q[:, 2] * 83492791) ^ (seed * 2654435761)
    return ((h & 0xffff) / 65536.0)


# --------------------------------------------------------------------------- proportions
BASE = dict(hip_z=34.0, hip_x=3.1, thigh=15.5, shin=15.0, ankle_h=3.0,
            sh_z=52.0, sh_x=7.0, uarm=10.5, farm=9.5,
            head_z=62.3, head_r=(5.2, 5.4, 6.0),
            torso=[(37.0, 5.0), (43.0, 6.0), (48.5, 6.9), (52.0, 6.8)], torso_ey=0.56,
            r_thigh=(2.7, 2.1), r_shin=(2.1, 1.6), r_uarm=(2.0, 1.7), r_farm=(1.7, 1.35),
            foot=(1.6, 3.0, 1.35), hunch=0.0, belly=0.0)


def dirv(pitch, roll=0.0, side=1):
    p, r = math.radians(pitch), math.radians(roll)
    return np.array([side * math.sin(r), math.sin(p) * math.cos(r), -math.cos(p) * math.cos(r)])


def xf_point(R, t, p):
    return R @ p + t


class Rig:
    """Builds posed primitives for one frame."""

    def __init__(self, spec, pose):
        self.s = spec; self.P = dict(BASE, **spec.get('prop', {})); self.pose = pose
        self.prims = []; self.anchors = {}

    def build(self):
        P, ps = self.P, self.pose
        prims = []
        # ---- legs (body local, x=left, y=fwd, z=up)
        soles = []
        legs = {}
        for side, (hip, knee, roll) in ((1, ps['legL']), (-1, ps['legR'])):
            Hj = np.array([side * P['hip_x'], 0, P['hip_z']])
            d1 = dirv(hip, roll, side)
            K = Hj + d1 * P['thigh']
            d2 = dirv(hip - knee, roll * 0.5, side)
            A = K + d2 * P['shin']
            sp = hip - knee
            fp = 0.5 * sp if sp < 0 else 0.25 * sp
            FR = Rz(-side * 6) @ Rx(fp)
            fc = A + FR @ np.array([0, 1.2, -P['ankle_h'] + P['foot'][2]])
            corners = [fc + FR @ (np.array(P['foot']) * np.array([sx, sy, sz])) for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
            soles.append(min(c[2] for c in corners))
            legs[side] = (Hj, K, A, d1, d2, fc, FR)
        lift = -min(soles)
        tag = {1: 'L', -1: 'R'}
        for side, (Hj, K, A, d1, d2, fc, FR) in legs.items():
            sv = np.array([side, 0, 0.0])
            prims += capsule(Hj, K, *P['r_thigh'], 'thigh' + tag[side], side=sv)
            prims += capsule(K, A, *P['r_shin'], 'shin' + tag[side], side=sv)
            prims.append(box(fc, P['foot'], 'foot' + tag[side], M=FR))
            self.anchors['ankle' + tag[side]] = A
        pel_c = np.array([0, 0, P['hip_z'] + 1.0])
        prims.append(ell(pel_c, (5.3 * P.get('wscale', 1), 3.5, 3.6), 'pelvis'))
        # ---- upper body transform
        lean = ps.get('lean', 0) + P['hunch']
        Rup = Rz(ps.get('twist', 0)) @ Rx(-lean)
        piv = np.array([0, 0, P['hip_z'] + 1.5])
        up = []
        tframe = (np.array([0, 0, 0.0]), np.eye(3))
        segs = P['torso']
        for (z0, r0), (z1, r1) in zip(segs[:-1], segs[1:]):
            up.append(cyl((0, 0, (z0 + z1) / 2), r0, r1, (z1 - z0) / 2, 'torso', frame=tframe, ey=P['torso_ey']))
        zt, rt = segs[-1]
        up.append(ell((0, 0, zt), (rt, rt * P['torso_ey'], 2.6), 'torso', frame=tframe))
        if P['belly']:
            up.append(ell((0, 1.2, 41), (5.5, 3.6 + P['belly'], 4.8), 'torso', frame=tframe))
        up += capsule((0, 0, zt), (0, 0.3, P['head_z'] - 3.5), 2.1, 1.9, 'neck')
        # head
        hp = ps.get('head', 0)
        hc_local = np.array([0, 0.3, P['head_z']])
        HR = Rx(-hp)
        hframe = (hc_local, HR)
        up.append(ell(hc_local, P['head_r'], 'head', M=HR, frame=hframe))
        hr = P['head_r']
        up.append(ell(hc_local + HR @ np.array([0, hr[1] - 0.2, -0.6]), (0.75, 1.0, 1.4), 'nose', M=HR, frame=hframe))
        for side in (1, -1):
            up.append(ell(hc_local + HR @ np.array([side * (hr[0] - 0.3), -0.4, -0.4]), (0.9, 1.0, 1.6), 'ear', M=HR, frame=hframe))
        # arms
        arms = {}
        for side, (sh, roll, elbow) in ((1, ps['armL']), (-1, ps['armR'])):
            S = np.array([side * P['sh_x'], 0, P['sh_z']])
            d1 = dirv(sh, roll + 3, side)
            E = S + d1 * P['uarm']
            d2 = dirv(sh + elbow, roll + 2, side)
            Wr = E + d2 * P['farm']
            sv = np.array([side, 0, 0.0])
            up += capsule(S, E, *P['r_uarm'], 'uarm' + tag[side], side=sv)
            up += capsule(E, Wr, *P['r_farm'], 'farm' + tag[side], side=sv)
            hc = Wr + d2 * 1.4
            up.append(ell(hc, (1.35, 1.1, 1.8), 'hand' + tag[side], M=basis_z(d2, sv)))
            up.append(ell(S + np.array([0, 0, 0.3]), (2.5, 2.5, 2.3), 'shoulder' + tag[side]))
            arms[side] = (S, E, Wr, d1, d2, hc)
        acc = self.s.get('acc')
        ctx = dict(P=P, hc=hc_local, HR=HR, hframe=hframe, arms=arms, pose=ps, tframe=tframe)
        extra_up, extra_low = [], []
        if acc:
            acc(ctx, extra_up, extra_low)
        up += extra_up
        prims += extra_low
        # face anchors in upper-body local
        self.local_anchor_up = {}
        for k, (pt, nn) in self.s.get('face', face_points(P)).items():
            self.local_anchor_up[k] = (hc_local + HR @ pt, HR @ nn)
        for side in (1, -1):
            self.local_anchor_up['hand' + tag[side]] = (arms[side][5], arms[side][4])
        if 'muzzle' in ctx:
            self.local_anchor_up['muzzle'] = ctx['muzzle']
        up = [p.xf(Rup, piv - Rup @ piv) for p in up]
        allp = prims + up
        # ---- global: lift, yaw, fall (fall toward a screen diagonal so a corpse fits in 48px)
        yaw = Rz(ps['yaw'])
        fall = ps.get('fall', 0)
        back = yaw @ np.array([0, -1.0, 0])
        g = np.array([back[0], back[1], 0.0])
        if abs(g[0]) < 0.5:
            g = np.array([-0.6, 0.8 * (1 if g[1] > 0 else -1), 0])
        else:
            g = np.array([0.6 * np.sign(g[0]), 0.8 * (1 if g[1] > 0 else -1), 0])
        g = nrm(g)
        Rf = rot_axis(np.cross([0, 0, 1.0], g), fall)
        R = Rf @ yaw
        tl = Rf @ np.array([0, 0, lift]) + np.array([0, 0, 3.4 * math.sin(math.radians(fall))])
        if fall:
            # slide the body so it stays centred in the frame
            pts = [R @ p.c + tl for p in allp]
            xs = [project(q, 0, 0)[0] for q in pts]; ys = [project(q, 0, 0)[1] for q in pts]
            k = min(1.0, fall / 70.0)
            mx = (min(xs) + max(xs)) / 2
            tl = tl + np.array([-mx * k, 0, 0])
            bottom = max(ys)
            if bottom > -1:
                tl = tl + np.array([0, -(bottom + 1) / 0.5 * k, 0])
        self.prims = [p.xf(R, tl) for p in allp]
        self.anchors = {}
        for k_, (pt, nn) in self.local_anchor_up.items():
            wp = Rup @ (pt - piv) + piv
            self.anchors[k_] = (R @ wp + tl, R @ (Rup @ nn))
        self.R, self.tl = R, tl
        return self.prims


def rot_axis(k, deg):
    k = nrm(k); a = math.radians(deg)
    K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    return np.eye(3) + math.sin(a) * K + (1 - math.cos(a)) * K @ K


def face_points(P):
    hr = P['head_r']
    def surf(x, z):
        # point on head ellipsoid front surface at local x,z
        yy = hr[1] * math.sqrt(max(0.0, 1 - (x / hr[0]) ** 2 - (z / hr[2]) ** 2))
        p = np.array([x, yy, z]); n = nrm(p / np.array(hr) ** 2)
        return p, n
    return {'eyeL': surf(2.0, 0.6), 'eyeR': surf(-2.0, 0.6), 'mouth': surf(0, -2.8),
            'templeL': surf(4.6, 0.6), 'templeR': surf(-4.6, 0.6), 'brow': surf(0, 1.6)}


# --------------------------------------------------------------------------- poses
def pose_base(yaw):
    return dict(yaw=yaw, legL=(2, 4, 0), legR=(-1, 3, 0), armL=(3, 4, 10), armR=(3, 4, 10), lean=0, head=0)


def make_pose(yaw, col, kind):
    p = pose_base(yaw)
    if col == 0:
        return p
    if 1 <= col <= 6:
        i = col - 1
        ph = 2 * math.pi * i / 6
        s, c = math.sin(ph), math.cos(ph)
        hL = 26 * s
        p['legL'] = (hL, 6 + 44 * max(0, c), 0)
        p['legR'] = (-hL, 6 + 44 * max(0, -c), 0)
        p['armL'] = (-20 * s, 3, 14 + 10 * max(0, -s))
        p['armR'] = (20 * s, 3, 14 + 10 * max(0, s))
        p['lean'] = 4; p['twist'] = 4 * s
        return p
    if 7 <= col <= 9:
        f = col - 7
        if kind == 'pistol':
            p['armR'] = [(45, 0, 40), (88, -4, 2), (100, -4, 10)][f]
            p['armL'] = (-6, 8, 18)
            p['lean'] = [2, 0, -5][f]; p['head'] = [0, 0, -4][f]
            p['legL'] = (10, 8, 0); p['legR'] = (-8, 4, 0)
        elif kind == 'rifle':
            p['armR'] = [(55, -8, 50), (82, -12, 12), (90, -12, 18)][f]
            p['armL'] = [(55, -30, 50), (78, -32, 30), (84, -32, 34)][f]
            p['lean'] = [3, 2, -5][f]
            p['legL'] = (12, 8, 0); p['legR'] = (-10, 4, 0)
        elif kind == 'melee':
            p['armR'] = [(165, 4, 50), (85, -6, 10), (25, -10, 30)][f]
            p['armL'] = [(20, 14, 30), (-10, 10, 20), (-20, 10, 20)][f]
            p['lean'] = [-4, 10, 14][f]; p['twist'] = [10, -6, -12][f]
            p['legL'] = (16, 12, 0); p['legR'] = (-12, 6, 0)
        elif kind == 'claw':
            p['armR'] = [(130, 10, 60), (75, 0, 10), (35, 0, 30)][f]
            p['armL'] = [(115, 10, 50), (80, 0, 14), (45, 0, 30)][f]
            p['lean'] = [-4, 14, 18][f]
            p['legL'] = (16, 14, 0); p['legR'] = (-12, 6, 0)
        else:  # punch
            p['armR'] = [(-20, 4, 110), (88, -6, 4), (40, 0, 70)][f]
            p['armL'] = [(30, 6, 100), (20, 8, 100), (30, 6, 100)][f]
            p['lean'] = [-2, 8, 2][f]; p['twist'] = [8, -10, 0][f]
            p['legL'] = (12, 8, 0); p['legR'] = (-8, 4, 0)
        p['attack'] = f
        return p
    if col == 10:
        p['lean'] = -14; p['head'] = -12
        p['armL'] = (-15, 28, 45); p['armR'] = (-15, 28, 45)
        p['legL'] = (8, 16, 0); p['legR'] = (-4, 12, 0)
        return p
    f = col - 11
    p['lean'] = [-16, -10, -4, 0][f]
    p['head'] = [-14, -10, 0, 6][f]
    p['fall'] = [10, 42, 76, 90][f]
    p['legL'] = [(14, 30, 4), (30, 50, 6), (40, 70, 8), (45, 80, 10)][f]
    p['legR'] = [(6, 24, 2), (20, 40, 4), (30, 60, 6), (34, 70, 8)][f]
    p['armL'] = [(40, 30, 40), (70, 34, 40), (60, 50, 50), (50, 60, 60)][f]
    p['armR'] = [(30, 26, 50), (60, 30, 50), (40, 36, 70), (20, 30, 80)][f]
    p['dead'] = f
    return p


# --------------------------------------------------------------------------- stamps
def put(img, x, y, col):
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), tuple(col) + (255,) if len(col) == 3 else tuple(col))


def scr(rig, key):
    p, n = rig.anchors[key]
    x, y = project(p, CX, CY)
    return p, n, int(math.floor(x)), int(math.floor(y))


def face_stamps(img, rig, res, spec, facing):
    if rig.pose.get('dead', -1) >= 2:
        return
    eyes = spec.get('eyes', 'dots')
    for k in ('eyeL', 'eyeR'):
        p, n, x, y = scr(rig, k)
        vis = visible(res, p, n, tol=2.0)
        f = float(np.dot(n, CV))
        if eyes == 'glasses':
            fr = PAL['frames']
            if vis:
                if f > 0.55:
                    # round 4x3 ring with pupil
                    for dx, dy in ((0, -1), (1, -1), (-1, 0), (2, 0), (0, 1), (1, 1)):
                        put(img, x - 1 + dx + 1, y + dy, fr[1] if dy < 1 else fr[2])
                    put(img, x, y, PAL['eye'][0])
                    put(img, x + 1, y, PAL['skin'][0])
                elif f > 0.15:
                    for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
                        put(img, x + dx, y + dy, fr[1])
                    put(img, x, y, PAL['eye'][0])
            # temple arm visible from the side/back
            tk = 'templeL' if k == 'eyeL' else 'templeR'
            tp, tn, tx, ty = scr(rig, tk)
            if float(np.dot(tn, CV)) > 0.1 and visible(res, tp, tn, tol=2.5) and f < 0.6:
                sx = 1 if x > tx else -1
                for i in range(3):
                    put(img, tx + sx * i, ty, fr[2])
        elif vis and f > 0.2:
            put(img, x, y, spec.get('eye_col', PAL['eye'][0]))
            if f > 0.6 and spec.get('eye_white'):
                put(img, x + (1 if k == 'eyeL' else -1), y, spec['eye_white'])
    p, n, x, y = scr(rig, 'mouth')
    if spec.get('mouth', True) and visible(res, p, n, tol=2.0):
        f = float(np.dot(n, CV))
        mc = spec.get('mouth_col', PAL['lip'][2])
        if f > 0.6:
            put(img, x - 1, y, mc); put(img, x, y, mc)
            if spec.get('mouth_wide'):
                put(img, x + 1, y, mc)
        elif f > 0.15:
            put(img, x, y, mc)


def muzzle_flash(img, rig):
    if 'muzzle' not in rig.anchors or rig.pose.get('attack') != 1:
        return
    p, n = rig.anchors['muzzle']
    x, y = project(p, CX, CY)
    x, y = int(x), int(y)
    fl = PAL['flash']
    for dx, dy, c in ((0, 0, 0), (1, 0, 0), (-1, 0, 1), (0, 1, 1), (0, -1, 1), (2, 0, 1), (-2, 0, 2), (0, 2, 2), (0, -2, 2),
                      (1, 1, 2), (-1, -1, 2), (1, -1, 2), (-1, 1, 2), (3, 0, 3)):
        put(img, x + dx, y + dy, fl[c])


# --------------------------------------------------------------------------- render
def render_frame(spec, facing, col):
    pose = make_pose(YAW[facing], col, spec.get('attack', 'punch'))
    rig = Rig(spec, pose)
    set_elev(14 + 16 * min(1.0, pose.get('fall', 0) / 80.0))
    prims = rig.build()
    res = raycast(prims, W, H, CX, CY)
    img, mats, sh = shade(res, lambda tag, lp, n, p: spec['mat'](tag, lp, n, p, pose), PAL, outline=None, edge=2.6)
    face_stamps(img, rig, res, spec, facing)
    if spec.get('post'):
        spec['post'](img, rig, res, facing)
    img = add_outline(img, OUTLINE)
    muzzle_flash(img, rig)
    # ground shadow / blood
    base = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(base)
    dead = pose.get('dead', -1)
    if dead >= 2:
        a = np.array(img)[..., 3] > 0
        ys, xs = np.nonzero(a)
        x0, x1 = xs.min(), xs.max(); y1 = ys.max(); y0 = max(ys.min(), y1 - 14)
        d.ellipse((x0 - 1, y0 + 2, x1 + 1, y1 + 3), fill=(0, 0, 0, 60))
        if dead == 3:
            hp, _, hx_, hy = scr(rig, 'mouth')
            bc = PAL['blood']
            d.ellipse((hx_ - 7, hy + 1, hx_ + 8, hy + 8), fill=bc[1] + (230,))
            d.ellipse((hx_ - 4, hy + 2, hx_ + 4, hy + 6), fill=bc[2] + (230,))
            d.point((hx_ - 3, hy + 2), fill=bc[0] + (255,))
    else:
        d.ellipse((CX - 10, CY - 3, CX + 10, CY + 3), fill=(0, 0, 0, 70))
    base.alpha_composite(img)
    return base


def render_sheet(key, spec):
    sheet = Image.new('RGBA', (W * 15, H * 4), (0, 0, 0, 0))
    for r, f in enumerate(ROWS):
        for c in range(15):
            sheet.alpha_composite(render_frame(spec, f, c), (c * W, r * H))
    return sheet


# =========================================================================== characters
def side_of(tag):
    return 1 if tag.endswith('L') else -1


def ravil_mat(tag, lp, n, p, pose):
    N = len(lp)
    out = np.full(N, 'jacket', object)
    x, y, z = lp[:, 0], lp[:, 1], lp[:, 2]
    if tag == 'torso':
        front = y > 0.6
        op = np.abs(x) < np.clip(0.8 + (z - 41) * 0.5, 0, 4.6)
        out[front & op & (z > 41)] = 'tee'
        # zip line below opening
        out[front & (np.abs(x) < 0.5) & (z <= 41) & (z > 37.5)] = 'jacket_dk'
        # lanyard straps converging to badge
        for s in (1, -1):
            cx = s * (2.6 - (53.5 - z) * 0.17)
            out[front & (np.abs(x - cx) < 0.45) & (z > 43.5) & (z < 54)] = 'lanyard'
            m = front & (np.abs(x - cx) < 0.45) & (z > 44) & (z < 52) & ((np.floor(z) + (s > 0)) % 2 == 0)
            out[m] = 'green'
        out[(z < 38.6)] = 'jacket_dk'
        out[(z > 52.4) & (np.abs(x) > 2.5)] = 'jacket'
        out[(z > 53.6)] = 'jacket'
    elif tag in ('uarmL', 'uarmR', 'farmL', 'farmR', 'shoulderL', 'shoulderR'):
        if tag.startswith('shoulder'):
            pass
        else:
            ang = np.arctan2(y, x)
            out[np.abs(ang - 0.15) < 0.3] = 'stripe'
            if tag.startswith('farm'):
                out[z > 8.6] = 'jacket_dk'
    elif tag.startswith('hand') or tag in ('ear', 'nose', 'neck'):
        out[:] = 'skin'
    elif tag == 'head':
        out[:] = 'skin'
        out[(z < -1.6) & (y > -1.5)] = 'stubble'
        out[(z < -1.6) & (y > 3.8) & (np.abs(x) < 1.6) & (z > -3.2)] = 'skin'  # lip area lighter
        hairm = (z > 3.3 - 0.15 * np.maximum(y, 0)) | ((y < -1.2) & (z > -2.0))
        out[hairm] = 'hair_brown'
    elif tag == 'hair':
        out[:] = 'hair_brown'
    elif tag.startswith('thigh') or tag.startswith('shin'):
        out[:] = 'jeans'
    elif tag == 'pelvis':
        out[:] = 'jeans'
        out[z > 1.6] = 'jacket_dk'
    elif tag.startswith('foot'):
        out[:] = 'sneaker'
        out[z < -0.6] = 'sole'
    elif tag == 'gun':
        out[:] = 'gun'
    return out


def hair_spikes(seed, n, hc, HR, hr, frame, tag='hair', spread=1.0, fwd=0.35, length=2.6, rad=1.05, zmin=0.25):
    r = rng(seed)
    out = []
    for i in range(n):
        while True:
            v = np.array([r.uniform(-1, 1), r.uniform(-1, 1) + fwd, r.uniform(zmin, 1.3)])
            if np.linalg.norm(v) > 0.3:
                break
        v = nrm(v)
        base = hc + HR @ (v * np.array(hr) * 0.82)
        d = HR @ nrm(v + np.array([0, 0, 0.6]) + np.array([r.uniform(-.3, .3), r.uniform(-.3, .3), 0]))
        L = length * r.uniform(0.75, 1.15)
        out.append(ell(base + d * L * 0.45, (rad, rad, L), tag, M=basis_z(d), frame=frame))
    return out


def ravil_acc(ctx, up, low):
    hc, HR, hr, fr = ctx['hc'], ctx['HR'], ctx['P']['head_r'], ctx['hframe']
    up.append(ell(hc + HR @ np.array([0, -1.5, 2.5]), (hr[0] + 0.4, hr[1] + 0.1, hr[2] - 0.7), 'hair', M=HR, frame=fr))
    up += hair_spikes(7, 16, hc, HR, hr, fr, zmin=0.75, fwd=0.0)
    # collar
    up.append(cyl((0, -0.4, 53.8), 3.3, 2.8, 1.0, 'torso', frame=ctx['tframe']))
    ps = ctx['pose']
    if ps.get('attack') is not None:
        S, E, Wr, d1, d2, h = ctx['arms'][-1]
        M = basis_z(d2, (0, 0, 1))
        up.append(box(h + d2 * 1.6 + M @ np.array([0, 0.6, 0]), (0.65, 1.0, 2.4), 'gun', M=M))
        up.append(box(h + M @ np.array([0, -0.4, 0.4]), (0.6, 1.2, 0.7), 'gun', M=M))
        ctx['muzzle'] = (h + d2 * 4.6 + M @ np.array([0, 0.6, 0]), d2)


def generic_mat(table, extra=None):
    def f(tag, lp, n, p, pose):
        base = tag.rstrip('LR') if tag not in table else tag
        out = np.full(len(lp), table.get(tag, table.get(base, 'rag')), object)
        if extra:
            r = extra(tag, lp, n, p, out)
            if r is not None:
                out = r
        return out
    return f


# ---- raider
def raider_extra(tag, lp, n, p, out):
    x, y, z = lp[:, 0], lp[:, 1], lp[:, 2]
    if tag == 'head':
        out[:] = 'skin_tan'
        out[(z < -1.7) & (y > -0.5)] = 'red'  # bandana over lower face
        out[(z < -1.7) & (z > -2.4) & (y > -0.5)] = 'cloth_wine'
        out[(np.abs(x) < 1.1) & (z > 3.0) & (y < 3.5)] = 'hair_red'
    elif tag == 'torso':
        # leather vest over bare chest with scraps
        out[:] = 'leather'
        out[(y > 0.8) & (np.abs(x) < 0.6 + (z - 44) * 0.3) & (z > 44)] = 'skin_tan'
        nz = noise(lp, 3, 0.7)
        out[(nz < 0.12) & (out == 'leather')] = 'leather_dk'
        out[(z > 45.5) & (z < 46.6) & (y > 0)] = 'leather_dk'  # strap
        out[(z < 38.6)] = 'leather_dk'
        out[(z < 39.4) & (z > 38.0)] = 'metal_dk'
    elif tag.startswith('farm'):
        out[:] = 'skin_tan'
        out[(lp[:, 2] > 5.5) & (lp[:, 2] < 8.5)] = 'leather_dk'  # wrist wraps
    return out


def raider_acc(ctx, up, low):
    hc, HR, hr, fr = ctx['hc'], ctx['HR'], ctx['P']['head_r'], ctx['hframe']
    for i in range(7):
        a = -60 + i * 22
        v = np.array([0, math.sin(math.radians(a)), math.cos(math.radians(a))])
        b = hc + HR @ (v * np.array(hr) * 0.9)
        d = HR @ nrm(v * np.array([1, 0.6, 1]) + np.array([0, 0, 0.4]))
        up.append(ell(b + d * 1.4, (0.9, 1.3, 2.8 - abs(i - 2.5) * 0.25), 'mohawk', M=basis_z(d, (1, 0, 0)), frame=fr))
    for side in (1, -1):
        S = ctx['arms'][side][0]
        up.append(ell(S + np.array([0, 0, 1.0]), (3.0, 3.0, 1.8), 'pad'))
        for k in range(3):
            b = S + np.array([side * (0.6 + k * 0.9), -0.8 + k * 0.8, 2.4])
            up.append(cyl(b + np.array([0, 0, 1.0]), 0.7, 0.0, 1.1, 'spike'))
    if ctx['pose'].get('attack') is not None or True:
        S, E, Wr, d1, d2, h = ctx['arms'][-1]
        M = basis_z(d2, (0, 0, 1))
        up.append(box(h + d2 * 3.2, (0.35, 0.9, 2.4), 'blade', M=M))


# ---- trader
def trader_extra(tag, lp, n, p, out):
    x, y, z = lp[:, 0], lp[:, 1], lp[:, 2]
    if tag == 'head':
        out[:] = 'skin_old'
        out[(z < -1.9) & (y > -1.0)] = 'beard_grey'
        out[(z < -1.9) & (z > -2.6) & (y > 3.6) & (np.abs(x) < 1.6)] = 'hair_grey'
        out[(y < -1.0) & (z > -2.5) & (z < 2.5)] = 'hair_grey'
    elif tag == 'torso':
        out[:] = 'shirt_white'
        vest = (np.abs(x) > 1.6 - (z - 46) * 0.12) | (y < 0)
        out[vest] = 'olive_dk'
        out[(np.abs(x) <= 1.6 - (z - 46) * 0.12) & (y >= 0) & (np.floor(z) % 3 == 0) & (np.abs(x) < 0.5)] = 'metal_dk'
        out[z < 38.4] = 'leather_dk'
    elif tag == 'hat':
        out[:] = 'cloth_wine'
        ang = np.arctan2(y, x)
        orn = (np.floor(ang * 6 / math.pi) % 2 == 0) & (z > -0.9) & (z < 0.1)
        out[orn] = 'gold'
        out[z > 1.0] = 'cloth_wine'
        out[(z > 1.0) & (np.abs(x) < 0.5)] = 'gold'
        out[(z > 1.0) & (np.abs(y) < 0.5)] = 'gold'
    return out


def trader_acc(ctx, up, low):
    hc, HR, hr, fr = ctx['hc'], ctx['HR'], ctx['P']['head_r'], ctx['hframe']
    top = hc + HR @ np.array([0, -0.4, hr[2] - 1.5])
    up.append(cyl(top, hr[0] - 0.3, hr[0] - 0.9, 1.3, 'hat', M=HR, frame=(top, HR)))
    up.append(ell(hc + HR @ np.array([0, 3.0, -4.4]), (3.0, 2.4, 2.8), 'beard', M=HR, frame=fr))
    tf = ctx['tframe']
    up.append(box((0, -5.6, 46), (5.0, 2.2, 5.6), 'pack', frame=tf))
    up.append(box((0, -5.8, 52.5), (4.0, 1.8, 1.4), 'packtop', frame=tf))
    up.append(cyl((0, -5.8, 40), 2.0, 2.0, 4.6, 'roll', M=Ry(90), frame=tf))


# ---- elder
def elder_extra(tag, lp, n, p, out):
    x, y, z = lp[:, 0], lp[:, 1], lp[:, 2]
    if tag == 'head':
        out[:] = 'skin_old'
        face = (y > 1.2) & (np.abs(x) < 3.6) & (z < 2.4) & (z > -4.8)
        out[~face] = 'cloth_wine'
    elif tag in ('scarf',):
        out[:] = 'cloth_wine'
        band = (z < -2.0) & (z > -3.6)
        out[band] = 'gold'
        dots = band & ((np.floor(np.arctan2(y, x) * 6) % 2) == 0)
        out[dots] = 'cloth_cream'
        out[(z > 2.5) & ((np.floor(x * 0.9) + np.floor(y * 0.9)) % 2 == 0) & (np.abs(x) < 2)] = 'gold'
    elif tag == 'torso' or tag == 'dress':
        out[:] = 'cloth_blue'
        if tag == 'dress':
            out[(z < -11) & (z > -13.2)] = 'gold'
            out[(z < -11) & (z > -13.2) & (np.floor(np.arctan2(y, x) * 7) % 2 == 0)] = 'red'
        else:
            out[(y > 0.5) & (np.abs(x) < 1.2) & (z > 45)] = 'cloth_cream'
    return out


def elder_acc(ctx, up, low):
    hc, HR, hr, fr = ctx['hc'], ctx['HR'], ctx['P']['head_r'], ctx['hframe']
    sc = hc + HR @ np.array([0, -1.0, 0.4])
    up.append(ell(sc, (hr[0] + 0.7, hr[1] + 0.2, hr[2] + 0.6), 'scarf', M=HR, frame=(sc, HR)))
    up.append(cyl((0, -1.0, 53.2), 6.4, 4.0, 1.8, 'scarf', frame=(np.array([0, -1, 59.0]), np.eye(3)), ey=0.75))
    # long dress around legs (not following torso lean)
    ps = ctx['pose']
    sway = 0.15 * (ps['legL'][0] + ps['legR'][0]) * 0
    df = (np.array([0, 0, 25.0]), np.eye(3))
    for z0, z1, r0, r1 in ((38, 26, 5.6, 6.6), (26, 14, 6.6, 7.6), (14, 4.5, 7.6, 8.2)):
        low.append(cyl((0, 0.3, (z0 + z1) / 2), r1, r0, (z0 - z1) / 2, 'dress', frame=df, ey=0.72))


# ---- ghoul
def ghoul_extra(tag, lp, n, p, out):
    x, y, z = lp[:, 0], lp[:, 1], lp[:, 2]
    nz = noise(lp, 11, 0.9)
    if tag in ('head', 'neck', 'ear', 'nose') or tag.startswith('hand') or tag.startswith('farm') or tag.startswith('shin'):
        out[:] = 'ghoul'
        out[nz < 0.3] = 'ghoul_raw'
        out[(nz > 0.85)] = 'olive_dk'
        if tag == 'head':
            out[(y > 0) & (z > 3.2) & (nz < 0.5)] = 'ghoul'
    elif tag in ('torso', 'pelvis') or tag.startswith('thigh') or tag.startswith('uarm'):
        out[:] = 'rag_dk'
        out[noise(lp, 4, 0.35) < 0.35] = 'rag'
        out[nz < 0.2] = 'ghoul'
        out[nz < 0.08] = 'ghoul_raw'
    return out


def ghoul_acc(ctx, up, low):
    hc, HR, hr, fr = ctx['hc'], ctx['HR'], ctx['P']['head_r'], ctx['hframe']
    up += hair_spikes(31, 3, hc, HR, hr, fr, tag='wisp', rad=0.5, length=2.2)


# ---- guard
def guard_extra(tag, lp, n, p, out):
    x, y, z = lp[:, 0], lp[:, 1], lp[:, 2]
    if tag == 'head':
        out[:] = 'skin'
        out[(z < -1.6) & (y > 0)] = 'stubble'
    elif tag == 'torso':
        # patchwork plates
        cell = (np.floor((x + 10) / 4.2) + np.floor((z - 30) / 4.6) * 3).astype(int)
        choice = np.array(['metal', 'olive', 'leather', 'metal_dk', 'rust', 'olive'], object)
        out[:] = choice[cell % 6]
        seam = ((x + 10) % 4.2 < 0.6) | ((z - 30) % 4.6 < 0.6)
        out[seam] = 'leather_dk'
        out[z < 38.6] = 'leather_dk'
    elif tag == 'helmet':
        out[:] = 'olive'
        out[z < -0.9] = 'olive_dk'
        out[(np.abs(x) < 0.6) & (y > 0)] = 'olive_dk'
    elif tag == 'pad':
        out[:] = 'metal'
        out[noise(lp, 5, 1.2) < 0.25] = 'rust'
    return out


def guard_acc(ctx, up, low):
    hc, HR, hr, fr = ctx['hc'], ctx['HR'], ctx['P']['head_r'], ctx['hframe']
    hcen = hc + HR @ np.array([0, -0.4, 2.6])
    up.append(ell(hcen, (hr[0] + 0.7, hr[1] + 0.7, hr[2] - 1.6), 'helmet', M=HR, frame=(hcen, HR)))
    up.append(cyl(hc + HR @ np.array([0, -0.1, 1.9]), hr[0] + 1.6, hr[0] + 1.1, 0.4, 'helmet', M=HR,
                  frame=(hcen, HR), ey=1.05))
    for side in (1, -1):
        S = ctx['arms'][side][0]
        up.append(ell(S + np.array([side * 0.6, 0, 1.0]), (3.2, 3.2, 2.2), 'pad'))
    ps = ctx['pose']
    tf = ctx['tframe']
    if ps.get('attack') is not None:
        S, E, Wr, d1, d2, h = ctx['arms'][-1]
        M = basis_z(d2, (0, 0, 1))
        up.append(box(h + d2 * 3.0, (0.7, 1.1, 7.5), 'rifle', M=M))
        up.append(box(h + d2 * 2.5 + M @ np.array([0, -1.0, -4.5]), (0.8, 1.6, 2.4), 'stock', M=M))
        ctx['muzzle'] = (h + d2 * 11.0, d2)
    else:
        Rr = Ry(35)
        up.append(box((0, -4.6, 45), (0.8, 1.0, 9.0), 'rifle', M=Rr, frame=tf))
        up.append(box((0, -4.6, 45) + Rr @ np.array([0, 0, -7.0]), (1.0, 1.4, 2.4), 'stock', M=Rr, frame=tf))


SPECS = {
    'ravil': dict(mat=ravil_mat, acc=ravil_acc, attack='pistol', eyes='glasses',
                  prop=dict(torso=[(37.0, 4.8), (43.0, 5.7), (48.5, 6.6), (52.0, 6.6)], r_thigh=(2.5, 1.9), r_shin=(1.9, 1.5))),
    'raider': dict(mat=generic_mat({'torso': 'leather', 'pelvis': 'leather_dk', 'thigh': 'leather_dk', 'shin': 'leather_dk',
                                    'foot': 'boot', 'uarm': 'skin_tan', 'farm': 'skin_tan', 'hand': 'skin_tan', 'shoulder': 'leather',
                                    'neck': 'skin_tan', 'ear': 'skin_tan', 'nose': 'skin_tan', 'mohawk': 'hair_red', 'pad': 'leather_dk',
                                    'spike': 'metal', 'blade': 'metal'}, raider_extra),
                   acc=raider_acc, attack='melee', mouth=False,
                   prop=dict(torso=[(37.0, 5.2), (43.0, 6.4), (48.5, 7.4), (52.0, 7.2)], r_uarm=(2.2, 1.9), r_farm=(1.9, 1.5))),
    'trader': dict(mat=generic_mat({'torso': 'shirt_white', 'pelvis': 'khaki', 'thigh': 'khaki', 'shin': 'khaki', 'foot': 'boot',
                                    'uarm': 'shirt_white', 'farm': 'shirt_white', 'hand': 'skin_old', 'shoulder': 'olive_dk',
                                    'neck': 'skin_old', 'ear': 'skin_old', 'nose': 'skin_old', 'beard': 'beard_grey', 'pack': 'canvas',
                                    'packtop': 'leather', 'roll': 'cloth_cream', 'hat': 'cloth_wine'}, trader_extra),
                   acc=trader_acc, attack='punch', mouth=False,
                   prop=dict(torso=[(37.0, 6.0), (43.0, 7.0), (48.5, 7.2), (52.0, 6.8)], belly=1.6, hunch=4, wscale=1.12)),
    'elder': dict(mat=generic_mat({'torso': 'cloth_blue', 'pelvis': 'cloth_blue', 'thigh': 'cloth_blue', 'shin': 'cloth_blue',
                                   'foot': 'boot', 'uarm': 'cloth_blue', 'farm': 'cloth_blue', 'hand': 'skin_old', 'shoulder': 'cloth_blue',
                                   'neck': 'skin_old', 'ear': 'skin_old', 'nose': 'skin_old', 'scarf': 'cloth_wine', 'dress': 'cloth_blue'},
                                  elder_extra),
                  acc=elder_acc, attack='punch',
                  prop=dict(hunch=9, head_z=59.5, sh_z=50.5, torso=[(37.0, 5.4), (43.0, 5.8), (48.0, 6.2), (50.5, 6.0)],
                            r_uarm=(1.8, 1.5), r_farm=(1.5, 1.2), thigh=15.0, shin=14.5, foot=(1.5, 2.6, 1.3))),
    'ghoul': dict(mat=generic_mat({'wisp': 'hair_grey', 'foot': 'rag_dk', 'shoulder': 'rag'}, ghoul_extra),
                  acc=ghoul_acc, attack='claw', eye_col=(226, 214, 120), mouth_col=(40, 26, 20), mouth_wide=True,
                  prop=dict(hunch=12, torso=[(37.0, 4.4), (43.0, 5.2), (48.5, 6.0), (52.0, 6.0)],
                            r_thigh=(2.1, 1.6), r_shin=(1.6, 1.2), r_uarm=(1.6, 1.3), r_farm=(1.3, 1.1), head_r=(4.8, 5.2, 5.8))),
    'guard': dict(mat=generic_mat({'torso': 'metal', 'pelvis': 'olive_dk', 'thigh': 'olive_dk', 'shin': 'olive_dk', 'foot': 'boot',
                                   'uarm': 'olive', 'farm': 'olive', 'hand': 'leather_dk', 'shoulder': 'olive', 'neck': 'skin',
                                   'ear': 'skin', 'nose': 'skin', 'helmet': 'olive', 'pad': 'metal', 'rifle': 'gun', 'stock': 'wood'},
                                  guard_extra),
                  acc=guard_acc, attack='rifle',
                  prop=dict(torso=[(37.0, 5.4), (43.0, 6.6), (48.5, 7.4), (52.0, 7.2)], r_thigh=(2.8, 2.2), r_shin=(2.2, 1.8))),
}


def main(only=None):
    for k, spec in SPECS.items():
        if only and k not in only:
            continue
        sheet = render_sheet(k, spec)
        set_elev(30)
        print('wrote', save(sheet, 'sprites', f'{k}.png'))


if __name__ == '__main__':
    main(sys.argv[1:] or None)
