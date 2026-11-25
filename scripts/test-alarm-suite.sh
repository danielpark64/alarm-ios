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

# iOS 위젯 — 앱과 위젯이 같은 공유 폴더 파일을 봐야 하고, 앱 복귀 때 데이터 기간을 밀어야 한다
printf "  iOS 위젯 데이터 연결(widget.json·앱 복귀 갱신) ... "
grep -q "syncIosWidget" "$ROOT/src/utils/widgetSync.ts" 2>/dev/null \
  && grep -q "syncIosWidget" "$ROOT/src/hooks/useAlarmNotifications.ts" 2>/dev/null \
  && grep -q 'widget.json' "$ROOT/modules/alarmapp-widget/ios/AlarmappWidgetModule.swift" 2>/dev/null \
  && grep -q 'alarmapp/widget.json' "$ROOT/targets/widget/WidgetData.swift" 2>/dev/null \
  && ok "" || { fail "iOS 위젯 데이터 경로가 어긋남 — 위젯이 비거나 옛 근무를 보여 준다"; }

# iOS 위젯 날짜 숫자 — 좁은 칸(주간 띠·월 달력)에서 "21"이 "2"/"1" 두 줄로 꺾이지 않게 한 줄 고정 (2026-11-21)
printf "  iOS 위젯 DayNumber 날짜 숫자 한 줄 고정(lineLimit(1)+fixedSize) ... "
_DN=$(awk '/struct DayNumber: View/,/^}/' "$ROOT/targets/widget/AlarmWidget.swift" 2>/dev/null)
echo "$_DN" | grep -q 'lineLimit(1)' && echo "$_DN" | grep -q 'fixedSize' \
  && ok "" || { fail "AlarmWidget.swift DayNumber에 lineLimit(1)·fixedSize 없음 — 두 자리 날짜가 두 줄로 꺾인다"; }

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

# 중첩 모달 (2026-08-03) — RN <Modal> 안에서 또 다른 모달을 열 때, 그 모달이 자기 트리 밖
# (형제 위치)에 렌더돼 있으면 iOS는 이미 present된 VC 위로 두 번째 present를 조용히 무시한다.
# Android는 Dialog로 쌓여서 멀쩡히 뜨기 때문에 Android만 테스트하면 절대 안 걸린다(실제로 놓쳤음:
# N일 주기/휴식 팝업의 시작일 달력이 iOS에서만 안 떴다). 여는 쪽이 {children} 슬롯으로 품어야 한다.
printf "  모달 안에서 여는 모달이 형제로 새지 않는지 ... "
NEST_BAD=""
for f in $(grep -rl '<Modal' "$ROOT/src" "$ROOT/app" 2>/dev/null); do
  case "$f" in *.tsx) ;; *) continue ;; esac
  # 주석({/* ... <Modal> ... */}, // ...)은 빼고 실제 JSX <Modal>이 처음 열리는 줄
  ML=$(grep -nE '<Modal[ >]' "$f" | grep -vE ':[[:space:]]*(\{?/\*|//|\*)' | head -1 | cut -d: -f1)
  [ -z "$ML" ] && continue
  # 그 <Modal> 안쪽에서 다른 모달을 여는 호출. 모달 바깥(폼 본문)에서 여는 건 정상이라 제외된다
  SL=$(awk -v s="$ML" 'NR>s && /set(Show|Open)[A-Za-z]*\(true\)|set[A-Za-z]*(Visible|Open)\(true\)/ {print NR; exit}' "$f")
  [ -z "$SL" ] && continue
  grep -q '{children}' "$f" || NEST_BAD="$NEST_BAD ${f##*/}:$SL"
done
[ -z "$NEST_BAD" ] && ok "" \
  || fail "모달 내부에서 형제 모달을 엶 —$NEST_BAD ({children}로 품지 않으면 iOS에서 안 뜸)"

# Direct Boot 구간에 읽어야 하는 데이터는 device-protected 저장소에 있어야 한다.
printf "  게이트·원장 device-protected 저장소 ... "
grep -q "createDeviceProtectedStorageContext" "$NATIVE_DIR/DeviceStorage.kt" 2>/dev/null \
  && grep -q "DeviceStorage.prefs" "$NATIVE_DIR/AlarmStore.kt" 2>/dev/null \
  && grep -q "DeviceStorage.prefs" "$NATIVE_DIR/WidgetModule.kt" 2>/dev/null \
  && grep -q "DeviceStorage.prefs" "$NATIVE_DIR/AlarmReceiver.kt" 2>/dev/null \
  && ok "" || { fail "잠금해제 전 접근 불가한 저장소를 참조 — Direct Boot에서 예외/게이트 오판"; }

# 2026-09-12 하루 근무 변경(dayOverride) — "그날 이 알람이 울리나" 판정이 core.ts의
# 로테이션/날짜기반 두 예약 루프에 독립 구현돼 있어서, 게이트(dayWorkFor)를 한쪽에만
# 넣으면 "달력엔 대근으로 뜨는데 알람은 그대로 안 울린다" 같은 불일치가 조용히 생긴다.
printf "  dayOverride 게이트가 두 예약 루프 모두에 있는지 ... "
DW_COUNT=$(grep -c "dayWorkFor(alarm" "$ROOT/src/utils/notifications/core.ts" 2>/dev/null || echo 0)
grep -q "export function dayWorkFor" "$ROOT/src/utils/index.ts" 2>/dev/null \
  && [ "$DW_COUNT" -ge 2 ] \
  && ok "" || { fail "dayWorkFor가 core.ts의 두 예약 루프(로테이션 rm==pattern / 날짜기반) 중 한쪽에서 빠짐"; }

# override로 activeAlarmIds(네이티브 차단 게이트)가 갱신되기 전에 재예약부터 걸면, 그 사이
# 발화한 알람이 게이트 판정을 못 받는다 — useAlarms.ts의 save()/mount와 같은 순서를 지켜야 함.
printf "  하루 근무 변경 시 syncWidget → rescheduleAll 순서 ... "
SW_LINE=$(grep -n "syncWidget(alarms" "$ROOT/src/hooks/useDayOverrides.ts" 2>/dev/null | head -1 | cut -d: -f1)
RA_LINE=$(grep -n "rescheduleAll(alarms" "$ROOT/src/hooks/useDayOverrides.ts" 2>/dev/null | head -1 | cut -d: -f1)
[ -n "$SW_LINE" ] && [ -n "$RA_LINE" ] && [ "$SW_LINE" -lt "$RA_LINE" ] \
  && ok "" || { fail "useDayOverrides.ts에서 syncWidget이 rescheduleAll보다 먼저 호출되지 않음"; }

# isOffDay/shiftForDate는 override를 몰라도 되도록 일부러 안 건드렸다(회귀 위험 최소화) —
# 대신 표시 계층(달력·홈 헤더·위젯)이 반드시 dayOverrideDisplay를 먼저 확인해야
# "연차인데 근무일로 표시" 같은 오판정이 안 생긴다. 세 화면 전부 확인.
printf "  달력·홈·위젯이 override를 shiftForDate/isOffDay보다 먼저 확인하는지 ... "
grep -q "dayOverrideDisplay" "$ROOT/src/components/Home/CalendarView.tsx" 2>/dev/null \
  && grep -q "dayOverrideDisplay" "$ROOT/src/components/Home/TodayShiftRow.tsx" 2>/dev/null \
  && grep -q "dayOverrideDisplay" "$ROOT/src/utils/widgetSync.ts" 2>/dev/null \
  && ok "" || { fail "달력/홈헤더/위젯 중 하나가 override 표시 분기 없이 기존 shiftForDate/isOffDay만 사용 — 연차 날이 근무일로 보일 수 있음"; }

# 2026-09-13 발견 — wdcustom(요일 반복) 알람은 WEEKLY 트리거로 예약돼서 스케줄링 시점에
# "이날만 끄기(skips)"가 있을 때만 날짜기반 루프로 전환됐는데, dayOverride 유무는 안 봐서
# override가 있어도 원래 요일 시각 그대로 예약되는(=override 무시) 우회 경로가 있었다.
# 일반 사용자의 출근/퇴근 알람 기본 반복방식이 wdcustom이라 이 기능이 가장 지원하려던
# 대상이 조용히 빠지는 회귀였다.
printf "  wdcustom 알람도 override 있으면 날짜기반 경로로 전환되는지 ... "
grep -q "hasUpcomingOverride" "$ROOT/src/utils/notifications/core.ts" 2>/dev/null \
  && grep -qE "alarm\.rm === 'wdcustom'.*!hasUpcomingOverride|!hasUpcomingOverride.*alarm\.rm === 'wdcustom'" "$ROOT/src/utils/notifications/core.ts" 2>/dev/null \
  && ok "" || { fail "wdcustom WEEKLY 예약 분기가 hasUpcomingOverride를 확인 안 함 — override가 요일 알람엔 무시될 수 있음"; }

# 2026-09-12 발견 — 실기기(플립)에서 반차로 출근 시각을 08→10시로 바꾸면 실제 예약(dumpsys)은
# 정확히 10시로 바뀌는데(core.ts의 dayWorkFor는 정상), 달력 하루 상세 팝업의 알람 목록은 여전히
# 08:00으로 표시됨. 원인: 팝업이 시각 표시에 effectiveTime()만 쓰는데 effectiveTime은
# rm==='pattern'만 override를 반영하고 cycle/rest/wdcustom은 그냥 alarm.hour/min을 반환 —
# 반차·야근·연장(copy-kind)처럼 "시각만 바뀐" override는 알람 객체 자체를 안 건드리므로 이
# 목록이 dayWorkFor를 직접 안 타면 예약된 실제 시각과 화면이 어긋난다.
printf "  하루 상세 팝업 알람 목록이 시각변경 override를 반영하는지 ... "
grep -q "dayWorkFor(al, selOverride)" "$ROOT/src/components/Home/CalendarView.tsx" 2>/dev/null \
  && ok "" || { fail "day-detail 팝업 알람 목록이 dayWorkFor로 override 시각을 반영하지 않음 — 반차/야근/연장 시 실제 예약 시각과 화면 표시가 어긋날 수 있음"; }

# 2026-09-12 설계 변경 — 경조사(family)는 "kind"(연차·대근 등)에서 완전히 분리했다. 남의
# 결혼식/장례식은 연차를 써서 가든 근무 끝나고 가든 상관없이 몇 시·누구 건지 메모만 있으면
# 되는 것이라, family는 근무 상태(work) 판정에 절대 관여하면 안 된다. dayWorkFor/
# dayOverrideDisplay가 kind 없이 family만 있는 override를 "연차처럼 근무 꺼짐"으로 오판정하면
# 경조사 메모만 남겼는데 근무 알람이 꺼지는 회귀가 생긴다 — kind 존재 여부를 반드시 먼저 본다.
printf "  경조사(family) 메모가 근무상태 판정(dayWorkFor/dayOverrideDisplay)에 안 섞이는지 ... "
[ "$(grep -c "if (!ov || !isKnownKind(ov\.kind)) return null;" "$ROOT/src/utils/index.ts" 2>/dev/null)" -ge 2 ] \
  && ok "" || { fail "dayWorkFor 또는 dayOverrideDisplay가 kind 없이 family만 있는(또는 지금 목록에 없는) override를 근무상태 변경으로 오판정할 수 있음"; }

# 2026-09-12 설계 변경 — "기타" kind를 없앴다(라벨 입력 UI가 끝내 없어서 뭐가 기타인지 알
# 방법이 없는 죽은 옵션이었음). OVERRIDE_KINDS에서 값 하나가 빠지는 건 이번이 처음이 아니고
# 앞으로도 있을 수 있는 일이라, dayWorkFor/dayOverrideDisplay가 "지금 목록에 없는 kind"를
# kind 없음과 동일하게(무해하게) 처리하는지 확인한다 — 안 그러면 예전에 저장된 값이 그대로
# 남아있는 사용자는 라벨 없는 빈 배지가 뜨거나 최악엔 근무 상태가 오판정될 수 있다.
printf "  목록에서 빠진 레거시 kind(예: 기타)가 무해하게 무시되는지 ... "
grep -q "isKnownKind" "$ROOT/src/utils/index.ts" 2>/dev/null \
  && ok "" || { fail "OVERRIDE_KINDS에 없는 kind를 걸러내는 방어 로직(isKnownKind)이 없음 — 목록에서 종류가 빠지면 레거시 데이터가 라벨 없이 표시되거나 오판정될 수 있음"; }

# 2026-09-12 발견 — 출근/퇴근(하루 근무 변경 대상) 알람에 "이날 끄기"가 열려있으면, 사용자가
# 출근만 끄고 퇴근은 그대로 둬서 "오늘 하루 쉬기" 의도와 다르게 반쪽만 적용될 수 있었다.
# 근무 알람은 하루 근무 변경(연차 등) 하나로만 유도해야 한다.
printf "  근무 알람(출근/퇴근)에는 개별 '이날 끄기'가 안 뜨는지 ... "
grep -qE "canSkip = .*!isOverridableAlarm\(al\)" "$ROOT/src/components/Home/CalendarView.tsx" 2>/dev/null \
  && ok "" || { fail "canSkip이 isOverridableAlarm(al)을 확인 안 함 — 근무 알람에도 개별 '이날 끄기'가 떠서 하루 근무 변경과 혼란을 일으킬 수 있음"; }

