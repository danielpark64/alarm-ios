# 버그 이력

## 2026-10-14 · [중간] 달력 주 시작 요일(또는 주 시작이 다른 언어)을 바꾸면 일부 날짜 칸이 통째로 비어 보임
**증상**: 32 실기기에서 ko→zh-Hans(월요일 시작)로 바꾸자 초번인 날 칸이 날짜 숫자까지 전부 사라짐. 20초 뒤에도 그대로, 탭을 나갔다 오면 복구.
스토어 스크린샷을 찍다가 발견(스페인어·중국어 달력).
**원인**: `MonthGrid` 날짜 칸의 key가 칸 번호(`key={i}`). 주 시작이 바뀌면 같은 칸 번호에 하루 어긋난 날짜가 오는데,
"비번 박스(cellOff: 테두리+배경)"였던 칸이 근무일로 재사용될 때 Fabric(New Architecture)에서 칸이 다시 그려지지 않음.
**수정**: key를 날짜+비번 여부(`${ds}-${effOff?1:0}`)로 — 날짜가 다르거나 비번 상태가 바뀌면 칸을 새로 만든다.
**재발 방지**: 정적 체크 "달력 칸 key가 날짜 기반인지". 목록·격자에서 **내용이 위치를 옮겨 다니는 항목**에 index key를 쓰지 말 것.
파일: `src/components/Home/CalendarView.tsx`, `scripts/test-alarm-suite.sh`.

## 2026-10-13 · [낮음] iOS 로테이션 보조 알림 제목에 근무조가 빠짐("야간 출근" 뒤 30초마다 "출근")
**증상**: iPad 실기기 대기 알림 목록에서 본 알림은 "🚇 야간 출근"인데 보조(`alarm_{id}_rep*`)는 "⏰ 출근".
**원인**: `schedulePatternAlarmReps`가 `alarmLabel(alarm)`만 사용 — 로테이션 알람의 label은 비어 있어 타입 이름만 나옴.
**수정**: 본 알림과 같은 규칙(근무일 `workDateOfFire` → override shift 우선 → `effectiveShift` → `roleLabel`, 폴백은 타입 이름).
**재발 방지**: 정적 체크 "로테이션 보조 알림 제목이 근무조 기준(roleLabel)인지". 제목을 만드는 곳이 늘면(본 알림·보조·헤더·위젯) 같은 규칙인지 함께 볼 것.
파일: `src/utils/notifications/core.ts`, `scripts/test-alarm-suite.sh`.

## 2026-10-13 · [중간·기존 결함] 자정 넘는 근무(야간 22~06, 24시간)의 퇴근 알람이 근무일 "당일" 시각으로 계산됨

**증상**: 야간(22:00~06:00)·24시간 근무처럼 퇴근이 다음 날인 근무의 퇴근 알람이 근무일 당일
06:00으로 잡혀, 이미 지난 시각이라 안 울리거나 엉뚱한 날 울림. 다국어화·해외 교대제도 대응
작업 중 발견했지만 한국 근무표에도 원래 있던 누락(사용자 확인: "한국에도 있는데 빼먹었다").
**원인**: 퇴근 시각을 근무일 날짜에 그대로 붙였다. "퇴근이 출근보다 이르면 다음 날"이라는 개념
자체가 없었고, 같은 계산이 `core.ts` 예약 루프 2곳(로테이션·날짜기반)과 `getNextFireDate`
세 곳에 각각 들어 있었다.
**수정**: `isOvernight`(퇴근<=출근이면 다음 날) 도입 → `effectiveTime`/`dayWorkFor`가
`dayOffset: 1`을 돌려줌. 예약 루프 2곳과 `getNextFireDate`는 퇴근 알람을 어제 근무일(i=-1,
`overnightFrom`)부터 훑는다(어젯밤 근무의 퇴근이 오늘 아침이므로). 발화일에서 근무일을 되짚는
`workDateOfFire` 추가. 시각 고정 시나리오 테스트 `scripts/logic-tests/overnight.test.js`,
정적 체크 ⑱⑲⑳ 추가. 32·노트 실기기에서 예약 날짜 검증(커밋 `ebbf522`).
남긴 것(낮음): 근무가 서로 겹칠 때만 `getNextFireDate` 순서 역전 가능, 퇴근이 실제로 울리는
날의 달력 팝업엔 그 알람이 안 보임(근무일 기준 표시), 레거시 cycle/rest로 따로 만든 야간 퇴근
알람은 출근 시각을 몰라 보정 안 됨.
**파일**: `src/utils/index.ts`, `src/utils/notifications/core.ts`, `src/constants/index.ts`,
`scripts/logic-tests/overnight.test.js`, `scripts/test-alarm-suite.sh`
**재발 감시 포인트**: "근무일"과 "발화일"이 다른 날일 수 있다 — `skips`·dayOverride·알림
식별자·네이티브 슬롯·정리 로직은 전부 **근무일** 기준으로 저장된다. 날짜를 키로 쓰는 새 코드는
그 날짜가 근무일인지 발화일인지 먼저 정하고, 발화일에서 출발하면 `workDateOfFire`를 거칠 것.
날짜를 훑는 새 루프는 0이 아니라 `overnightFrom(alarm)`에서 시작해야 어젯밤 근무의 퇴근을
놓치지 않는다. 2026-09-12 항목의 "같은 판정을 여러 호출부가 각자 구현" 골격과 같은 자리
(예약 루프 2곳 + `getNextFireDate`)라, 셋 중 하나만 고치면 표시와 발화가 어긋난다.

