@AGENTS.md

# Android 알람 시스템 — 필수 주의사항

Android는 알림 시스템이 **두 개** 동시에 동작한다. 알람 관련 로직을 건드릴 때 반드시 둘 다 처리해야 한다.

1. **Expo Notifications** — `Notifications.cancelScheduledNotificationAsync()` / `cancelAllScheduledNotificationsAsync()`
2. **네이티브 AlarmManager** — `cancelNativeAlarms(alarmId)` / `scheduleNative()`

iOS는 Expo 하나로 끝나지만, Android는 Doze 모드·배터리 최적화 때문에 AlarmManager를 따로 쓴다.  
Expo만 취소하고 AlarmManager를 빠뜨리면 알람이 비활성화해도 계속 울린다.

**체크리스트 — 알람 로직 수정 시:**
- [ ] 예약: `scheduleAlarmTriggers` + `scheduleNative` 둘 다 호출하는가?
- [ ] 취소: `Notifications.cancel~` + `cancelNativeAlarms` 둘 다 호출하는가?
- [ ] 재스케줄(`rescheduleAll`): 전체 알람 목록 기준으로 네이티브도 전부 초기화하는가?
- [ ] **삭제**: 목록에서 사라진 id는 `rescheduleAll`의 cancel 루프가 못 돈다(정의상 빠짐).
      원장 기준 정리(`syncActiveNativeAlarms`)가 재등록 **이후에** 호출되는가?
- [ ] **부팅 복구**: 새 예약 경로를 추가했다면 `AlarmStore`에도 기록되는가?
      (기록 안 하면 재부팅·앱 교체 후 그 예약만 조용히 사라진다)
- [ ] **재진입**: `rescheduleAll`/`scheduleAlarmTriggers`에 새 `await`를 넣었다면 그 뒤에
      `if (isStaleGen(gen)) return;`이 있는가? (겹쳐 돈 앞 호출이 꺼진 알람을 다시 예약하는 경쟁 방지)
- [ ] **네이티브 끄기 뒷정리**: 새 끄기 경로(알림 버튼·커버·워치 등)는 `AlarmService.ACTION_STOP`을
      거치는가? 그래야 `notifyStopped` → JS `alarmStopped`로 Expo 재알림 취소가 된다.
- [ ] **보조 알림(반복 울림) 단일 진입점**: 예약은 `scheduleRepSeries`, 취소는 `cancelRepSeries`만 쓴다.
      `grp_*_rep1`/`rep2`를 직접 지우는 코드를 새로 넣지 말 것 — iOS는 묶음이 최대 `REP_MAX`개라
      일부만 지우면 나머지가 계속 울린다. "같은 뒷정리를 여러 호출부가 각자 구현"하는 패턴이
      이 프로젝트에서 세 번 재발했다(`.claude/bugs.md` 2026-09-12 / 10-09 / 10-10).
- [ ] **iOS 알림엔 소리가 있어야 진동이 온다**: 진동만 모드도 `notifSound()`가 무음 파일을 붙인다.
      iOS용 content에 `sound: undefined`를 보내는 새 경로를 만들지 말 것.

# 근무일과 발화일 — 자정 넘는 근무 (2026-10-13)

야간(22~06)·24시간 근무는 퇴근 알람이 **근무일 다음 날** 울린다(`isOvernight`: 퇴근 시각 ≤ 출근 시각).
- `skips`("이날 끄기")·하루 근무 변경(override)·Expo 식별자(`alarm_{id}_date_{ds}`)·달력 표시는 전부 **근무일 기준**이다.
- 발화 시각을 만드는 곳은 세 곳(core.ts 로테이션 루프·날짜기반 루프, utils `getNextFireDate`) — `dayOffset`을 셋 다 더해야 한다.
- 퇴근 알람은 어제 근무일(`overnightFrom` = -1)부터 훑는다. 지난 날짜를 정리하는 코드는 "어제"까지 남겨야 한다(`pruneSkips`).
- 발화 시각에서 근무조 라벨을 거꾸로 만들 땐 `workDateOfFire`를 쓴다.

# 다국어 (2026-10-13) — 문구를 추가·수정할 때

방식은 세이람과 같다: **한국어 원문이 번역 키** `t('알람 추가')`. 자세한 규칙은 `docs/i18n-conventions.md`.
- 컴포넌트는 `useT()`(`src/i18n`), 순수 모듈(`src/utils/**`, `src/constants/**`, 알림·위젯)은 `src/i18n/translate`의 `t`만.
  utils·constants가 `src/i18n` 인덱스를 import하면 `scripts/logic-tests`가 깨진다(정적 체크 ㉑).