# ═══════════════════════════════════════════════════════════
# R8 난독화 설정 회귀 방지 (2026-09-13, Play "앱 최적화 기준점 미만" 경고 대응)
# 난독화는 깨져도 크래시가 안 나고 "조용히 no-op"이 되는 방식으로 실패한다 —
# 재부팅 후 알람 미등록, 위젯 먹통 등. 그래서 설정이 실수로 꺼지거나 keep 규칙이
# 빠지는 걸 여기서 막는다.
# ═══════════════════════════════════════════════════════════
GRADLE_PROPS="$ROOT/android/gradle.properties"
PROGUARD="$ROOT/android/app/proguard-rules.pro"

printf "  R8 난독화 활성화(gradle.properties) ... "
grep -Eq '^[[:space:]]*android\.enableMinifyInReleaseBuilds[[:space:]]*=[[:space:]]*true' "$GRADLE_PROPS" 2>/dev/null \
  && ok "" || { fail "android.enableMinifyInReleaseBuilds=true 없음 — 난독화가 꺼져 Play '앱 최적화' 경고가 재발생함"; }

# AppWidgetProvider 클래스명은 런처의 AppWidgetHost DB에 영구 저장된다.
# 이름이 바뀌면 기존 사용자의 홈화면 위젯이 죽고, 롤백해도 자동 복구가 안 된다(재추가만이 방법).
printf "  위젯 Provider keep 규칙 ... "
grep -q 'AlarmWidgetMedium' "$PROGUARD" 2>/dev/null \
  && grep -q 'AlarmWidgetLarge' "$PROGUARD" 2>/dev/null \
  && grep -q 'WidgetListService' "$PROGUARD" 2>/dev/null \
  && ok "" || { fail "proguard-rules.pro에 위젯 Provider keep이 없음 — 기존 사용자 홈화면 위젯이 영구 파손될 수 있음"; }

# 시스템이 "이름으로" 배달하는 컴포넌트 + JS 브리지.
# BootReceiver가 깨지면 "재부팅 후 알람 안 울림"이 크래시 없이 발생하고,
# 브리지 메서드가 사라지면 JS의 존재 확인 분기가 예외 없이 폴백으로 새서 취소가 누락된다.
printf "  알람 체인·브리지 keep 규칙 ... "
PG_MISS=""
for C in BootReceiver AlarmReceiver AlarmService CoverAlarmActivity AlarmModule WidgetModule; do
  grep -q "com\.danielpark\.alarmapp\.$C" "$PROGUARD" 2>/dev/null || PG_MISS="$PG_MISS $C"
done
grep -q 'ReactMethod <methods>' "$PROGUARD" 2>/dev/null || PG_MISS="$PG_MISS @ReactMethod"
[ -z "$PG_MISS" ] \
  && ok "" || { fail "keep 누락:$PG_MISS — 재부팅 복구/directBoot 발화/알람 취소가 조용히 깨질 수 있음"; }

# 앱 패키지를 통째로 keep하면 난독화율이 다시 떨어져 Play 기준(25%)을 못 맞춘다.
printf "  과도한 패키지 통째 keep 없음 ... "
grep -Eq '^-keep[a-z]* class com\.danielpark\.alarmapp\.\*\*' "$PROGUARD" 2>/dev/null \
  && fail "com.danielpark.alarmapp.** 통째 keep 발견 — 난독화율이 떨어져 Play 경고가 재발생함" || ok ""

printf "  스택트레이스 줄번호 보존(LineNumberTable) ... "
grep -q 'keepattributes.*LineNumberTable' "$PROGUARD" 2>/dev/null \
  && ok "" || { fail "-keepattributes SourceFile,LineNumberTable 없음 — 난독화 후 크래시 라인 판독 불가"; }

# ─── 법정공휴일 스킵 (교대근무가 아닌 출퇴근 알람) ───────────────────
HOLIDAYS_TS="$ROOT/src/constants/holidays.ts"

# 달력 표엔 제헌절(2008년부터 공휴일 아님)·근로자의날(관공서 공휴일 아님)도 들어 있다.
# 이 둘을 스킵 대상에서 빼지 않으면 정상 출근일에 알람이 안 울려 지각한다.
printf "  공휴일 스킵 제외 목록(제헌절·근로자의날) ... "
grep -q 'NOT_DAY_OFF' "$HOLIDAYS_TS" 2>/dev/null \
  && grep -A4 'NOT_DAY_OFF' "$HOLIDAYS_TS" 2>/dev/null | grep -q '제헌절' \
  && grep -A4 'NOT_DAY_OFF' "$HOLIDAYS_TS" 2>/dev/null | grep -q '근로자의날' \
  && ok "" || { fail "isStatutoryHoliday 제외 목록에 제헌절·근로자의날이 없음 — 출근일에 알람이 안 울려 지각함"; }

# 교대근무자는 공휴일에도 근무한다. cycle/rest/pattern이 스킵 대상에 들어가면
# 이 앱의 주 사용자층인 교대근무자 알람이 공휴일마다 통째로 꺼진다.
printf "  공휴일 스킵이 교대근무(cycle/rest/pattern)를 제외하는지 ... "
if grep -q 'export const skipsStatutoryHoliday' "$ROOT/src/utils/index.ts" 2>/dev/null; then
  if grep -A4 'export const skipsStatutoryHoliday' "$ROOT/src/utils/index.ts" | grep -Eq "'cycle'|'rest'|'pattern'"; then
    fail "skipsStatutoryHoliday가 교대근무 반복모드를 포함 — 교대근무자 알람이 공휴일에 안 울림"
  else
    ok ""
  fi
else
  fail "skipsStatutoryHoliday 헬퍼가 없음"
fi

# 판정 지점이 4곳으로 흩어져 있어(공통 게이트 없음) 한 곳만 빠져도
# "달력엔 안 울린다고 표시되는데 실제로는 울린다" 같은 불일치가 생긴다.
printf "  공휴일 게이트가 예약·표시 경로 모두에 있는지 ... "
grep -A3 'skips?.includes(cs)' "$ROOT/src/utils/index.ts" 2>/dev/null | grep -q 'isHolidaySkipped' \
  && grep -A3 'includeSkipped && a.skips' "$ROOT/src/utils/index.ts" 2>/dev/null | grep -q 'isHolidaySkipped' \
  && grep -A3 'fires && alarm.skips?.includes(ds)' "$ROOT/src/utils/notifications/core.ts" 2>/dev/null | grep -q 'isHolidaySkipped' \
  && ok "" || { fail "getNextFireDate/alarmsForDate/core.ts 날짜루프 중 공휴일 게이트가 빠진 곳이 있음 — 표시와 실제 발화가 어긋남"; }

# ⚠️ 가장 중요한 항목. 네이티브(AlarmScheduling.kt)는 recurrence='weekly' 예약을
# JS와 무관하게 자체 재계산해서 자가 재예약한다. WEEKLY 조기반환을 막아
# 날짜기반('once')으로 내려보내지 않으면, JS를 아무리 고쳐도 공휴일에 그대로 울린다.
printf "  공휴일이 WEEKLY 예약을 날짜기반으로 전환시키는지 ... "
grep -q 'hasUpcomingHoliday' "$ROOT/src/utils/notifications/core.ts" 2>/dev/null \
  && grep "rm === 'wdcustom' && alarm.days.length" "$ROOT/src/utils/notifications/core.ts" 2>/dev/null | grep -q '!hasUpcomingHoliday' \
  && ok "" || { fail "WEEKLY 조기반환에 !hasUpcomingHoliday가 없음 — 네이티브 주간 알람이 공휴일에 그대로 울림"; }

# 하루 근무 변경(연차·대근 등) 보존 — 2026-10-07: 대근을 등록했는데 다음날 사라진 버그.
# ① 앱을 열 때 지난 날짜를 지우면 달력 아래 "이번 달/올해" 집계와 지난 기록이 날아간다.
printf "  하루 근무 변경이 지난 날짜라고 지워지지 않는지 ... "
grep -vE '^\s*//' "$ROOT/src/hooks/useDayOverrides.ts" 2>/dev/null | grep -qE "ds < today" \
  && { fail "useDayOverrides가 'ds < today'로 지난 기록을 지움 — 대근·연차 내역과 올해 집계가 사라짐"; } || ok ""

# ② setState 업데이터 안에서 next를 만들어 저장하면, React 19에서 업데이터가 늦게 돌아
#    빈 {}이 저장돼 연속 등록 시 기록 전체가 날아간다. 동기 캐시를 기준으로 만들어야 한다.
printf "  setOverride가 setState 업데이터에 기대지 않는지 ... "
grep -vE '^\s*//' "$ROOT/src/hooks/useDayOverrides.ts" 2>/dev/null | grep -qE "setOverrides\(prev" \
  && { fail "setOverride가 setOverrides(prev => …) 안에서 next를 만듦 — 저장값이 빈 {}이 될 수 있음"; } || ok ""

# ── 2026-10-09 로직 리뷰에서 나온 항목들 ──────────────────────────────
# ① 만료된 '한 번' 알람을 자동 비활성화하며 저장할 때 nextId를 상수 100으로 덧씌우면,
#    다음 콜드 스타트에서 새 알람이 기존 알람과 같은 id를 받아 토글/삭제가 둘 다에 걸린다.
printf "  로드 시 저장이 nextId를 상수로 덧씌우지 않는지 ... "
grep -vE '^\s*//' "$ROOT/src/hooks/useAlarms.ts" 2>/dev/null | grep -qE "nextId:\s*100\s*\}" \
  && { fail "useAlarms 로드 분기가 nextId: 100 상수를 저장함 — 알람 id 중복 생성 경로"; } || ok ""

# ② 로드가 끝나기 전 포그라운드 복귀 리스너가 빈 목록으로 rescheduleAll을 돌리면
#    네이티브 원장·예약이 전부 비워진다. loaded 가드가 있어야 한다.
printf "  포그라운드 재스케줄이 loaded 전엔 건너뛰는지 ... "
grep -q "loadedRef.current" "$ROOT/src/hooks/useAlarmNotifications.ts" 2>/dev/null \
  && ok "" || { fail "useAlarmNotifications 포그라운드 rescheduleAll에 loaded 가드 없음"; }

# ③ rescheduleAll이 겹쳐 돌면(포그라운드 복귀 + 토글) 뒤 호출의 전체 취소 뒤에도 앞 호출이
#    남은 루프를 계속 돌며 방금 꺼진 알람을 Expo에 다시 예약한다. 세대 번호로 앞 호출을 중단해야 한다.
printf "  rescheduleAll 세대 번호(재진입 중단) ... "
grep -q "isStaleGen" "$ROOT/src/utils/notifications/index.ts" 2>/dev/null \
  && grep -q "isStaleGen" "$ROOT/src/utils/notifications/core.ts" 2>/dev/null \
  && ok "" || { fail "rescheduleAll/scheduleAlarmTriggers에 세대 번호 중단 없음"; }

# ④ 네이티브 알림 버튼·커버 화면으로 끄면 JS가 모르므로 Expo +1/+2분 재알림이 그대로 울린다.
#    ACTION_STOP이 JS에 alarmStopped 이벤트를 보내고, JS가 받아서 cancelExpoGroupReps 해야 한다.
printf "  네이티브 끄기 → JS alarmStopped → Expo rep 취소 ... "
grep -q "alarmStopped" "$ROOT/android/app/src/main/java/com/danielpark/alarmapp/AlarmService.kt" 2>/dev/null \
  && grep -q "alarmStopped" "$ROOT/src/hooks/useAlarmNotifications.ts" 2>/dev/null \
  && grep -q "consumeLastStopped" "$ROOT/android/app/src/main/java/com/danielpark/alarmapp/AlarmModule.kt" 2>/dev/null \
  && ok "" || { fail "네이티브 끄기가 JS에 전달되지 않음 — Expo rep 슬롯 잔존"; }

# ⑤ 그룹 rep 데이터에 alarmIds만 있고 alarmId가 없으면 '한 번' 알람의 rep2 자동 비활성화가 항상 불발.
printf "  단일 알람 그룹 rep 데이터에 alarmId 포함 ... "
grep -q "alarmId: active.length === 1" "$ROOT/src/utils/notifications/core.ts" 2>/dev/null \
  && ok "" || { fail "scheduleGroupReps 데이터에 alarmId 없음 — once 자동 비활성화 불발"; }

# ⑥ 하루 근무 변경·경조사 메모는 지난 날짜도 편집 가능해야 한다(2026-10-09) — 장부 성격이라
#    잘못 적은 과거 기록을 고칠 길이 있어야 함. 반대로 알람 "이날 끄기"(canSkip)는 예약 전용이라
#    오늘 이후 제한을 유지한다. ovSection/ovMemoRow 바로 위 조건에 selDate >= today가 다시 들어오면 실패.
printf "  하루 근무 변경이 지난 날짜도 편집 가능한지(canSkip은 오늘 이후 유지) ... "
_CV="$ROOT/src/components/Home/CalendarView.tsx"
if [ "$(grep -cE "<View style=\{cv\.(ovSection|ovMemoRow)\}>" "$_CV" 2>/dev/null)" != "2" ]; then
  fail "ovSection/ovMemoRow 마커를 못 찾음 — 스타일명이 바뀌었으면 이 체크의 grep도 같이 고칠 것"
elif grep -B3 -E "<View style=\{cv\.(ovSection|ovMemoRow)\}>" "$_CV" 2>/dev/null | grep -q "selDate >= today"; then
  fail "하루 근무 변경/경조사 메모 섹션이 selDate >= today로 막혀 있음 — 지난 날짜 수정 불가"
elif ! grep -q "canSkip = .*selDate >= today" "$_CV" 2>/dev/null; then
  fail "알람 '이날 끄기'(canSkip)의 오늘 이후 제한이 사라짐 — 지난 날짜 skip은 무의미"
else
  ok ""
fi