## 2026-10-13 · [중간] "이날만 끄기"로 끈 야간 퇴근 알람이 자정 뒤 앱을 열면 되살아남

**증상**: 야간 근무일의 퇴근 알람을 "이날만 끄기"로 껐는데, 자정이 지난 뒤 앱을 열면 그날 아침
퇴근 알람이 다시 예약됨. 바로 위 항목(자정 넘는 근무)을 고치면서 생긴 구멍으로, alarm-logic
리뷰가 출시 전에 발견.
**원인**: `useAlarms.migrateAlarm`이 로드할 때 `skips`에서 오늘 이전 날짜를 전부 지웠다.
`skips`는 근무일 기준인데 야간 퇴근은 근무일 다음 날 울리므로, 자정을 넘기는 순간 "어제"
skip이 아직 필요한데도 지워졌다.
**수정**: `pruneSkips`(어제까지 남김)로 교체. `overnight.test.js`에 시나리오 포함.
**파일**: `src/utils/index.ts`, `src/hooks/useAlarms.ts`, `scripts/logic-tests/overnight.test.js`
**재발 감시 포인트**: 위 항목과 같은 전제(근무일 ≠ 발화일). "지난 날짜는 필요 없다"고 보고
오늘 기준으로 잘라내는 정리 로직(`skips`, dayOverride, 원장 청소 등)을 새로 쓰거나 고칠 때는
경계를 "어제"로 잡았는지 확인. 날짜 계산 방식을 바꾸는 수정은 예약 경로만 보지 말고 그 날짜를
키로 쓰는 저장·정리 경로까지 같이 훑을 것 — 이번 건은 예약 쪽만 고치고 정리 쪽을 놓친 사례.

## 2026-10-13 · [높음·출시 전 차단] 한국어 iPhone에서 앱이 영어로 뜨고 공휴일 건너뛰기가 꺼질 수 있음

**증상**: 기기 언어가 한국어인 iPhone에서 앱이 영어로 표시되고, 한국 전용 기능(공휴일
건너뛰기 등)이 함께 꺼질 수 있음. verify-fix가 코드·프로젝트 설정을 읽어 발견했고, 실기기에서
재현하기 전에 예방 수정함(iPhone 빌드에서의 한국어 표시 확인은 기록 시점에 아직 남은 일).
**원인**: 기기 언어를 `Intl.DateTimeFormat().resolvedOptions().locale`로만 읽었다. iOS는 앱이
선언한 언어(`CFBundleLocalizations`, 당시 en뿐) 안에서 로캘을 정하므로 한국어 기기에서도 en이
나온다. 그 결과가 `isKoreanLocale` 게이트로 이어져 표시 언어뿐 아니라 공휴일 건너뛰기라는
알람 동작까지 바뀐다.
**수정**: `setSystemLocaleProvider`로 네이티브 값을 우선 읽음(iOS `Settings`의
`AppleLanguages` / Android `I18nManager`의 `localeIdentifier`, `Intl`은 마지막 폴백).
`app.json`과 Info.plist의 `CFBundleLocalizations`에 9개 언어 선언. 정적 체크 ㉕ 추가
(커밋 `ca7b275`).
**파일**: `src/i18n/lang.ts`, `src/i18n/index.tsx`, `app.json`, `scripts/logic-tests/locale.test.js`,
`scripts/test-alarm-suite.sh`
**재발 감시 포인트**: 한국 전용 기능이 언어 게이트에 묶여 있어 "언어 판정이 틀리면 알람 동작이
바뀐다". 언어 판정 경로(`lang.ts`, `i18n/index.tsx`, `loadLanguageSetting` 호출 순서)를 고칠
때는 `scripts/logic-tests/locale.test.js`와 정적 체크 ㉓㉕를 확인. 지원 언어를 추가하면
`CFBundleLocalizations`에도 같이 넣을 것. `ios/`는 gitignore라 Info.plist 수동 수정은 prebuild에서
사라진다 — 진짜 소스는 `app.json`. 기기 언어를 `Intl`에서 직접 읽는 코드를 새로 만들지 말 것.

