"""Tiny orthographic ray-caster used as a 'drawing aid' for pixel art.

Shapes (ellipsoids, boxes, frusta) are posed in 3D, cast at 1 px per ray, then
flat-shaded with a quantised 4-step palette, depth-edge lines and a 1 px dark
outline, so the result reads like hand-placed pixel clusters rather than a render.

World axes: X = screen right, Y = toward viewer (ground), Z = up.
Camera is ~30 deg above ground (Fallout-ish), so ground depth is squashed 0.5.
"""
import math
import numpy as np
from PIL import Image

ELEV = math.radians(30)
UX = np.array([1.0, 0.0, 0.0])
WY = np.array([0.0, -math.sin(ELEV), math.cos(ELEV)])     # screen up
VD = np.array([0.0, -math.cos(ELEV), -math.sin(ELEV)])    # view direction (into scene)
CV = -VD                                                   # toward camera


def set_elev(deg):
    """change camera elevation in place (arrays are shared by importers)"""
    e = math.radians(deg)
    WY[:] = [0.0, -math.sin(e), math.cos(e)]
    VD[:] = [0.0, -math.cos(e), -math.sin(e)]
    CV[:] = -VD


def nrm(v):
    v = np.asarray(v, float)
    return v / np.linalg.norm(v)


LIGHT = nrm([-0.6, 0.55, 0.8])  # top-left, slightly from viewer


def Rx(d):
    a = math.radians(d); c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]], float)


def Ry(d):
    a = math.radians(d); c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]], float)


def Rz(d):
    a = math.radians(d); c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], float)


def basis_z(direction, side=(1, 0, 0)):
    """Rotation whose local z points along `direction`, x as close to `side` as possible."""
    z = nrm(direction)
    x = np.asarray(side, float) - np.dot(side, z) * z
    if np.linalg.norm(x) < 1e-6:
        x = np.array([0, 1.0, 0]) - z[1] * z
    x = nrm(x)
    y = np.cross(z, x)
    return np.stack([x, y, z], axis=1)


class Prim:
    """kind: 'ell' size=(rx,ry,rz) | 'box' size=(hx,hy,hz) | 'cyl' size=(r_bottom, r_top, half_h).
    frame=(origin, M) gives the coordinate system passed to the material function."""

    def __init__(self, kind, c, M, size, tag, frame=None, **data):
        self.kind, self.c, self.M = kind, np.asarray(c, float), np.asarray(M, float)
        self.size = np.asarray(size, float)
        self.Mi = np.linalg.inv(self.M)
        self.tag = tag
        self.frame = frame if frame is not None else (self.c, self.M)
        self.data = data

    def xf(self, R, t):
        t = np.asarray(t, float)
        fo, fM = self.frame
        p = Prim(self.kind, R @ self.c + t, R @ self.M, self.size, self.tag,
                 (R @ np.asarray(fo, float) + t, R @ np.asarray(fM, float)), **self.data)
        return p


def ell(c, r, tag, M=np.eye(3), frame=None, **kw):
    return Prim('ell', c, M, r, tag, frame, **kw)


def box(c, h, tag, M=np.eye(3), frame=None, **kw):
    return Prim('box', c, M, h, tag, frame, **kw)


def cyl(c, rb, rt, hh, tag, M=np.eye(3), frame=None, **kw):
    return Prim('cyl', c, M, (rb, rt, hh), tag, frame, **kw)


def capsule(a, b, ra, rb, tag, side=(1, 0, 0), frame=None, ends=True, **kw):
    """Tapered capsule from a to b. Frame default: origin a, z along limb."""
    a = np.asarray(a, float); b = np.asarray(b, float)
    L = np.linalg.norm(b - a)
    M = basis_z(b - a, side)
    fr = frame if frame is not None else (a, M)
    out = [Prim('cyl', (a + b) / 2, M, (ra, rb, L / 2), tag, fr, **kw)]
    if ends:
        out.append(Prim('ell', a, M, (ra, ra, ra), tag, fr, **kw))
        out.append(Prim('ell', b, M, (rb, rb, rb), tag, fr, **kw))
    return out


def project(p, cx, cy, scale=1.0):
    p = np.asarray(p, float)
    return cx + scale * float(p @ UX), cy - scale * float(p @ WY)