# ⑦ 달력 아래 "휴일근무" 집계(2026-10-09) — 사용자 입력 없이 공휴일×근무 여부로 자동 산정.
#    판정은 isHolidayWorkDay 한 곳에만 두고(override 우선 → isWorkAlarm 로테이션), 달력 tally가
#    그 헬퍼를 쓰는지 확인. 집계가 헬퍼를 우회해 자체 판정을 넣으면 셀·홈·위젯과 어긋난다.
printf "  휴일근무 집계가 isHolidayWorkDay(override 우선) 헬퍼를 쓰는지 ... "
grep -q "isHolidayWorkDay" "$ROOT/src/components/Home/CalendarView.tsx" 2>/dev/null \
  && grep -A4 "export function isHolidayWorkDay" "$ROOT/src/utils/index.ts" 2>/dev/null | grep -q "dayOverrideDisplay" \
  && ok "" || { fail "휴일근무 집계가 isHolidayWorkDay를 안 쓰거나 헬퍼가 override를 먼저 보지 않음"; }

# ⑧ 지난 날짜 편집 허용과 짝 — 로드 시 정리 기준이 "작년"으로 되돌아가면 과거 편집이 재시작 때 사라진다.
printf "  하루 근무 변경 보관 기간이 10년 이상인지 ... "
grep -qE "getFullYear\(\) - (1[0-9]|[2-9][0-9])\}-01-01" "$ROOT/src/hooks/useDayOverrides.ts" 2>/dev/null \
  && ok "" || { fail "useDayOverrides keepFrom이 10년 미만 — 지난 날짜 편집 기록이 다음 실행 때 지워질 수 있음"; }

# ⑨ 공휴일 API 갱신 신호(2026-10-09) — setApiHolidays가 버전을 올리고, 달력이 그 버전을 구독해야
#    네트워크 갱신이 달력을 보는 중에 끝나도 집계·셀이 그 자리에서 다시 그려진다.
printf "  공휴일 갱신 → 달력 재계산 신호(useHolidayVersion) ... "
grep -A3 "export function setApiHolidays" "$ROOT/src/constants/holidays.ts" 2>/dev/null | grep -q "holidayVersion++" \
  && grep -q "useHolidayVersion()" "$ROOT/src/components/Home/CalendarView.tsx" 2>/dev/null \
  && grep -q "holidayVersion={holidayVersion}" "$ROOT/src/components/Home/CalendarView.tsx" 2>/dev/null \
  && ok "" || { fail "공휴일 갱신 신호가 끊김 — setApiHolidays 버전 증가 또는 CalendarView 구독 누락"; }

# ⑩ 내장 공휴일 표가 내년까지 있는지 — API 실패·키 만료 시 마지막 방어선. 매년 갱신 루틴.
NEXT_YEAR=$(( $(date +%Y) + 1 ))
printf "  내장 공휴일 표에 내년(${NEXT_YEAR}) 데이터가 있는지 ... "
grep -q "'${NEXT_YEAR}-01-01'" "$ROOT/src/constants/holidays.ts" 2>/dev/null \
  && ok "" || { fail "holidays.ts에 ${NEXT_YEAR}년 표 없음 — 내년 공휴일을 추가할 것"; }

# ⑪ Play 대형 화면 경고(2026-10-09) — 매니페스트 MainActivity에 screenOrientation을 두지 않고
#    MainActivity.kt가 폰 크기에서만 런타임으로 세로 고정한다. expo prebuild를 다시 돌리면 app.json의
#    orientation:"portrait"가 매니페스트 속성을 되살리므로 여기서 잡는다.
printf "  매니페스트 screenOrientation 없음 + 런타임 세로 고정 ... "
_MF="$ROOT/android/app/src/main/AndroidManifest.xml"
if grep -A3 'android:name=".MainActivity"' "$_MF" 2>/dev/null | grep -q "screenOrientation"; then
  fail "MainActivity에 android:screenOrientation이 다시 생김 — prebuild 결과면 제거하고 MainActivity 런타임 고정 유지"
elif ! grep -q "lockPortraitOnPhones()" "$ROOT/android/app/src/main/java/com/danielpark/alarmapp/MainActivity.kt" 2>/dev/null; then
  fail "MainActivity.lockPortraitOnPhones 호출 없음 — 폰에서 가로 회전이 허용됨"
else
  ok ""
fi

# ⑫ Play edge-to-edge 지원중단 속성(2026-10-09) — API 35+ 테마(values-v35)에는 statusBarColor /
#    navigationBarColor가 없어야 하고, 15 미만용 values/에는 남아 있어야 보이는 결과가 같다.
printf "  values-v35 테마에 지원중단 상태바 속성 없음 ... "
_V35="$ROOT/android/app/src/main/res/values-v35/styles.xml"
if [ ! -f "$_V35" ]; then
  fail "values-v35/styles.xml 없음 — prebuild로 지워졌으면 복구할 것"
elif grep -qE '<item name="android:(statusBarColor|navigationBarColor)"' "$_V35"; then
  fail "values-v35/styles.xml에 statusBarColor/navigationBarColor가 있음"
else
  ok ""
fi

# ⑬ iOS "진동만" = 무음 사운드(2026-10-10) — iOS는 소리 없는 알림엔 진동도 안 하므로 silent_short.wav를
#    붙여야 진동이 온다. 파일이 iOS 번들(pbxproj Resources)·android raw·app.json 셋 다 등록돼야 한다.
printf "  iOS 진동만 → silent_short.wav 소리 부착 + 리소스 등록 ... "
if ! grep -q "silent_short.wav" "$ROOT/src/utils/notifications/core.ts" 2>/dev/null; then
  fail "core.ts notifSound가 iOS 진동만에 silent_short.wav를 안 붙임 — iOS에서 진동이 안 옴"
elif [ -d "$ROOT/ios" ] && { ! grep -q "silent_short.wav in Resources" "$ROOT/ios/app.xcodeproj/project.pbxproj" 2>/dev/null || [ ! -f "$ROOT/ios/app/silent_short.wav" ]; }; then
  # ios/는 gitignore(prebuild 산출물)라 있을 때만 검사 — 새 체크아웃은 prebuild가 app.json sounds로 등록한다
  fail "silent_short.wav가 Xcode Resources에 없음 — iOS 알림이 소리를 못 찾아 기본음/무진동"
elif ! grep -q "silent_short.wav" "$ROOT/app.json" 2>/dev/null; then
  fail "app.json expo-notifications sounds에 silent_short.wav 없음 — prebuild 시 누락됨"
else
  ok ""
fi

# ⑭ 보조 알림(반복 울림)을 메인 트리거보다 먼저 예약하고, 60개 한도 검사로 포기하지 않는지.
#    iOS는 64개 넘으면 먼 것부터 버리므로 가까운 보조를 먼저 걸어야 한다.
printf "  보조 알림을 메인보다 먼저 예약 + 60개 한도 포기 없음 ... "
_IDX="$ROOT/src/utils/notifications/index.ts"
_L_REP=$(grep -n "await scheduleGroupReps(group" "$_IDX" 2>/dev/null | head -1 | cut -d: -f1)
_L_MAIN=$(grep -n "await scheduleAlarmTriggers(alarm" "$_IDX" 2>/dev/null | head -1 | cut -d: -f1)
if grep -q "scheduled.length + 2 > 62" "$ROOT/src/utils/notifications/core.ts" 2>/dev/null; then
  fail "scheduleGroupReps에 60개 한도 포기 검사가 되살아남 — 가장 가까운 보조 알림을 우리가 먼저 버림"
elif [ -z "$_L_REP" ] || [ -z "$_L_MAIN" ] || [ "$_L_REP" -gt "$_L_MAIN" ]; then
  fail "rescheduleAll에서 보조 알림(scheduleGroupReps)이 메인(scheduleAlarmTriggers)보다 뒤에 예약됨"
else
  ok ""
fi

# ⑮ 보조 알림 취소는 cancelRepSeries(REP_MAX까지)로만 — rep1/rep2 두 개만 지우면 iOS 긴 묶음이 남아 계속 울린다.
printf "  보조 알림 취소가 cancelRepSeries를 거치는지(rep1/rep2 직접 취소 없음) ... "
if grep -rn "_rep1\`\|_rep2\`" "$ROOT/src/hooks" "$ROOT/src/utils/notifications/index.ts" "$ROOT/app" 2>/dev/null | grep -v "^\s*//" | grep -q "cancelScheduledNotificationAsync"; then
  fail "rep1/rep2만 직접 취소하는 코드가 있음 — cancelRepSeries로 바꿀 것"
elif ! grep -q "REP_MAX" "$_IDX" 2>/dev/null; then
  fail "cancelRepSeries가 REP_MAX 상한을 안 씀"
else
  ok ""
fi

# ⑯ iOS 시간 민감 알림 권한 — entitlements와 content interruptionLevel이 짝으로 있어야 집중 모드를 뚫는다.
printf "  iOS interruptionLevel timeSensitive 요청 ... "
grep -q "timeSensitive" "$ROOT/src/utils/notifications/core.ts" 2>/dev/null \
  && ok "" || { fail "core.ts에 interruptionLevel timeSensitive 없음"; }
# entitlement 키는 유료 계정 프로필에서만 가능하므로 여기선 강제하지 않는다(app.entitlements 주석 참고).

# ⑰ iOS 딥링크(2026-10-10) — UIScene 셔임(withIosSceneDelegate)에서 URL을 RN Linking으로 넘기는 두 경로
#    (콜드 스타트 launchOptions[.url] 주입, 실행 중 openURLContexts)가 플러그인에 있어야 한다.
#    없으면 alarmapp:// 링크(테스트 알람 딥링크 포함)가 iOS 27 빌드에서 조용히 버려진다.
printf "  iOS SceneDelegate 딥링크 전달(openURLContexts + launchOptions[.url]) ... "
grep -q "openURLContexts" "$ROOT/plugins/withIosSceneDelegate.js" 2>/dev/null \
  && grep -q "launchOptions\[.url\] = url" "$ROOT/plugins/withIosSceneDelegate.js" 2>/dev/null \
  && ok "" || { fail "withIosSceneDelegate.js에 딥링크 전달 코드 없음 — iOS에서 딥링크 전부 무시됨"; }

# ⑱ 자정을 넘는 근무(야간 22~06시, 24시간 근무)(2026-10-13) — 퇴근 시각이 출근 시각보다 이르거나 같으면
#    퇴근 알람은 근무일 "다음 날"에 울려야 한다. 판정은 isOvernight 한 곳, effectiveTime/dayWorkFor가
#    dayOffset을 돌려주고, 발화 시각을 만드는 세 곳(core.ts 두 예약 루프 + getNextFireDate)이 전부 그걸 더해야 한다.
#    한 곳이라도 빠지면 "다음 알람 문구는 내일 06시인데 실제 예약은 오늘 06시(이미 지남 → 안 울림)"가 된다.
printf "  자정 넘는 근무: dayOffset이 예약 루프 2곳 + getNextFireDate에 반영 ... "
_U="$ROOT/src/utils/index.ts"; _C="$ROOT/src/utils/notifications/core.ts"
if ! grep -q "export function isOvernight" "$_U" 2>/dev/null; then
  fail "isOvernight 헬퍼 없음"
elif ! grep -q "if (t.dayOffset) ft.setDate" "$_C" 2>/dev/null || ! grep -q "if (dw?.dayOffset) ft.setDate" "$_C" 2>/dev/null; then
  fail "core.ts 예약 루프가 dayOffset을 반영하지 않음(로테이션·날짜기반 두 루프 모두 필요)"
elif ! awk '/export function getNextFireDate/,/^}/' "$_U" | grep -q "dayOffset"; then
  fail "getNextFireDate가 dayOffset을 반영하지 않음 — 다음 알람 문구·보조 알림 시각이 실제 예약과 어긋남"
elif [ "$(grep -c "overnightFrom(alarm)" "$_C" 2>/dev/null)" -lt 2 ]; then
  fail "core.ts 예약 루프가 어제 근무분(i=-1)부터 훑지 않음 — 어젯밤 야간 근무의 오늘 아침 퇴근 알람 누락"
else
  ok ""
fi

# ⑲ 야간(night) 근무조 — SHIFTS와 테마 색상표(다크/라이트) 양쪽에 있어야 배지가 빈 색으로 뜨지 않는다.
# (OVERRIDE_KINDS에도 id:'night'(야근)가 있어 파일 전체 grep은 거짓 통과한다 — SHIFTS 블록만 잘라 본다.
#  "+" 근무 추가 팝업(AddShiftModal BUTTON_ORDER)은 목록이 하드코딩이라 거기에도 있어야 고를 수 있다.)
printf "  야간(night) 근무조가 SHIFTS·다크·라이트 색상표·근무 추가 팝업에 모두 있는지 ... "
grep -q "BUTTON_ORDER.*'day'.*'night'" "$ROOT/src/components/AlarmForm/AddShiftModal.tsx" 2>/dev/null || { fail "AddShiftModal BUTTON_ORDER에 day/night 없음 — 근무표에 주간·야간 블록을 추가할 수 없음"; }
awk '/^export const SHIFTS/,/as const/' "$ROOT/src/constants/index.ts" 2>/dev/null | grep -q "id: 'night'" \
  && [ "$(grep -c "^  night:" "$ROOT/src/constants/colors.ts" 2>/dev/null)" -ge 2 ] \
  && ok "" || { fail "night 근무조가 SHIFTS 또는 colors.ts(DARK_SHIFT/LIGHT_SHIFT)에 없음"; }