- 모듈 최상위 상수 라벨은 `N('…')` 표식 + 표시할 때 `t(x.label)`. 값이 끼는 문구는 `t('{n}일', { n })` — 템플릿 보간 금지.
- 문구를 추가했으면 `node scripts/i18n-keys.js`(키 재추출) → 8개 사전(`src/i18n/locales/*.ts`)에 번역 추가 →
  `node scripts/i18n-keys.js --check`가 "누락 없음"이어야 한다(정적 체크 ㉒).
- 알림 본문 키는 `{time}`으로 시작해야 한다(네이티브 끄기 경로가 본문 맨 앞 HH:MM을 읽는다).
- **한국 전용 기능**(법정공휴일 건너뛰기·휴일근무 집계·음력·24절기·후원 배너)은 언어가 한국어일 때만 동작한다
  (`isKoreanLocale`, 게이트는 `holidays.getHoliday` 한 곳). ⚠️ 언어 판정이 틀리면 알람 동작이 바뀐다 —
  기기 언어는 네이티브 값을 먼저 읽고(`setSystemLocaleProvider`), 언어 설정이 없는 기존 설치는 'ko'로 고정한다(정적 체크 ㉕).
- 저장되는 `alarm.label`은 만든 시점의 언어로 굳는다. 표시는 `alarmLabel(alarm)`, 폼 초기값·비교는 `localizeDefaultLabel`.
- 네이티브가 직접 그리는 문구(알림 "끄기"·위젯 라벨)는 `widgetSync.ts` → `WidgetModule.saveNativeStrings` → `NativeStrings.kt`.

# TDD 원칙 — 버그 수정·회귀 방지 로직 추가 시

이 프로젝트엔 Jest 같은 유닛 테스트 프레임워크가 없다. 대신 `scripts/test-alarm-suite.sh`의
정적 검사(파일 내용에 대한 정규식/패턴 기반 assertion)를 유닛 테스트처럼 취급해 TDD를 적용한다.

**순서 — 버그를 고치거나 "이 조건에서 반드시 이래야 한다"는 규칙을 코드에 넣을 때:**
0. 값이 맞는지 따질 수 있는 순수 로직(다음 발화 시각, 라벨, 번역)은 `scripts/logic-tests/*.test.js`에 시각을 고정한
   시나리오 테스트를 먼저 쓴다(`node scripts/logic-tests/run.js`, 정적 스위트 ⑳이 함께 돌린다) — grep 체크보다 우선.
1. 먼저 `scripts/test-alarm-suite.sh`의 `[1] 정적 코드 분석` 섹션에 그 규칙을 검증하는
   새 체크 항목을 추가한다 (기존 항목들처럼 grep/패턴 매칭으로 관련 파일에서 규칙 준수 여부 확인)
2. 스크립트를 돌려 **새 체크가 FAIL하는지 확인**한다 (아직 코드를 못 고쳤으니 당연히 실패해야 함 — 이게 "레드")
3. 그 다음 실제 코드(`.kt`/`.ts`)를 고친다
4. 다시 돌려서 새 체크를 포함해 **전부 PASS**하는지 확인한다 ("그린")

이렇게 하면 체크 항목 자체가 회귀 방지 테스트로 영구히 남는다 — 나중에 누군가(미래의 나 포함)
같은 실수를 반복해도 커밋 전 스크립트가 바로 잡아낸다.

**적용 범위**: 알람 이중 스케줄링처럼 "빠뜨리면 조용히 깨지는" 규칙에 특히 유효
(예: 위 체크리스트의 각 항목이 이미 이 방식으로 만들어진 것들). 단순 UI 스타일 변경처럼
정적 패턴으로 표현하기 애매한 경우까지 억지로 체크를 만들 필요는 없다 — 판단이 서지 않으면
사용자에게 새 체크 항목이 적절한지 먼저 물어볼 것.

# 테스트 규칙 — 항상 적용

알람 관련 파일(`AlarmReceiver.kt` / `AlarmModule.kt` / `android.ts` / `useAlarms.ts` / `widgetSync.ts` / `core.ts` / `notifications/index.ts`) 수정 시:

1. **커밋 전** — `./scripts/test-alarm-suite.sh --static` 실행, FAIL 있으면 먼저 수정
2. **빌드·설치 후** — `./scripts/test-alarm-suite.sh RF9R3049REV`(32)와 `./scripts/test-alarm-suite.sh R3CM909QRGK`(노트) 실행, 결과를 사용자에게 보고.
   테스트 알람은 전부 진동만. 화면을 손으로 조작하는 대신 개발 딥링크(`docs/i18n-plan.md` 참고, 잠금 키 `DEV_LINK_KEY`)를 쓸 수 있다
3. **3환경 수동 테스트 필요 시** — 스크립트 마지막에 출력되는 체크리스트를 사용자에게 안내

# 작업 완료 후 규칙

- 작업이 끝날 때마다 항상 커밋 및 푸시 여부를 사용자에게 물어볼 것

# Play 스토어 스크린샷·출시 규칙 — 반드시 지킬 것

**화면 UI를 바꾸면 스토어 스크린샷 6장도 다시 찍는다.**
헤더("다음 알람" 줄 등), 달력, 알람 목록, 알람 추가·수정 화면, 하루 근무 변경 팝업처럼
스크린샷에 찍히는 부분을 고쳤다면, 출시 전에 6장을 새로 촬영해서 교체한다.
(2026-09-25: 헤더에 알람 이름을 넣은 뒤 기존 스크린샷이 전부 구버전이 되어 재촬영함)

**스크린샷 6장 구성 (순서 고정)**
01 달력 → 02 알람 목록 → 03 근무블록(로테이션 알람 수정) → 04 일반 알람 추가 → 05 하루 근무 변경 팝업 → 06 반복 방식

**언어별 스크린샷 (2026-10-14~)**
- 스토어에는 9개 언어(ko en ja zh-Hans zh-Hant es fr de pt) 각각 6장을 올린다. UI를 바꾸면 9개 언어 모두 다시 찍는다.
- 개발 딥링크로 같은 데이터를 만든다: `clearAll=1` → `demo=1`(초번→말번→비번 근무표) → `demo=2`(식사 알람, 찍기 전에 끈다)
  → 언어마다 `lang=<코드>&tab=calendar`. 끝나면 `clearAll=1`, `lang=system`.
- 수정 화면은 **하드웨어 뒤로가기를 쓰지 말고 화면의 취소 버튼**으로 닫는다 — 뒤로가기는 앱을 나가 버린다.
- 언어를 바꾼 직후 달력 칸이 비어 보이면 버그다(2026-10-14 수정, 날짜 칸 key) — 그대로 찍지 말고 원인을 본다.
- 결과물: `store-assets/screenshots/i18n-<날짜>/<언어>/`, 등록 문구는 `store-assets/listings/`.

**촬영 방법**
- 기기는 "32"(RF9R3049REV), Claude가 adb로 직접 조작해서 찍는다.
- 촬영 **전에** 알람 켜짐 상태·소리/진동 설정을 기록하고, 촬영 **후에** 반드시 원상복구한다.
  (전부 끄기 → `dumpsys alarm` 대기 예약 0건 확인 → 소리/진동 아이콘 대조)
  2026-09-12에 촬영 중 소리 설정이 "진동만"으로 바뀐 사고가 있었다.
- 알람 수정·추가 화면과 하루 근무 변경 팝업은 **저장하지 말고 취소/닫기**로만 나온다.
- 알람 추가 화면을 스크롤할 때는 **화면 왼쪽 가장자리**에서 스와이프한다 — 가운데서 하면 시간 휠이 돌아간다.
- 결과물은 `~/Desktop/스크린샷/` 아래에 저장하고, 올리기 전에 사용자에게 먼저 보여준다.

**Play 규격 — 원본 그대로는 거부된다**
- Play는 세로가 가로의 2배를 넘으면 거부한다. 32 원본(1080×2400, 2.22배)은 그대로 못 올린다.
- 양옆에 앱 배경색 여백을 붙여 **1350×2400(9:16)**으로 변환한 사본을 올린다. 내용은 자르지 않는다.

**versionCode 규칙**
- Play에 한 번 올린 AAB의 versionCode는 **출시하지 않았어도 다시 쓸 수 없다.**
  제출 전에 코드를 고쳤다면 versionName은 그대로 두고 versionCode만 올려서 다시 빌드한다.
- 업로드용 AAB는 `~/Desktop/교대알람-<버전>-vc<번호>.aab`로 복사해 두고, 이전 번호 파일은 지워 헷갈리지 않게 한다.
- 심사 중에는 **절대 다시 제출하지 않는다** — 대기 순서가 처음부터 다시 시작된다.
