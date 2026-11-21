#!/usr/bin/env python3
"""교대알람 스토어 가로 대표 이미지 — B안(종이 콜라주) 가로판.

왼쪽: 꼬리표 + 큰 글 두 줄(핵심 낱말 파랑) + 작은 글(왼쪽 정렬, 세로 가운데).
오른쪽: 폰 목업 2대를 반대로 기울여 겹치고(앞=달력, 뒤=알람 목록), 소품 쪽지·달력을 테이프로 붙인다.
폰·소품·글꼴 그리는 함수는 tools/store-shot.py 것을 그대로 불러 쓴다(그 파일은 바꾸지 않는다).

사용 예:
  python3 tools/store-banner.py --lang ko
  → store-assets/store-shots/banner/ko/landscape-1920x1080.png, feature-1024x500.png
  python3 tools/store-banner.py --all
  → 문구 파일의 모든 언어 × 2장 + banner/preview-landscape.png, preview-feature.png(3×3 미리보기)
문구는 tools/store-banner-copy.json 에 언어별로 둔다.
"""
import argparse, importlib.util, json, os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
_spec = importlib.util.spec_from_file_location("store_shot", os.path.join(HERE, "store-shot.py"))
ss = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ss)

# 크기별 배치. 길이는 전부 캔버스 높이(H) 기준 비율, x 는 폭(W) 기준 비율.
LAYOUTS = {
    "landscape-1920x1080": {
        "size": (1920, 1080),
        "text_x": 0.075, "text_w": 0.40,       # 글 영역 왼쪽·폭(W 비율)
        "title": 0.100, "title_min": 0.040,     # 큰 글 크기(H 비율) — 긴 언어는 다 보이도록 최소까지 줄인다
        "sub": 0.036, "pill_h": 0.056, "pill_font": 0.029,
        "text_cy": 0.50,
        # 폰: 가운데 x(W), 위 y(H), 폭(H), 기울기(도, +는 반시계)
        "back": (0.862, 0.075, 0.46, -5.0),
        "front": (0.645, 0.175, 0.48, 3.5),
        # 소품: 종류 순서대로 (가운데 x(W), 가운데 y(H), 폭(H), 기울기, 테이프 기울기)
        "props": [(0.462, 0.175, 0.19, 7, -4), (0.905, 0.875, 0.19, -5, 4), (0.475, 0.85, 0.16, -6, 3)],
    },
    "feature-1024x500": {
        "size": (1024, 500),
        "text_x": 0.15, "text_w": 0.385,
        "title": 0.112, "title_min": 0.050,
        "sub": 0.043, "pill_h": 0.068, "pill_font": 0.035,
        "text_cy": 0.50,
        "back": (0.885, 0.06, 0.46, -5.0),
        "front": (0.695, 0.17, 0.48, 3.5),
        # 세 번째(비번 쪽지)는 가로판처럼 앞 폰 왼쪽 아래. 이 크기에선 달력 격자를 단순하게(simple_cal)
        "props": [(0.548, 0.165, 0.19, 7, -4), (0.885, 0.865, 0.19, -5, 4), (0.585, 0.85, 0.17, -6, 3)],
        "simple_cal": True,
    },
}


def paper(W, H):
    canvas = Image.new("RGBA", (W, H), ss.PAPER + (255,))
    noise = Image.effect_noise((W, H), 26).convert("RGBA")
    noise.putalpha(14)
    canvas.alpha_composite(noise)
    return canvas


def phone(shot, pw, s):
    """둥근 짙은 테두리 폰 + 넓고 부드러운 그림자를 여백 붙은 RGBA 로(회전 전)."""
    bezel = round(14 * s)
    inner_w = pw - 2 * bezel
    inner_h = round(shot.height * inner_w / shot.width)
    shot = shot.resize((inner_w, inner_h), Image.LANCZOS)
    r_in = round(56 * s)
    r_out = r_in + bezel
    ph = inner_h + 2 * bezel
    pad = round(120 * s)
    lay = Image.new("RGBA", (pw + 2 * pad, ph + 2 * pad), (0, 0, 0, 0))
    sh = Image.new("RGBA", lay.size, (0, 0, 0, 0))
    dy = round(36 * s)
    ImageDraw.Draw(sh).rounded_rectangle((pad, pad + dy, pad + pw, pad + ph + dy), r_out, fill=(0, 0, 0, 77))
    lay.alpha_composite(sh.filter(ImageFilter.GaussianBlur(round(46 * s))))
    body = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    ImageDraw.Draw(body).rounded_rectangle((0, 0, pw - 1, ph - 1), r_out, fill=ss.BODY + (255,))
    mask = Image.new("L", (inner_w, inner_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, inner_w - 1, inner_h - 1), r_in, fill=255)
    body.paste(shot, (bezel, bezel), mask)
    lay.alpha_composite(body, (pad, pad))
    return lay, pad, ph


