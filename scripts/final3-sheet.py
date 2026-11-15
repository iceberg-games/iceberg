# python3 scripts/final3-sheet.py out.png cols tile a.png b.png ...   (contact sheet helper for final3 screenshots)
import sys
from PIL import Image
out, cols, tile = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]); files = sys.argv[4:]
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tile, rows * tile), 'white')
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB'); im.thumbnail((tile, tile)); sheet.paste(im, ((i % cols) * tile, (i // cols) * tile))
sheet.save(out)
