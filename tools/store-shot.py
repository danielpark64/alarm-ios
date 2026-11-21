#!/usr/bin/env python3
"""교대알람 스토어 스크린샷 시안 — collage 스타일 하나만.

사진첩(Albummory) store-shot.py 의 collage 틀을 가져오되, 폴라로이드 대신
앱 주제 소품(뜯어 쓰는 달력 / 근무표 쪽지)을 PIL 로 직접 그려 폰 뒤에 깐다.

사용 예:
  python3 tools/store-shot.py --in store-assets/screenshots/i18n-2026-10-14/ko \
    --out store-assets/store-shots/drafts/ko --lang ko --only 01_calendar.png,02_alarmlist.png

원본 캡처는 Play 규격용으로 1080 폭 화면 양옆에 배경 여백 135px 이 붙은 1350 폭이다.
가운데 1080 폭만 잘라 폰 화면으로 쓴다. 아이폰(1206x2622)·아이패드 원본은 자르지 않는다(원본 파일은 건드리지 않는다).
"""
import argparse, json, re, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

import glob

SYS = "/System/Library/Fonts/"
SDGN = SYS + "AppleSDGothicNeo.ttc"


def _pingfang():
    """PingFang 은 해시 폴더 아래라 경로를 찾아서 쓴다."""
    g = glob.glob("/System/Library/AssetsV2/com_apple_MobileAsset_Font*/*/AssetData/PingFang.ttc")
    return g[0] if g else SDGN


HIRA = SYS + "ヒラギノ角ゴシック W%d.ttc"
# 언어별 (큰 글·소품 달력 / 꼬리표·소품 쪽지 / 작은 글) 글꼴 = (경로, 인덱스)
LANG_FONTS = {
    "ja": {"heavy": (HIRA % 8, 0), "bold": (HIRA % 6, 0), "sub": (HIRA % 4, 0)},
    "zh-Hans": {"heavy": (_pingfang(), 11), "bold": (_pingfang(), 11), "sub": (_pingfang(), 7)},
    "zh-Hant": {"heavy": (_pingfang(), 10), "bold": (_pingfang(), 10), "sub": (_pingfang(), 6)},
}
# AppleSDGothicNeo 는 é ü ß 같은 악센트 글자가 네모로 나와서 유럽 언어는 Helvetica Neue 를 쓴다
_HN = SYS + "HelveticaNeue.ttc"
for _l in ("es", "fr", "de", "pt"):
    LANG_FONTS[_l] = {"heavy": (_HN, 1), "bold": (_HN, 1), "sub": (_HN, 10)}
DEFAULT_FONTS = {"heavy": (SDGN, 16), "bold": (SDGN, 6), "sub": (SDGN, 2)}
FONTS = dict(DEFAULT_FONTS)


def set_lang_fonts(lang):
    FONTS.clear()
    FONTS.update(LANG_FONTS.get(lang, DEFAULT_FONTS))


def font(kind, size):
    path, idx = FONTS[kind]
    return ImageFont.truetype(path, max(8, int(size)), index=idx)

PAPER = (0xFB, 0xF7, 0xEF)
BLUE = (0x31, 0x82, 0xF6)
BODY = (0x1E, 0x1E, 0x1E)
BROWN = (0x3A, 0x2E, 0x24)
SUB = (0x7A, 0x6A, 0x5A)
SCREEN_W = 1080  # Play 원본(1350 폭)에서 폰 화면 실제 폭(가운데)


def parse_runs(line):
    """'[낱말]' 형식을 (글자, 파랑여부) 조각 목록으로."""
    runs = []
    for m in re.finditer(r"\[([^\]]*)\]|([^\[]+)", line):
        runs.append((m.group(1), True) if m.group(1) is not None else (m.group(2), False))
    return runs


def fit_font(d, lines, W, s, start=102, minimum=64):
    """가장 긴 줄이 폭 안에 들어오도록 글자 크기를 줄인다(최소를 넘어서도 넘치면 더 줄여 다 보이게)."""
    size = round(start * s)
    lo = round(minimum * s)
    limit = W - round(110 * s)
    while size > 12:
        f = font("heavy", size)
        widest = max(sum(d.textlength(t, font=f) for t, _ in parse_runs(l)) for l in lines)
        if widest <= limit:
            break
        size -= 2
    return f, size


