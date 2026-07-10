#!/bin/bash
# ============================================================
# 교대알람 자동 테스트 스위트
# ============================================================
# 사용법:
#   ./scripts/test-disabled-alarm.sh [adb-serial]
#
#   예) ./scripts/test-disabled-alarm.sh RF9R3049REV   # 32
#       ./scripts/test-disabled-alarm.sh R5CR80EAMRE   # 플립
#       ./scripts/test-disabled-alarm.sh               # 연결된 기기 자동
#
# 사전 조건: 앱을 한 번 열어두면 더 정확함 (activeAlarmIds 설정됨)
# ============================================================

PKG="com.danielpark.alarmapp"
RECEIVER="${PKG}/.AlarmReceiver"
SERIAL=${1:-}
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

pass=0; fail=0; skip=0

# ── ADB 설정 ─────────────────────────────────────────────────
if [ -n "$SERIAL" ]; then
  ADB="adb -s $SERIAL"
else
  ADB="adb"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  교대알람 자동 테스트 스위트"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 코드 정적 분석 (기기 불필요) ─────────────────────────────

echo ""
echo -e "${BLUE}[정적 분석]${NC}"

# ── 정적 테스트 1: TypeScript 컴파일 ──────────────────────────
printf "  TS 컴파일 체크 ... "
if cd "$ROOT" && npx tsc --noEmit 2>/dev/null; then
  echo -e "${GREEN}PASS${NC}"
  pass=$((pass+1))
else
  echo -e "${RED}FAIL — 타입 에러 있음${NC}"
  npx tsc --noEmit 2>&1 | head -10
  fail=$((fail+1))
fi

# ── 정적 테스트 2: cancelNativeAlarms에 bare alarmId 취소 포함 ──
printf "  cancelNativeAlarms bare alarmId 체크 ... "
if grep -q "cancelAlarm(alarmId)" "$ROOT/src/utils/notifications/android.ts" 2>/dev/null; then
  echo -e "${GREEN}PASS${NC}"
  pass=$((pass+1))
else
  echo -e "${RED}FAIL — bare alarmId 취소 누락!${NC}"
  fail=$((fail+1))
fi

# ── 정적 테스트 3: AlarmReceiver에 activeAlarmIds 차단 로직 존재 ──
printf "  AlarmReceiver 비활성 차단 로직 체크 ... "
if grep -q "activeAlarmIds" "$ROOT/android/app/src/main/java/com/danielpark/alarmapp/AlarmReceiver.kt" 2>/dev/null; then
  echo -e "${GREEN}PASS${NC}"
  pass=$((pass+1))
else
  echo -e "${RED}FAIL — AlarmReceiver에 차단 로직 없음!${NC}"
  fail=$((fail+1))
fi

# ── 정적 테스트 4: widgetSync에서 saveActiveAlarmIds 호출 ──────
printf "  saveActiveAlarmIds 호출 체크 ... "
if grep -q "saveActiveAlarmIds" "$ROOT/src/utils/widgetSync.ts" 2>/dev/null; then
  echo -e "${GREEN}PASS${NC}"
  pass=$((pass+1))
else
  echo -e "${RED}FAIL — saveActiveAlarmIds 호출 없음!${NC}"
  fail=$((fail+1))
fi

# ── 정적 테스트 5: 이중 시스템 체크 (Expo + 네이티브 둘 다) ───
printf "  이중 알람 시스템 체크 (Expo + AlarmManager) ... "
HAS_EXPO=$(grep -c "scheduleAlarmTriggers\|scheduleNotificationAsync" "$ROOT/src/utils/notifications/index.ts" 2>/dev/null || echo 0)
HAS_NATIVE=$(grep -c "scheduleNative\|cancelNativeAlarms" "$ROOT/src/utils/notifications/index.ts" 2>/dev/null || echo 0)
if [ "$HAS_EXPO" -gt 0 ] && [ "$HAS_NATIVE" -gt 0 ]; then
  echo -e "${GREEN}PASS${NC}"
  pass=$((pass+1))
else
  echo -e "${RED}FAIL — Expo 또는 네이티브 AlarmManager 호출 누락!${NC}"
  fail=$((fail+1))
fi

# ── 정적 테스트 6: rescheduleAll이 비활성 알람도 cancel ─────────
printf "  rescheduleAll 비활성 취소 체크 ... "
if grep -A5 "rescheduleAll" "$ROOT/src/utils/notifications/index.ts" 2>/dev/null | grep -q "cancelNativeAlarms"; then
  echo -e "${GREEN}PASS${NC}"
  pass=$((pass+1))
else
  echo -e "${RED}FAIL — rescheduleAll에서 cancelNativeAlarms 누락!${NC}"
  fail=$((fail+1))
