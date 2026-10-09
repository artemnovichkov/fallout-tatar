"""Shared palette + helpers. Muted Fallout-2-ish colours, 4 shades each (light -> dark)."""
import os
import random
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'assets')
OUTLINE = (22, 17, 13, 255)


def hx(s):
    s = s.lstrip('#')
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def ramp(*cols):
    return [hx(c) for c in cols]


PAL = {
    # skin
    'skin': ramp('#e0bb94', '#c4977a', '#9a6c52', '#6a4636'),
    'skin_old': ramp('#d6b496', '#b8927a', '#8e6a56', '#5e4438'),
    'skin_tan': ramp('#c99a70', '#a87a58', '#7e5640', '#54382a'),
    'stubble': ramp('#a8866c', '#8c6c58', '#6c5040', '#48342a'),
    'ghoul': ramp('#a8ad78', '#868c5c', '#626844', '#40452e'),
    'ghoul_raw': ramp('#b47a62', '#91574a', '#6a3a34', '#452424'),
    'lip': ramp('#b07a68', '#946054', '#744438', '#4e2c24'),
    'eye': ramp('#2a1e18', '#2a1e18', '#1a1210', '#1a1210'),
    # hair
    'hair_brown': ramp('#6e4c34', '#523626', '#3a261a', '#26180f'),
    'hair_grey': ramp('#b4aea2', '#948e84', '#706a62', '#4c4842'),
    'hair_red': ramp('#b04a30', '#8c3424', '#66241a', '#421810'),
    'beard_grey': ramp('#c2baa8', '#a09888', '#7a7266', '#544e46'),
    # ravil
    'jacket': ramp('#a2a3a2', '#838584', '#646767', '#45484a'),
    'jacket_dk': ramp('#77797a', '#5e6162', '#47494b', '#323436'),
    'stripe': ramp('#e6e2d6', '#c8c4b8', '#a29e94', '#7a766e'),
    'tee': ramp('#cdc4cc', '#aea4b0', '#8a808e', '#625a66'),
    'lanyard': ramp('#3a3a38', '#2a2a28', '#1e1e1c', '#141412'),
    'green': ramp('#7cd06a', '#58ae4e', '#3e8638', '#2a5c26'),
    'jeans': ramp('#5e6578', '#474e60', '#353a4a', '#242834'),
    'sneaker': ramp('#dcd8cc', '#bcb8ac', '#949086', '#6a665e'),
    'sole': ramp('#5a5650', '#44403c', '#322f2c', '#22201e'),
    'frames': ramp('#9a6230', '#74461e', '#523012', '#36200c'),
    # generic cloth / leather / metal
    'leather': ramp('#8a6440', '#6c4c30', '#4e3622', '#342416'),
    'leather_dk': ramp('#5e4430', '#4a3424', '#36261a', '#241810'),
    'rag': ramp('#9a8c70', '#7c6e56', '#5c5040', '#3e362c'),
    'rag_dk': ramp('#6c6250', '#544c3e', '#3e382e', '#2a2620'),
    'red': ramp('#b04a36', '#8e3428', '#6a241e', '#461814'),
    'olive': ramp('#8a8a5a', '#6c6e44', '#525432', '#383a22'),
    'olive_dk': ramp('#626444', '#4c4e34', '#383a26', '#26281a'),
    'khaki': ramp('#b4a47c', '#968660', '#746648', '#504632'),
    'cloth_blue': ramp('#6a7a8a', '#52606e', '#3e4854', '#2a323a'),
    'cloth_wine': ramp('#8c4a4a', '#703838', '#542828', '#3a1c1c'),
    'cloth_cream': ramp('#d2c6a8', '#b2a68a', '#8c826a', '#62594a'),
    'shirt_white': ramp('#d4ccb8', '#b4ac9a', '#8e8878', '#646054'),
    'gold': ramp('#e0c070', '#b8964a', '#8a6c30', '#5a441c'),
    'metal': ramp('#a8a8a0', '#86867e', '#64645e', '#44443e'),
    'metal_dk': ramp('#6e6e6a', '#545450', '#3e3e3a', '#2a2a28'),
    'rust': ramp('#a8643a', '#88482a', '#66341e', '#442214'),
    'wood': ramp('#9a7650', '#7a5a3a', '#5a4028', '#3c2a1a'),
    'wood_dk': ramp('#6a5038', '#523c2a', '#3c2c1e', '#281c12'),
    'boot': ramp('#5a4634', '#463628', '#34281e', '#221a14'),
    'gun': ramp('#6a6a68', '#4a4a4a', '#343434', '#222222'),
    'flash': ramp('#fff4c0', '#ffd860', '#ff9a30', '#c05a20'),
    'blood': ramp('#7a2018', '#5e1810', '#46120c', '#300c08'),
    # environment
    'stone': ramp('#b0a490', '#928672', '#726854', '#504838'),
    'stone_dk': ramp('#857a68', '#6a604f', '#504839', '#363026'),
    'brick': ramp('#a8604a', '#8a4a38', '#6a3628', '#48241a'),
    'brick_dk': ramp('#7e4434', '#643426', '#4a261c', '#321812'),
    'mortar': ramp('#b8aa94', '#9a8c78', '#786c5c', '#544c40'),
    'white_stone': ramp('#e2dccc', '#c8c0ae', '#a29a8a', '#7a7466'),
    'green_roof': ramp('#7aa07a', '#5a805e', '#426046', '#2c4230'),
    'concrete': ramp('#a29e94', '#868278', '#68645c', '#4a4842'),
    'rock': ramp('#8e8472', '#706858', '#544e42', '#38342c'),
    'canvas': ramp('#bcaa86', '#9e8c6a', '#7a6c50', '#564c38'),
    'felt': ramp('#cfc3a4', '#b0a486', '#8c8268', '#645c4a'),
    'fire': ramp('#fff0a0', '#ffc040', '#f07a20', '#b04010'),
    'ash': ramp('#5a5450', '#46423e', '#34312e', '#24221f'),
    'glass': ramp('#9ab0a8', '#6e8a84', '#4e6662', '#344644'),
    'lamp': ramp('#fff2b0', '#f0d070', '#c8a040', '#8a6a24'),
    'carpet_red': ramp('#a84838', '#8a3428', '#6a261e', '#4a1a14'),
    'oil': ramp('#3a3632', '#2a2724', '#1e1c1a', '#141210'),
    'vault': ramp('#b0a878', '#8e8658', '#6c6640', '#4a462c'),
    'vault_blue': ramp('#6a86a0', '#4e6a84', '#3a5066', '#283848'),
    'yellow': ramp('#d8b848', '#b49434', '#8a7024', '#5e4c18'),
}


def rng(seed):
    return random.Random(seed)


def save(img, *rel):
    path = os.path.join(OUT, *rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)
    return path


def hex_mask(w=50, h=26):
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).polygon([(w * 0.25, 0), (w * 0.75, 0), (w, h / 2), (w * 0.75, h), (w * 0.25, h), (0, h / 2)], fill=255)
    return np.array(m) > 0


def shade_of(name, i):
    return PAL[name][max(0, min(3, i))]