# ---------------------------------------------------------------- intersection
def _ell(p, Q, d):
    r = p.size
    o = ((Q - p.c) @ p.Mi.T) / r
    dl = (d @ p.Mi.T) / r
    a = dl @ dl
    b = 2 * (o @ dl)
    cc = (o * o).sum(1) - 1
    disc = b * b - 4 * a * cc
    t = (-b - np.sqrt(np.maximum(disc, 0))) / (2 * a)
    t = np.where(disc >= 0, t, np.inf)
    loc = o + np.where(np.isfinite(t), t, 0)[:, None] * dl
    n = (loc / r) @ p.Mi
    return t, n


def _box(p, Q, d):
    h = p.size
    o = (Q - p.c) @ p.Mi.T
    dl = d @ p.Mi.T
    dl = np.where(np.abs(dl) < 1e-9, 1e-9, dl)
    t1 = (-h - o) / dl
    t2 = (h - o) / dl
    tn = np.minimum(t1, t2); tf = np.maximum(t1, t2)
    tmin = tn.max(1); tmax = tf.min(1)
    t = np.where(tmin <= tmax, tmin, np.inf)
    ax = tn.argmax(1)
    nl = np.zeros_like(o)
    nl[np.arange(len(o)), ax] = -np.sign(dl[ax])
    return t, nl @ p.Mi


def _cyl(p, Q, d):
    rb, rt, hh = p.size
    r0 = (rb + rt) / 2; k = (rt - rb) / (2 * hh)
    ey = p.data.get('ey', 1.0)
    o = (Q - p.c) @ p.Mi.T
    dl = d @ p.Mi.T
    o = o / np.array([1.0, ey, 1.0]); dl = dl / np.array([1.0, ey, 1.0])
    ox, oy, oz = o[:, 0], o[:, 1], o[:, 2]
    dx, dy, dz = dl
    rz = r0 + k * oz
    A = dx * dx + dy * dy - k * k * dz * dz
    B = 2 * (ox * dx + oy * dy - k * rz * dz)
    C = ox * ox + oy * oy - rz * rz
    best = np.full(len(o), np.inf)
    nl = np.zeros_like(o)
    if abs(A) > 1e-9:
        disc = B * B - 4 * A * C
        sq = np.sqrt(np.maximum(disc, 0))
        for sgn in (-1, 1):
            t = (-B + sgn * sq) / (2 * A)
            z = oz + t * dz
            ok = (disc >= 0) & (np.abs(z) <= hh) & (r0 + k * z >= 0) & (t < best)
            best = np.where(ok, t, best)
            px, py = ox + t * dx, oy + t * dy
            n = np.stack([px, py, -k * (r0 + k * z)], 1)
            nl = np.where(ok[:, None], n, nl)
    if abs(dz) > 1e-9:
        for zc, rc, nz in ((hh, rt, 1.0), (-hh, rb, -1.0)):
            t = (zc - oz) / dz
            px, py = ox + t * dx, oy + t * dy
            ok = (px * px + py * py <= rc * rc) & (t < best)
            best = np.where(ok, t, best)
            nl = np.where(ok[:, None], np.array([0, 0, nz]), nl)
    nl = nl / np.array([1.0, ey, 1.0])
    return best, nl @ p.Mi


_FN = {'ell': _ell, 'box': _box, 'cyl': _cyl}


def raycast(prims, w, h, cx, cy, scale=1.0):
    ys, xs = np.mgrid[0:h, 0:w]
    a = ((xs + 0.5) - cx) / scale
    b = -((ys + 0.5) - cy) / scale
    Q = (a[..., None] * UX + b[..., None] * WY + 1000 * CV).reshape(-1, 3)
    bt = np.full(len(Q), np.inf)
    bi = np.full(len(Q), -1)
    bn = np.zeros_like(Q)
    for i, p in enumerate(prims):
        t, n = _FN[p.kind](p, Q, VD)
        m = t < bt
        bt[m] = t[m]; bi[m] = i; bn[m] = n[m]
    ln = np.linalg.norm(bn, axis=1, keepdims=True)
    bn = bn / np.where(ln > 0, ln, 1)
    P = Q + np.where(np.isfinite(bt), bt, 0)[:, None] * VD
    return dict(w=w, h=h, t=bt.reshape(h, w), idx=bi.reshape(h, w), n=bn.reshape(h, w, 3),
                P=P.reshape(h, w, 3), prims=prims, cx=cx, cy=cy, scale=scale)


BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


def shade(res, matfn, pal, thresholds=(0.55, 0.12, -0.3), dither=0.0, edge=3.0,
          outline=(22, 17, 13, 255), edge_steps=1, light=LIGHT, edge_by_tag=False):
    """matfn(tag, local_pts(N,3), normals(N,3), prim) -> material name or array of names.
    pal: name -> list of 4 RGB tuples (light..dark). Names starting with '!' are unlit (shade 1),
    '!!' fully bright (shade 0). Returns RGBA PIL image and the material/shade buffers."""
    h, w = res['h'], res['w']
    idx, n, P, prims = res['idx'], res['n'], res['P'], res['prims']
    out = np.zeros((h, w, 4), np.uint8)
    mats = np.full((h, w), '', object)
    hit = idx >= 0
    for i in np.unique(idx[hit]):
        p = prims[i]
        m = idx == i
        fo, fM = p.frame
        lp = (P[m] - fo) @ fM
        r = matfn(p.tag, lp, n[m], p)
        mats[m] = r
    I = (n @ light)
    if dither:
        by = np.tile(BAYER4, (h // 4 + 1, w // 4 + 1))[:h, :w]
        I = I + (by - 0.5) * dither
    sh = np.full((h, w), 3)
    for k, th in enumerate(thresholds):
        sh = np.where((I > th) & (sh == 3), k, sh)
    # depth-edge internal lines: pixel behind a nearer neighbour gets darker
    t = np.where(hit, res['t'], np.inf)
    tagid = np.full((h, w), -1)
    if edge_by_tag:
        names = {}
        for i in np.unique(idx[hit]):
            tagid[idx == i] = names.setdefault(prims[i].tag, len(names))
    behind = np.zeros((h, w), bool)
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        nb = np.full((h, w), np.inf)
        ys = slice(max(dy, 0), h + min(dy, 0)); yd = slice(max(-dy, 0), h + min(-dy, 0))
        xs = slice(max(dx, 0), w + min(dx, 0)); xd = slice(max(-dx, 0), w + min(-dx, 0))
        nb[yd, xd] = t[ys, xs]
        tb = np.full((h, w), -2); tb[yd, xd] = tagid[ys, xs]
        with np.errstate(invalid="ignore"):
            jump = hit & (t - nb > edge)
            if edge_by_tag:
                jump &= (tb != tagid) | (t - nb > edge * 4)
            behind |= jump
    sh = np.where(behind, np.minimum(sh + edge_steps, 3), sh)
    for y in range(h):
        for x in range(w):
            mname = mats[y, x]
            if not mname:
                continue
            if mname.startswith('!!'):
                col = pal[mname[2:]][0]
            elif mname.startswith('!'):
                col = pal[mname[1:]][1]
            elif mname == '_':
                continue  # discard
            else:
                col = pal[mname][sh[y, x]]
            out[y, x, :3] = col
            out[y, x, 3] = 255
    img = Image.fromarray(out, 'RGBA')
    if outline:
        img = add_outline(img, outline)
    return img, mats, sh


def add_outline(img, col=(22, 17, 13, 255), diag=False):
    a = np.array(img)
    op = a[..., 3] > 0
    h, w = op.shape
    ring = np.zeros_like(op)
    dirs = [(0, 1), (0, -1), (1, 0), (-1, 0)]
    if diag:
        dirs += [(1, 1), (1, -1), (-1, 1), (-1, -1)]
    for dy, dx in dirs:
        sh = np.zeros_like(op)
        sh[max(dy, 0):h + min(dy, 0), max(dx, 0):w + min(dx, 0)] = op[max(-dy, 0):h + min(-dy, 0), max(-dx, 0):w + min(-dx, 0)]
        ring |= sh
    ring &= ~op
    a[ring] = col
    return Image.fromarray(a, 'RGBA')


def visible(res, p, normal, tol=1.5):
    """Is world point p (with outward normal) visible and not occluded?"""
    if np.dot(normal, CV) <= 0.05:
        return False
    sx, sy = project(p, res['cx'], res['cy'], res['scale'])
    x, y = int(math.floor(sx)), int(math.floor(sy))
    if not (0 <= x < res['w'] and 0 <= y < res['h']):
        return False
    hp = res['P'][y, x]
    return float(np.dot(hp - p, VD)) > -tol