def place_phone(canvas, shot, spec, W, H):
    cx, top, wf, ang = spec
    pw = round(wf * H)
    s = pw / 600  # 세로 시안의 폰 폭(약 600px) 기준 배율
    lay, pad, ph = phone(shot, pw, s)
    lay = lay.rotate(ang, expand=True, resample=Image.BICUBIC)
    # 회전 전 폰 가운데가 (cx, top + ph/2) 에 오게
    canvas.alpha_composite(lay, (round(cx * W - lay.width / 2), round(top * H + ph / 2 - lay.height / 2)))


def draw_text(canvas, c, L, W, H):
    d = ImageDraw.Draw(canvas)
    x0 = round(L["text_x"] * W)
    maxw = round(L["text_w"] * W)
    lines = c["title"].split("\n")
    size = round(L["title"] * H)
    while size > round(L["title_min"] * H):
        f = ss.font("heavy", size)
        if max(sum(d.textlength(t, font=f) for t, _ in ss.parse_runs(l)) for l in lines) <= maxw:
            break
        size -= 1
    f_big = ss.font("heavy", size)
    ssize = round(L["sub"] * H)
    f_sub = ss.font("sub", ssize)
    while d.textlength(c["sub"], font=f_sub) > maxw and ssize > 10:
        ssize -= 1
        f_sub = ss.font("sub", ssize)
    ph = round(L["pill_h"] * H)
    lh = round(size * 1.28)
    gap1, gap2 = round(ph * 0.62), round(size * 0.22)
    total = ph + gap1 + lh * len(lines) + gap2 + round(ssize * 1.2)
    y = round(L["text_cy"] * H - total / 2)
    # 꼬리표(왼쪽 정렬)
    padx = round(ph * 0.58)
    psize = round(L["pill_font"] * H)
    pf = ss.font("bold", psize)
    while d.textlength(c["tag"], font=pf) + 2 * padx > maxw and psize > 10:
        psize -= 1
        pf = ss.font("bold", psize)
    tw = d.textlength(c["tag"], font=pf)
    d.rounded_rectangle((x0, y, x0 + tw + 2 * padx, y + ph), ph // 2, fill=ss.BROWN + (255,))
    d.text((x0 + padx + tw / 2, y + ph / 2), c["tag"], font=pf, fill=(0xFB, 0xF2, 0xE0, 255), anchor="mm")
    y += ph + gap1
    for ln in lines:
        x = x0
        for t, key in ss.parse_runs(ln):
            d.text((x, y), t, font=f_big, fill=(ss.BLUE if key else ss.BROWN))
            x += d.textlength(t, font=f_big)
        y += lh
    y += gap2
    d.text((x0, y), c["sub"], font=f_sub, fill=ss.SUB + (255,))
    return size


def prop_calendar_simple(text, w, s):
    """작은 크기용 달력 소품: 숫자 없는 날짜 칸 3줄(몇 칸은 근무색). 숫자가 뭉개지는 것을 막는다."""
    w = round(w * s)
    h = round(w * 1.22)
    band = round(h * 0.17)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = round(12 * s)
    d.rounded_rectangle((0, 0, w - 1, h - 1), r, fill=(255, 255, 255, 255))
    d.rounded_rectangle((0, 0, w - 1, band + r), r, fill=(0xB5, 0x54, 0x3C, 255))
    d.rectangle((0, band, w - 1, band + r), fill=(255, 255, 255, 255))
    n = 4
    for i in range(n):
        cx, cy, rr = w * (i + 1) / (n + 1), band * 0.5, round(9 * s)
        d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=ss.PAPER + (255,), outline=(0x8A, 0x3C, 0x2A, 255), width=max(1, round(2 * s)))
    gy0, gh = band + round(14 * s), h * 0.38
    f = ss.fit_text_font(d, text, "heavy", w - round(40 * s), round(104 * s))
    d.text((w / 2, gy0 + gh / 2), text, font=f, fill=ss.BROWN + (255,), anchor="mm")
    gx0, gx1 = round(30 * s), w - round(30 * s)
    top = gy0 + gh + round(14 * s)
    bot = h - round(28 * s)
    cols, rows = 7, 3
    cw, ch = (gx1 - gx0) / cols, (bot - top) / rows
    mark = {(0, 2): (0xC9, 0xD9, 0xF6), (1, 5): (0xC9, 0xD9, 0xF6), (2, 1): (0xC9, 0xD9, 0xF6),
            (0, 5): (0xEC, 0xDB, 0xC4), (1, 0): (0xEC, 0xDB, 0xC4), (2, 4): (0xEC, 0xDB, 0xC4)}
    g = max(2, round(cw * 0.16))
    for rI in range(rows):
        for cI in range(cols):
            x, y = gx0 + cI * cw, top + rI * ch
            fill = mark.get((rI, cI), (0xEE, 0xEB, 0xE6))
            d.rounded_rectangle((x + g / 2, y + g / 2, x + cw - g / 2, y + ch - g / 2), max(1, round(3 * s)), fill=fill + (255,))
    return img