def text_runs(canvas, runs, font, cx, y, base, key):
    d = ImageDraw.Draw(canvas)
    widths = [d.textlength(t, font=font) for t, _ in runs]
    x = cx - sum(widths) / 2
    for (t, k), w in zip(runs, widths):
        d.text((x, y), t, font=font, fill=key if k else base)
        x += w


def pill(canvas, cx, y, text, s):
    """큰 글 위의 짙은 갈색 알약 꼬리표(넘치면 글자를 줄인다)."""
    d = ImageDraw.Draw(canvas)
    padx, h = round(34 * s), round(60 * s)
    maxw = canvas.width - round(140 * s) - 2 * padx
    size = round(31 * s)
    f = font("bold", size)
    while d.textlength(text, font=f) > maxw and size > 10:
        size -= 1
        f = font("bold", size)
    tw = d.textlength(text, font=f)
    d.rounded_rectangle((cx - tw / 2 - padx, y, cx + tw / 2 + padx, y + h), h // 2, fill=BROWN + (255,))
    d.text((cx, y + h / 2), text, font=f, fill=(0xFB, 0xF2, 0xE0, 255), anchor="mm")


def draw_text_block(canvas, W, s, c, y0=96):
    """꼬리표 + 큰 글 + 작은 설명. 글 아래 y 를 돌려준다."""
    d = ImageDraw.Draw(canvas)
    lines = c["title"].split("\n")
    f_big, size = fit_font(d, lines, W, s)
    y = round(y0 * s)
    if c.get("tag"):
        pill(canvas, W / 2, y, c["tag"], s)
        y += round(60 * s) + round(40 * s)
    lh = round(size * 1.3)
    for ln in lines:
        text_runs(canvas, parse_runs(ln), f_big, W / 2, y, BROWN, BLUE)
        y += lh
    y += round(6 * s)
    ssize = round(42 * s)
    f_sub = font("sub", ssize)
    while d.textlength(c["sub"], font=f_sub) > W - round(110 * s) and ssize > 12:
        ssize -= 1
        f_sub = font("sub", ssize)
    sw = d.textlength(c["sub"], font=f_sub)
    d.text(((W - sw) / 2, y), c["sub"], font=f_sub, fill=SUB + (255,))
    return y + round(ssize * 1.2)


def load_screen(src_path):
    """원본을 열어 폰 화면만 돌려준다. 1350 폭(Play 여백 붙은 것)이면 가운데 1080 만 쓴다."""
    shot = Image.open(src_path).convert("RGB")
    if shot.width == 1350:
        x0 = (shot.width - SCREEN_W) // 2
        shot = shot.crop((x0, 0, x0 + SCREEN_W, shot.height))
    return shot


def phone_layer(shot, W, H, s, px_w, py, angle=0.0, tablet=False):
    """둥근 짙은 테두리 폰(태블릿은 얇은 테두리·작은 모서리) + 부드러운 그림자 레이어로."""
    bezel = round((8 if tablet else 14) * s)
    inner_w = px_w - 2 * bezel
    inner_h = round(shot.height * inner_w / shot.width)
    shot = shot.resize((inner_w, inner_h), Image.LANCZOS)
    r_in = round((26 if tablet else 56) * s)
    r_out = r_in + bezel
    pw, ph = inner_w + 2 * bezel, inner_h + 2 * bezel
    px = (W - pw) // 2
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle(
        (px, py + round(36 * s), px + pw, py + ph + round(36 * s)), r_out, fill=(0, 0, 0, round(255 * 0.30)))
    lay.alpha_composite(sh.filter(ImageFilter.GaussianBlur(round(46 * s))))
    body = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    ImageDraw.Draw(body).rounded_rectangle((0, 0, pw - 1, ph - 1), r_out, fill=BODY + (255,))
    mask = Image.new("L", (inner_w, inner_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, inner_w - 1, inner_h - 1), r_in, fill=255)
    body.paste(shot, (bezel, bezel), mask)
    lay.alpha_composite(body, (px, py))
    if angle:
        lay = lay.rotate(angle, center=(W / 2, py + ph / 2), resample=Image.BICUBIC)
    return lay


def fit_text_font(d, text, kind, max_w, start, minimum=10):
    size = start
    while size > minimum:
        f = font(kind, size)
        if d.textlength(text, font=f) <= max_w:
            return f
        size -= 2
    return font(kind, minimum)


def prop_calendar(text, w, s):
    """뜯어 쓰는 달력 한 장: 흰 종이 + 붉은갈색 띠 + 스프링 구멍 + 큰 글 + 작은 날짜 격자. RGBA(여백 포함)."""
    w = round(w * s)
    h = round(w * 1.22)
    band = round(h * 0.17)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = round(12 * s)
    d.rounded_rectangle((0, 0, w - 1, h - 1), r, fill=(255, 255, 255, 255))
    d.rounded_rectangle((0, 0, w - 1, band + r), r, fill=(0xB5, 0x54, 0x3C, 255))
    d.rectangle((0, band, w - 1, band + r), fill=(255, 255, 255, 255))  # 띠 아래쪽 모서리를 직선으로
    # 스프링 구멍
    n = 4
    for i in range(n):
        cx = w * (i + 1) / (n + 1)
        cy = band * 0.5
        rr = round(9 * s)
        d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=(0xFB, 0xF7, 0xEF, 255), outline=(0x8A, 0x3C, 0x2A, 255), width=max(1, round(2 * s)))
    # 가운데 큰 글
    gy0, gh = band + round(14 * s), h * 0.34
    f = fit_text_font(d, text, "heavy", w - round(50 * s), round(96 * s))
    d.text((w / 2, gy0 + gh / 2), text, font=f, fill=BROWN + (255,), anchor="mm")
    # 아래 작은 날짜 격자 7x4
    gx0, gx1 = round(26 * s), w - round(26 * s)
    top = band + round(14 * s) + gh + round(8 * s)
    bot = h - round(24 * s)
    cols, rows = 7, 4
    cw, ch = (gx1 - gx0) / cols, (bot - top) / rows
    fn = font("bold", max(10, round(15 * s)))
    for rI in range(rows):
        for cI in range(cols):
            x, y = gx0 + cI * cw, top + rI * ch
            d.rounded_rectangle((x + 2, y + 2, x + cw - 3, y + ch - 3), round(3 * s), outline=(0xE1, 0xDE, 0xD8, 255), width=max(1, round(1.5 * s)))
            d.text((x + cw / 2, y + ch / 2), str(rI * 7 + cI + 1), font=fn, fill=(0xC9, 0xC4, 0xBA, 255), anchor="mm")
    return img