## 2026-10-13 · [중간] 폰을 영어 등으로 쓰는 기존 한국 사용자가 업데이트 뒤 영어로 바뀌고 공휴일 건너뛰기가 꺼짐

**증상**: 기기 언어가 한국어가 아닌 기존 사용자가 다국어 버전으로 업데이트하면, 언어 설정
기본값 '시스템' 때문에 앱이 영어 등으로 바뀌고 공휴일 건너뛰기가 아무 안내 없이 꺼짐 →
공휴일에 출근 알람이 울림. verify-fix가 출시 전에 발견.
**원인**: 이전 버전은 한국어 전용이라 언어 설정 값이 없는데, 값이 없을 때의 기본값을 신규
설치와 기존 설치 구분 없이 '시스템'으로 뒀다.
**수정**: `loadLanguageSetting`이 언어 설정 없는 첫 실행에서 기존 알람 데이터(`alarms_v1_rn`)가
있으면 'ko'로 고정하고 값을 즉시 저장(다음 실행부터는 판별 없이 그 값을 씀). 알림 카테고리
등록·공휴일 갱신보다 `loadLanguageSetting`을 먼저 부르도록 순서도 맞춤. 정적 체크 ㉕.
**파일**: `src/i18n/index.tsx`, `src/hooks/useAlarmNotifications.ts`, `src/hooks/useHolidaySync.ts`,
`app/index.tsx`, `scripts/test-alarm-suite.sh`
**재발 감시 포인트**: 위 항목과 같은 전제(언어 판정 = 알람 동작). 새 설정 항목의 기본값을 정할
때 "설정 값이 없는 기존 설치"가 지금까지와 똑같이 동작하는지 따로 따져볼 것. 기존 설치 판별이
`i18n/index.tsx`에 따로 적어 둔 저장 키 문자열 `alarms_v1_rn`에 기대고 있어, `useAlarms`의
저장 키를 바꾸면 이 보호가 조용히 풀린다(같은 값을 두 곳이 각자 들고 있는 구조). 언어를
읽는 코드(알림 문구·공휴일·위젯)는 `loadLanguageSetting`이 끝난 뒤에 돌아야 한다.

## 2026-10-13 · [중간] 언어를 바꾼 뒤 기존 알람을 편집하면 이름 입력칸이 잠김

**증상**: 한국어에서 만든 알람(예: "출근 준비")을 영어 등 다른 언어로 바꾼 뒤 편집하면 이름
입력칸에 어떤 글자도 입력·삭제되지 않음.
**원인**: `setLabelGuarded`가 현재 언어의 타입 이름 접두어로 시작하는 입력만 받았다. 저장된
라벨은 만든 시점의 언어("출근 …")인데 가드는 현재 언어("Clock in …")를 요구해, 어떤 입력도
조건을 만족할 수 없었다.
**수정**: 지금 라벨이 그 접두어로 시작할 때만 가드를 건다
(`!prev.startsWith(requiredPrefix) || text.startsWith(requiredPrefix)`).
**파일**: `src/hooks/useAlarmFormState.ts`
**재발 감시 포인트**: 저장 데이터(`alarm.label`)는 만든 시점의 언어로 굳는다. 라벨을 현재
언어 문자열과 직접 비교하거나 `startsWith`로 가드하는 코드는 언어 전환 뒤 깨지므로, 비교·가드·
표시는 `localizeDefaultLabel`/`alarmLabel`을 거칠 것. `overrideLabel()`·
`dayOverrideDisplay().label`처럼 한국어 원문을 Map 키·정렬에 쓰는 값도 같은 부류 — 키는 원문
그대로 두고 표시 시점에만 `t()`.

## 2026-10-13 · [낮음] 번역 누락·잘림 — 오늘 근무 줄·달력 칩이 원문 표시, 카드 라벨 "· next day" 잘림

