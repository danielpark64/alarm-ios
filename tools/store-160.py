#!/usr/bin/env python3
"""교대알람 1.6.0 스토어 스크린샷 8장(시안) — 지난 8장 틀(종이 콜라주, 1·2번 장 이어짐)을 그대로 쓰고 장 구성만 바꾼다.

  01 hero · 02 calendar  = store-pano.py make_pano (1·2번 장을 한 캔버스에 그려 가운데서 자름)
  03 reliable            = Play 는 '꺼진 화면에서도', 아이폰은 AlarmKit '무음 모드에서도 시계 알람처럼'
  04 share · 05 together = 근무표 공유(받기 팝업 / 다 같이 쉬는 날)
  06 widget              = store-pano.py make_widget
  07 rotation · 08 override
문구: tools/store-160-copy.json (장마다 play/iphone63 따로 줄 수 있다). 원본 캡처는 읽기만 한다.

사용 예:
  python3 tools/store-160.py --lang ko --size 1350x2400 --in <원본>/play/ko --out <시안>/play/ko
  python3 tools/store-160.py --lang ko --size 1206x2622 --in <원본>/iphone63/ko --out <시안>/iphone63/ko
  python3 tools/store-160.py --lang ko --size 2064x2752 --in <원본>/ipad13/ko --out <결과>/ipad13/ko
  (아이패드 = App Store, 장마다 ipad13 문구가 없으면 iphone63 문구. 위젯 원본은 ipad-home.png)
"""
import argparse, importlib.util, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("store_pano", os.path.join(HERE, "store-pano.py"))
sp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sp)
ss = sp.ss

KINDS = {"1080x1920": "play", "1350x2400": "play", "1206x2622": "iphone63", "2064x2752": "ipad13"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", default="ko")
    ap.add_argument("--size", default="1350x2400", choices=sorted(KINDS))
    ap.add_argument("--in", dest="inp", required=True, help="원본 캡처 폴더(읽기만)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--copy", default=os.path.join(HERE, "store-160-copy.json"))
    a = ap.parse_args()
    W, H = map(int, a.size.split("x"))
    kind = KINDS[a.size]
    os.makedirs(a.out, exist_ok=True)
    ss.set_lang_fonts(a.lang)
    copy = json.load(open(a.copy, encoding="utf-8"))[a.lang]
    print("%s %s → %s" % (kind, a.lang, a.out))
    warns = sp.make_pano(copy, a.inp, a.out, W, H)
    for n, sl in enumerate(copy["slides"], 3):
        # 스토어별 문구가 있으면 덮어쓴다. 아이패드는 App Store 라 따로 없으면 아이폰(iphone63) 문구를 쓴다
        ov = sl.get(kind) or (sl.get("iphone63", {}) if kind == "ipad13" else {})
        c = dict(sl, **ov)
        out = os.path.join(a.out, "%02d-%s.png" % (n, sl["slug"]))
        if sl.get("widget"):
            hit = sp.make_widget(c, os.path.join(a.inp, sl["src"][kind]), out, W, H, kind)
            if hit:
                warns.append("%s 글 겹침" % sl["slug"])
        else:
            c["_idx"] = n - 1  # 좌우 번갈아(짝·홀)
            ss.make(os.path.join(a.inp, c["src"]), out, W, H, c)
        print("만듦:", out)
    if warns:
        print("경고:", warns)


if __name__ == "__main__":
    main()
