#!/bin/bash
# 파노라마 7장 세트(01 hero · 02 calendar 이어짐 · 03 reliable · 04~07 기존 장)를
# 9개 언어 x 3종(Play / 아이폰 6.3 / 아이패드 13) 전부 다시 뽑고 미리보기를 만든다.
# 원본(store-assets/screenshots, store-assets/appstore)은 읽기만 한다. 결과: store-assets/store-shots/pano7/
set -e
cd "$(dirname "$0")/.."
for lang in ko en ja zh-Hans zh-Hant es fr de pt; do
  for size in 1080x1920 1206x2622 2064x2752; do
    python3 tools/store-pano.py --lang $lang --size $size
  done
done
python3 tools/store-pano-preview.py
