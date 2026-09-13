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
