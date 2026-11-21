#!/usr/bin/env python3
"""교대알람 스토어 스크린샷 — 파노라마(장과 장이 이어지는 방식) 7장 세트.

1·2번 장을 (2×폭)×높이 한 캔버스에 그린 뒤 정확히 가운데(x=폭)에서 잘라 두 장으로 저장한다.
  1번 장: 꼬리표 + 포스터처럼 큰 글 세 줄(왼쪽 정렬) + 작은 글 + 왼쪽 아래 근무조 쪽지 2개.
  경계: 크게 기울인 달력 폰(아이패드는 태블릿)이 두 장에 걸친다.
  2번 장: 위에 꼬리표 + 큰 글 두 줄 + 작은 글, 오른쪽에 달력·쪽지 소품.
3번 장은 store-shot.py 의 make() 를 문구만 바꿔 그대로 쓴다.
4~7번 장은 store-shot.py 결과의 3~6번 장과 같은 그림(번호만 하나씩 뒤로).
폰·소품·글꼴 함수는 tools/store-shot.py 것을 불러 쓴다(그 파일은 바꾸지 않는다).

크기(--size)
  play     1080x1920  — 배치 기준(승낙된 한국어 시안과 같은 값)
  iphone63 1206x2622  — 1080 기준 값을 폭 비율로 키우고, 남는 세로는 위→아래로 점점 더 나눠 준다
  ipad13   2064x2752  — 가로가 넓어 따로 배치(태블릿 테두리)

큰 글·작은 글은 폰·쪽지·이음매와 겹치지 않을 때까지 글자를 줄인다(줄마다 그 높이에서 비어 있는 폭을 잰다).
다 그린 뒤 글과 폰·소품이 겹친 점이 있으면 '경고'를 찍는다.

사용 예:
  python3 tools/store-pano.py --lang de --size 1206x2622
  → store-assets/store-shots/pano7/iphone63/de/01-hero.png … 07-everyday.png
"""
import argparse, importlib.util, json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
_spec = importlib.util.spec_from_file_location("store_shot", os.path.join(HERE, "store-shot.py"))
ss = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ss)

KINDS = {"1080x1920": "play", "1206x2622": "iphone63", "2064x2752": "ipad13"}
SRC_DIRS = {
    "play": "store-assets/screenshots/i18n-2026-10-14",
    "iphone63": "store-assets/appstore/screenshots-iphone63",
    "ipad13": "store-assets/appstore/screenshots-ipad13",
}
# 4~7번 장: store-shot-copy.json order 의 3~6번(원래 번호 그대로 넘겨야 좌우 번갈아 배치가 같다)
TAIL_FROM = 3


def layout(W, H):
    """캔버스(2W×H) 픽셀 좌표의 배치 값. 1080×1920 값은 승낙된 시안과 같다."""
    CUT = W
    if W / H > 0.7:  # 아이패드(가로가 넓은 비율) — 따로 배치
        t = 1.55  # 글자 배율(1080 기준)
        return {
            "CUT": CUT, "SAFE": 90, "t": t, "tablet": True, "margin": 30,
            "hero_x": 150, "hero_size": round(200 * t), "hero_min": round(96 * t), "hero_top": 300,
            "pill_h": round(76 * t), "pill_f": round(38 * t), "pill_gap": round(44 * t), "sub_size": round(42 * t),
            "phone_c": (CUT + 70, 2290), "phone_w": 1700, "phone_ang": -12.0,
            "p2_cx": CUT + W / 2 + 60, "p2_top": 190,
            "prop_s": 1.6,
            "hero_props": [(420, 2030, 1.05, -6, -4), (380, 2480, 1.0, 4, 3)],
            "props": [(2 * W - 250, 1180, 1.0, 6, 4), (2 * W - 240, 1820, 1.0, -5, -3), (2 * W - 260, 2430, 0.92, 4, 3)],
        }
    s = W / 1080
    ex = H - 1920 * s  # 아이폰처럼 더 긴 캔버스에서 남는 세로

    def X(x):
        return x * s

    def Y(y):
        return y * s + ex * y / 1920

    return {
        "CUT": CUT, "SAFE": round(60 * s), "t": s, "tablet": False, "margin": round(20 * s),
        "hero_x": X(84), "hero_size": round(200 * s), "hero_min": round(96 * s), "hero_top": Y(230),
        "pill_h": round(76 * s), "pill_f": round(38 * s), "pill_gap": round(44 * s), "sub_size": round(42 * s),
        "phone_c": (X(1095), Y(1690)), "phone_w": X(860), "phone_ang": -12.0,
        "p2_cx": CUT + W / 2 + X(40), "p2_top": Y(120),
        "prop_s": s,
        # (가운데 x, 가운데 y, 폭 배율, 기울기, 테이프 기울기)
        "hero_props": [(X(330), Y(1360), 1.05, -6, -4), (X(300), Y(1720), 1.0, 4, 3)],
        "props": [(X(1985), Y(840), 1.0, 6, 4), (X(2000), Y(1330), 1.0, -5, -3), (X(1980), Y(1760), 0.92, 4, 3)],
    }


