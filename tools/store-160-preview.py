#!/usr/bin/env python3
"""1.6.0 시안 모아 보기: 종류(Play·아이폰)마다 8장을 한 줄로(1·2번 장은 붙여서 이음매 확인), 두 줄을 한 장에.
사용: python3 tools/store-160-preview.py <시안 폴더> [언어]  → <시안 폴더>/미리보기-<언어>.jpg
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont
base, lang = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "ko")
H, gap, pad = 900, 14, 30
f = ImageFont.truetype("/System/Library/Fonts/AppleSDGothicNeo.ttc", 34, index=6)
rows = []
for kind, label in (("play", "Play 1350×2400"), ("iphone63", "아이폰 6.3 1206×2622")):
    d = os.path.join(base, kind, lang)
    fs = sorted(x for x in os.listdir(d) if x.endswith(".png"))
    ims = [Image.open(os.path.join(d, x)).convert("RGB") for x in fs]
    ims = [im.resize((round(im.width * H / im.height), H), Image.LANCZOS) for im in ims]
    rows.append((label, ims))
W = max(sum(i.width for i in ims) + gap * (len(ims) - 2) for _, ims in rows) + 2 * pad
sheet = Image.new("RGB", (W, len(rows) * (H + 70) + pad), (0x2A, 0x2A, 0x2C))
dr = ImageDraw.Draw(sheet)
y = pad
for label, ims in rows:
    dr.text((pad, y), label, font=f, fill=(230, 230, 230))
    y += 50
    x = pad
    for n, im in enumerate(ims):
        sheet.paste(im, (x, y))
        x += im.width + (0 if n == 0 else gap)
    y += H + 20
out = os.path.join(base, "미리보기-%s.jpg" % lang)
sheet.save(out, quality=88)
print(out, sheet.size)
