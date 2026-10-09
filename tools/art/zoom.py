"""debug: zoom.py sheet.png out.png scale [x y w h]"""
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGBA')
s = int(sys.argv[3])
if len(sys.argv) > 4:
    x, y, w, h = map(int, sys.argv[4:8]); im = im.crop((x, y, x + w, y + h))
bg = Image.new('RGBA', im.size, (120, 104, 80, 255)); bg.alpha_composite(im)
bg.resize((im.width * s, im.height * s), Image.NEAREST).save(sys.argv[2])