# ⑳ 순수 로직 시나리오 테스트(scripts/logic-tests) — 시각을 고정해 getNextFireDate·effectiveTime·dayWorkFor 등을
#    실제로 실행한다. grep 체크가 못 잡는 "값이 틀림"을 잡는 용도(자정 넘는 근무 등).
printf "  로직 시나리오 테스트(node scripts/logic-tests/run.js) ... "
_LT=$(cd "$ROOT" && node scripts/logic-tests/run.js 2>&1)
if echo "$_LT" | grep -q "/ 0 실패"; then ok "$(echo "$_LT" | tail -1)"; else fail "로직 테스트 실패"; echo "$_LT" | grep -E "FAIL|Error" | head -8; fi

# 로테이션 보조 알림 제목(2026-10-13) — iOS 보조 알림(schedulePatternAlarmReps)도 본 알림처럼 "근무일" 근무조로
#    제목을 만든다. alarmLabel만 쓰면 본 알림은 "야간 출근"인데 30초 뒤 보조는 "출근"으로 달라진다.
printf "  로테이션 보조 알림 제목이 근무조 기준(roleLabel)인지 ... "
if awk '/export async function schedulePatternAlarmReps/,/^}/' "$ROOT/src/utils/notifications/core.ts" 2>/dev/null | grep -q "roleLabel(" \
  && awk '/export async function schedulePatternAlarmReps/,/^}/' "$ROOT/src/utils/notifications/core.ts" 2>/dev/null | grep -q "workDateOfFire("; then ok ""
else fail "schedulePatternAlarmReps 제목이 근무일 근무조(roleLabel+workDateOfFire)를 쓰지 않음"; fi

# 앱 이름(2026-10-14) — 한국어 기기만 "교대알람", 그 외 모든 언어는 "RotaWake" 하나로 통일.
#    언어별로 다른 이름(Shift Alarm, Schichtwecker …)이 다시 들어오면 브랜드가 갈라진다.
printf "  앱 이름: 한국어=교대알람, 그 외=RotaWake ... "
_RES="$ROOT/android/app/src/main/res"
_BADNAME=$(grep -l "app_name" "$_RES"/values*/strings.xml 2>/dev/null | grep -v "/values-ko/" | xargs grep -L '<string name="app_name">RotaWake</string>' 2>/dev/null)
if [ -z "$_BADNAME" ] && grep -q '<string name="app_name">교대알람</string>' "$_RES/values-ko/strings.xml" 2>/dev/null \
  && grep -q '"CFBundleDisplayName": "RotaWake"' "$ROOT/app.json" && grep -q '교대알람' "$ROOT/locales/ko.json" 2>/dev/null; then ok ""
else fail "앱 이름 규칙 위반: $_BADNAME"; fi

# 달력 칸 key(2026-10-14) — 칸 번호(key={i})를 쓰면 주 시작 요일·언어를 바꿀 때 비번 칸이 근무일로 재사용되며
#    칸 전체가 비어 보인다(32 실기기 확인). 날짜 기반 key여야 한다.
printf "  달력 칸 key가 날짜 기반인지 ... "
if grep -q 'key={`${ds}-${effOff ? 1 : 0}`}' "$ROOT/src/components/Home/CalendarView.tsx" 2>/dev/null; then ok ""
else fail "CalendarView 날짜 칸 key가 날짜 기반이 아님 — 주 시작 변경 시 빈칸 버그 재발"; fi

# ㉑ 다국어(2026-10-13) — 순수 모듈(utils·constants)은 i18n 인덱스(React·AsyncStorage)를 import하면 안 된다
#    (scripts/logic-tests가 node에서 못 돈다). 번역은 '../i18n/translate', 표식은 '../i18n/lang'만.
printf "  utils·constants가 i18n 인덱스를 import하지 않는지 ... "
if grep -rnE "from '(\.\./)+i18n'" "$ROOT/src/utils" "$ROOT/src/constants" >/dev/null 2>&1; then
  fail "src/utils 또는 src/constants가 '…/i18n' 인덱스를 import함 — '…/i18n/translate'로 바꿀 것"
else ok ""; fi

# ㉒ 사전 누락 검사 — 코드의 모든 t()/N() 키가 8개 언어 사전에 있고, 자리표시자·{time} 선두 규칙을 지키는지.
printf "  번역 사전 누락·자리표시자 검사(node scripts/i18n-keys.js --check) ... "
_IK=$(cd "$ROOT" && node scripts/i18n-keys.js --check 2>&1)
if echo "$_IK" | grep -q "누락 없음"; then ok "$(echo "$_IK" | tail -1)"; else fail "사전에 문제"; echo "$_IK" | head -12; fi

# ㉓ 한국 전용 기능 게이트 — 공휴일 표는 한국어일 때만(getHoliday). 이 게이트가 빠지면 해외 사용자의 출근 알람이
#    한국 공휴일에 조용히 안 울린다. 알림 본문 키는 {time}으로 시작해야 네이티브 끄기 경로가 시각을 읽는다.
printf "  한국 공휴일 게이트(isKoreanLocale) + 알림 본문 키 ... "
grep -A3 "export const getHoliday" "$ROOT/src/constants/holidays.ts" 2>/dev/null | grep -q "isKoreanLocale()" \
  && grep -q "'{time} 알람'" "$ROOT/src/utils/notifications/core.ts" 2>/dev/null \
  && ok "" || { fail "getHoliday의 isKoreanLocale 게이트 또는 '{time} 알람' 키가 없음"; }

# ㉔ 네이티브 문구 — 알림 "끄기" 버튼·위젯 라벨은 JS가 넘긴 현재 언어 문구(NativeStrings)를 쓴다.
printf "  네이티브 문구가 NativeStrings를 거치는지 ... "
_J="$ROOT/android/app/src/main/java/com/danielpark/alarmapp"
grep -q 'NativeStrings.get(this, "stop"' "$_J/AlarmService.kt" 2>/dev/null \
  && grep -q "saveNativeStrings" "$_J/WidgetModule.kt" 2>/dev/null \
  && grep -q "saveNativeStrings" "$ROOT/src/utils/widgetSync.ts" 2>/dev/null \
  && ok "" || { fail "AlarmService 끄기 버튼 또는 saveNativeStrings 연결이 없음"; }

# ㉕ 기존 한국어 사용자 보호(2026-10-13 verify-fix) — (a) 기기 언어는 네이티브 값(iOS AppleLanguages / Android I18nManager)을
#    먼저 읽는다: iOS의 Intl 로캘은 앱이 선언한 언어 안에서만 정해져 한국어 iPhone에서도 en이 나올 수 있다.
#    (b) iOS가 지원 언어를 선언한다(CFBundleLocalizations). (c) 언어 설정이 없는 기존 설치(알람 데이터 있음)는 'ko'로 고정한다 —
#    폰을 영어로 쓰는 기존 사용자가 업데이트 뒤 영어로 바뀌며 공휴일 건너뛰기가 조용히 꺼지는 것을 막는다.
printf "  기기 언어 네이티브 읽기 + iOS 언어 선언 + 기존 설치 한국어 고정 ... "
_IX="$ROOT/src/i18n/index.tsx"
if ! grep -q "setSystemLocaleProvider(" "$_IX" 2>/dev/null || ! grep -q "AppleLanguages" "$_IX" 2>/dev/null; then
  fail "i18n/index.tsx가 네이티브 로캘 제공자를 등록하지 않음 — 한국어 iPhone이 영어로 뜰 수 있음"
elif ! grep -q "CFBundleLocalizations" "$ROOT/app.json" 2>/dev/null; then
  fail "app.json ios.infoPlist에 CFBundleLocalizations 없음"
elif ! grep -q "existing ? 'ko' : 'system'" "$_IX" 2>/dev/null; then
  fail "기존 설치를 'ko'로 고정하는 첫 실행 판별이 없음(loadLanguageSetting)"
else ok ""; fi

# 세이람 자동 공유(v2) — 세이람 저장소 docs/shift-share-protocol.md (2026-10-18)
# ① exported provider라 호출 앱 확인이 유일한 방어선이다. 허용 목록이 넓어지면 아무 앱이나 근무표를 읽는다.
SP="$ROOT/modules/alarmapp-share/android/src/main/java/com/danielpark/alarmapp/share"
printf "  공유 창구(provider)가 세이람 패키지만 허용하는지 ... "
grep -q 'val ALLOWED = setOf("com.danielpark.sayram")$' "$SP/ShareProvider.kt" 2>/dev/null \
  && grep -q 'caller !in ALLOWED' "$SP/ShareProvider.kt" 2>/dev/null \
  && ok "" || { fail "ShareProvider 허용 목록이 세이람 하나가 아니거나 callingPackage 확인이 빠짐 — 다른 앱이 근무표를 읽을 수 있음"; }

# ② 창구로 내보내는 파일 이름은 shifts·config 두 개뿐 — 경로를 넓히면 앱 내부 파일이 새어 나간다.
printf "  공유 창구가 shifts·config만 내보내는지 ... "
grep -q 'val NAMES = setOf("shifts", "config")$' "$SP/ShareFiles.kt" 2>/dev/null \
  && ok "" || { fail "ShareFiles.NAMES가 shifts·config 외의 이름을 허용함"; }

# ③ 공유가 꺼져 있으면(양쪽 스위치 모두 꺼짐) 세이람 일정을 읽지도 보여 주지도 않는다 — 문서의 "반드시 지킬 것".
printf "  공유가 꺼져 있으면 세이람 일정을 읽지 않는지 ... "
grep -q 'if (!shareEnabled(mine' "$ROOT/src/utils/sayramShareNative.ts" 2>/dev/null \
  && ok "" || { fail "readSiblingEvents가 shareEnabled 확인 없이 세이람 일정을 읽음"; }

# ④ 읽기는 시작·앱이 앞으로 올 때만 — 주기적 폴링 금지(배터리).
printf "  세이람 공유에 주기적 폴링이 없는지 ... "
grep -qE 'setInterval|setTimeout' "$ROOT/src/hooks/useSayramShare.tsx" "$ROOT/src/utils/sayramShareNative.ts" 2>/dev/null \
  && { fail "세이람 공유 코드에 타이머(폴링)가 있음 — AppState active일 때만 읽어야 함"; } || ok ""

# 공유 v3(2026-10-18, "시스템에 부하는 절대 주면 안 돼") — 열 때마다 세이람 프로세스를 깨우지 않는다.
# ⑤ 넣어 주기 창구(call push)도 세이람만, 받는 이름은 events·config만.
printf "  넣어 주기 창구(call)가 세이람만 받는지 ... "
grep -q 'override fun call(' "$SP/ShareProvider.kt" 2>/dev/null \
  && awk '/override fun call\(/,/^  }/' "$SP/ShareProvider.kt" | grep -q 'caller !in ALLOWED' \
  && grep -q 'val INBOX_NAMES = setOf("events", "config")$' "$SP/ShareFiles.kt" 2>/dev/null \
  && ok "" || { fail "ShareProvider.call에 호출 앱 확인이 없거나 INBOX_NAMES가 events·config가 아님"; }

# ⑥ 앱을 열 때는 받은 파일(readInbox)만 읽고, 직접 가져오기(pullToInbox)는 needsPull일 때만.
printf "  열 때 세이람을 깨우지 않는지(needsPull일 때만 가져오기) ... "
N="$ROOT/src/utils/sayramShareNative.ts"
grep -vE '^\s*(//|\*)' "$N" 2>/dev/null | grep -q 'readSibling(' \
  && { fail "sayramShareNative가 아직 readSibling(query)으로 매번 세이람을 부름"; } \
  || { grep -q 'if (needsPull(' "$N" 2>/dev/null && ok "" || fail "pullToInbox 앞에 needsPull 확인이 없음"; }

# ⑦ 홍보 배너의 세이람 설치 확인은 실행 때 한 번만 — 앞으로 올 때마다 확인하지 않는다.
printf "  배너가 세이람 설치를 실행 때 한 번만 확인하는지 ... "
grep -q 'installedCache' "$N" 2>/dev/null \
  && ! grep -q 'AppState' "$ROOT/src/components/Home/PromoBanner.tsx" 2>/dev/null \
  && ok "" || { fail "sayramInstalled 결과를 기억하지 않거나 PromoBanner가 AppState마다 다시 확인함"; }

# ── iOS 26+ AlarmKit(2026-11-21) — 허용되면 소리 알람은 AlarmKit만, 진동만·거부·iOS 26 미만은 기존 Expo 그대로 ──
# ① AlarmKit 경로에선 Expo 메인 알림·보조(rep) 알림을 걸지 않는다 — 둘 다 걸면 같은 알람이 두 번 울린다.
#    core.ts의 세 예약 지점(로테이션 루프·요일 WEEKLY·날짜 루프)이 모두 viaAK로 갈라지고, 보조 알림 두 함수가 AlarmKit 알람을 뺀다.
_C="$ROOT/src/utils/notifications/core.ts"
printf "  AlarmKit 경로에서 Expo 메인·보조 알림을 걸지 않는지 ... "
_VA=$(grep -c "if (viaAK)" "$_C" 2>/dev/null)
if [ "${_VA:-0}" -lt 3 ]; then fail "core.ts 예약 지점 3곳 중 viaAK 분기가 ${_VA:-0}곳뿐 — AlarmKit과 Expo가 둘 다 걸릴 수 있음"
elif ! awk '/export async function scheduleGroupReps/,/^}/' "$_C" | grep -q "usesAlarmKit("; then fail "scheduleGroupReps가 AlarmKit 알람을 묶음에서 빼지 않음"
elif ! awk '/export async function schedulePatternAlarmReps/,/^}/' "$_C" | grep -q "usesAlarmKit("; then fail "schedulePatternAlarmReps가 AlarmKit 알람에도 보조 알림을 검"
elif ! grep -q "usesAlarmKit(" "$ROOT/src/utils/notifications/index.ts"; then fail "scheduleAllReps(가장 가까운 묶음 계산)가 AlarmKit 알람을 빼지 않음"
else ok ""; fi