**증상**: (a) 오늘 근무 줄(TodayShiftRow)의 하루 근무 변경 이름이 비한국어에서도 한국어 원문으로
표시. (b) 달력 칩의 알람 이름이 저장된 원문 그대로 표시. (c) 영어·독일어·스페인어 등에서 알람
카드의 "· next day" 같은 라벨이 잘림. android-build의 32·노트 언어별 스크린샷에서 발견.
**원인**: (a)(b) 표시 경로 두 곳이 `ov.label`·`al.label`을 번역 함수 없이 그대로 찍었다 —
다른 표시 경로는 이미 `t()`/`alarmLabel`을 거치는데 이 둘만 빠짐. (c) 한국어 길이에 맞춘 칸에
더 긴 번역이 들어감.
**수정**: (a) `t(ov.label)`, (b) `alarmLabel(al)`, 달력 집계 memo 의존성에 `lang` 추가.
(c) 사전에서 단축('{label} · 다음날' → "+1d" 등, '알람 추가', 경조사 메모 placeholder, es/pt
중번, de 기타·출근·퇴근). 32·노트 재설치 후 잘림 재확인은 기록 시점에 아직 남은 일.
**파일**: `src/components/Home/TodayShiftRow.tsx`, `src/components/Home/CalendarView.tsx`,
`src/i18n/locales/*.ts`
**재발 감시 포인트**: 새 표시 화면에서 `.label`을 그대로 찍지 말 것 — 알람은 `alarmLabel(al)`,
근무 변경·상수 라벨은 `t()`. 언어에 따라 달라지는 값을 `useMemo`로 묶으면 의존성에 `lang`을
넣어야 언어 전환 직후 갱신된다. 새 문구를 추가하면 칸이 좁은 곳(카드·칩·탭)은 de/fr/es/pt
스크린샷으로 길이를 확인. 2026-09-12 항목의 "표시 계층 여러 곳 중 일부만 누락"과 같은 골격.

## 2026-10-10 · [치명] iOS "진동만" 알람이 무음 배너로만 뜸 — 소리 없는 알림엔 iOS가 진동도 안 울림

**증상**: 소리를 "진동만"으로 둔 알람이 iOS에서 울릴 시각에 소리도 진동도 없이 배너만 조용히 뜸.
사용자 보고: "폰만 있으면(워치 없이) 알람이 온 줄 전혀 모른다". Android는 정상.
**원인**: iOS는 알림 content에 `sound`가 없으면 진동(햅틱)도 함께 생략한다. `core.ts`가
`snd !== 'default'`면 `sound: undefined`로 보내고 있었고, 함께 넣던 `vibrate` 필드는 Android
전용이라 iOS에선 아무 효과가 없음. 즉 "진동만"이 iOS에서는 "완전 무음 배너"로 번역되고 있었다.
**수정**: `notifSound()`가 iOS + 진동만일 때 0.5초 무음 파일 `silent_short.wav`를 sound로 붙여
iOS가 "소리 있는 알림"으로 취급 → 진동이 울림. 파일은 `assets/`, `ios/app/`, Android raw,
`app.json`의 `sounds`, pbxproj Resources 5곳에 모두 등록. 겸사겸사 iOS 반복 울림 재설계:
`scheduleRepSeries` 30초 간격, 가장 가까운 알람은 10회(5분)·나머지는 2회, 로테이션(pattern)
알람도 iOS에선 `alarm_{id}_rep*` 묶음으로 통일, "60개 한도 넘으면 포기" 검사 제거(iOS는 64개를
넘으면 먼 것부터 알아서 버리므로 가까운 알람이 손해 보지 않음), 취소 경로는
`cancelRepSeries(REP_MAX)` 하나로 통일, 응답 리스너는 `refreshRepsOnly`(보조 반복만 갱신, 전체
재예약 금지). 실기기(iPhone 17 Pro Max)에서 30초 간격 반복과 끄기 후 중지 확인. 정적 체크
⑬⑭⑮⑯ 추가.
**파일**: `src/utils/notifications/core.ts`, `src/hooks/useAlarmNotifications.ts`,
`assets/silent_short.wav`, `ios/app/silent_short.wav`, `android/app/src/main/res/raw/silent_short.wav`,
`app.json`, `ios/app.xcodeproj/project.pbxproj`, `scripts/test-alarm-suite.sh`
**재발 감시 포인트**: iOS용 알림 content를 `sound` 없이 보내는 코드가 하나라도 생기면 그 알림은
진동도 사라진다 — "무음이지만 진동은 있어야 하는" 모든 경우는 `notifSound()`를 거쳐 무음 파일을
붙일 것(`sound: undefined`/`null` 직접 대입 금지). 반복 알림 취소는 `rep1`/`rep2` 식별자를 직접
취소하지 말고 반드시 `cancelRepSeries`를 호출 — 회수(REP_MAX)가 바뀌어도 한 곳만 고치면 되게.
2026-10-09 "네이티브 끄기" 항목과 같은 골격(취소 경로 다원화)이 재현되지 않도록 새 취소 진입점은
`cancelRepSeries`를 타는지 확인.

## 2026-10-10 · [중간] iOS 27 빌드에서 딥링크(alarmapp://) 전부 무시됨 — SceneDelegate가 URL을 RN에 안 넘김

