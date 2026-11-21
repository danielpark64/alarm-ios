#!/bin/bash
# 9개 언어 x 3종(Play / 아이폰 6.3 / 아이패드 13) 스토어 스크린샷을 한 번에 다시 뽑는다.
# 원본(store-assets/screenshots, store-assets/appstore)은 읽기만 하고 덮어쓰지 않는다.
set -e
cd "$(dirname "$0")/.."
OUT=store-assets/store-shots
for lang in ko en ja zh-Hans zh-Hant es fr de pt; do
  python3 tools/store-shot.py --in store-assets/screenshots/i18n-2026-10-14/$lang --out $OUT/play/$lang --lang $lang --size 1080x1920
  python3 tools/store-shot.py --in store-assets/appstore/screenshots-iphone63/$lang --out $OUT/iphone63/$lang --lang $lang --size 1206x2622
  python3 tools/store-shot.py --in store-assets/appstore/screenshots-ipad13/$lang --out $OUT/ipad13/$lang --lang $lang --size 2064x2752
done
# 눈으로 확인용 미리보기
python3 tools/store-shot-preview.py