def paper(W, H):
    canvas = Image.new("RGBA", (W, H), ss.PAPER + (255,))
    noise = Image.effect_noise((W, H), 26).convert("RGBA")
    noise.putalpha(14)
    canvas.alpha_composite(noise)
    return canvas


# ---- 비어 있는 폭 재기(장애물 = 폰 몸체·소품, 불투명한 곳) ----

def first_obstacle_right(obs, y0, y1, x_from, x_to):
    """행 [y0,y1) 에서 x_from 오른쪽으로 처음 만나는 장애물 x(없으면 x_to)."""
    y0, y1 = max(0, int(y0)), min(obs.shape[0], int(y1))
    x_from, x_to = int(x_from), int(x_to)
    if y1 <= y0 or x_to <= x_from:
        return x_to
    cols = obs[y0:y1, x_from:x_to].any(axis=0)
    i = np.argmax(cols)
    return x_from + i if cols[i] else x_to


def first_obstacle_left(obs, y0, y1, x_from, x_to):
    """행 [y0,y1) 에서 x_from 왼쪽으로(x_to 까지) 처음 만나는 장애물 x(없으면 x_to)."""
    y0, y1 = max(0, int(y0)), min(obs.shape[0], int(y1))
    x_from, x_to = int(x_from), int(x_to)
    if y1 <= y0 or x_from <= x_to:
        return x_to
    cols = obs[y0:y1, x_to:x_from].any(axis=0)[::-1]
    i = np.argmax(cols)
    return x_from - i if cols[i] else x_to