fi

# ── ADB 런타임 테스트 (기기 필요) ───────────────────────────────

echo ""
echo -e "${BLUE}[ADB 런타임 테스트]${NC}"

if ! $ADB get-state > /dev/null 2>&1; then
  echo -e "  ${YELLOW}기기 없음 — ADB 테스트 전체 SKIP${NC}"
  skip=$((skip+3))
else
  DEVICE_NAME=$($ADB shell getprop ro.product.model 2>/dev/null | tr -d '\r')
  echo "  기기: $DEVICE_NAME ($($ADB get-serialno))"

  # 공통: ADB 발화 함수
  fire_receiver() {
    local alarm_id="$1"
    local is_rep="${2:-false}"
    $ADB logcat -c 2>/dev/null
    sleep 0.3
    $ADB shell am broadcast \
      -n "$RECEIVER" \
      --ei alarmId "$alarm_id" \
      --es "${PKG}.EXTRA_TITLE" "테스트알람" \
      --es "${PKG}.EXTRA_BODY" "00:00 알람" \
      --ez isRep "$is_rep" \
      --ez soundOn false \
      --ez vibOn false \
      --ef volume 0.0 \
      > /dev/null 2>&1
    sleep 1.5
    $ADB logcat -d 2>/dev/null | grep -c "com.danielpark.alarmapp.AlarmService\|Start proc.*AlarmService\|startForegroundService" 2>/dev/null || echo 0
  }

  # ── ADB 테스트 1: 비활성 알람 (메인) 차단 ──────────────────
  printf "  비활성 알람 메인 발화 차단 (alarmId=9999) ... "
  result=$(fire_receiver 9999 false)
  if [ "$result" -eq 0 ]; then
    echo -e "${GREEN}PASS${NC}"
    pass=$((pass+1))
  else
    echo -e "${RED}FAIL — AlarmService 시작됨! (꺼둔 알람이 울림)${NC}"
    fail=$((fail+1))
  fi

  # ── ADB 테스트 2: 비활성 알람 rep 슬롯 차단 ────────────────
  printf "  비활성 알람 +1분 rep 슬롯 차단 (alarmId=9999, isRep=true) ... "
  result=$(fire_receiver 9999 true)
  if [ "$result" -eq 0 ]; then
    echo -e "${GREEN}PASS${NC}"
    pass=$((pass+1))
  else
    echo -e "${RED}FAIL — rep 슬롯에서 AlarmService 시작됨!${NC}"
    fail=$((fail+1))
  fi

  # ── ADB 테스트 3: alarmId=-1은 차단 안 됨 (시스템 내부) ───
  printf "  시스템 내부 알람 (alarmId=-1) 허용 여부 ... "
  $ADB logcat -c 2>/dev/null
  sleep 0.3
  $ADB shell am broadcast \
    -n "$RECEIVER" \
    --ei alarmId -1 \
    --es "${PKG}.EXTRA_TITLE" "내부테스트" \
    --es "${PKG}.EXTRA_BODY" "00:00 알람" \
    --ez isRep false \
    --ez soundOn false \
    --ez vibOn false \
    --ef volume 0.0 \
    > /dev/null 2>&1
  sleep 1.5
  # alarmId=-1은 체크 건너뜀 → 서비스 시작 시도하는 게 정상
  # (단, AlarmService 자체가 소리 없이 시작될 수 있음)
  echo -e "${YELLOW}SKIP${NC} (수동 확인 필요 — 시스템 내부용)"
  skip=$((skip+1))

fi

# ── 결과 요약 ────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
total=$((pass+fail))
echo -e "  결과: ${GREEN}✅ $pass 통과${NC} │ ${RED}❌ $fail 실패${NC} │ ${YELLOW}⏭  $skip 스킵${NC} │ 전체 $total"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$fail" -gt 0 ]; then
  echo ""
  echo -e "${RED}🔴 실패한 테스트가 있습니다. 관련 로그:${NC}"
  if $ADB get-state > /dev/null 2>&1; then
    $ADB logcat -d 2>/dev/null | grep -E "AlarmService|AlarmReceiver|activeAlarm" | tail -15
  fi
  exit 1
else
  echo ""
  echo -e "${GREEN}🟢 자동 테스트 전체 통과${NC}"
  echo ""
  echo -e "${YELLOW}수동 확인 항목 (기기 직접 조작 필요):${NC}"
  echo "  □ 잠금화면: 알람 끄고 화면 끔 → 시간 지나도 안 울리는지"
  echo "  □ 백그라운드: 알람 끄고 앱 홈으로 → 안 울리는지"
  echo "  □ 포그라운드: 알람 끄고 앱 켜둠 → 안 울리는지"
  exit 0
fi
