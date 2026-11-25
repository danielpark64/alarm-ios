#!/usr/bin/env bash
# iOS 실기기 자동 확인 — Android의 adb처럼, 연결된 iPhone/iPad를 맥에서 직접 조작한다(화면 미러링 없음).
#
# 방식: Appium(XCUITest 드라이버)이 기기에 WebDriverAgent(WDA)를 깔고, XCTest API로 탭·캡처·접근성 트리를 주고받는다.
#   앱 프로젝트(ios/)를 전혀 건드리지 않으므로 expo prebuild와 무관하고, 어느 앱이든 bundleId만 바꿔 쓴다.
#   알림 배너·알림 센터·잠금 화면은 SpringBoard 화면이라, 앱 안 UI 테스트 타깃 없이도 여기서 누를 수 있다.
#
# 처음 한 번(맥):
#   npm install -g appium && appium driver install xcuitest
#   기기: 개발자 모드 켜기, 맥과 페어링(USB). 첫 세션 때 WDA가 자동 서명·설치된다(팀 T5Z6ACK2PU, 키는 Xcode 자동 서명).
#   기기 설정 › 개발자 › "UI 자동화 허용"(Enable UI Automation)이 꺼져 있으면 켠다.
#
# 사용법:
#   scripts/ios-device-test.sh <udid> <bundleId> <명령> [인자…]
#
#   기기·도구
#     doctor                       Appium 서버·세션·기기 잠금·앱 설치 여부 점검(서버가 없으면 띄운다)
#     install <app 경로>           xcrun devicectl로 덮어 설치(데이터 유지) — 설치 뒤 세션은 자동으로 다시 만든다
#     volume-min                   음량 내림 버튼 16번(밤 시험 전에)
#   앱
#     launch                       앱 실행(앞으로)
#     kill                         앱 완전 종료(최근 앱에서 쓸어 올린 것과 같음)
#     state                        0 없음 · 1 안 돌아감 · 2/3 백그라운드 · 4 앞
#     link '<url>'                 딥링크로 열기(devicectl --payload-url). 같은 URL을 다시 쓰려면 &n=<숫자>를 바꿔라
#     tap-xy <x> <y>               좌표(포인트, 가로 1133×744 기준 미니) 탭 — mobile: tap. RN 앱 안은 이것만 된다
#     drag <x1> <y1> <x2> <y2>     끌기(휠 돌리기·스크롤)
#     tap '<글자>'                 접근성 이름으로 찾아 누르기 — SpringBoard·시스템 화면용(RN 앱 안 요소는 트리에 안 잡힘)
#     texts                        앞 화면의 보이는 글자 목록(접근성 트리 — RN 앱은 거의 비어 있음, 캡처로 볼 것)
#     alert [keep]                 시스템 경고창 글자 읽기(RN 앱의 Alert는 안 잡힘)
#     shot <이름>                  ~/Desktop/스크린샷/<이름>.png로 캡처
#   알림(SpringBoard)
#     home                         홈 화면으로
#     notif-wait '<글자>' [초] [center]          배너(또는 center면 알림 센터)에 그 글자가 든 알림이 올 때까지
#     notif-action '<글자>' '<버튼>' [초]  알림이 올 때까지 기다렸다가 알림 센터를 열고, 길게 눌러 버튼을 누른다
#                                  (배너는 길게 누르지 않는다 — 배너가 사라지면 홈 화면이 편집 모드로 들어감)
#                                  NOTIF_SHOT=<png> 를 주면 버튼이 펼쳐진 화면을 캡처
#     notif-center                 알림 센터 열기(맨 위 왼쪽에서 아래로)
#     lock | unlock | is-locked    잠금·풀기·상태 — 미니(iPadOS 27.2.1)에선 lock이 시간 초과로 안 됨(11-26)
#   앱별 묶음(교대알람만 — 다른 앱은 위 명령으로 조합)
#     alarm-pending                교대알람 dumpPending 딥링크 → 경고창을 캡처하고 닫음
#     alarm-report                 교대알람 report=1 딥링크 → 앱 저장소에서 dev_report JSON을 꺼내 출력
#
# 다른 앱 예:
#   세이람   scripts/ios-device-test.sh 00008110-00061C9C02FB801E com.danielpark.sayram launch
#   사진첩   scripts/ios-device-test.sh 00008110-00061C9C02FB801E com.danielpark.albummory shot 사진첩-첫화면
#   장바구니 scripts/ios-device-test.sh 00008110-00061C9C02FB801E com.danielpark.saycart texts
#   (각 앱의 개발 딥링크 주소만 link로 넘기면 된다. 알림 버튼 글자는 그 앱 문구 그대로.)
#
# 교대알람 진동만 알람 예(밤에도 됨 — 소리 알람·AlarmKit 소리는 쓰지 말 것):
#   T="scripts/ios-device-test.sh 00008110-00061C9C02FB801E com.danielpark.alarmapp"
#   $T link 'alarmapp://?k=1ef80163d089870d&testAlarm=1&n=1'      # 1분 뒤 '테스트 알람'(진동만)
#   $T home; $T notif-action '테스트 알람' '5분 후 다시' 120
#   $T alarm-pending
#   $T link 'alarmapp://?k=1ef80163d089870d&clearTestAlarms=1&n=2'
#   미니에는 사용자 알람이 있다 — clearAll 금지, clearTestAlarms만.
#
# 환경 변수: APPIUM_URL(기본 http://127.0.0.1:4723), IOS_TEAM(기본 T5Z6ACK2PU), WDA_BUNDLE_ID(기본 com.danielpark.wda),
#   SHOT_DIR(기본 ~/Desktop/스크린샷), ALARM_KEY(교대알람 개발 링크 키)
set -euo pipefail
[[ $# -lt 3 ]] && { sed -n '2,55p' "$0"; exit 1; }
UDID=$1; BUNDLE=$2; CMD=$3; shift 3
HERE=$(cd "$(dirname "$0")" && pwd)
export IOS_UDID=$UDID
WD="python3 $HERE/ios-device/wd.py"
SHOT_DIR=${SHOT_DIR:-$HOME/Desktop/스크린샷}
ALARM_KEY=${ALARM_KEY:-1ef80163d089870d}
APPIUM_URL=${APPIUM_URL:-http://127.0.0.1:4723}

ensure_appium() {
  curl -sf "$APPIUM_URL/status" >/dev/null && return
  command -v appium >/dev/null || { echo "✗ appium 없음 — npm install -g appium && appium driver install xcuitest"; exit 1; }
  mkdir -p ~/Library/Logs/appium
  nohup appium server -p 4723 --log ~/Library/Logs/appium/appium.log --log-level info >/dev/null 2>&1 &
  for _ in $(seq 1 30); do curl -sf "$APPIUM_URL/status" >/dev/null && return; sleep 1; done
  echo "✗ appium 서버가 안 뜸 — ~/Library/Logs/appium/appium.log"; exit 1
}

case $CMD in
  doctor)
    ensure_appium; echo "• Appium 서버 OK"
    xcrun devicectl list devices 2>/dev/null | grep -F "$UDID" || { echo "✗ 기기가 안 보임(USB·페어링 확인)"; exit 1; }
    echo "• 세션: $($WD session)"
    echo "• 잠김: $($WD is-locked)"
    echo "• 앱 상태: $($WD state "$BUNDLE") (0이면 설치 안 됨)";;
  install)
    xcrun devicectl device install app --device "$UDID" "$1" | tail -3
    ensure_appium; $WD new-session >/dev/null; echo "• 세션 새로 만듦";;
  launch)   ensure_appium; $WD activate "$BUNDLE";;
  kill)     ensure_appium; $WD terminate "$BUNDLE";;
  state)    ensure_appium; $WD state "$BUNDLE";;
  link)
    xcrun devicectl device process launch --device "$UDID" --payload-url "$1" "$BUNDLE" >/dev/null && echo "• 링크 열었음";;
  shot)     ensure_appium; mkdir -p "$SHOT_DIR"; $WD shot "$SHOT_DIR/$1.png";;
  alarm-pending)
    ensure_appium
    xcrun devicectl device process launch --device "$UDID" --payload-url "alarmapp://?k=$ALARM_KEY&dumpPending=1&n=$RANDOM$RANDOM" "$BUNDLE" >/dev/null
    # RN 앱 안 경고창은 WDA 접근성 트리에 안 잡힌다(11-26 미니) — 캡처로 남기고 '확인'을 좌표로 눌러 닫는다. 글자는 alarm-report로.
    sleep 4; mkdir -p "$SHOT_DIR"; $WD shot "$SHOT_DIR/${BUNDLE##*.}-pending-$(date +%H%M%S).png"; $WD tap-xy 566 396;;
  alarm-report)
    xcrun devicectl device process launch --device "$UDID" --payload-url "alarmapp://?k=$ALARM_KEY&report=1&n=$RANDOM$RANDOM" "$BUNDLE" >/dev/null
    sleep 4
    TMP=$(mktemp -d)
    xcrun devicectl device copy from --device "$UDID" --domain-type appDataContainer --domain-identifier "$BUNDLE" \
      --source "Library/Application Support/$BUNDLE/RCTAsyncLocalStorage_V1" --destination "$TMP" >/dev/null
    python3 - "$TMP" <<'EOF'
import json, os, sys, hashlib
d = sys.argv[1]
m = json.load(open(os.path.join(d, 'manifest.json')))
v = m.get('dev_report')
if v is None:  # 큰 값은 manifest 대신 md5(키) 파일에 들어간다
    p = os.path.join(d, hashlib.md5(b'dev_report').hexdigest())
    v = open(p).read() if os.path.exists(p) else None
print(json.dumps(json.loads(v), ensure_ascii=False, indent=1) if v else '✗ dev_report 없음')
EOF
    rm -rf "$TMP";;
  *) ensure_appium; $WD "$CMD" "$@";;
esac
