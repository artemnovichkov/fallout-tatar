"""Contact sheet of all generated assets (3x nearest). usage: preview.py out.png"""
import os
import sys
from PIL import Image, ImageDraw

A = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'assets')
CHARS = ['ravil', 'raider', 'trader', 'elder', 'ghoul', 'guard']
TILES = ['sand', 'asphalt', 'rubble', 'grass', 'water', 'floor', 'carpet']
OBJS = ['wall_stone', 'wall_brick', 'wall_kremlin', 'tower_syuyumbike', 'tree_dead', 'barrel', 'crate', 'car_wreck',
        'vault_door', 'tent', 'campfire', 'derrick', 'lamp_post', 'counter', 'bed', 'locker']
PORTS = ['ravil', 'trader', 'elder', 'raider', 'ghoul', 'guard']


def L(*p):
    return Image.open(os.path.join(A, *p)).convert('RGBA')


def main(out):
    W = 15 * 48
    sheet = Image.new('RGBA', (W, 2000), (52, 46, 36, 255))
    y = 0
    # Ravil full sheet, others: one row each (S facing, all 15 frames) + SE walk
    rv = L('sprites', 'ravil.png'); sheet.alpha_composite(rv, (0, y)); y += rv.height
    for k in CHARS[1:]:
        s = L('sprites', f'{k}.png')
        sheet.alpha_composite(s.crop((0, 0, W, 80)), (0, y)); y += 80
    y += 6
    # tiles in a hex patch each + objects on sand
    for i, t in enumerate(TILES):
        tile = L('tiles', f'{t}.png')
        for c in range(3):
            for r in range(3):
                sheet.alpha_composite(tile, (i * 102 + c * 36, y + r * 24 + (c % 2) * 12))
    y += 96
    sand = L('tiles', 'sand.png')
    x = 4; base = y + 190
    for k in OBJS:
        o = L('sprites', f'obj_{k}.png')
        if x + max(o.width, 40) > W:
            x = 4; base += 100
        cx = x + max(o.width, 40) // 2
        sheet.alpha_composite(sand, (cx - 25, base - 13))
        sheet.alpha_composite(o, (cx - o.width // 2, base + 12 - o.height))
        x += max(o.width, 40) + 4
    y = base + 20
    ic = L('ui', 'icons.png'); sheet.alpha_composite(ic, (0, y)); y += 36
    for i, p in enumerate(PORTS):
        sheet.alpha_composite(L('portraits', f'portrait_{p}.png'), ((i % 4) * 172, y + (i // 4) * 164))
    y += 328
    sheet = sheet.crop((0, 0, W, y))
    sheet.resize((W * 3, y * 3), Image.NEAREST).save(out)
    print('preview', out)


if __name__ == '__main__':
    main(sys.argv[1])