**증상**: `alarmapp://...` 딥링크가 콜드 스타트·웜 스타트 모두 앱만 띄우고 RN `Linking`에 아무
이벤트도 오지 않음. 발견 계기: 테스트 알람 생성용 개발 딥링크(`alarmapp://?testAlarm=3`,
`?dumpPending=1`, `?clearTestAlarms=1`)를 `devicectl --payload-url`로 보내다가 전부 무반응.
**원인**: `plugins/withIosSceneDelegate.js`가 생성한 SceneDelegate에 URL 전달 코드가 없음.
UIScene 기반 앱에서는 `AppDelegate.application(_:open:)`이 호출되지 않고 URL이
`scene(_:openURLContexts:)`(실행 중) 또는 `connectionOptions.urlContexts`(콜드 스타트)로만 오는데
둘 다 처리하지 않아 RN 쪽 `launchOptions[.url]`·`RCTLinkingManager`에 URL이 닿지 않았다.
**수정**: SceneDelegate에 `scene(_:openURLContexts:)`와 `scene(_:continue:)`(유니버설 링크) 추가,
`willConnectTo`에서 `connectionOptions.urlContexts.first?.url`을 `launchOptions[.url]`로 주입.
플러그인(`withIosSceneDelegate.js`)과 이미 생성된 `ios/app/AppDelegate.swift` 둘 다 반영.
정적 체크 ⑰(SceneDelegate에 두 경로가 있는지) 추가.
**파일**: `plugins/withIosSceneDelegate.js`, `ios/app/AppDelegate.swift`, `scripts/test-alarm-suite.sh`
**재발 감시 포인트**: `withIosSceneDelegate.js`를 고칠 때 URL 전달 두 경로(콜드 스타트
`connectionOptions.urlContexts` → `launchOptions[.url]`, 실행 중 `scene(_:openURLContexts:)`)를
반드시 유지. `ios/`는 gitignore 대상이라 prebuild로 다시 생성되면 수동 수정은 사라지므로 진짜
소스는 플러그인이고, prebuild 뒤 정적 체크 ⑰로 결과물을 확인. UIScene 앱에서 AppDelegate의
URL/푸시/유니버설 링크 콜백에 의존하는 새 기능을 추가할 때는 SceneDelegate 대응 콜백이 있는지
먼저 확인.

## 2026-10-09 · [치명] 알람 id 중복 — 만료된 '한 번' 알람 자동 비활성화 저장이 nextId를 100으로 되돌림

**증상**: 앱 콜드 스타트 시 만료된 '한 번' 알람이 있으면 자동 비활성화 후 저장되는데, 그 다음
콜드 스타트부터 새로 만든 알람이 기존 알람과 같은 id를 받음 → 한 알람을 켜고 끄면 다른 알람이
같이 바뀌고, 네이티브 requestCode(알람 id 기반 합성)도 충돌해 취소/예약이 서로 덮어씀.
**원인**: `src/hooks/useAlarms.ts` 로드 분기. 디스크에서 읽은 `d.nextId`는 `setNextId()`로 React
상태에만 넣고, 만료 알람을 비활성화한 뒤 다시 `AsyncStorage.setItem`할 때는 상수
`nextId: 100`을 썼다. 상태(메모리)와 저장값(디스크)이 서로 다른 소스에서 온 것.
**수정**: 로드한 nextId를 지역변수 `loadedNextId`로 받아 `setNextId(loadedNextId)`와 저장
양쪽에 같은 값을 쓰도록 통일. `scripts/test-alarm-suite.sh --static`에 "useAlarms 로드 분기가
`nextId: 100` 상수를 저장하지 않는지" grep 체크 추가.
**파일**: `src/hooks/useAlarms.ts`, `scripts/test-alarm-suite.sh`
**재발 감시 포인트**: "setState로 넣는 값"과 "디스크에 저장하는 값"이 한 함수 안에서 서로 다른
변수/리터럴에서 나오면 의심. 특히 로드 직후 곧바로 저장(마이그레이션·자동 정리)하는 경로는
로드한 전체 객체를 그대로 기준으로 삼아 필요한 필드만 바꿔 쓰고, 상수 폴백은 "파일이 없을 때"
한 번만 쓰이도록 할 것. 저장 포맷에 카운터/시퀀스 필드가 있으면 저장 호출마다 그 필드의
출처를 확인.

## 2026-10-09 · [중간] 로드 완료 전 포그라운드 복귀 시 알람 예약·네이티브 원장 전부 삭제

