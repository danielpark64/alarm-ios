#!/usr/bin/env python3
"""파노라마 7장 세트 확인용 미리보기: 언어·종류마다 7장을 사이 간격 없이 나란히(1·2번 장 이음매 확인용) 붙인 JPEG.
→ store-assets/store-shots/pano7/preview/<kind>-<lang>.jpg (높이 900px)
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R = os.path.join(ROOT, "store-assets/store-shots/pano7")
LANGS = ["ko", "en", "ja", "zh-Hans", "zh-Hant", "es", "fr", "de", "pt"]
H = 900
os.makedirs(os.path.join(R, "preview"), exist_ok=True)
for kind in ("play", "iphone63", "ipad13"):
    for lang in LANGS:
        d = os.path.join(R, kind, lang)
        fs = sorted(f for f in os.listdir(d) if f.endswith(".png"))
        ims = [Image.open(os.path.join(d, f)).convert("RGB") for f in fs]
        ims = [im.resize((round(im.width * H / im.height), H), Image.LANCZOS) for im in ims]
        gap = 12
        sheet = Image.new("RGB", (sum(i.width for i in ims) + gap * (len(ims) - 2), H), (0x2A, 0x2A, 0x2C))
        x = 0
        for n, im in enumerate(ims):
            sheet.paste(im, (x, 0))
            # 1·2번 장은 붙여서(파노라마가 이어지는지 보이게), 나머지는 간격을 둔다
            x += im.width + (0 if n == 0 else gap)
        sheet.save(os.path.join(R, "preview", "%s-%s.jpg" % (kind, lang)), quality=88)
        print("미리보기:", kind, lang, len(fs), "장")