# ② 개별 취소(cancelAlarmNotifications)는 Expo·네이티브에 더해 AlarmKit 원장 취소도 부른다.
printf "  알람 취소가 AlarmKit 원장 취소도 부르는지 ... "
awk '/export async function cancelAlarmNotifications/,/^}/' "$ROOT/src/utils/notifications/index.ts" | grep -q "cancelAlarmKitFor(alarmId)" \
  && ok "" || { fail "cancelAlarmNotifications에 cancelAlarmKitFor 없음 — 끈 알람이 AlarmKit으로 계속 울림"; }

# ③ rescheduleAll은 매번 모드를 다시 판정하고(권한 변경·iOS 업데이트) AlarmKit 원장 전체를 정리한 뒤 다시 건다 —
#    삭제된 알람 id·반대쪽 방식에 남은 예약까지 지워진다. 정리 뒤엔 세대 확인.
printf "  rescheduleAll이 AlarmKit 모드 재판정 + 원장 전체 정리 ... "
_RA=$(awk '/export async function rescheduleAll/,/^}/' "$ROOT/src/utils/notifications/index.ts")
if echo "$_RA" | grep -q "await refreshAlarmKitMode()" && echo "$_RA" | grep -q "await cancelAllAlarmKit(" \
   && echo "$_RA" | grep -A1 "await cancelAllAlarmKit(" | grep -q "isStaleGen(gen)"; then ok ""
else fail "rescheduleAll에 refreshAlarmKitMode/cancelAllAlarmKit(+isStaleGen) 없음 — 방식이 바뀌면 반대쪽 예약이 남음"; fi

# ④ 권한 문구 — NSAlarmKitUsageDescription이 없거나 비면 AlarmKit 예약 자체가 안 된다(Apple 문서). 9개 언어 InfoPlist.
printf "  NSAlarmKitUsageDescription(app.json + 9개 언어) ... "
_MISS=""
grep -q '"NSAlarmKitUsageDescription"' "$ROOT/app.json" 2>/dev/null || _MISS="app.json"
for _l in ko en ja zh-Hans zh-Hant es fr de pt; do
  grep -q '"NSAlarmKitUsageDescription": *"[^"]' "$ROOT/locales/$_l.json" 2>/dev/null || _MISS="$_MISS $_l"
  grep -q "\"$_l\": *\"./locales/$_l.json\"" "$ROOT/app.json" 2>/dev/null || _MISS="$_MISS app.json:locales.$_l"
done
[ -z "$_MISS" ] && ok "" || fail "누락:$_MISS"

# ⑤ AlarmKit 네이티브 호출은 직렬 큐로만 — 겹쳐 돈 rescheduleAll의 늦게 끝난 예약이 다음 호출의 전체 정리 뒤에 남지 않게.
printf "  AlarmKit 네이티브 호출이 직렬 큐를 거치는지 ... "
_AK="$ROOT/src/utils/notifications/alarmkit.ts"
if [ -f "$_AK" ] && ! grep -vE '^\s*//' "$_AK" | grep -E "native[!?]?\.(schedule|cancelForAlarm|cancelAll)\(" | grep -vq "serial("; then ok ""
else fail "alarmkit.ts가 없거나 schedule/cancel 네이티브 호출이 serial()을 거치지 않음"; fi

# ── 근무표 공유(1.6.0, 2026-11-22) — 받은 근무표는 보기만, 알람 예약 경로에 절대 들어가지 않는다 ──
# ① 알람 예약·위젯 파일은 공유 모듈·받은 목록을 모른다(import·저장 키 둘 다). 들어가면 남의 근무로 내 알람이 울린다.
printf "  받은 근무표가 알람 예약 경로에 안 들어가는지 ... "
_SS_BAD=""
for _f in src/utils/notifications/core.ts src/utils/notifications/index.ts src/utils/notifications/android.ts src/utils/notifications/alarmkit.ts \
          src/hooks/useAlarms.ts src/hooks/useAlarmNotifications.ts src/utils/widgetSync.ts src/utils/iosWidget.ts src/utils/alarmkitRoute.ts; do
  [ -f "$ROOT/$_f" ] || continue
  grep -qE "shiftShareLink|useShiftShare|shift_share_people" "$ROOT/$_f" && _SS_BAD="$_SS_BAD $_f"
done
[ -z "$_SS_BAD" ] && ok "" || fail "알람 경로가 근무표 공유를 참조함:$_SS_BAD"

# ② 공유 쪽도 알람을 만들지 않는다 — 공유 모듈·훅·화면이 예약 함수(notifications·useAlarms·rescheduleAll)를 부르지 않는다.
printf "  근무표 공유 코드가 알람 예약을 부르지 않는지 ... "
_SS_FILES="$ROOT/src/utils/shiftShareLink.ts $ROOT/src/hooks/useShiftShare.tsx $ROOT/src/components/Home/ShareBar.tsx $ROOT/src/components/Home/ShareReceiveModal.tsx $ROOT/src/components/Home/ShareTab.tsx"
if ! ls $_SS_FILES >/dev/null 2>&1; then fail "근무표 공유 파일이 없음"
elif cat $_SS_FILES | grep -vE '^\s*(//|\*)' | grep -qE "notifications|useAlarms|rescheduleAll|scheduleAlarm|addAlarm|submitWorkPattern"; then fail "근무표 공유 코드가 알람 예약·추가 함수를 참조함"
else ok ""; fi

# ③ 받기 주소는 1.6.0에서 새로 등록한 alarmappshare:// — 옛 버전은 이 주소를 몰라 앱이 안 열리고 안내 페이지가 스토어를 보여 준다.
#    app.json·iOS Info.plist·Android 매니페스트 세 곳 모두 등록, 안내 페이지는 alarmapp://로 열지 않는다. 받기 창은 앱 전체에 한 번.
printf "  공유 받기 새 주소(alarmappshare) 등록 + 안내 페이지 + Provider ... "
_MF="$ROOT/android/app/src/main/AndroidManifest.xml"
if ! grep -q '"alarmappshare"' "$ROOT/app.json"; then fail "app.json scheme에 alarmappshare 없음"
elif ! grep -q "<string>alarmappshare</string>" "$ROOT/ios/app/Info.plist" 2>/dev/null; then fail "ios/app/Info.plist CFBundleURLSchemes에 alarmappshare 없음"
elif ! grep -q 'android:scheme="alarmappshare"' "$_MF" 2>/dev/null; then fail "AndroidManifest에 alarmappshare intent-filter 없음"
elif [ ! -f "$ROOT/docs/s.html" ] || ! grep -q "alarmappshare://" "$ROOT/docs/s.html" || grep -q "alarmapp://" "$ROOT/docs/s.html"; then fail "docs/s.html이 없거나 alarmappshare://로 열지 않음(또는 옛 alarmapp://를 씀)"
elif [ ! -f "$ROOT/docs/s/index.html" ] || ! grep -q "alarmappshare://" "$ROOT/docs/s/index.html" || ! grep -q 'og:image" content="https://' "$ROOT/docs/s/index.html" || [ ! -f "$ROOT/docs/s/icon.png" ]; then fail "docs/s/index.html(짧은 v2 링크 안내 페이지)·og 미리보기 카드·icon.png 중 빠진 것"
elif ! grep -q "<ShiftShareProvider>" "$ROOT/app/_layout.tsx"; then fail "app/_layout.tsx에 ShiftShareProvider 없음 — 받기 팝업이 안 뜸"
else ok ""; fi

# ④ 내 달력과 공유 근무표는 섞지 않는다(2026-11-22 사용자 "내 기존 달력과 섞이면 안 돼, 따로").
#    내 달력 화면(CalendarView)은 공유 부품·훅·링크 모듈을 import하지 않는다 — 받은 근무는 [공유] 탭(ShareTab)에서만.
printf "  내 달력 화면이 근무표 공유 부품을 모르는지 ... "
_CV="$ROOT/src/components/Home/CalendarView.tsx"
if [ ! -f "$_CV" ]; then fail "CalendarView.tsx 없음"
elif grep -vE '^\s*(//|\*)' "$_CV" | grep -qE "ShareBar|useShiftShare|shiftShareLink|ShareTab|ShareCalendar"; then fail "CalendarView가 근무표 공유 부품을 import함 — 공유는 [공유] 탭에서만"
else ok ""; fi

# ⑤ [공유] 탭 — 아래 탭 줄에 있고, Android 뒤로가기는 앱을 끄지 않고 달력 탭으로, 링크로 받으면 공유 탭으로 간다.
printf "  공유 탭(탭 줄·뒤로가기→달력·받기→공유 탭) ... "
_IX="$ROOT/app/index.tsx"
if ! grep -q "'share'" "$ROOT/src/components/Home/BottomNav.tsx"; then fail "BottomNav에 share 탭 없음"
elif [ ! -f "$ROOT/src/components/Home/ShareTab.tsx" ]; then fail "ShareTab.tsx 없음"
elif ! grep -q "BackHandler" "$_IX" || ! awk '/hardwareBackPress/,/\}\);/' "$_IX" | grep -q "setTab('calendar')"; then fail "공유 탭에서 Android 뒤로가기가 달력 탭으로 가지 않음"
elif ! grep -q "incomingSeq" "$_IX"; then fail "링크로 받을 때 공유 탭으로 이동하지 않음(incomingSeq 구독 없음)"
else ok ""; fi

# ⑥ 받기 팝업이 다른 창에 막혀 사라지지 않게(2026-11-22 시뮬 재현 — 받은 근무표 편집 창의 [지우기] 확인이 떠 있을 때
#    링크가 오면, iOS는 이미 떠 있는 창 위로 두 번째 Modal을 조용히 무시하고 visible이 계속 true라 앱을 다시 켤 때까지 안 뜸).
#    받기 팝업은 onShow로 실제로 떴는지 확인해 못 떴으면 다시 띄우고, 공유 탭의 편집 창·날짜 시트는 링크가 오면 먼저 닫는다.
printf "  받기 팝업 재시도(onShow) + 링크 오면 공유 탭 창 닫기 ... "
_RM="$ROOT/src/components/Home/ShareReceiveModal.tsx"
if grep -qE '<Modal[[:space:]]+visible[[:space:]]' "$_RM"; then fail "ShareReceiveModal이 visible 고정 — iOS에서 다른 창에 막히면 다시 띄우지 못함"
elif ! grep -q "onShow" "$_RM"; then fail "ShareReceiveModal에 onShow 확인 없음 — 못 뜬 걸 알 수 없음"
elif ! grep -q "incomingSeq" "$ROOT/src/components/Home/ShareBar.tsx"; then fail "ShareBar 편집 창이 링크가 와도 닫히지 않음(incomingSeq)"
elif ! grep -q "incomingSeq" "$ROOT/src/components/Home/ShareTab.tsx"; then fail "ShareTab 날짜 시트가 링크가 와도 닫히지 않음(incomingSeq)"
else ok ""; fi

# ⑦-1 받기 쉽게(1.6.1, 2026-11-24) — https 링크를 누르면 페이지 없이 바로 앱(iOS 유니버설 링크·Android App Links).
#    app.json(prebuild용)과 손으로 관리하는 네이티브 프로젝트 둘 다 등록해야 하고, 그 주소로 열릴 때 expo-router가
#    /alarm-ios/s 경로를 Unmatched Route로 띄우지 않게 app/+native-intent.tsx가 '/'로 돌린다(링크 내용은 useShiftShare가 읽는다).
printf "  공유 링크 바로 열기(applinks·App Links autoVerify·+native-intent) ... "
_ENT="$ROOT/ios/app/app.entitlements"
_NI="$ROOT/app/+native-intent.tsx"
if ! grep -q '"applinks:danielpark64.github.io"' "$ROOT/app.json"; then fail "app.json ios.associatedDomains에 applinks:danielpark64.github.io 없음"
elif ! grep -q '"autoVerify": *true' "$ROOT/app.json" || ! grep -q '"pathPrefix": *"/alarm-ios/s"' "$ROOT/app.json"; then fail "app.json android.intentFilters(autoVerify·/alarm-ios/s) 없음"
elif ! grep -q "<string>applinks:danielpark64.github.io</string>" "$_ENT" 2>/dev/null; then fail "ios/app/app.entitlements에 associated-domains 없음"
elif ! grep -q 'android:autoVerify="true"' "$_MF" || ! grep -q 'android:host="danielpark64.github.io"' "$_MF" || ! grep -q 'android:pathPrefix="/alarm-ios/s"' "$_MF"; then fail "AndroidManifest에 App Links(autoVerify·host·pathPrefix) intent-filter 없음"
elif [ ! -f "$_NI" ] || ! grep -q "redirectSystemPath" "$_NI" || ! grep -q "/alarm-ios/s" "$_NI"; then fail "app/+native-intent.tsx 없음 — https 공유 주소로 열리면 Unmatched Route"
elif ! grep -q "onPress: openStore" "$ROOT/src/hooks/useShiftShare.tsx" || ! grep -q "STORE_ANDROID_WEB" "$ROOT/src/utils/storeLink.ts" || ! grep -q "STORE_IOS" "$ROOT/src/utils/storeLink.ts"; then fail "새 형식 안내에 [업데이트](플랫폼별 스토어, utils/storeLink.ts) 버튼 없음"
else ok ""; fi