**증상**: 스플래시~AsyncStorage 로드 사이에 다른 앱으로 갔다 돌아오면(알림 탭, 전화 등) 모든
알람의 Expo 예약과 네이티브 AlarmManager 예약이 사라지고 `activeAlarmIds` 원장도 비워짐.
알람 목록 화면엔 정상으로 보이는데 실제로는 아무것도 울리지 않음.
**원인**: `src/hooks/useAlarmNotifications.ts`의 AppState 리스너가 `background→active` 전이에
무조건 `rescheduleAll(alarmsRef.current, ...)`를 호출. 로드 전엔 `alarmsRef.current`가 `[]`라
`rescheduleAll([])` = 전체 취소 + `syncActiveNativeAlarms([])`로 동작.
**수정**: `useAlarmNotifications`에 `loaded` 인자 추가(`app/index.tsx`에서 `useAlarms`의 loaded
전달), `loadedRef` 가드로 로드 전엔 건너뜀. 겸사겸사 `${todayStr()}|${JSON(alarms)}|${JSON(overrides)}`
키를 `lastRescheduleKeyRef`에 저장해 마지막 재스케줄과 같으면 다시 돌리지 않음(재스케줄은
알람당 최대 14회 직렬 await라 수 초 걸림; 날짜를 키에 넣어 "지나간 슬롯 보충"은 유지).
정적 체크 "포그라운드 재스케줄이 loaded 전엔 건너뛰는지" 추가.
**파일**: `src/hooks/useAlarmNotifications.ts`, `app/index.tsx`, `scripts/test-alarm-suite.sh`
**재발 감시 포인트**: 비동기 로드되는 상태(`useAlarms`·`useDayOverrides` 등)를 "전체 기준으로
다시 맞추는" 파괴적 동기화(`rescheduleAll`, `syncActiveNativeAlarms`, 위젯 전체 갱신)에 넘길
때는 항상 "로드 전 빈 배열이 들어가면 무슨 일이 생기나"를 먼저 묻기. 빈 배열이 "알람 없음"과
"아직 모름"을 구분 못 하는 구조라, 새 호출부(새 이벤트 리스너·새 화면 진입 효과)를 추가하면
`loaded` 가드가 있는지 확인.

## 2026-10-09 · [중간·추정] rescheduleAll 두 개가 겹치면 꺼진 알람이 Expo에 다시 예약됨

**증상**: 알람이 울려 앱이 전면에 뜨면 포그라운드 재스케줄(rescheduleAll)이 돌기 시작하는데,
그 수 초 동안 사용자가 그 알람을 토글 OFF하면 두 번째 rescheduleAll이 전체 취소를 끝낸 뒤에도
첫 번째 호출이 남은 루프를 계속 돌며 방금 끈 알람을 Expo에 다시 예약. 네이티브는
`activeAlarmIds` 게이트가 걸러주지만 Expo 알림엔 게이트가 없어 그대로 울림. (실기기에서
재현한 것은 아니고 코드 경로 분석으로 추정한 버그 — 재현 시도는 verify-fix에 위임 필요.)
**원인**: `src/utils/notifications/index.ts`의 `rescheduleAll`에 재진입 방어가 없음. "전체 취소 →
알람마다 최대 14회 await 재예약"이 원자적이지 않은데 호출부(포그라운드 복귀·토글·override 변경)가
서로 직렬화되지 않음.
**수정**: `src/utils/notifications/rescheduleGen.ts` 신설 — 모듈 전역 세대 번호
`nextGen()`/`isStaleGen(gen)`. `rescheduleAll`이 시작할 때 세대를 받고, `index.ts`·`core.ts`
(`scheduleAlarmTriggers`/`schedulePatternAlarmTriggers`/`scheduleGroupReps`)의 각 await 뒤에
`isStaleGen(gen)`이면 즉시 return — 마지막으로 시작한 호출만 끝까지 수행. gen 생략 시(단일 알람
`scheduleAlarm` 경로) 항상 유효. 취소는 멱등이라 겹쳐도 무해. 정적 체크 "rescheduleAll 세대
번호(재진입 중단)" 추가.
**파일**: `src/utils/notifications/rescheduleGen.ts`(신규), `src/utils/notifications/index.ts`,
`src/utils/notifications/core.ts`, `scripts/test-alarm-suite.sh`
**재발 감시 포인트**: `core.ts`에 새 예약 루프나 새 await 지점을 추가하면 그 뒤에
`if (isStaleGen(gen)) return;`을 넣고 `gen`을 인자로 끝까지 전달해야 한다 — 한 함수만 빠뜨리면
그 구간이 다시 "앞 호출이 뒤 호출을 덮어쓰는" 창이 된다. 2026-09-12 항목이 말한 "같은 뒷정리를
여러 호출부가 각자 구현" 골격의 변형: 여러 진입점이 같은 장기 작업을 서로 모르고 시작하는 구조.

## 2026-10-09 · [중간] 네이티브 "끄기"(알림 버튼·커버 화면·워치)로 끄면 Expo +1/+2분 재알림이 그대로 울림