def make(c, L, src_dir, out_path):
    W, H = L["size"]
    canvas = paper(W, H)
    draw_text(canvas, c, L, W, H)
    place_phone(canvas, ss.load_screen(os.path.join(src_dir, c["back"])), L["back"], W, H)
    place_phone(canvas, ss.load_screen(os.path.join(src_dir, c["front"])), L["front"], W, H)
    for p, spec in zip(c.get("props", []), L["props"]):
        if not spec:
            continue
        cx, cy, wf, ang, ta = spec
        if p["kind"] == "calendar":
            s = wf * H / 256
            base = (prop_calendar_simple if L.get("simple_cal") else ss.prop_calendar)(p["text"], 256, s)
        else:
            s = wf * H / 250
            base = ss.prop_note(p["text"], 250, s)
        pl = ss.with_tape_shadow(base, ang, s, ta)
        canvas.alpha_composite(pl, (round(cx * W - pl.width / 2), round(cy * H - pl.height / 2)))
    canvas.convert("RGB").save(out_path)
    print("만듦:", out_path)


PREVIEW_ORDER = ["ko", "en", "ja", "zh-Hans", "zh-Hant", "es", "fr", "de", "pt"]


def build(lang, copy_all, inp=None, out=None):
    src = inp or os.path.join(ROOT, "store-assets/screenshots/i18n-2026-10-14", lang)
    out = out or os.path.join(ROOT, "store-assets/store-shots/banner", lang)
    os.makedirs(out, exist_ok=True)
    ss.set_lang_fonts(lang)
    for name, L in LAYOUTS.items():
        make(copy_all[lang], L, src, os.path.join(out, name + ".png"))


def preview(langs):
    """언어별 결과를 3×3 으로 이어 붙인 확인용 미리보기(언어 코드 표시)."""
    base = os.path.join(ROOT, "store-assets/store-shots/banner")
    for name, short in (("landscape-1920x1080", "landscape"), ("feature-1024x500", "feature")):
        tw = 960 if short == "landscape" else 1024
        th = round(tw * LAYOUTS[name]["size"][1] / LAYOUTS[name]["size"][0])
        gap, lab = 16, 40
        sheet = Image.new("RGB", (3 * tw + 4 * gap, 3 * (th + lab) + 4 * gap), (60, 60, 60))
        d = ImageDraw.Draw(sheet)
        lf = ImageFont.truetype(ss.SDGN, 28, index=6)
        for i, lang in enumerate(langs[:9]):
            im = Image.open(os.path.join(base, lang, name + ".png")).convert("RGB").resize((tw, th), Image.LANCZOS)
            x = gap + (i % 3) * (tw + gap)
            y = gap + (i // 3) * (th + lab + gap)
            d.text((x, y + 4), lang, font=lf, fill=(255, 255, 255))
            sheet.paste(im, (x, y + lab))
        p = os.path.join(base, "preview-%s.png" % short)
        sheet.save(p)
        print("미리보기:", p)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", default="ko")
    ap.add_argument("--all", action="store_true", help="문구 파일의 모든 언어를 뽑고 3×3 미리보기도 만든다")
    ap.add_argument("--in", dest="inp", default=None, help="원본 캡처 폴더(기본: i18n-2026-10-14/<언어>)")
    ap.add_argument("--out", default=None, help="출력 폴더(기본: store-assets/store-shots/banner/<언어>)")
    ap.add_argument("--copy", default=os.path.join(HERE, "store-banner-copy.json"))
    a = ap.parse_args()
    copy_all = json.load(open(a.copy, encoding="utf-8"))
    if a.all:
        langs = [l for l in PREVIEW_ORDER if l in copy_all] + [l for l in copy_all if l not in PREVIEW_ORDER]
        for lang in langs:
            build(lang, copy_all)
        preview(langs)
    else:
        build(a.lang, copy_all, a.inp, a.out)


if __name__ == "__main__":
    main()
