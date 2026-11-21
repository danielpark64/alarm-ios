#!/usr/bin/env python3
"""언어별 6장을 가로 한 줄로 모은 축소 미리보기를 만든다."""
import os
from PIL import Image
R = "store-assets/store-shots"
LANGS = ["ko", "en", "ja", "zh-Hans", "zh-Hant", "es", "fr", "de", "pt"]
os.makedirs(R + "/preview", exist_ok=True)
for kind, langs, w in [("play", LANGS, 2400), ("iphone63", ["ko", "de", "ja"], 2400), ("ipad13", ["ko", "de", "ja"], 2400)]:
    for lang in langs:
        d = "%s/%s/%s" % (R, kind, lang)
        fs = sorted(f for f in os.listdir(d) if f.endswith(".png"))
        cw = w // 6
        ims = [Image.open(os.path.join(d, f)) for f in fs]
        ims = [im.resize((cw - 8, round(im.height * (cw - 8) / im.width)), Image.LANCZOS) for im in ims]
        sheet = Image.new("RGB", (w, max(i.height for i in ims) + 8), (255, 255, 255))
        for i, im in enumerate(ims):
            sheet.paste(im, (i * cw + 4, 4))
        sheet.save("%s/preview/%s-%s.png" % (R, lang, kind))