**증상**: 알람을 네이티브 알림의 "끄기" 액션 버튼(워치 Bluetooth 브릿지로 전달된 버튼 포함)
이나 네이티브 커버(풀스크린) 화면에서 끄면 1분·2분 뒤 Expo 재알림(`grp_{h}_{m}_rep1/2`)이
그대로 울림. 인앱 팝업(`stopRinging`)으로 끌 때만 재알림이 취소됐다. 부수적으로 '한 번' 알람의
rep2 자동 비활성화도 단일 알람 그룹에서 전혀 동작하지 않았음.
**원인**: 끄기 경로가 인앱 팝업 / 알림 액션 버튼 / 커버 화면 / 워치 4갈래인데 뒷정리(Expo rep
취소 + once 알람 비활성화)는 인앱 경로(JS `stopRinging`)에만 있었다. `AlarmService.kt`의
`ACTION_STOP`은 서비스만 정지하고 JS에 아무것도 알리지 않음. 부수 버그: 수신 리스너의 once rep2
자동 비활성화가 `data.alarmId`를 보는데 `scheduleGroupReps`는 `alarmIds`(배열)만 넣어 조건이
항상 거짓.
**수정**: (네이티브) `AlarmService.notifyStopped(currentRinging)` — RN이 살아 있으면
DeviceEvent `alarmStopped{body, baseAlarmId}` 즉시 전달, 아니면 prefs `AlarmLastStopped`에 기록;
`AlarmModule.consumeLastStopped()`가 포그라운드 복귀 때 읽고 지움. `AlarmReceiver`→`AlarmService`에
`baseAlarmId`(알람 원본 id; 합성 requestCode와 별개) 전달, `RingingInfo`에 `baseAlarmId` 필드 추가.
(JS) `useAlarmNotifications.afterNativeStop(body, baseAlarmId)` 한 곳에 뒷정리 집중 —
`cancelExpoGroupReps(body)` + `rm==='once'`면 `active:false`. `alarmStopped` 리스너와
`consumeLastStopped` 처리가 모두 이 함수를 탄다. 부수: `scheduleGroupReps`가 단일 알람 그룹이면
`alarmId: active[0].id`도 데이터에 넣음. 정적 체크 "네이티브 끄기 → JS alarmStopped → Expo rep
취소", "단일 알람 그룹 rep 데이터에 alarmId 포함" 추가.
**파일**: `android/app/src/main/java/com/danielpark/alarmapp/AlarmService.kt`, `AlarmModule.kt`,
`AlarmReceiver.kt`, `src/hooks/useAlarmNotifications.ts`, `src/utils/notifications/core.ts`,
`scripts/test-alarm-suite.sh`
**재발 감시 포인트**: 2026-09-12 항목 골격("같은 판정/뒷정리를 여러 호출부가 각자 구현")의 네 번째
변형. 알람 종료/해제의 새 진입점(새 알림 액션, 위젯 버튼, 워치 전용 액션, 자동 종료 타임아웃
등)을 추가하면 반드시 `afterNativeStop`(또는 인앱의 `stopRinging`)을 거치는지 확인 — 네이티브
쪽에서 끝나는 경로는 `notifyStopped`를 호출해야 JS 뒷정리가 돈다. 또 네이티브 이벤트에 id를
실을 때 "합성 requestCode"와 "알람 원본 id"를 섞지 말고 둘 다 명시적으로 보내기(2026-06
`0155346`/`70978ba` rep 슬롯 취소 누락과 같은 혼동). 앱이 죽어 있을 때 이벤트가 유실되는 경로는
prefs 기록 + 복귀 시 consume 패턴으로 보완했는지 확인. rep 발화는 1~2분 뒤라 그 안에 앱이 안
열리면 여전히 울릴 수 있음 — 완전 해결은 네이티브가 Expo 예약을 직접 취소하거나 rep 자체를
네이티브로 옮겨야 함.

## 2026-09-12 · [위험지점] dayOverride(하루 근무 변경) — 판정 로직이 4곳에 분산 구현됨

**상태**: 버그 아님 — 신규 기능 구현 시점의 구조적 위험지점 기록.

**배경**: 연차·병가 등은 그날 근무 알람을 끄고, 대근·특근은 원래 비번인 날에 알람을
새로 켜는 기능. 판정 자체는 `dayWorkFor()`(발화용, `src/utils/index.ts`) /
`dayOverrideDisplay()`(표시용, 같은 파일) 두 헬퍼로 중앙화했지만, "override를 기존
로직보다 먼저 확인한다"는 **우선순위(순서)** 는 호출부마다 각각 손으로 넣어야 한다:

1. `src/utils/notifications/core.ts` — 로테이션 루프(`schedulePatternAlarmTriggers`,
   `rm==='pattern'`): `dayWorkFor` → 없으면 `skips` → `effectiveShift`/`effectiveTime`