def pill_left(d, x, y, text, h, fsize):
    """왼쪽 정렬 짙은 갈색 알약 꼬리표. 오른쪽 끝 x 를 돌려준다."""
    f = ss.font("bold", fsize)
    padx = round(h * 0.58)
    tw = d.textlength(text, font=f)
    d.rounded_rectangle((x, y, x + tw + 2 * padx, y + h), h // 2, fill=ss.BROWN + (255,))
    d.text((x + padx + tw / 2, y + h / 2), text, font=f, fill=(0xFB, 0xF2, 0xE0, 255), anchor="mm")
    return x + tw + 2 * padx


def line_w(d, line, f):
    return sum(d.textlength(t, font=f) for t, _ in ss.parse_runs(line))


def plain(line):
    return "".join(t for t, _ in ss.parse_runs(line))


def hero_plan(d, c, L, obs):
    """1번 장 큰 글 크기·작은 글 크기를 정한다(줄마다 폰·쪽지·이음매 앞에서 멈추게)."""
    x0, m = L["hero_x"], L["margin"]
    hard = L["CUT"] - L["SAFE"] - 16 * L["t"]
    lines = c["title"].split("\n")
    sub_start, sub_min = L["sub_size"], round(26 * L["t"])
    size = L["hero_size"]
    while True:
        f = ss.font("heavy", size)
        y = L["hero_top"] + L["pill_h"] + L["pill_gap"]
        lh = round(size * 1.2)
        ok = True
        for ln in lines:
            yy = y - round(size * 0.08)
            bb = d.textbbox((x0, yy), plain(ln), font=f)
            lim = min(hard, first_obstacle_right(obs, bb[1] - m, bb[3] + m, x0, hard + m + 1) - m)
            if x0 + line_w(d, ln, f) > lim:
                ok = False
                break
            y += lh
        if ok:
            y += round(18 * L["t"])
            ssize = sub_start
            ms = round(8 * L["t"])  # 작은 글은 폰에 조금 더 붙어도 된다(승낙된 시안 간격)
            while ssize >= sub_min:
                fs = ss.font("sub", ssize)
                bb = d.textbbox((x0 + 6, y), c["sub"], font=fs)
                lim = min(hard, first_obstacle_right(obs, bb[1] - ms, bb[3] + ms, x0, hard + ms + 1) - ms)
                if bb[2] <= lim:
                    return size, ssize, True
                ssize -= 1
        if size <= L["hero_min"]:
            return size, sub_min, False
        size -= 2


def draw_hero(layer, c, L, obs):
    """1번 장: 꼬리표 + 아주 큰 글 + 작은 글(왼쪽 정렬). (글 영역, 큰 글 크기, 맞음 여부) 를 돌려준다."""
    d = ImageDraw.Draw(layer)
    x0 = L["hero_x"]
    size, ssize, ok = hero_plan(d, c, L, obs)
    f = ss.font("heavy", size)
    y = L["hero_top"]
    ph = L["pill_h"]
    pill_left(d, x0 + 6 * L["t"], y, c["tag"], ph, L["pill_f"])
    y += ph + L["pill_gap"]
    lh = round(size * 1.2)
    right = 0
    for ln in c["title"].split("\n"):
        x = x0
        for t, key in ss.parse_runs(ln):
            # Heavy 글 바닥선을 맞추려고 위 여백(ascender)만큼 끌어올린다
            d.text((x, y - round(size * 0.08)), t, font=f, fill=(ss.BLUE if key else ss.BROWN))
            x += d.textlength(t, font=f)
        right = max(right, x)
        y += lh
    y += round(18 * L["t"])
    fs = ss.font("sub", ssize)
    d.text((x0 + 6, y), c["sub"], font=fs, fill=ss.SUB + (255,))
    right = max(right, x0 + 6 + d.textlength(c["sub"], font=fs))
    return (x0, L["hero_top"], right, y + round(ssize * 1.25)), size, ok


def centered_half(obs, L, cx, y0, y1, W):
    """가운데 x 둘레로 비어 있는 반폭(이음매 안전 폭·오른쪽 여백·장애물 고려)."""
    m = L["margin"]
    lo = L["CUT"] + L["SAFE"]
    hi = 2 * W - 56 * L["t"]
    left = first_obstacle_left(obs, y0 - m, y1 + m, cx, lo)
    right = first_obstacle_right(obs, y0 - m, y1 + m, cx, hi)
    if left > lo:
        left += m
    if right < hi:
        right -= m
    return min(cx - left, right - cx)


def draw_p2_text(layer, c, L, obs, W):
    """2번 장: 가운데 정렬 꼬리표 + 큰 글 두 줄 + 작은 글. 글 아래 y 를 돌려준다."""
    d = ImageDraw.Draw(layer)
    t = L["t"]
    cx = L["p2_cx"]
    lines = c["title"].split("\n")
    ph = round(66 * t)
    y_lines = L["p2_top"] + ph + round(40 * t)
    size = round(118 * t)
    while size > round(50 * t):
        f = ss.font("heavy", size)
        lh = round(size * 1.28)
        ok = True
        for i, ln in enumerate(lines):
            yy = y_lines + i * lh
            if line_w(d, ln, f) > 2 * centered_half(obs, L, cx, yy, yy + size * 1.1, W):
                ok = False
                break
        if ok:
            break
        size -= 2
    f = ss.font("heavy", size)
    y = L["p2_top"]
    ftag = ss.font("bold", round(34 * t))
    tw = d.textlength(c["tag"], font=ftag)
    padx = round(38 * t)
    d.rounded_rectangle((cx - tw / 2 - padx, y, cx + tw / 2 + padx, y + ph), ph // 2, fill=ss.BROWN + (255,))
    d.text((cx, y + ph / 2), c["tag"], font=ftag, fill=(0xFB, 0xF2, 0xE0, 255), anchor="mm")
    y += ph + round(40 * t)
    lh = round(size * 1.28)
    for ln in lines:
        ss.text_runs(layer, ss.parse_runs(ln), f, cx, y, ss.BROWN, ss.BLUE)
        y += lh
    y += round(8 * t)
    ssize = round(44 * t)
    while ssize > round(20 * t):
        fs = ss.font("sub", ssize)
        if d.textlength(c["sub"], font=fs) <= 2 * centered_half(obs, L, cx, y, y + ssize * 1.2, W):
            break
        ssize -= 1
    fs = ss.font("sub", ssize)
    d.text((cx, y), c["sub"], font=fs, fill=ss.SUB + (255,), anchor="mt")
    return y + round(ssize * 1.2)


def phone_rotated(shot, pw, ang, tablet=False):
    """둥근 짙은 테두리 폰(태블릿은 얇은 테두리·작은 모서리)을 기울이고, 아래로 떨어지는 넓고 부드러운 그림자를 붙인다.
    (그림자 포함 레이어, 몸체만 레이어, 레이어 안 폰 가운데 좌표) 를 돌려준다."""
    s = pw / 600
    if tablet:
        k = pw / 843  # store-shot.py 아이패드(1610 폭 태블릿, 배율 1.91)와 같은 테두리 비율
        bezel, r_in = round(8 * k), round(26 * k)
    else:
        bezel, r_in = round(14 * s), round(56 * s)
    inner_w = round(pw) - 2 * bezel
    pw = inner_w + 2 * bezel
    inner_h = round(shot.height * inner_w / shot.width)
    shot = shot.resize((inner_w, inner_h), Image.LANCZOS)
    r_out = r_in + bezel
    ph = inner_h + 2 * bezel
    body = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    ImageDraw.Draw(body).rounded_rectangle((0, 0, pw - 1, ph - 1), r_out, fill=ss.BODY + (255,))
    mask = Image.new("L", (inner_w, inner_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, inner_w - 1, inner_h - 1), r_in, fill=255)
    body.paste(shot, (bezel, bezel), mask)
    # 옆면에 아주 옅은 윤곽선(종이 위에서 테두리가 묻히지 않게)
    ImageDraw.Draw(body).rounded_rectangle((0, 0, pw - 1, ph - 1), r_out, outline=(0x55, 0x4A, 0x40, 255), width=max(1, round(1.5 * s)))
    body = body.rotate(ang, expand=True, resample=Image.BICUBIC)
    pad = round(150 * s)
    lay = Image.new("RGBA", (body.width + 2 * pad, body.height + 2 * pad), (0, 0, 0, 0))
    a = body.getchannel("A").point(lambda v: round(v * 0.30))
    sh = Image.new("RGBA", body.size, (0, 0, 0, 0))
    sh.putalpha(a)
    shl = Image.new("RGBA", lay.size, (0, 0, 0, 0))
    shl.alpha_composite(sh, (pad + round(10 * s), pad + round(40 * s)))
    lay.alpha_composite(shl.filter(ImageFilter.GaussianBlur(round(48 * s))))
    lay.alpha_composite(body, (pad, pad))
    only = Image.new("RGBA", lay.size, (0, 0, 0, 0))
    only.alpha_composite(body, (pad, pad))
    return lay, only, (lay.width / 2, lay.height / 2)


def prop_layer(p, spec, s):
    """소품 레이어와 붙일 왼쪽 위 좌표."""
    cx, cy, k, ang, ta = spec
    if p["kind"] == "calendar":
        base = ss.prop_calendar(p["text"], 256 * k, s)
    else:
        base = ss.prop_note(p["text"], 250 * k, s)
    pl = ss.with_tape_shadow(base, ang, s, ta)
    return pl, (round(cx - pl.width / 2), round(cy - pl.height / 2))


def make_pano(copy, src_dir, out_dir, W, H):
    L = layout(W, H)
    CW = 2 * W
    canvas = paper(CW, H)
    # 장애물(폰 몸체·소품) 먼저 위치를 정해 글이 피해 가게 한다
    shot = ss.load_screen(os.path.join(src_dir, copy["calendar"]["src"]))
    lay, body, (lx, ly) = phone_rotated(shot, L["phone_w"], L["phone_ang"], L["tablet"])
    pcx, pcy = L["phone_c"]
    ppos = (round(pcx - lx), round(pcy - ly))
    obs_img = Image.new("L", (CW, H), 0)
    obs_img.paste(body.getchannel("A"), ppos, body.getchannel("A"))
    props = []
    specs = list(zip(copy["hero"].get("props", []), L["hero_props"])) + \
        list(zip(copy["calendar"].get("props", []), L["props"]))
    for p, spec in specs:
        pl, pos = prop_layer(p, spec, L["prop_s"])
        props.append((pl, pos))
        a = pl.getchannel("A").point(lambda v: 255 if v > 200 else 0)  # 그림자는 빼고 종이만
        obs_img.paste(a, pos, a)
    obs = np.asarray(obs_img) > 0
    # 글은 따로 레이어에 그려 겹침 점검에 쓴다
    txt = Image.new("RGBA", (CW, H), (0, 0, 0, 0))
    hero_box, hsize, hok = draw_hero(txt, copy["hero"], L, obs)
    p2_bottom = draw_p2_text(txt, copy["calendar"], L, obs, W)
    canvas.alpha_composite(txt)
    canvas.alpha_composite(lay, ppos)
    for pl, pos in props:
        canvas.alpha_composite(pl, pos)
    rgb = canvas.convert("RGB")
    rgb.crop((0, 0, W, H)).save(os.path.join(out_dir, "01-hero.png"))
    rgb.crop((W, 0, CW, H)).save(os.path.join(out_dir, "02-calendar.png"))
    # 점검: 글 ↔ 장애물 겹침, 글이 이음매 안전 폭에 들어갔는지
    ta = np.asarray(txt.getchannel("A")) > 40
    hit = int((ta & obs).sum())
    band = ta[:, int(L["CUT"] - L["SAFE"] / 2):int(L["CUT"] + L["SAFE"] / 2)].sum()
    warn = []
    if hit:
        warn.append("글과 폰·소품 겹침 %d점" % hit)
    if band:
        warn.append("글이 이음매 근처 %d점" % band)
    if not hok:
        warn.append("큰 글이 최소 크기에서도 자리가 모자람")
    print("  01·02 큰 글 %dpx, 글 영역 %s, 2번 장 글 아래 y=%d%s" % (
        hsize, tuple(round(v) for v in hero_box), p2_bottom, ("  경고: " + ", ".join(warn)) if warn else ""))
    return warn


def make_rest(copy, shot_copy, src_dir, out_dir, W, H):
    c = dict(copy["reliable"], _idx=2)
    ss.make(os.path.join(src_dir, c["src"]), os.path.join(out_dir, "03-reliable.png"), W, H, c)
    order = shot_copy["order"]
    for n, i in enumerate(range(TAIL_FROM, TAIL_FROM + 4), 4):
        name = order[i - 1]
        c = dict(shot_copy["shots"][name], _idx=i)
        ss.make(os.path.join(src_dir, name), os.path.join(out_dir, "%02d-%s.png" % (n, c["slug"])), W, H, c)


# ---- 위젯 장(8장 세트의 04번) ----
# 홈 화면 캡처를 폰(아이패드는 태블릿) 목업에 넣되, 위젯이 주인공이 되게 크게 키우고 아래쪽은 캔버스 밖으로 잘라 낸다.
# 캡처 아래쪽(독·다른 앱·떠 있는 창)이 안 보이도록 '보일 비율'(vis)을 기기별로 정한다.
WIDGET_SRC_DIR = "store-assets/screenshots/widget-2026-11-21"
FINAL8_DIR = "store-assets/store-shots/final8"
WIDGET_SPEC = {
    # vis: 캡처 세로 중 보일 최대 비율 / pw: 폰 폭 최대(캔버스 폭 비율) / ang: 기울기 / pk: 소품 배율
    # props: (캡처 세로 위치 비율, 가로 위치, 기울기, 테이프 기울기) — 가로 위치 0=왼쪽 가장자리, 1=오른쪽 가장자리,
    #        그 밖의 소수는 캔버스 폭 비율. 위젯 내용·상태바를 가리지 않는 바탕화면·빈칸 위에만 둔다.
    "play": {"vis": 0.74, "pw": 0.86, "ang": -2.5, "pk": 1.0,
             "props": [(0.42, 0, -7, -5), (0.50, 1, 6, 4), (0.585, 0, -4, 3)]},
    # 아이폰 캡처는 위젯이 화면 75%까지 차서 — '오늘' 쪽지는 큰 위젯 마지막 줄 오른쪽 빈칸(30일 뒤), 달력 소품은 아래 가운데(시스템 언어로 찍힌 '검색' 알약을 덮는다),
    # '다음' 쪽지는 큰 위젯 아래 왼쪽 바탕화면. (상태바 시계 위에 두면 9:41이 가려진다 — 2026-11-21 수정)
    "iphone63": {"vis": 0.86, "pw": 0.90, "ang": -2.5, "pk": 0.80,
                 "props": [(0.706, 0.68, -5, -4), (0.772, 0.47, 5, 4), (0.785, 0, -4, 3)]},
    # 아이패드: 위젯은 화면 위 30%에 있고 그 아래는 빈 바탕화면 — 소품을 그 빈 곳에 크게
    "ipad13": {"vis": 0.80, "pw": 0.88, "ang": -2.0, "pk": 0.80, "tablet": True,
               "props": [(0.43, 0.22, -7, -5), (0.50, 0.77, 6, 4), (0.65, 0.42, -4, 3)]},
}
# Play 캡처 오른쪽 가장자리에 숨겨 둔 유튜브 PiP(떠 있는 창) — 원본은 두고 합성할 때만 옆 바탕화면을 거울로 비춰 메운다
PIP_BOX = (990, 1680, 1080, 1980)


def hide_pip(shot):
    x0, y0, x1, y1 = PIP_BOX
    if shot.width != 1080 or shot.height < y1:
        return shot
    shot = shot.copy()
    w = x1 - x0
    strip = shot.crop((x0 - w, y0, x0, y1)).transpose(Image.FLIP_LEFT_RIGHT)
    shot.paste(strip, (x0, y0))
    return shot


def make_widget(c, src_path, out_path, W, H, kind):
    sp = WIDGET_SPEC[kind]
    tablet = sp.get("tablet", False)
    s = W / 1080
    canvas = paper(W, H)
    # 글 영역(가운데 정렬 꼬리표 + 큰 글 두 줄 + 작은 글) — 03~07번 장과 같은 함수
    txt = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    tall = W != 1080
    ts = s * (0.82 if tablet else 1.0)  # 아이패드 글자 배율 — 03~07번 장(store-shot.py make)과 같게
    y0 = 96 + (60 if tall and not tablet else 0)
    tb = ss.draw_text_block(txt, W, ts, c, y0=y0)
    shot = ss.load_screen(src_path)
    if kind == "play":
        shot = hide_pip(shot)
    # 보일 비율만큼만 잘라 쓰고(아래는 캔버스 밖), 폰 테두리는 아래로 이어지게 넉넉히 둔다
    vis_h = round(shot.height * sp["vis"])
    extra = round(shot.height * 0.06)
    gap = round(54 * s)
    top = tb + gap  # 폰 위쪽 끝(회전 전)
    pw = round(W * sp["pw"])
    lay, body, (lx, ly) = phone_rotated(shot.crop((0, 0, shot.width, vis_h + extra)), pw, sp["ang"], tablet)
    bz = round(8 * pw / 843) if tablet else round(14 * pw / 600)  # phone_rotated 와 같은 테두리
    inner_w = round(pw) - 2 * bz
    k = inner_w / shot.width  # 캡처 → 캔버스 배율
    # 폰은 최대 폭으로 두고, 그래도 캡처가 vis 보다 많이 보이면 폰을 아래로 내린다(아래 독·다른 앱이 안 보이게)
    top = max(top, round(H - bz - vis_h * k))
    ph = round((vis_h + extra) * k) + 2 * bz
    pcx, pcy = W / 2, top + ph / 2
    ppos = (round(pcx - lx), round(pcy - ly))
    obs_img = Image.new("L", (W, H), 0)
    obs_img.paste(body.getchannel("A"), ppos, body.getchannel("A"))
    canvas.alpha_composite(txt)
    canvas.alpha_composite(lay, ppos)
    # 소품: 폰 앞, 위젯 내용이 없는 곳에만
    pk = sp["pk"]
    for p, (fy, xs, ang, ta) in zip(c.get("props", [])[:3], sp["props"]):
        # 긴 쪽지 글(라틴 문자 10자 이상)은 쪽지를 조금 넓혀 글자가 너무 작아지지 않게
        nw = 250 * pk * (1.2 if len(p["text"]) >= 10 and p["text"].isascii() else 1.0)
        base = ss.prop_calendar(p["text"], 256 * pk, s) if p["kind"] == "calendar" else ss.prop_note(p["text"], nw, s)
        pl = ss.with_tape_shadow(base, ang, s, ta)
        if xs == 0:
            cx = pl.width / 2 - 14 * s
        elif xs == 1:
            cx = W - pl.width / 2 + 14 * s
        else:
            cx = W * xs
        cy = top + bz + fy * shot.height * k
        pos = (round(cx - pl.width / 2), round(cy - pl.height / 2))
        canvas.alpha_composite(pl, pos)
        a = pl.getchannel("A").point(lambda v: 255 if v > 200 else 0)
        obs_img.paste(a, pos, a)
    canvas.convert("RGB").save(out_path)
    ta_ = np.asarray(txt.getchannel("A")) > 40
    hit = int((ta_ & (np.asarray(obs_img) > 0)).sum())
    print("  위젯 장 %s: 글 아래 y=%d, 폰 위 y=%d, 캡처 %.0f%% 보임%s" % (
        kind, tb, top, 100 * min(1, (H - top - bz) / (shot.height * k)), ("  경고: 글과 폰·소품 겹침 %d점" % hit) if hit else ""))
    return hit


def main_widget(a, W, H, kind):
    ss.set_lang_fonts(a.lang)
    c = json.load(open(a.copy, encoding="utf-8"))[a.lang]["widget"]
    src = os.path.join(a.inp or os.path.join(ROOT, WIDGET_SRC_DIR, a.lang), c["src"][kind])
    out = a.out or os.path.join(ROOT, FINAL8_DIR, kind, a.lang)
    os.makedirs(out, exist_ok=True)
    path = os.path.join(out, "04-widget.png")
    make_widget(c, src, path, W, H, kind)
    print("만듦:", path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", default="ko")
    ap.add_argument("--size", default="1080x1920", choices=sorted(KINDS))
    ap.add_argument("--in", dest="inp", default=None, help="원본 캡처 폴더(읽기만)")
    ap.add_argument("--out", default=None, help="출력 폴더")
    ap.add_argument("--copy", default=os.path.join(HERE, "store-pano-copy.json"))
    ap.add_argument("--shot-copy", default=os.path.join(HERE, "store-shot-copy.json"))
    ap.add_argument("--only-pano", action="store_true", help="1·2번 장만(배치 시험용)")
    ap.add_argument("--widget", action="store_true",
                    help="위젯 장만 → final8/<종류>/<lang>/04-widget.png (기존 7장은 안 만든다)")
    a = ap.parse_args()
    W, H = map(int, a.size.split("x"))
    kind = KINDS[a.size]
    if a.widget:
        return main_widget(a, W, H, kind)
    src = a.inp or os.path.join(ROOT, SRC_DIRS[kind], a.lang)
    out = a.out or os.path.join(ROOT, "store-assets/store-shots/pano7", kind, a.lang)
    os.makedirs(out, exist_ok=True)
    ss.set_lang_fonts(a.lang)
    copy = json.load(open(a.copy, encoding="utf-8"))[a.lang]
    shot_copy = json.load(open(a.shot_copy, encoding="utf-8"))[a.lang]
    print("%s %s → %s" % (kind, a.lang, out))
    make_pano(copy, src, out, W, H)
    if not a.only_pano:
        make_rest(copy, shot_copy, src, out, W, H)


if __name__ == "__main__":
    main()