def prop_note(text, w, s):
    """근무표 쪽지: 옅은 노랑 메모지 + 옅은 가로줄 + 짙은 갈색 Bold 글."""
    w = round(w * s)
    h = round(w * 0.78)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, w - 1, h - 1), fill=(0xF7, 0xEB, 0xC3, 255))
    d.rectangle((0, 0, w - 1, round(10 * s)), fill=(0xEF, 0xDF, 0xAE, 255))  # 윗단 살짝 진하게
    for fy in (0.40, 0.62, 0.84):
        y = round(h * fy)
        d.line((round(22 * s), y, w - round(22 * s), y), fill=(0xE2, 0xD2, 0xA0, 255), width=max(1, round(2 * s)))
    f = fit_text_font(d, text, "bold", w - round(60 * s), round(42 * s))
    cx, cy = w * 0.44, h * 0.40 - round(4 * s)
    col = (0x4A, 0x32, 0x20, 255)
    if "→" in text and FONTS["bold"][0] != SDGN and FONTS["bold"][0] == _HN:
        # Helvetica Neue 에 화살표가 없어 화살표만 Apple SD Gothic Neo 로 그린다
        fa = ImageFont.truetype(SDGN, f.size, index=6)
        parts = text.split("→")
        segs = []
        for i, t in enumerate(parts):
            segs.append((t, f))
            if i < len(parts) - 1:
                segs.append(("→", fa))
        tot = sum(d.textlength(t, font=ft) for t, ft in segs)
        x = cx - tot / 2
        for t, ft in segs:
            d.text((x, cy), t, font=ft, fill=col, anchor="lm")
            x += d.textlength(t, font=ft)
    else:
        d.text((cx, cy), text, font=f, fill=col, anchor="mm")
    return img