# ⑦ 알람 소리 고르기(2026-11-23) — 알람마다 소리 하나. 소리 파일 이름은 src/constants/alarmTones.ts(JS)와
#    AlarmTones.kt(Android 네이티브) 한 곳에서만 정한다. 다른 곳에 'alarm_long.wav'·R.raw.alarm_long을 박아 두면
#    그 경로만 고른 소리를 무시하고 기본음으로 울린다(스누즈·보조 알림·AlarmKit 등 경로가 여러 개라 빠뜨리기 쉽다).
printf "  알람 소리: 파일 이름 하드코딩 금지(alarmTones 한 곳) ... "
_TONE_HARD=$(grep -rnE "'alarm_long\.wav'|\"alarm_long\.wav\"" "$ROOT/src" "$ROOT/app" "$ROOT/modules" 2>/dev/null \
  | grep -v "src/constants/alarmTones.ts" | grep -v "tone-fallback" | grep -vE ':[[:space:]]*(//|\*)' | head -3)
_TONE_HARD_KT=$(grep -rn "R\.raw\.alarm_long" "$NATIVE_DIR" 2>/dev/null | grep -v "AlarmTones.kt" | head -3)
if [ ! -f "$ROOT/src/constants/alarmTones.ts" ]; then fail "src/constants/alarmTones.ts 없음"
elif [ -n "$_TONE_HARD" ]; then fail "JS/Swift에 alarm_long.wav 하드코딩 — 고른 소리 무시: $_TONE_HARD"
elif [ ! -f "$NATIVE_DIR/AlarmTones.kt" ]; then fail "AlarmTones.kt 없음(Android 소리 id → R.raw 매핑)"
elif [ -n "$_TONE_HARD_KT" ]; then fail "Kotlin에 R.raw.alarm_long 하드코딩 — 고른 소리 무시: $_TONE_HARD_KT"
else ok ""; fi

# 목록의 모든 소리 파일이 실제로 있어야 한다 — iOS는 app.json sounds(번들 포함), Android는 res/raw.
# 없으면 iOS는 조용히 기본음(또는 무음), Android는 리소스가 없어 빌드가 깨지거나 기본음으로 떨어진다.
printf "  알람 소리: 파일이 app.json·assets·res/raw에 모두 있음 ... "
_TONE_MISS=""
if [ -f "$ROOT/src/constants/alarmTones.ts" ]; then
  for f in $(grep -oE "ios: *'[^']+'" "$ROOT/src/constants/alarmTones.ts" | sed -E "s/ios: *'([^']+)'/\1/"); do
    grep -q "assets/sounds/$f\"\|assets/$f\"" "$ROOT/app.json" || _TONE_MISS="$_TONE_MISS app.json:$f"
    [ -f "$ROOT/assets/sounds/$f" ] || [ -f "$ROOT/assets/$f" ] || _TONE_MISS="$_TONE_MISS assets:$f"
  done
  for r in $(grep -oE "android: *'[^']+'" "$ROOT/src/constants/alarmTones.ts" | sed -E "s/android: *'([^']+)'/\1/"); do
    ls "$ROOT/android/app/src/main/res/raw/$r."* >/dev/null 2>&1 || _TONE_MISS="$_TONE_MISS raw:$r"
    grep -q "R\.raw\.$r\b" "$NATIVE_DIR/AlarmTones.kt" 2>/dev/null || _TONE_MISS="$_TONE_MISS kt:$r"
  done
else _TONE_MISS="alarmTones.ts 없음"; fi
[ -z "$_TONE_MISS" ] && ok "" || fail "소리 파일 누락 —$_TONE_MISS"

# iOS 알림 소리는 30초 이하여야 한다(넘으면 iOS가 기본음으로 바꿔 울린다). 원본 mp3는 앱에 넣지 않는다(용량).
printf "  알람 소리: iOS 파일 30초 이하·원본 mp3 미포함 ... "
_TONE_LONG=""
if command -v afinfo >/dev/null 2>&1; then
  for f in "$ROOT"/assets/sounds/*.caf; do
    [ -f "$f" ] || continue
    d=$(afinfo "$f" 2>/dev/null | awk '/estimated duration/ {print $3}')
    awk -v d="${d:-99}" 'BEGIN{exit !(d>=30)}' && _TONE_LONG="$_TONE_LONG ${f##*/}(${d}s)"
  done