2. `src/utils/notifications/core.ts` — 날짜기반 루프(`scheduleAlarmTriggers` 본문,
   `rm!=='pattern'`): `dayWorkFor` → 없으면 기존 `fires` 계산 → `skips`
3. `src/utils/index.ts` — `getNextFireDate()`: `dayWorkFor` → 없으면 `skips` → 기존 로직
4. 표시 계층 3곳(`CalendarView.tsx`, `TodayShiftRow.tsx`, `widgetSync.ts`) —
   `dayOverrideDisplay` → 없으면 `shiftForDate`/`isOffDay`

**왜 위험한가**: `isOffDay`/`shiftForDate` 자체는 override를 전혀 모르도록 일부러 안
건드렸다(회귀 위험 최소화 목적). 그 대신 호출부 각각이 "override부터 먼저 확인"하는
분기를 매번 새로 써야 하는데, 이 프로젝트엔 이미 **같은 모양의 버그**가 세 번 이상
반복된 전례가 있다:
- `8201ac3` (2026-07-19): "이날 끄기"로 알람만 끈 근무일이 `isOffDay`에서 비번(빨간
  날)으로 오판정 — `alarmsForDate`가 skip을 이미 걸러낸 채로 넘어와서 판정용
  호출부와 발화용 호출부가 다른 결과를 봄. `includeSkipped` 파라미터를 표시 판정
  전용으로 분리해서 수정.
- `e35e7ca` (2026-08-04): 로테이션 알람의 실제 발화 시각(`effectiveTime` 기반)을
  헤더 문구·위젯 두 곳이 반영 안 하고 `alarm.hour/min`(레거시 폴백값)을 그대로 찍어
  "다음 알람" 표시가 실제 발화와 어긋남. 발화 경로(core.ts)는 처음부터 맞았고 표시
  경로만 누락됐던 패턴.
- `0155346`/`70978ba` (2026-06): 네이티브 requestCode(합성 슬롯 ID)와 JS의 bare
  alarmId를 비교하는 곳이 여러 곳이라, 한 곳만 합성 ID를 후보로 추가하고 다른 곳은
  안 고쳐서 rep 슬롯 취소가 누락됨.

세 사례 모두 "같은 판정을 여러 호출부가 각자 구현 → 한쪽만 고치거나 한쪽만 새
갈래를 추가 → 조용한 불일치"라는 동일한 골격이다. dayOverride는 판정 *로직*은
헬퍼로 중앙화해 이 함정을 어느 정도 피했지만, *순서*(override 우선 체크)는 여전히
4곳에 중복 구현돼 있어 다섯 번째 사례가 되지 않는다는 보장은 없다.

**현재 상태(2026-09-12 구현 시점)**: 4곳 모두 override 우선 체크가 들어가 있음을
확인함(수동 diff 리뷰 완료). `scripts/test-alarm-suite.sh --static`에 회귀 방지
정적 체크 3개 추가·전부 PASS:
- `dayWorkFor(alarm` 가 core.ts 두 예약 루프 모두에 존재하는지 (grep count ≥ 2)
- `useDayOverrides.ts`에서 `syncWidget` 호출이 `rescheduleAll` 호출보다 먼저인지
- `dayOverrideDisplay`가 CalendarView/TodayShiftRow/widgetSync 세 표시 계층 모두에
  존재하는지

**재발 감시 포인트**: 이후 새 표시 화면(예: 알람 카드, 알림 배너 문구, 다른 위젯
레이아웃)이나 새 예약 경로를 추가할 때, "override부터 먼저 확인"을 빠뜨리기 매우
쉬운 구조다. 새 호출부를 추가하면 반드시:
1. 위 4곳 패턴(override 체크 → 없으면 기존 로직)을 그대로 복사
2. `test-alarm-suite.sh`의 관련 grep 체크에 그 새 파일도 포함시키거나, 못 하면
   비슷한 grep 체크를 새로 추가
파일: `src/utils/index.ts`(`dayWorkFor`/`dayOverrideDisplay`/`getNextFireDate`),
`src/utils/notifications/core.ts`(두 예약 루프),
`src/components/Home/CalendarView.tsx`, `src/components/Home/TodayShiftRow.tsx`,
`src/utils/widgetSync.ts`, `src/hooks/useDayOverrides.ts`,
`scripts/test-alarm-suite.sh`.

**참고**: 자정 롤오버/타임존 계산 버그, 네이티브 requestCode 충돌은 이번
dayOverride 구현이 새로 만드는 alarmId/PendingIntent requestCode가 없어(기존
`mainNativeId`/`weekdaySlotId` 산식을 그대로 재사용) 해당 안 됨. 날짜 문자열도
기존 코드와 동일하게 로컬 `Date` 객체 기반(`getFullYear/getMonth/getDate`)이라
새로운 타임존 버그 경로를 추가하지 않음.
