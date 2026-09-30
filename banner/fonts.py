# One-time step: turn the design system's woff2 fonts into TTF for render.mjs.
#   pip install fonttools brotli && python3 fonts.py
import os
from fontTools.ttLib import TTFont

SRC, DST = "design/fonts", "design/fonts-ttf"
os.makedirs(DST, exist_ok=True)
for name in sorted(os.listdir(SRC)):
    if name.endswith(".woff2"):
        font = TTFont(os.path.join(SRC, name))
        font.flavor = None
        font.save(os.path.join(DST, name[:-6] + ".ttf"))
        print("wrote", os.path.join(DST, name[:-6] + ".ttf"))