def with_tape_shadow(prop, angle, s, tape_angle):
    """소품에 옅은 그림자 + 위쪽 반투명 크림 테이프를 붙이고 회전한 RGBA 를 돌려준다."""
    pad = round(60 * s)
    w, h = prop.size
    lay = Image.new("RGBA", (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    sh = Image.new("RGBA", lay.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle((pad, pad + 14 * s, pad + w, pad + h + 14 * s), fill=(0, 0, 0, 70))
    lay.alpha_composite(sh.filter(ImageFilter.GaussianBlur(round(20 * s))))
    lay.alpha_composite(prop, (pad, pad))
    tw, th = round(150 * s), round(46 * s)
    tape = Image.new("RGBA", (tw, th), (246, 236, 205, 175))
    tape = tape.rotate(tape_angle, expand=True, resample=Image.BICUBIC)
    lay.alpha_composite(tape, (pad + w // 2 - tape.width // 2, pad - th // 2 - round(4 * s)))
    return lay.rotate(angle, expand=True, resample=Image.BICUBIC)


def make(src_path, out_path, W, H, c):
    s = W / 1080
    shot = load_screen(src_path)
    tablet = shot.height / shot.width < 1.6
    tall = (not tablet) and W != 1080  # 아이폰 캔버스
    ts = s * (0.82 if tablet else 1.0)  # 글자 크기 배율(아이패드는 폰(태블릿) 화면에 자리를 더 준다)
    bz = round((8 if tablet else 14) * s)
    scr_ratio = shot.height / shot.width
    canvas = Image.new("RGBA", (W, H), PAPER + (255,))
    noise = Image.effect_noise((W, H), 26).convert("RGBA")
    noise.putalpha(14)
    canvas.alpha_composite(noise)
    # 글 영역 높이를 먼저 재서 폰 크기를 정한다
    tb0 = draw_text_block(Image.new("RGBA", (W, H)), W, ts, c)
    gap = round(60 * s)
    bottom = round(90 * s)
    frac = 0.78 if tablet else (0.62 if tall else 0.60)
    pw_target = round(W * frac)
    avail_h = H - tb0 - gap - bottom - 2 * bz
    pw_target = min(pw_target, round(avail_h / scr_ratio) + 2 * bz)
    ph_h = round((pw_target - 2 * bz) * scr_ratio) + 2 * bz
    # 남는 세로 공간은 위·아래로 나눠 글 위에 일부 더한다
    spare = max(0, H - (tb0 + gap + ph_h + round(70 * s)))
    off = spare * 0.5
    tb = draw_text_block(canvas, W, ts, c, y0=96 + off / ts)
    py = tb + gap
    flip = c.get("_idx", 0) % 2
    pk = 0.62 if tablet else (0.88 if tall else 1.0)  # 소품 배율(아이패드는 화면을 덜 가리게 작게)
    ex = 138 * pk  # 소품이 캔버스 가장자리에 붙고 폰 가장자리에 살짝 걸치게
    # 폰 먼저, 소품은 폰 앞에 올려 글씨가 가려지지 않게 한다. 위·가운데·아래, 좌우 번갈아
    canvas.alpha_composite(phone_layer(shot, W, H, s, pw_target, py, angle=2.5 * (-1 if flip else 1), tablet=tablet))
    spec = [(-7, ex, 0.16, -5), (6, W / s - ex, 0.49, 4), (-5, ex, 0.81, 3)]
    for p, (ang, cx, fy, ta) in zip(c.get("props", [])[:3], spec):
        if flip:
            cx, ang, ta = W / s - cx, -ang, -ta
        base = prop_calendar(p["text"], 256 * pk, s) if p["kind"] == "calendar" else prop_note(p["text"], 250 * pk, s)
        pl = with_tape_shadow(base, ang, s, ta)
        cy = (py + fy * ph_h) / s
        canvas.alpha_composite(pl, (round(cx * s - pl.width / 2), round(cy * s - pl.height / 2)))
    canvas.convert("RGB").save(out_path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True, help="원본 캡처 폴더")
    ap.add_argument("--out", required=True, help="출력 폴더")
    ap.add_argument("--size", default="1080x1920")
    ap.add_argument("--copy", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "store-shot-copy.json"))
    ap.add_argument("--lang", default="ko")
    ap.add_argument("--only", default="", help="쉼표로 나눈 원본 파일명만 만든다(시안용)")
    a = ap.parse_args()
    W, H = map(int, a.size.lower().split("x"))
    set_lang_fonts(a.lang)
    copy = json.load(open(a.copy, encoding="utf-8"))[a.lang]
    os.makedirs(a.out, exist_ok=True)
    only = a.only.split(",") if a.only else []
    for i, name in enumerate(copy["order"], 1):
        c = dict(copy["shots"][name], _idx=i)
        src = os.path.join(a.inp, name)
        if not os.path.exists(src):
            print("건너뜀(원본 없음):", name)
            continue
        if only and name not in only:
            continue
        out = os.path.join(a.out, "%02d-%s.png" % (i, c["slug"]))
        make(src, out, W, H, c)
        print("만듦:", out)


if __name__ == "__main__":
    main()
