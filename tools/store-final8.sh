#!/bin/bash
# 최종 8장 세트(9개 언어 x 3종 = 216장)를 다시 조립한다.
#   01~03, 05~08 = store-shots/pano7 의 01~03, 04~07 을 그대로 복사(다시 그리지 않는다, pano7 은 읽기만)
#   04-widget     = tools/store-pano.py --widget 으로 새로 그림(원본: store-assets/screenshots/widget-2026-11-21)
# 결과: store-assets/store-shots/final8/{play,iphone63,ipad13}/<lang>/01-hero … 08-everyday.png
#       + final8/preview/<kind>-<lang>.jpg(8장 나란히) + final8/preview/widget-<kind>.jpg(위젯 장 9개 언어)
# pano7 자체를 다시 뽑으려면 먼저 tools/store-pano-all.sh 를 돌린다.
set -e
cd "$(dirname "$0")/.."
P=store-assets/store-shots/pano7
F=store-assets/store-shots/final8
LANGS="ko en ja zh-Hans zh-Hant es fr de pt"
for kind in play iphone63 ipad13; do
  case $kind in play) size=1080x1920 ;; iphone63) size=1206x2622 ;; ipad13) size=2064x2752 ;; esac
  for lang in $LANGS; do
    d=$F/$kind/$lang
    mkdir -p $d
    cp $P/$kind/$lang/01-hero.png     $d/01-hero.png
    cp $P/$kind/$lang/02-calendar.png $d/02-calendar.png
    cp $P/$kind/$lang/03-reliable.png $d/03-reliable.png
    cp $P/$kind/$lang/04-rotation.png $d/05-rotation.png
    cp $P/$kind/$lang/05-override.png $d/06-override.png
    cp $P/$kind/$lang/06-cycle.png    $d/07-cycle.png
    cp $P/$kind/$lang/07-everyday.png $d/08-everyday.png
    python3 tools/store-pano.py --widget --lang $lang --size $size | sed "s/^/$lang /" | grep -v "^$lang 만듦"
  done
done
python3 tools/store-final8-check.py