fi
if [ -n "$_TONE_LONG" ]; then fail "30초 넘는 iOS 소리:$_TONE_LONG"
elif ls "$ROOT"/assets/sounds/*.mp3 "$ROOT"/android/app/src/main/res/raw/*.mp3 >/dev/null 2>&1; then fail "원본 mp3가 앱에 들어감"
else ok ""; fi

# 고른 소리가 예약 데이터로 끝까지 가야 한다 — JS scheduleNative → AlarmModule → AlarmStore(부팅 복구) →
# 인텐트(AlarmScheduling) → AlarmReceiver(보조 rep 포함) → AlarmService. 한 군데라도 빠지면 재부팅 뒤·보조 울림만 기본음.
printf "  알람 소리: tone·crescendo가 예약~재생까지 전달 ... "
_TP=""
grep -q "tone" "$ROOT/src/utils/notifications/android.ts" || _TP="$_TP android.ts"
grep -q "tone" "$NATIVE_DIR/AlarmModule.kt" || _TP="$_TP AlarmModule"
grep -q '"tone"' "$NATIVE_DIR/AlarmStore.kt" && grep -q '"cres"' "$NATIVE_DIR/AlarmStore.kt" || _TP="$_TP AlarmStore"
grep -q '"tone"' "$NATIVE_DIR/AlarmScheduling.kt" && grep -q '"crescendo"' "$NATIVE_DIR/AlarmScheduling.kt" || _TP="$_TP AlarmScheduling"
[ "$(grep -c '"tone"' "$NATIVE_DIR/AlarmReceiver.kt")" -ge 3 ] || _TP="$_TP AlarmReceiver(본·rep 둘 다)"
grep -q "AlarmTones" "$NATIVE_DIR/AlarmService.kt" || _TP="$_TP AlarmService"
grep -q "o.sound\|o\.sound" "$ROOT/modules/alarmapp-alarmkit/ios/AlarmappAlarmKitModule.swift" || _TP="$_TP AlarmKit.swift"
[ -z "$_TP" ] && ok "" || fail "소리 id 전달 끊김 —$_TP"

# ── 알람 화면 항상 맨 앞(1.6.1, 2026-11-24 세이람 0eb9d8b 이식) — 울리는 동안 끌 곳이 숨지 않게 ──
# ① 커버·잠금해제 전 울림 화면(CoverAlarmActivity)은 울리는 동안 뒤로 가기로 닫히지 않는다(소리는 계속인데 끌 곳이 사라짐).
#    대신 이미 꺼졌으면 남아 있지 않는다(onResume에서 닫고, 뒤로 가기도 허용) — 막기만 하면 낡은 화면이 못 닫힌다.
printf "  맨 앞: 커버 울림 화면 뒤로 가기 막기(울리는 동안만) ... "
_CA="$NATIVE_DIR/CoverAlarmActivity.kt"
if ! grep -q "override fun onBackPressed" "$_CA"; then fail "CoverAlarmActivity에 onBackPressed 없음 — 뒤로 가기로 울림 화면이 닫힘"
elif ! grep -A4 "override fun onBackPressed" "$_CA" | grep -q "AlarmService.currentRinging"; then fail "뒤로 가기가 울림 여부를 안 봄 — 꺼진 뒤에도 못 닫히거나 울리는 중에 닫힘"
elif ! grep -A4 "override fun onResume" "$_CA" | grep -q "AlarmService.currentRinging == null"; then fail "onResume에서 꺼진 알람의 낡은 화면을 닫지 않음"
else ok ""; fi
# ② 기본 화면: 울리는 동안 홈·다른 앱에 가려지면 다시 맨 앞으로(scheduleKeepFront). 울림이 끝나는 모든 길(끄기·스누즈·서비스 종료)에서
#    멈춘다 — 안 멈추면 끈 뒤에도 앱이 튀어나온다. 화면 꺼짐·통화 중에는 띄우지 않고, "다른 앱 위에 표시"가 없으면 돌리지 않는다.
printf "  맨 앞: 가려지면 다시 올림 + 끝나면 멈춤 ... "
_AS="$NATIVE_DIR/AlarmService.kt"
_KF_BAD=""
grep -q "private fun scheduleKeepFront" "$_AS" || _KF_BAD="$_KF_BAD 함수없음"
[ "$(grep -c 'scheduleKeepFront(' "$_AS")" -ge 2 ] || _KF_BAD="$_KF_BAD 호출없음"
[ "$(grep -c 'cancelKeepFront()' "$_AS")" -ge 4 ] || _KF_BAD="$_KF_BAD 멈춤(끄기·스누즈·onDestroy)부족"
_KF_BODY=$(awk '/private fun scheduleKeepFront/,/^    }$/' "$_AS")
echo "$_KF_BODY" | grep -q "canDrawOverlays()" || _KF_BAD="$_KF_BAD 오버레이권한검사없음"
echo "$_KF_BODY" | grep -q "currentRinging == null" || _KF_BAD="$_KF_BAD 울림검사없음"
echo "$_KF_BODY" | grep -q "isScreenOn()" || _KF_BAD="$_KF_BAD 화면꺼짐검사없음"
echo "$_KF_BODY" | grep -q "inCall()" || _KF_BAD="$_KF_BAD 통화중검사없음"
echo "$_KF_BODY" | grep -q "MainActivity.inFront" || _KF_BAD="$_KF_BAD 맨앞판정없음"
grep -q "inFront = true" "$NATIVE_DIR/MainActivity.kt" && grep -q "inFront = false" "$NATIVE_DIR/MainActivity.kt" || _KF_BAD="$_KF_BAD MainActivity맨앞기록없음"
[ -z "$_KF_BAD" ] && ok "" || fail "다시 올리기 —$_KF_BAD"
# ③ 화면이 하나뿐인 폰은 전체 화면 알림(fullScreenIntent)도 단다 — "다른 앱 위에 표시"가 꺼져 있어도 잠금·화면 꺼짐 때 울림 화면이 뜬다.
#    접는 폰(화면 둘 이상)은 달지 않는다 — 시스템이 기본 화면에 먼저 띄워 커버 화면 지정과 경쟁한다(42b5b66 이후 제거한 이유).
printf "  맨 앞: 전체 화면 알림은 화면 하나인 폰만 ... "
if ! grep -q "\.setFullScreenIntent(" "$_AS"; then fail "AlarmService에 setFullScreenIntent 호출 없음"
elif ! grep -B8 "\.setFullScreenIntent(" "$_AS" | grep -q "if (!hasMultipleDisplays())"; then fail "fullScreenIntent가 접는 폰에서도 달림 — 커버 화면과 경쟁"
else ok ""; fi
# ④ Android 14+ 전체 화면 알림 허용 확인·설정 열기(네이티브) + 안내 판정(순수 함수, logic-tests) + 설정 줄.
printf "  맨 앞: 전체 화면 알림 허용 확인·안내 ... "
_FSI_BAD=""
grep -q "fun canUseFullScreenIntent" "$NATIVE_DIR/AlarmModule.kt" || _FSI_BAD="$_FSI_BAD AlarmModule.canUseFullScreenIntent"
grep -q "fun openFullScreenIntentSettings" "$NATIVE_DIR/AlarmModule.kt" || _FSI_BAD="$_FSI_BAD AlarmModule.openFullScreenIntentSettings"
[ -f "$ROOT/src/utils/alarmScreenAsk.ts" ] || _FSI_BAD="$_FSI_BAD src/utils/alarmScreenAsk.ts"
grep -q "canUseFullScreenIntent" "$ROOT/src/components/Home/SettingsView.tsx" 2>/dev/null || _FSI_BAD="$_FSI_BAD 설정줄"
[ -z "$_FSI_BAD" ] && ok "" || fail "없음 —$_FSI_BAD"
# ⑤ iOS 시간 민감 알림 — core.ts가 interruptionLevel 'timeSensitive'를 쓰면 엔타이틀먼트가 있어야 한다.
#    없으면 iOS가 오류 없이 보통 단계로 낮춘다(집중 모드에서 안 뜸). ios/는 gitignore라 app.json에 둔다.
printf "  iOS 시간 민감 알림 엔타이틀먼트(app.json) ... "
if grep -q "timeSensitive" "$ROOT/src/utils/notifications/core.ts" && ! grep -q '"com.apple.developer.usernotifications.time-sensitive": true' "$ROOT/app.json"; then
  fail "core.ts는 timeSensitive를 쓰는데 app.json ios.entitlements에 time-sensitive 없음 — 조용히 보통 알림으로 낮아짐"
else ok ""; fi

# ── 1.6.2(2026-11-25 실기기 점검) ──
# ⑥ 울리는 중 Expo 알림 '본문'을 누르면 알람이 꺼져 버렸다 — 응답 리스너가 액션 버튼과 본문 탭을 구분해야 한다.
#    판정은 순수 함수(src/utils/alarmResponse.ts responseAction, logic-tests) 한 곳. 울림 화면 열기 갈래가 있어야 한다.
printf "  1.6.2: 알림 본문 탭은 끄지 않고 울림 화면 ... "
_UAN="$ROOT/src/hooks/useAlarmNotifications.ts"
_RB=$(awk '/addNotificationResponseReceivedListener/,/^    }\);$/' "$_UAN")
if [ ! -f "$ROOT/src/utils/alarmResponse.ts" ]; then fail "src/utils/alarmResponse.ts 없음"
elif ! echo "$_RB" | grep -q "responseAction("; then fail "응답 리스너가 responseAction으로 판정 안 함 — 본문 탭도 끔"
elif ! echo "$_RB" | grep -q "DEFAULT_ACTION_IDENTIFIER"; then fail "응답 리스너가 DEFAULT_ACTION_IDENTIFIER를 넘기지 않음"
elif ! echo "$_RB" | grep -q "'openRinging'"; then fail "울림 화면 열기 갈래 없음"
else ok ""; fi
# ⑦ 끈 뒤에도 MainActivity가 보안 잠금 위에 남았다 — setShowWhenLocked(true)는 창 플래그(clearFlags)로 안 풀린다.
#    울림이 끝나는 모든 길(끄기·스누즈·서비스 종료)에서 AlarmService가 MainActivity.onRingingEnded()를 불러 잠금 위 표시를 풀고,
#    커버 울림 화면(CoverAlarmActivity)도 닫는다. AlarmModule(JS 끄기·스누즈)도 같은 함수를 쓴다.
printf "  1.6.2: 끈 뒤 잠금 위 표시 해제 ... "
_MA="$NATIVE_DIR/MainActivity.kt"; _LK=""
grep -q "setShowWhenLocked(false)" "$_MA" || _LK="$_LK MainActivity.setShowWhenLocked(false)"
grep -q "setTurnScreenOn(false)" "$_MA" || _LK="$_LK MainActivity.setTurnScreenOn(false)"
grep -q "fun onRingingEnded" "$_MA" || _LK="$_LK MainActivity.onRingingEnded"
# AlarmService는 한 함수(onRingingEnded)로 모아 끄기·스누즈·onDestroy 세 곳에서 부른다
[ "$(grep -cE '^ +onRingingEnded\(\)$' "$_AS")" -ge 3 ] || _LK="$_LK AlarmService호출(끄기·스누즈·onDestroy)부족"
_RE_BODY=$(awk '/private fun onRingingEnded/,/^    }$/' "$_AS")
echo "$_RE_BODY" | grep -q "MainActivity.onRingingEnded()" || _LK="$_LK AlarmService→MainActivity"
echo "$_RE_BODY" | grep -q "CoverAlarmActivity.onRingingEnded()" || _LK="$_LK AlarmService→커버화면닫기"
awk '/ACTION_STOP -> \{/,/return START_NOT_STICKY/' "$_AS" | grep -qE '^ +onRingingEnded\(\)$' || _LK="$_LK 끄기경로"
awk '/ACTION_SNOOZE -> \{/,/return START_NOT_STICKY/' "$_AS" | grep -qE '^ +onRingingEnded\(\)$' || _LK="$_LK 스누즈경로"
awk '/override fun onDestroy/,/^    }$/' "$_AS" | grep -qE '^ +onRingingEnded\(\)$' || _LK="$_LK onDestroy"
grep -q "fun onRingingEnded" "$_CA" || _LK="$_LK CoverAlarmActivity.onRingingEnded"
grep -q "MainActivity.onRingingEnded()" "$NATIVE_DIR/AlarmModule.kt" || _LK="$_LK AlarmModule호출"
[ -z "$_LK" ] && ok "" || fail "잠금 위에 남음 —$_LK"
# ⑦-2 울린 지 1.2초 안에(워치·알림 버튼) 끄면 지연된 울림 화면 띄우기(postDelayed 1200ms·DisplayListener)가 취소되지 않아
#     끈 뒤에 MainActivity가 잠금 위로 다시 떴다. 끝나는 세 길(끄기·스누즈·onDestroy)에서 대기 중인 띄우기를 취소하고,
#     띄우기 직전에 "아직 같은 울림인가"를 다시 본다. 늦게 도착한 울림 인텐트(ringAt ≤ 마지막으로 끝난 시각)는 플래그를 걸지 않는다.
printf "  1.6.2: 울리자마자 끄면 지연 띄우기 취소 ... "
_PL=""
grep -q "private fun cancelPendingRingLaunch" "$_AS" || _PL="$_PL 취소함수없음"
_CPL=$(awk '/private fun cancelPendingRingLaunch/,/^    }$/' "$_AS")
echo "$_CPL" | grep -q "removeCallbacks" || _PL="$_PL 콜백취소없음"
echo "$_CPL" | grep -q "unregisterDisplayListener" || _PL="$_PL 리스너해제없음"
awk '/ACTION_STOP -> \{/,/return START_NOT_STICKY/' "$_AS" | grep -q "cancelPendingRingLaunch()" || _PL="$_PL 끄기경로"
awk '/ACTION_SNOOZE -> \{/,/return START_NOT_STICKY/' "$_AS" | grep -q "cancelPendingRingLaunch()" || _PL="$_PL 스누즈경로"
awk '/override fun onDestroy/,/^    }$/' "$_AS" | grep -q "cancelPendingRingLaunch()" || _PL="$_PL onDestroy"
awk '/fun launch\(displayId/,/^        }$/' "$_AS" | grep -q "currentRinging == null" || _PL="$_PL 띄우기직전재확인없음"
awk '/private fun onRingingEnded/,/^    }$/' "$_AS" | grep -q "lastRingEndedAt = " || _PL="$_PL 끝난시각기록없음"
[ "$(grep -c 'putExtra("ringAt"' "$_AS")" -ge 2 ] || _PL="$_PL 울림인텐트ringAt(울림화면·알림본문)"
grep -q "lastRingEndedAt" "$_MA" || _PL="$_PL MainActivity늦은인텐트판정없음"
[ -z "$_PL" ] && ok "" || fail "끈 뒤 잠금 위로 다시 뜰 수 있음 —$_PL"
# ⑦-4 허용 안내(1.6.2, 세이람 1.2.3에서 가져옴) — 알람 저장 직후에도 꺼진 허용(알림·다른 앱 위에 표시·전체 화면 알림)을 안내,
#     알림 권한도 안내. 배터리 최적화는 시작·저장 때 띄우지 않고 설정 화면 줄에서만(사용자 결정 2026-11-25).
printf "  1.6.2: 허용 안내(저장 직후·알림 권한, 배터리는 설정 줄만) ... "
_PA=""; _IDX="$ROOT/app/index.tsx"; _SAH="$ROOT/src/hooks/useAlarmScreenAsk.ts"
[ "$(grep -c 'askAfterSave(true)' "$_IDX")" -ge 4 ] || _PA="$_PA 저장4곳연결부족"
grep -q "withOverlay: true" "$_SAH" || _PA="$_PA 저장때표시권한안봄"
grep -q "need === 'notif'" "$_SAH" || _PA="$_PA 알림권한안내없음"
grep -q "notifications: await notificationPermissionGranted()" "$ROOT/src/utils/alarmScreenNative.ts" || _PA="$_PA 알림권한확인없음"
grep -qE "openBatteryOptimizationSettings|isIgnoringBatteryOptimizations" "$_SAH" "$_IDX" && _PA="$_PA 배터리를시작·저장때띄움"
grep -q "openBatteryOptimizationSettings()" "$ROOT/src/components/Home/SettingsView.tsx" || _PA="$_PA 설정화면배터리줄없음"
grep -q "ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS\|REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" "$NATIVE_DIR/AlarmModule.kt" "$ROOT/android/app/src/main/AndroidManifest.xml" 2>/dev/null \
  && grep -v '^\s*\*\|//' "$NATIVE_DIR/AlarmModule.kt" | grep -q "ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" && _PA="$_PA 바로요청권한사용(Play선언필요)"
[ -z "$_PA" ] && ok "" || fail "허용 안내 빠짐 —$_PA"
# ⑦-3 최근 앱에서 옛 울림 인텐트로 다시 열면(FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) 울림이 끝났는데도 잠금 위 표시가 걸리고
#     첫 onResume에서 5초 규칙 때문에 안 풀렸다 → 걸지 않고, onResume에서 바로 푼다.
printf "  1.6.2: 최근 앱 재진입 시 잠금 위 표시 즉시 해제 ... "
_HS=""
_AW=$(awk '/private fun applyRingingWindowFlags/,/^  }$/' "$_MA")
echo "$_AW" | grep -q "isStaleRingingIntent" || _HS="$_HS 걸기전판정없음"
grep -q "FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY" "$_MA" || _HS="$_HS 최근앱판정없음"
awk '/override fun onResume/,/^  }$/' "$_MA" | grep -q "isStaleRingingIntent" || _HS="$_HS onResume즉시해제없음"
[ -z "$_HS" ] && ok "" || fail "최근 앱으로 열면 잠금 위에 남음 —$_HS"
# ⑧ 끈 알람의 표시된 알림이 알림 줄에 쌓였다 — 끄는 길(afterNativeStop·인앱 끄기·응답 리스너)이 dismissPresentedAlarm을 부른다.
printf "  1.6.2: 끈 알람의 지난 알림 지우기 ... "
_NI="$ROOT/src/utils/notifications/index.ts"; _DS=""
grep -q "export async function dismissPresentedAlarm" "$_NI" || _DS="$_DS 함수없음"
grep -A8 "export async function dismissPresentedAlarm" "$_NI" | grep -q "getPresentedNotificationsAsync" || _DS="$_DS 표시목록조회없음"
grep -A8 "export async function dismissPresentedAlarm" "$_NI" | grep -q "dismissNotificationAsync" || _DS="$_DS 지우기없음"
awk '/const afterNativeStop/,/^  };$/' "$_UAN" | grep -q "dismissPresentedAlarm(" || _DS="$_DS afterNativeStop"
awk '/const stopRinging = /,/^  };$/' "$_UAN" | grep -q "dismissPresentedAlarm(" || _DS="$_DS stopRinging"
echo "$_RB" | grep -q "dismissPresentedAlarm(" || _DS="$_DS 응답리스너"
[ -z "$_DS" ] && ok "" || fail "지난 알림 남음 —$_DS"
# ⑨ '다른 앱 위에 표시' 안내는 설정 목록에 실제로 보이는 앱 이름으로 — 한국어 "교대알람", 다른 언어는 RotaWake(android app_name).
printf "  1.6.2: 표시 권한 안내에 실제 앱 이름 ... "
_OV=""
grep -q '1. 그 목록에서 "교대알람"을 찾아주세요' "$ROOT/app/index.tsx" || _OV="$_OV 한국어"
for _l in en ja zh-Hans zh-Hant es fr de pt; do
  grep '그 목록에서 \\"교대알람\\"' "$ROOT/src/i18n/locales/$_l.ts" | grep -q "RotaWake" || _OV="$_OV $_l"
done
[ -z "$_OV" ] && ok "" || fail "앱 이름이 아님 —$_OV"

# ⑩ 어느 앱 알람인지(1.6.2, 세이람 1.2.3과 같은 모양) — 울림 화면(JS·커버)에 앱 아이콘+이름, 울리는 중 상시 알림 제목에 앱 이름.
#    앱 이름은 NativeStrings(appName) ← widgetSync.saveNativeStrings 경로. 알림 본문은 {time}으로 시작해야 하므로 제목만 바꾼다.
printf "  1.6.2: 울림 화면·상시 알림에 앱 이름 ... "
_AN=""
grep -q "t('교대알람')" "$ROOT/src/components/AlarmRinging.tsx" || _AN="$_AN JS울림화면"
grep -q "appName: t('교대알람')" "$ROOT/src/utils/widgetSync.ts" || _AN="$_AN saveNativeStrings"
grep -q 'NativeStrings.get(this, "appName"' "$_AS" || _AN="$_AN 상시알림제목"
grep -q '\.setContentText(body)' "$_AS" || _AN="$_AN 상시알림본문바뀜"
grep -q '"appName"' "$_CA" && grep -q "getApplicationIcon" "$_CA" || _AN="$_AN 커버화면"
[ -z "$_AN" ] && ok "" || fail "앱 이름 없음 —$_AN"

# ── 새 버전 안내(1.6.3, 본부/규칙/업데이트-안내.md) — 앱을 열 때 스토어에 새 판이 있으면 "새 버전이 있어요" ──
_UP_HOOK="$ROOT/src/hooks/useAppUpdatePrompt.ts"; _UP_NAT="$ROOT/src/utils/appUpdateNative.ts"; _UP_UI="$ROOT/src/components/common/UpdatePrompt.tsx"
# ① 울리는 중·울림 화면에서는 절대 안 띄운다 — 알람 끄기를 막으면 안 된다.
#    판정(shouldShowUpdate, logic-tests)에 울림 여부를 넘기고, Android는 띄우기 직전에 네이티브 울림(getCurrentRinging)도 본다.
#    창은 <Modal>이 아닌 화면 안 덮개(View) — 울림 화면(AlarmRinging, Modal)이 늘 그 위에 뜬다(모달 겹침은 iOS에서 조용히 죽음).
printf "  새 버전 안내: 울리는 중·울림 화면에서 안 띄움 ... "
_UR=""
[ -f "$_UP_HOOK" ] || _UR="$_UR 훅없음"
grep -q "shouldShowUpdate(" "$_UP_HOOK" 2>/dev/null && grep -q "ringing" "$_UP_HOOK" 2>/dev/null || _UR="$_UR 판정에울림없음"
grep -q "getCurrentRinging" "$_UP_HOOK" 2>/dev/null || _UR="$_UR 네이티브울림확인없음"
grep -q "useAppUpdatePrompt(" "$ROOT/app/index.tsx" && grep -A6 "useAppUpdatePrompt(" "$ROOT/app/index.tsx" | grep -q "ringing: !!ringing" || _UR="$_UR index가울림을안넘김"
[ -f "$_UP_UI" ] && ! grep -q "<Modal" "$_UP_UI" || _UR="$_UR 창이Modal이거나없음"
# 화면에 그릴 때도 울림 화면이 없을 때만
grep -q "!ringing && <UpdatePrompt\|!ringing && (<UpdatePrompt\|{!ringing && appUpdate" "$ROOT/app/index.tsx" || _UR="$_UR 그릴때울림검사없음"
[ -z "$_UR" ] && ok "" || fail "울림 중에 뜰 수 있음 —$_UR"
# ② 확인이 실패하면(인터넷 없음·스토어 응답 없음·Play 없음) 조용히 — 창·Alert 없이 null, 시간 제한, 앱 시작을 기다리게 하지 않는다.
printf "  새 버전 안내: 실패하면 조용히(시간 제한·Alert 없음) ... "
_US=""
[ -f "$_UP_NAT" ] || _US="$_US appUpdateNative.ts없음"
grep -q "export async function checkForUpdate" "$_UP_NAT" 2>/dev/null || _US="$_US checkForUpdate없음"
awk '/export async function checkForUpdate/,/^}$/' "$_UP_NAT" 2>/dev/null | grep -q "catch" || _US="$_US try/catch없음"
grep -q "AbortController\|withTimeout" "$_UP_NAT" 2>/dev/null || _US="$_US 시간제한없음"
grep -qE "Alert|console\.(warn|error)" "$_UP_NAT" "$_UP_HOOK" 2>/dev/null && _US="$_US 실패를화면에보임"
grep -q "checkForUpdate().then\|checkForUpdate()\.then" "$_UP_HOOK" 2>/dev/null || _US="$_US 뒤에서확인안함(await로기다림)"
grep -q "\.catch(() => null)\|\.catch(() => {})" "$_UP_HOOK" 2>/dev/null || _US="$_US 훅catch없음"
[ -z "$_US" ] && ok "" || fail "실패가 드러나거나 시작을 막음 —$_US"
# ③ 다른 시작 안내 창(알림·AlarmKit 시스템 창 → 표시 권한 → 알람 화면 권한 → 첫 실행 따라하기)이 다 끝난 뒤에만.
printf "  새 버전 안내: 시작 안내 창이 끝난 뒤 ... "
_UO=""
grep -q "settled" "$ROOT/src/hooks/useAlarmScreenAsk.ts" || _UO="$_UO useAlarmScreenAsk가끝남을안알림"
_UREADY=$(grep -A6 "useAppUpdatePrompt(" "$ROOT/app/index.tsx")
echo "$_UREADY" | grep -q "startupPermsDone" || _UO="$_UO 권한창"
echo "$_UREADY" | grep -q "screenAskSettled" || _UO="$_UO 알람화면권한창"
echo "$_UREADY" | grep -q "overlayAskOpen" || _UO="$_UO 표시권한창"
echo "$_UREADY" | grep -q "firstRunPrompt" || _UO="$_UO 첫실행창"
[ -z "$_UO" ] && ok "" || fail "다른 창과 겹칠 수 있음 —$_UO"
# ④ 보내는 값 — iOS는 lookupUrl(번들 ID·나라)만, Android는 JS에서 인터넷을 쓰지 않는다(Play 스토어 앱이 확인 — 세이람은 INTERNET 권한 없음).
printf "  새 버전 안내: iOS는 번들ID·나라만, Android는 fetch 없음 ... "
_UF=""
[ "$(grep -c "fetch(" "$_UP_NAT" 2>/dev/null)" = "1" ] || _UF="$_UF fetch가하나가아님"
grep "fetch(" "$_UP_NAT" 2>/dev/null | grep -q "fetch(lookupUrl(IOS_BUNDLE_ID, " || _UF="$_UF 조회주소가lookupUrl아님"
awk '/async function checkAndroid/,/^}$/' "$_UP_NAT" 2>/dev/null | grep -q "fetch(" && _UF="$_UF Android가fetch"
grep -qE "headers|getUniqueId|deviceId|installationId" "$_UP_NAT" 2>/dev/null && _UF="$_UF 추가로보내는값"
grep -q "com.google.android.play:app-update" "$ROOT/modules/app-update/android/build.gradle" 2>/dev/null || _UF="$_UF app-update의존성없음"
[ -z "$_UF" ] && ok "" || fail "보내는 값이 늘어남 —$_UF"
# ⑤ [업데이트]는 받은 링크의 "업데이트가 필요해요"와 같은 스토어 이동(storeLink.openStore — Android는 Play 웹 주소 먼저),
#    스토어 주소·번들 ID는 src/constants/appInfo.ts 한 곳(다른 앱이 가져갈 때 여기만 바꾼다).
printf "  새 버전 안내: 같은 스토어 이동·앱 값 한 곳 ... "
_UL=""
grep -q "export function openStore" "$ROOT/src/utils/storeLink.ts" 2>/dev/null || _UL="$_UL storeLink.openStore없음"
grep -q "openStore" "$_UP_HOOK" 2>/dev/null || _UL="$_UL 새버전안내가openStore안씀"
grep -q "from '../utils/storeLink'" "$ROOT/src/hooks/useShiftShare.tsx" || _UL="$_UL 공유안내가openStore안씀"
grep -q "function openStore" "$ROOT/src/hooks/useShiftShare.tsx" && _UL="$_UL 공유에복사본남음"
grep -rq "apps.apple.com/app/id6825757463" "$ROOT/src/utils" "$ROOT/src/hooks" "$ROOT/app" && _UL="$_UL 스토어주소가appInfo밖에"
[ -z "$_UL" ] && ok "" || fail "스토어 이동이 두 갈래 —$_UL"

# ── 1.6.3 울림 카드(2026-11-25 사용자 확정 시안 docs/시안/울림화면-카드-시안.html "바꿀 모양") ──────────
# ① 울림 화면(JS 모달·커버 화면)에 시간·이모지를 넣지 않는다 — 교대알람은 정시에 울리니 시간은 빼고, 근무 이름·근무일 날짜만.
printf "  1.6.3 울림 카드: 시간·이모지 없음(JS·커버) ... "
_RC=""; _AR="$ROOT/src/components/AlarmRinging.tsx"
grep -q "ringTitle(" "$_AR" || _RC="$_RC JS제목에서아이콘안뗌"
grep -q "ringDateLabel(" "$_AR" || _RC="$_RC JS날짜없음"
grep -qE "\{body\}" "$_AR" && _RC="$_RC JS가본문(HH:MM)표시"
LC_ALL=C grep -qE $'\xe2\x8f\xb0|\xf0\x9f' "$_AR" && _RC="$_RC JS에이모지"
grep -q "fun ringTitle" "$_CA" || _RC="$_RC 커버제목에서아이콘안뗌"
grep -q "ringDateLabel" "$_CA" || _RC="$_RC 커버날짜없음"
LC_ALL=C grep -vE '^\s*//' "$_CA" | LC_ALL=C grep -qE $'\xe2\x8f\xb0|\xf0\x9f' && _RC="$_RC 커버에이모지"
grep -q 'getStringExtra("body")\|EXTRA_BODY' "$_CA" && _RC="$_RC 커버가본문표시"
[ -z "$_RC" ] && ok "" || fail "울림 화면에 시간·이모지 —$_RC"
# ② "5분 후 다시"는 기존 네이티브 스누즈(AlarmService.ACTION_SNOOZE) 하나로 — 진동만 알람이 스누즈 뒤 소리로 울리면 안 되고,
#    포그라운드 복귀 때 도는 rescheduleAll(cancelNativeAlarms)이 방금 건 스누즈를 지우면 안 된다(대신 baseAlarmId 게이트가 지운 알람의 스누즈를 막는다).
printf "  1.6.3 울림 카드: 스누즈는 네이티브 한 길·설정 그대로·안 지워짐 ... "
_SZ=""; _SNZ=$(awk '/ACTION_SNOOZE -> \{/,/return START_NOT_STICKY/' "$_AS")
grep -q "SNOOZE_ENABLED" "$_AR" && _SZ="$_SZ JS버튼이SNOOZE_ENABLED에묶임"
grep -q "snoozeLabel()" "$_AR" || _SZ="$_SZ JS문구가snoozeLabel아님"
grep -q "AlarmService.ACTION_SNOOZE" "$_CA" || _SZ="$_SZ 커버에스누즈없음"
echo "$_SNZ" | grep -vE '^ *//' | grep -q "notifyStopped(" && _SZ="$_SZ 스누즈가notifyStopped(한번알람꺼짐)"
echo "$_SNZ" | grep -q "cur?.soundOn" || _SZ="$_SZ 소리설정을지금울림에서안가져옴"
echo "$_SNZ" | grep -q "cur?.vibOn" || _SZ="$_SZ 진동설정을지금울림에서안가져옴"
echo "$_SNZ" | grep -q "emitSnoozed(" || _SZ="$_SZ JS에스누즈알림없음(Expo보조취소)"
awk '/private fun scheduleSnooze/,/^    }$/' "$_AS" | grep -q 'putExtra("baseAlarmId"' || _SZ="$_SZ 스누즈예약에baseAlarmId없음"
awk '/private fun scheduleSnooze/,/^    }$/' "$_AS" | grep -q "SNOOZE_MINUTES" || _SZ="$_SZ 스누즈분이상수아님"
awk '/export function cancelNativeAlarms/,/^}$/' "$ROOT/src/utils/notifications/android.ts" | grep -q "ids.push(SNOOZE_REQUEST_CODE)" && _SZ="$_SZ 재예약이스누즈를지움"
grep -q "'alarmSnoozed'" "$ROOT/src/hooks/useAlarmNotifications.ts" || _SZ="$_SZ JS가alarmSnoozed안받음"
_NSM=$(grep -oE 'SNOOZE_MINUTES *= *[0-9]+' "$_AS" | grep -oE '[0-9]+$'); _JSM=$(grep -oE 'export const SNOOZE_MIN *= *[0-9]+' "$ROOT/src/constants/index.ts" | grep -oE '[0-9]+$')
[ -n "$_NSM" ] && [ "$_NSM" = "$_JSM" ] || _SZ="$_SZ 스누즈분불일치(네이티브$_NSM/JS$_JSM)"
grep -q "snooze:" "$ROOT/src/utils/widgetSync.ts" || _SZ="$_SZ 커버스누즈문구번역없음"
[ -z "$_SZ" ] && ok "" || fail "스누즈 경로 —$_SZ"
# ③ 날짜는 근무일 기준 — 야간 퇴근은 다음 날 울리므로 예약 때 근무일(ds)을 실어 보내고(원장·부팅 복구 포함) 울림 화면이 그 날짜를 쓴다.
printf "  1.6.3 울림 카드: 날짜는 근무일(예약→원장→울림→화면) ... "
_WD=""
[ "$(grep -cE "scheduleNative\(mainNativeId\(.*, ds\);" "$ROOT/src/utils/notifications/core.ts")" -ge 2 ] || _WD="$_WD core가근무일안넘김"
grep -q "workDate: string = ''" "$ROOT/src/utils/notifications/android.ts" || _WD="$_WD scheduleNative인자없음"
grep -q 'putExtra("workDate"' "$NATIVE_DIR/AlarmScheduling.kt" || _WD="$_WD 예약인텐트"
grep -q '"wdate"' "$NATIVE_DIR/AlarmStore.kt" || _WD="$_WD 원장"
[ "$(grep -c 'putExtra("workDate"' "$NATIVE_DIR/AlarmReceiver.kt")" -ge 2 ] || _WD="$_WD 수신기(울림·보조)"
grep -q 'putString("workDate"' "$NATIVE_DIR/AlarmModule.kt" || _WD="$_WD getCurrentRinging"
grep -q 'putExtra("workDate"' "$_AS" || _WD="$_WD 서비스→화면·스누즈"
grep -q "workDate" "$ROOT/src/hooks/useAlarmNotifications.ts" || _WD="$_WD JS울림상태"
[ -z "$_WD" ] && ok "" || fail "근무일 날짜 —$_WD"

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
# "전부 끔 → 0개" 판정이 무의미해진다. 대기 예약 구간만 잘라서 센다.
#
# ⚠️ 2026-08-03 수정 — 예전엔 "Pending alarm batches:" 헤더를 만나야 구간에 진입했는데,
# 그 헤더가 없는 기기가 있다(32 = SM-A325N / Android 13에는 아예 없고 RTC_WAKEUP #N 항목이
# 바로 나열된다). 그 결과 COUNT가 **항상 0**이 되어, 이 스위트에서 가장 중요한 검사인
# "알람 전부 끔 → 등록 0개"가 실제 상태와 무관하게 늘 통과했다(vacuous pass).
# 이제 헤더 진입 대신 "이력/통계 섹션이 시작되기 전까지"를 대기 구간으로 본다.
# 또 이력 항목은 `[tag=...`처럼 대괄호로 시작하므로, 대괄호 없는 tag= 줄만 실제 예약으로 센다.
PENDING=$(echo "$RAW" | awk '
  /^[[:space:]]*(App Alarm history|LazyAlarmStore stats|Temporary Quota Reserves|Allow while idle|Top Alarms|Alarm Stats|Alarm manager stats|Recent problems|Removal history|Addition history|Recent (Wakeup|Alarm) History|Pending alarms per uid|Past-due non-wakeup alarms|Pending user blocked|Idle mode state)/ { stop=1 }
  !stop { print }
')
COUNT=$(echo "$PENDING" | grep -c "^[[:space:]]*tag=\*walarm\*:com\.danielpark\.alarmapp/\.AlarmReceiver" | tr -d ' ')
TIMES=$(echo "$PENDING" | grep -A2 "^[[:space:]]*tag=\*walarm\*:com\.danielpark\.alarmapp/\.AlarmReceiver" | \
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
