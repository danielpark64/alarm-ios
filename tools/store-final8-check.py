#!/usr/bin/env python3
"""최종 8장 세트 점검 + 미리보기.
- 장마다 크기(1080x1920 / 1206x2622 / 2064x2752)·RGB(알파 없음)·8장이 다 있는지 확인, 어긋나면 '문제'를 찍고 끝 코드 1.
- 미리보기: final8/preview/<kind>-<lang>.jpg (8장 나란히, 높이 900px)
           final8/preview/widget-<kind>.jpg (04 위젯 장만 9개 언어 나란히, 높이 900px)
"""
import os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F = os.path.join(ROOT, "store-assets/store-shots/final8")
LANGS = ["ko", "en", "ja", "zh-Hans", "zh-Hant", "es", "fr", "de", "pt"]
SIZES = {"play": (1080, 1920), "iphone63": (1206, 2622), "ipad13": (2064, 2752)}
NAMES = ["01-hero", "02-calendar", "03-reliable", "04-widget", "05-rotation", "06-override", "07-cycle", "08-everyday"]
H = 900
GAP = 12
BG = (0x2A, 0x2A, 0x2C)


def sheet(ims, out):
    ims = [im.resize((round(im.width * H / im.height), H), Image.LANCZOS) for im in ims]
    s = Image.new("RGB", (sum(i.width for i in ims) + GAP * (len(ims) - 1), H), BG)
    x = 0
    for im in ims:
        s.paste(im, (x, 0))
        x += im.width + GAP
    s.save(out, quality=88)


def main():
    os.makedirs(os.path.join(F, "preview"), exist_ok=True)
    bad, count = [], 0
    for kind, size in SIZES.items():
        widgets = []
        for lang in LANGS:
            ims = []
            for n in NAMES:
                p = os.path.join(F, kind, lang, n + ".png")
                if not os.path.exists(p):
                    bad.append("없음 " + p)
                    continue
                im = Image.open(p)
                count += 1
                if im.size != size:
                    bad.append("크기 %s %s" % (im.size, p))
                if im.mode != "RGB":
                    bad.append("모드 %s %s" % (im.mode, p))
                ims.append(im.convert("RGB"))
                if n == "04-widget":
                    widgets.append(ims[-1])
            sheet(ims, os.path.join(F, "preview", "%s-%s.jpg" % (kind, lang)))
        sheet(widgets, os.path.join(F, "preview", "widget-%s.jpg" % kind))
    print("final8: %d장 확인%s" % (count, "" if not bad else ", 문제 %d건" % len(bad)))
    for b in bad:
        print("  문제:", b)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
