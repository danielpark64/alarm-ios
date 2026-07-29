#!/bin/bash
# ============================================================
# 교대알람 자동 테스트 스위트 v2
# ============================================================
# 사용법:
#   ./scripts/test-alarm-suite.sh [옵션] [adb-serial]
#
#   옵션:
#     --all-off   앱에서 알람을 전부 끈 상태로 실행 → 등록 0개 기대
#     --static    정적 분석만 실행 (기기 없어도 됨)
#
#   예) ./scripts/test-alarm-suite.sh RF9R3049REV
#       ./scripts/test-alarm-suite.sh --all-off RF9R3049REV
#       ./scripts/test-alarm-suite.sh --static
# ============================================================

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG="com.danielpark.alarmapp"
ALL_OFF=false
STATIC_ONLY=false
SERIAL=""

# 인수 파싱
for arg in "$@"; do
  case "$arg" in
    --all-off)    ALL_OFF=true ;;
    --static)     STATIC_ONLY=true ;;
    RF9R3049REV|R5CR80EAMRE) SERIAL="$arg" ;;
    *)            SERIAL="$arg" ;;  # 기타 시리얼
  esac
done

ADB="adb${SERIAL:+ -s $SERIAL}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

pass=0; fail=0; warn=0

ok()   { echo -e "  ${GREEN}✅ PASS${NC}  $1"; pass=$((pass+1)); }
fail() { echo -e "  ${RED}❌ FAIL${NC}  $1"; fail=$((fail+1)); }
warn() { echo -e "  ${YELLOW}⚠️  WARN${NC}  $1"; warn=$((warn+1)); }
info() { echo -e "  ${BLUE}ℹ️ ${NC}  $1"; }

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  교대알람 자동 테스트 스위트${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# ═══════════════════════════════════════════════════════════
# 1. 정적 분석
# ═══════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}[1] 정적 코드 분석${NC} (기기 불필요)"

# TS 컴파일 — 에러는 경고로 표시 (Expo 라이브러리 타입 불일치 무시)
printf "  TS 컴파일 체크 ... "
TS_ERR=$(cd "$ROOT" && npx tsc --noEmit 2>&1 | grep -v "node_modules\|ReactotronConfig\|TS2556" | grep "error TS" | wc -l | tr -d ' ')
if [ "$TS_ERR" -eq 0 ]; then
  echo -e "${GREEN}PASS${NC}"
  pass=$((pass+1))
else
  echo -e "${YELLOW}WARN ($TS_ERR 개 에러 — Expo 라이브러리 타입 불일치 포함 가능)${NC}"
  cd "$ROOT" && npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "node_modules\|ReactotronConfig\|TS2556" | head -5
  warn=$((warn+1))
fi

# cancelNativeAlarms bare alarmId 취소 — 개별 호출(cancelAlarm(alarmId)) 또는
# 배치 취소 목록에 포함(ids.push(alarmId)) 어느 쪽이든 bare id가 취소 대상이면 통과
printf "  cancelNativeAlarms bare alarmId 포함 ... "
grep -Eq "cancelAlarm\(alarmId\)|ids\.push\(alarmId\)" "$ROOT/src/utils/notifications/android.ts" 2>/dev/null \
  && ok "" || { fail "bare alarmId 취소 누락! (재발 가능성 높음)"; }

# AlarmReceiver 비활성 차단
printf "  AlarmReceiver 비활성 차단 로직 ... "
grep -q "activeAlarmIds" "$ROOT/android/app/src/main/java/com/danielpark/alarmapp/AlarmReceiver.kt" 2>/dev/null \
  && ok "" || { fail "AlarmReceiver에 차단 로직 없음!"; }

# 게이트 ID 체계 일치 (2026-07-18 BUG-1 재발 방지) — 게이트는 합성 requestCode(alarmId extra)가
# 아니라 bare id(baseAlarmId extra)로 판정해야 활성 알람이 차단되지 않는다.
printf "  AlarmReceiver 게이트 baseAlarmId 판정 ... "
# 예약 intent 조립은 AlarmScheduling.buildAlarmIntent 한 곳으로 공용화돼 있다. 네이티브 전체를
# 훑으면 AlarmReceiver의 rep 슬롯 putExtra에 걸려 조립부에서 baseAlarmId가 빠져도 통과하므로,
# 반드시 조립부 파일만 본다.
grep -q 'baseAlarmId !in activeIds' "$ROOT/android/app/src/main/java/com/danielpark/alarmapp/AlarmReceiver.kt" 2>/dev/null \
  && grep -q 'putExtra("baseAlarmId"' "$ROOT/android/app/src/main/java/com/danielpark/alarmapp/AlarmScheduling.kt" 2>/dev/null \
  && grep -q 'baseAlarmId' "$ROOT/android/app/src/main/java/com/danielpark/alarmapp/AlarmModule.kt" 2>/dev/null \
  && grep -q 'baseAlarmId' "$ROOT/src/utils/notifications/android.ts" 2>/dev/null \
  && ok "" || { fail "게이트가 bare id(baseAlarmId) 기준이 아님 — 합성 id 비교는 활성 알람 전체 차단!"; }

# fail-safe open (빈 목록 → 허용)
printf "  AlarmReceiver fail-safe open 설정 ... "
grep -q "isNullOrEmpty" "$ROOT/android/app/src/main/java/com/danielpark/alarmapp/AlarmReceiver.kt" 2>/dev/null \
  && ok "" || { fail "빈 activeAlarmIds 시 모든 알람 차단 (재부팅 후 알람 안 울림)"; }

# saveActiveAlarmIds 호출
printf "  widgetSync → saveActiveAlarmIds 호출 ... "
grep -q "saveActiveAlarmIds" "$ROOT/src/utils/widgetSync.ts" 2>/dev/null \
  && ok "" || { fail "saveActiveAlarmIds 호출 없음 — 차단 목록이 업데이트 안 됨"; }

# 이중 시스템 (Expo + 네이티브)
printf "  이중 알람 시스템 (Expo + AlarmManager) ... "
HAS_E=$(grep -c "scheduleAlarmTriggers\|scheduleNotificationAsync" "$ROOT/src/utils/notifications/index.ts" 2>/dev/null || echo 0)
HAS_N=$(grep -c "scheduleNative\|cancelNativeAlarms" "$ROOT/src/utils/notifications/index.ts" 2>/dev/null || echo 0)
[ "$HAS_E" -gt 0 ] && [ "$HAS_N" -gt 0 ] && ok "" || fail "Expo 또는 AlarmManager 호출 누락"

# rescheduleAll이 비활성도 cancel
printf "  rescheduleAll — 비활성 알람도 cancel ... "
grep -A5 "rescheduleAll" "$ROOT/src/utils/notifications/index.ts" 2>/dev/null | grep -q "cancelNativeAlarms" \
  && ok "" || fail "rescheduleAll에서 cancelNativeAlarms 누락"

# 재부팅/앱 교체 후 네이티브 예약 복구 (2026-07-29) — Android는 부팅 시 AlarmManager를 비운다.
# expo 쪽은 자체 리시버가 복구하지만 네이티브 예약은 BootReceiver가 없으면 앱을 다시 열기 전까지 공백.
NATIVE_DIR="$ROOT/android/app/src/main/java/com/danielpark/alarmapp"
MANIFEST="$ROOT/android/app/src/main/AndroidManifest.xml"
printf "  BootReceiver 매니페스트 등록 ... "
grep -q 'android:name=".BootReceiver"' "$MANIFEST" 2>/dev/null \
  && grep -q 'android.intent.action.BOOT_COMPLETED' "$MANIFEST" 2>/dev/null \
  && grep -q 'android.intent.action.MY_PACKAGE_REPLACED' "$MANIFEST" 2>/dev/null \
  && ok "" || { fail "BootReceiver 미등록 — 재부팅 후 네이티브 알람 전부 소실"; }

printf "  예약 원장(AlarmStore) 기록/정리 ... "
grep -q "AlarmStore.put" "$NATIVE_DIR/AlarmModule.kt" 2>/dev/null \
  && grep -q "AlarmStore.remove" "$NATIVE_DIR/AlarmModule.kt" 2>/dev/null \
  && grep -q "AlarmStore.all" "$NATIVE_DIR/BootReceiver.kt" 2>/dev/null \
  && ok "" || { fail "예약 원장 기록/복구 경로 누락 — 부팅 복구가 빈 목록으로 동작"; }

# 삭제 경로 유령 예약 (2026-07-29 BUG-A) — rescheduleAll의 cancel 루프는 "남은 알람"만 돌아서
# 삭제된 id는 취소되지 않는다. 원장 기준 정리(syncActiveAlarms)가 반드시 붙어 있어야 한다.
printf "  삭제 알람 잔여 예약 정리(syncActiveAlarms) ... "
grep -q "fun syncActiveAlarms" "$NATIVE_DIR/AlarmModule.kt" 2>/dev/null \
  && grep -q "syncActiveNativeAlarms" "$ROOT/src/utils/notifications/android.ts" 2>/dev/null \
  && grep -q "syncActiveNativeAlarms" "$ROOT/src/utils/notifications/index.ts" 2>/dev/null \
  && ok "" || { fail "삭제된 알람의 네이티브 예약이 원장에 남아 부팅마다 부활함"; }

# 활성 0개 fail-open (2026-07-29 BUG-B) — 빈 문자열은 '미초기화'와 구분이 안 돼 게이트가 열린다.
printf "  활성 0개 센티널(none) 처리 ... "
grep -q "ACTIVE_IDS_NONE" "$ROOT/src/utils/widgetSync.ts" 2>/dev/null \
  && grep -q "ACTIVE_IDS_NONE" "$NATIVE_DIR/AlarmReceiver.kt" 2>/dev/null \
  && ok "" || { fail "활성 알람 0개일 때 게이트가 fail-open — 꺼둔 알람이 울릴 수 있음"; }

# Direct Boot (2026-07-29) — 재부팅 후 최초 잠금해제 전 구간에도 알람이 울려야 한다.
# 발화 체인(수신→재생→커버화면)+부팅 리시버 중 하나라도 directBootAware가 빠지면 그 단계에서 끊긴다.
printf "  Direct Boot 발화 체인 directBootAware ... "
DB_OK=true
for comp in AlarmReceiver AlarmService BootReceiver CoverAlarmActivity; do
  grep -A4 "android:name=\".$comp\"" "$MANIFEST" 2>/dev/null | grep -q 'directBootAware="true"' || DB_OK=false
done
grep -q 'android.intent.action.LOCKED_BOOT_COMPLETED' "$MANIFEST" 2>/dev/null || DB_OK=false
$DB_OK && ok "" || { fail "발화 체인에 directBootAware/LOCKED_BOOT_COMPLETED 누락 — 잠금해제 전 알람 불발"; }

# Direct Boot 구간에 읽어야 하는 데이터는 device-protected 저장소에 있어야 한다.
printf "  게이트·원장 device-protected 저장소 ... "
grep -q "createDeviceProtectedStorageContext" "$NATIVE_DIR/DeviceStorage.kt" 2>/dev/null \
  && grep -q "DeviceStorage.prefs" "$NATIVE_DIR/AlarmStore.kt" 2>/dev/null \
  && grep -q "DeviceStorage.prefs" "$NATIVE_DIR/WidgetModule.kt" 2>/dev/null \
  && grep -q "DeviceStorage.prefs" "$NATIVE_DIR/AlarmReceiver.kt" 2>/dev/null \
  && ok "" || { fail "잠금해제 전 접근 불가한 저장소를 참조 — Direct Boot에서 예외/게이트 오판"; }

if $STATIC_ONLY; then
  echo ""
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "결과: ${GREEN}✅ $pass 통과${NC} │ ${RED}❌ $fail 실패${NC} │ ${YELLOW}⚠️  $warn 경고${NC}"
  [ "$fail" -gt 0 ] && exit 1 || exit 0
fi

# ═══════════════════════════════════════════════════════════
# 2. 기기 연결 확인
# ═══════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}[2] 기기 상태 확인${NC}"

if ! $ADB get-state > /dev/null 2>&1; then
  warn "기기 없음 — ADB 테스트 건너뜀 (--static으로 정적 분석만 가능)"
  echo ""
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "결과: ${GREEN}✅ $pass 통과${NC} │ ${RED}❌ $fail 실패${NC} │ ${YELLOW}⚠️  $warn 경고${NC}"
  [ "$fail" -gt 0 ] && exit 1 || exit 0
fi

MODEL=$($ADB shell getprop ro.product.model 2>/dev/null | tr -d '\r')
SERIAL_NO=$($ADB get-serialno 2>/dev/null)
info "기기: $MODEL ($SERIAL_NO)"

# ═══════════════════════════════════════════════════════════
# 3. AlarmManager 등록 상태 확인
# ═══════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}[3] AlarmManager 등록 상태${NC} (dumpsys alarm)"

RAW=$($ADB shell dumpsys alarm 2>/dev/null)

# dumpsys alarm 전문에는 실제 대기 예약 말고도 Removal/Addition history, Top Alarms,
# Alarm Stats가 함께 나온다. 전문을 grep하면 이미 발화했거나 취소된 항목까지 세어져서
# "전부 끔 → 0개" 판정이 항상 실패한다. 대기 배치 구간만 잘라서 센다.
PENDING=$(echo "$RAW" | awk '
  /^[[:space:]]*Pending alarm batches:/ { inb=1; next }
  /^[[:space:]]*(Pending alarms per uid|Past-due non-wakeup alarms|Pending user blocked|Recent (Wakeup|Alarm) History|Alarm Stats|Top Alarms|Removal history|Addition history|Recent problems|Idle mode state)/ { inb=0 }
  inb { print }
')
COUNT=$(echo "$PENDING" | grep -c "com.danielpark.alarmapp/.AlarmReceiver" | tr -d ' ')
TIMES=$(echo "$PENDING" | grep -A4 "com.danielpark.alarmapp/.AlarmReceiver" | \
  grep -o "origWhen=[0-9-]* [0-9][0-9]:[0-9][0-9]" | sed 's/origWhen=//' | head -5)

info "AlarmReceiver 등록 수: ${COUNT}개"
if [ "$COUNT" -gt 0 ] && [ -n "$TIMES" ]; then
  echo "$TIMES" | while read -r t; do info "  예정 시각: $t"; done
fi

if $ALL_OFF; then
  printf "  알람 전체 끔 → 등록 0개 기대 ... "
  if [ "$COUNT" -eq 0 ]; then
    ok "등록 없음 (정상)"
  else
    fail "${COUNT}개가 여전히 AlarmManager에 남아 있음! (cancel 누락 가능)"
    echo ""
    echo -e "  ${YELLOW}등록된 항목:${NC}"
    echo "$RAW" | grep -A4 "AlarmReceiver" | grep "origWhen\|whenElapsed" | head -10 | sed 's/^/    /'
  fi
else
  info "활성 알람 있을 수 있음 (--all-off 미지정)"
  [ "$COUNT" -gt 0 ] && info "  → ${COUNT}개 등록됨 (앱의 활성 알람과 일치하는지 직접 확인 필요)"
  [ "$COUNT" -eq 0 ] && info "  → 등록 없음 (알람 없거나 전부 끄거나 아직 취소됨)"
fi

# ═══════════════════════════════════════════════════════════
# 4. 최근 logcat — AlarmService 비정상 발화 흔적
# ═══════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}[4] 최근 logcat 이상 징후${NC}"

LOG=$($ADB logcat -d -t 200 2>/dev/null)

# AlarmService 시작 횟수
SVC_COUNT=$(echo "$LOG" | grep "com.danielpark.alarmapp.AlarmService\|Start proc.*AlarmService" | wc -l | tr -d ' ')
printf "  AlarmService 시작 (최근 200줄) ... "
if [ "$SVC_COUNT" -eq 0 ]; then
  ok "없음"
else
  warn "${SVC_COUNT}회 감지 — 아래 시간 확인"
  echo "$LOG" | grep "AlarmService" | tail -5 | sed 's/^/    /'
fi

# AlarmReceiver 수신 횟수
RCV_COUNT=$(echo "$LOG" | grep "AlarmReceiver\|broadcastIntent.*AlarmReceiver" | wc -l | tr -d ' ')
printf "  AlarmReceiver 수신 흔적 ... "
[ "$RCV_COUNT" -eq 0 ] && ok "없음" || info "${RCV_COUNT}회 (정상 발화 포함)"

# ═══════════════════════════════════════════════════════════
# 결과 요약
# ═══════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "결과: ${GREEN}✅ $pass 통과${NC} │ ${RED}❌ $fail 실패${NC} │ ${YELLOW}⚠️  $warn 경고${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$fail" -gt 0 ]; then
  echo ""
  echo -e "${RED}🔴 코드 수정 필요 — 위 FAIL 항목 확인${NC}"
  exit 1
else
  echo ""
  echo -e "${GREEN}🟢 자동 테스트 통과${NC}"
  echo ""
  echo -e "${YELLOW}수동 확인 항목 (알람 끄기/스누즈 로직 수정 후):${NC}"
  echo "  □ [잠금화면]   알람 끄고 화면 끔 → 시간 지나도 안 울리는지"
  echo "  □ [백그라운드] 알람 끄고 앱 홈으로 → 안 울리는지"
  echo "  □ [포그라운드] 알람 끄고 앱 켜둠  → 안 울리는지"
  exit 0
fi
