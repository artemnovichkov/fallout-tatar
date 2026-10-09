"""Contact sheet of the v2 assets (3x nearest). usage: preview_v2.py out.png"""
import os
import sys
from PIL import Image

A = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'assets')
CHARS = ['dweller', 'overseer', 'robot', 'rat', 'shurale', 'settler']
TILES = ['metal', 'grate']
OBJS = ['wall_vault', 'terminal', 'purifier', 'reactor', 'pipes', 'table', 'shelf', 'desk', 'pole']
PORTS = ['overseer', 'dweller', 'robot', 'shurale', 'settler']
N_OLD_ICONS = 18


def L(*p):
    return Image.open(os.path.join(A, *p)).convert('RGBA')


def main(out):
    W = 15 * 48
    sheet = Image.new('RGBA', (W, 3000), (52, 46, 36, 255))
    y = 0
    for k in CHARS:  # full 4-row sheets
        s = L('sprites', f'{k}.png'); sheet.alpha_composite(s, (0, y)); y += s.height + 4
    # tiles: 5x4 patch each, plus a vault-wall run on metal floor
    for i, t in enumerate(TILES):
        tile = L('tiles', f'{t}.png')
        for c in range(5):
            for r in range(4):
                sheet.alpha_composite(tile, (i * 200 + c * 36, y + r * 24 + (c % 2) * 12))
    metal = L('tiles', 'metal.png'); wall = L('sprites', 'obj_wall_vault.png')
    ox = 420
    for c in range(7):
        for r in range(4):
            sheet.alpha_composite(metal, (ox + c * 36, y + 70 + r * 24 + (c % 2) * 12))
    # L-shaped wall run: hex centres; draw back-to-front
    cells = [(0, 0), (1, 0), (2, 0), (3, 0), (4, 0), (4, 1), (4, 2)]
    cells.sort(key=lambda cr: cr[1] * 24 + (cr[0] % 2) * 12)
    for c, r in cells:
        cx = ox + c * 36 + 25; cy = y + 70 + r * 24 + (c % 2) * 12 + 13
        sheet.alpha_composite(wall, (cx - wall.width // 2, cy + 12 - wall.height))
    y += 190
    x = 4; base = y + 160
    for k in OBJS:
        o = L('sprites', f'obj_{k}.png')
        cx = x + max(o.width, 50) // 2
        sheet.alpha_composite(metal, (cx - 25, base - 13))
        sheet.alpha_composite(o, (cx - o.width // 2, base + 12 - o.height))
        x += max(o.width, 50) + 6
    y = base + 22
    ic = L('ui', 'icons.png')
    new = ic.crop((N_OLD_ICONS * 32, 0, ic.width, 32))
    sheet.alpha_composite(new, (0, y)); y += 40
    for i, p in enumerate(PORTS):
        path = os.path.join(A, 'portraits', f'portrait_{p}.png')
        if os.path.exists(path):
            sheet.alpha_composite(L('portraits', f'portrait_{p}.png'), ((i % 4) * 172, y + (i // 4) * 164))
    y += 328
    sheet = sheet.crop((0, 0, W, y))
    sheet.resize((W * 3, y * 3), Image.NEAREST).save(out)
    print('preview', out)


if __name__ == '__main__':
    main(sys.argv[1])
