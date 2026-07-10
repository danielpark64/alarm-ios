#!/bin/bash
# 꺼둔 알람이 울리는 버그 자동 테스트
# 사용법: ./scripts/test-disabled-alarm.sh [adb-serial]
#   예) ./scripts/test-disabled-alarm.sh RF9R3049REV
#       ./scripts/test-disabled-alarm.sh R5CR80EAMRE
#
# 사전 조건: 앱을 한 번 열어서 알람을 모두 끄고 나서 실행할 것.
#            (그래야 activeAlarmIds가 SharedPreferences에 저장됨)

PKG="com.danielpark.alarmapp"
RECEIVER="${PKG}/.AlarmReceiver"
SERIAL=${1:-}

# adb 디바이스 확인
if [ -n "$SERIAL" ]; then
  ADB="adb -s $SERIAL"
else
  ADB="adb"
fi

if ! $ADB get-state > /dev/null 2>&1; then
  echo "❌ 기기가 연결되지 않았습니다. adb devices 확인."
  exit 1
fi

echo "📱 기기: $($ADB get-serialno)"
echo ""

pass=0
fail=0

run_test() {
  local desc="$1"
  local alarm_id="$2"
  local expect_ring="$3"   # "yes" or "no"

  $ADB logcat -c 2>/dev/null
  sleep 0.3

  $ADB shell am broadcast \
    -a android.intent.action.MAIN \
    -n "$RECEIVER" \
    --ei alarmId "$alarm_id" \
    --es "${PKG}.EXTRA_TITLE" "테스트알람" \
    --es "${PKG}.EXTRA_BODY" "00:00 알람" \
    --ez soundOn false \
    --ez vibOn false \
    --ef volume 0.0 \
    > /dev/null 2>&1

  sleep 1.5

  local started
  started=$($ADB logcat -d 2>/dev/null | grep -c "AlarmService\|startForegroundService\|Start proc.*AlarmService" || true)

  if [ "$expect_ring" = "no" ]; then
    if [ "$started" -eq 0 ]; then
      echo "✅ PASS │ $desc (alarmId=$alarm_id) → 울리지 않음 (정상)"
      pass=$((pass + 1))
    else
      echo "❌ FAIL │ $desc (alarmId=$alarm_id) → AlarmService 시작됨! (버그)"
      fail=$((fail + 1))
    fi
  else
    if [ "$started" -gt 0 ]; then
      echo "✅ PASS │ $desc (alarmId=$alarm_id) → 울림 (정상)"
      pass=$((pass + 1))
    else
      echo "⚠️  SKIP │ $desc (alarmId=$alarm_id) → AlarmService 없음 (activeAlarmIds 미설정 가능)"
    fi
  fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "테스트 1: 존재하지 않는 알람 ID → 울리면 안 됨"
run_test "비활성 알람 차단" 9999 "no"

echo ""
echo "테스트 2: alarmId=-1 (시스템 내부용) → activeAlarmIds 체크 스킵"
# alarmId=-1은 체크에서 제외되므로 울릴 수 있음 (내부 로직)
echo "ℹ️  SKIP │ alarmId=-1은 내부용 — 테스트 제외"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "결과: ✅ $pass 통과 │ ❌ $fail 실패"
echo ""

if [ "$fail" -gt 0 ]; then
  echo "🔴 버그 있음 — 로그 확인:"
  $ADB logcat -d 2>/dev/null | grep -E "AlarmService|AlarmReceiver|activeAlarm" | tail -20
  exit 1
else
  echo "🟢 이 시나리오에서 버그 없음"
  exit 0
fi
