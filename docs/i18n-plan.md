# 다국어화·해외 교대제도 대응 진행표 (feat/i18n 브랜치)

사용자 지시(2026-10-13): 조사 결과(docs/shift-systems-research.md)를 전부 수용해 진행. 기존 에이전트
(alarm-logic / verify-fix / alarm-test / bug-tracker / android-build / ios-build)로 기존 로직 회귀를 막을 것.
언어 선택은 세이람(/Users/daniel/Desktop/daniel-project/Mallo/.claude/worktrees/reverent-pike-e8c285/lib/i18n) 방식 —
한국어 원문을 키로 쓰는 t('…'), 설정에서 system|언어 선택, 9개 언어(ko en ja zh-Hans zh-Hant es fr de pt).
한국 전용 기능은 언어가 ko일 때만 노출. main 푸시·스토어 출시는 하지 말고 끝나면 사용자에게 물을 것.
모든 사용자 보고는 한국어. 32 기기 테스트 알람은 진동만.

규칙: 단계가 끝날 때마다 `./scripts/test-alarm-suite.sh --static` 전부 PASS → verify-fix 에이전트 → 지적 반영 →
이 파일 체크 → feat/i18n에 커밋(푸시는 브랜치만 가능). 작업 중엔 `touch .claude/i18n.lock`으로 활동 표시.

## 단계
- [x] 1. 자정 넘는 근무(야간·24시간) + 야간(night) 근무조 추가 — 로직 변경, 가장 위험. alarm-logic 리뷰 필수
- [x] 2. 번역 틀(src/i18n: lang.ts, index.tsx, dicts.ts) + 설정 화면 언어 선택 + 언어 변경 시 재예약
- [x] 3. 화면·알림 문구를 t()로 감싸기 (한국어 표시는 그대로여야 함)
- [x] 4. 8개 언어 사전 작성 (en ja zh-Hans zh-Hant es fr de pt)
- [x] 5. 지역별 차이: 근무조 이름 묶음, 근무표 프리셋, 하루 근무 변경 종류(대체휴무·대기근무 추가, 반반차는 ko만),
        한국 전용 숨김(공휴일·휴일근무 집계·음력·24절기·후원 계좌), 달력 주 시작 설정
- [x] 6. 네이티브 문구(Android strings.xml values-xx, 알림 버튼·위젯), 앱 이름 현지화 플러그인
- [x] 7. 최종: 정적 체크 추가, verify-fix, bug-tracker 기록, 32·폰 빌드 설치, 사용자 보고(커밋/푸시/출시 여부 질문)

## 진행 메모
(단계별로 무엇을 했고 무엇이 남았는지 여기에 적는다)

### 1단계 완료 (2026-10-13)
- isOvernight/overnightFrom/pruneSkips/workDateOfFire(utils), effectiveTime·dayWorkFor의 dayOffset, 예약 루프 2곳 + getNextFireDate 반영.
- night 근무조: SHIFTS, DEFAULT_SHIFT_TIMES, colors, AddShiftModal BUTTON_ORDER.
- scripts/logic-tests(시각 고정 시나리오 테스트 33개) 신설, 정적 체크 ⑱⑲⑳.
- alarm-logic·verify-fix 리뷰 반영. 남긴 것(낮음): getNextFireDate는 근무가 서로 겹칠 때만 순서 역전 가능(현실 패턴엔 없음),
  WorkPatternBuilder(수정 화면)에는 "다음날" 안내 없음, 퇴근이 실제로 울리는 날(근무일 다음 날)의 달력 팝업엔 그 알람이 안 보임(근무일 기준 표시).
  레거시 cycle/rest로 따로 만든 야간 퇴근 알람은 출근 시각을 몰라 보정 안 됨 → 근무표(로테이션)로 다시 만들어야 함.
- 사용자 지시: 테스트는 32(RF9R3049REV)·노트(R3CM909QRGK) 둘 다, 테스트 알람은 전부 진동만, 두 기기의 기존 앱은 지우고 새로 설치.
- 개발용 딥링크는 잠금 키 필요: alarmapp://?k=<src/constants의 DEV_LINK_KEY>&testAlarm=3 | testPattern=night | clearAll=1 | dumpPending=1 | clearTestAlarms=1
  (같은 URL은 한 번만 처리되므로 반복 시 &n=<숫자>를 붙일 것). Android: adb shell am start -a android.intent.action.VIEW -d "<url>" com.danielpark.alarmapp
- src/i18n/(lang.ts, translate.ts, index.tsx, dicts.ts, locales/*.ts 빈 사전)는 2단계 뼈대로 만들어 둠 — 아직 어디에도 연결 안 됨.

### 2단계 완료 (2026-10-13)
- src/i18n: lang.ts(언어 상태·N 표식·isKoreanLocale), translate.ts(순수 t), index.tsx(LanguageProvider·useT·loadLanguageSetting),
  dicts.ts + locales/<lang>.ts(아직 빈 사전). app/_layout.tsx에 프로바이더, useAlarms가 재예약 전에 언어 설정 로드,
  app/index.tsx가 언어 변경 시 syncWidget+rescheduleAll, 설정 화면에 언어 칩(시스템 + 9개).
- scripts/i18n-keys.js: 키 추출(src/i18n/keys.json) / `--check` 사전 누락·자리표시자·{time} 선두 검사.
- 3단계 규칙: docs/i18n-conventions.md (감싸기 작업자는 이 문서를 따른다).

### 3단계 완료 (2026-10-13)
- 5개 묶음(홈·설정 / 달력 / 알람 폼 / 유틸·알림·위젯 / 도움말·튜토리얼)을 에이전트로 병렬 처리. 키 328개(src/i18n/keys.json, `node scripts/i18n-keys.js`로 재생성).
- 한국어 출력 동일: logic-tests 33, 정적 54 통과. core.ts·useAlarmNotifications·WorkPatternBuilder·CalendarPicker는 지역 변수 t와 충돌해 번역 함수를 `tr`로 import.
- overrideLabel()/dayOverrideDisplay().label은 한국어 원문 반환 유지(달력 집계가 Map 키·정렬에 사용) — 표시 시점에 t().
- 5단계에서 처리할 것으로 넘긴 항목:
  (a) 저장되는 기본 라벨이 한국어("출근", "초번 출근") — useAlarmFormState의 label 초기값/handleTypeChange/handleShiftChange/setLabelGuarded/applyShiftGate/handleSubmit.
      shiftPrefixFor는 이제 번역된 접두어를 돌려주는데 getType().label은 원문이라 비한국어에서 "Early 출근"처럼 섞일 수 있음 → 표시용 alarmDisplayLabel + 폼 로직을 현재 언어 기준으로 통일 필요.
  (b) 한국 전용 숨김: 공휴일(표시·건너뛰기·휴일근무 집계), 음력(토글·yearly 음력 옵션·repeatLabel 음력 분기), 24절기, PromoBanner(후원·채널), CoffeeTipScreen,
      도움말 항목 '음력 생일·제사 알람' '공휴일이 자동으로 반영돼요' '공휴일엔 출퇴근 알람이 쉬어요' + '교대근무자도, 일반인도' 본문의 음력 구절.
  (c) 위젯 네이티브 문구(WidgetListService.kt dayNames·"비번"), 알림 버튼 "끄기"(AlarmService.kt), CoverAlarmActivity "끄기" → 6단계.

### 5·6단계 구현 완료 (2026-10-13) — 사전(4단계)은 언어별 에이전트가 작성 중
- 5(b) 한국 전용 게이트: holidays.getHoliday/statutoryHolidaysInYear, solarTerms.getSolarTerm, useHolidaySync, 달력 음력 토글·음력 줄,
  DateSection 음력 옵션, AlarmsTab PromoBanner, 도움말 krOnly/bodyIntl. (isKoreanLocale = 현재 언어가 ko)
- 5(a) alarmLabel/localizeDefaultLabel(utils): 저장된 기본 라벨("출근", "초번 출근" 등 어느 언어든)을 현재 언어로 표시. 폼(useAlarmFormState)도 현재 언어 기준.
- 주간(day) 근무조 추가(2교대 낮 근무, 야간과 짝). 근무표 프리셋(src/constants/shiftPresets.ts + PresetModal, 새 근무표 만들 때 "자주 쓰는 근무표에서 고르기").
- 하루 근무 변경 종류: 대체휴무(comp, 끄는 갈래)·대기근무(oncall, 근무조·시각 고르는 갈래) 추가, 반반차는 ko에서만 선택 가능(pickableOverrideKinds).
- 달력 주 시작: useWeekStart(auto|sun|mon, auto는 de·fr·es·pt·zh-Hans가 월요일). 메인 달력·날짜 선택 달력에만 적용, 위젯 주간 줄은 일~토 고정.
- 6: NativeStrings.kt + WidgetModule.saveNativeStrings ← widgetSync.ts(끄기·채널 이름·위젯 라벨·요일). 앱 이름은 Android values-<lang>/strings.xml(기기 언어 기준).
  iOS 앱 이름 현지화(lproj)는 미구현 — ios/가 gitignore라 플러그인으로 pbxproj에 등록해야 함(남은 일).
- 정적 체크 ㉑~㉔ 추가(㉒는 사전이 다 채워져야 PASS).
- 남은 일: 사전 완성 후 `node scripts/i18n-keys.js --check` 통과 확인(위젯용 새 키 6개 '끄기' '알람 울림' '오늘 비번! 🎉' '비번 {n}일 후' '비번 없음' '⏰ 다음 알람'은
  에이전트 시작 뒤에 추가돼 사전에 없을 수 있음 → 직접 채울 것), verify-fix, 32·노트 빌드·언어 전환 스크린샷, iPhone 빌드, bug-tracker, 최종 보고.

### 4단계 완료 (2026-10-13)
- 8개 언어 사전(src/i18n/locales/*.ts) 각 366키, `node scripts/i18n-keys.js --check` 누락 없음. logic-tests 129, 정적 58 통과.
- 개발 딥링크 추가: alarmapp://?k=<키>&lang=en&tab=calendar (언어 전환 + 탭 이동, 스크린샷용).
- 번역 에이전트들이 공통으로 짚은 것(7단계에서 실기기로 확인): 독일어 탭 "Einstellungen", 근무 변경 종류 칩(de/fr/es/pt가 김), 근무조 칩(es "Intermedio", pt "Intermediário"),
  "{date}부터"의 MM.DD 고정 순서, 복수형 미지원("1 days" → 칩은 "d"/"j"/"Tg." 약어로 회피), 권한 안내문 속 앱 이름.

### 7단계 진행 (2026-10-13)
- verify-fix(전체) + android-build(32·노트 언어별 스크린샷) 결과 반영:
  기기 언어 네이티브 읽기(setSystemLocaleProvider: iOS Settings AppleLanguages / Android I18nManager) + app.json·Info.plist CFBundleLocalizations,
  언어 설정 없는 기존 설치는 'ko' 고정(loadLanguageSetting, 값 즉시 저장), 라벨 접두어 가드 완화(다른 언어로 만든 알람 편집 시 입력칸 잠김),
  registerNotificationCategories·refreshHolidays 전에 loadLanguageSetting, ko로 바꾸면 refreshHolidays, next/tally memo에 lang,
  TodayShiftRow t(ov.label), 달력 칩 alarmLabel, localizeDefaultLabel이 출퇴근을 문장 키('{shift} 출근')로 조립, AddShiftModal 스크롤, 프리셋 적용 전 확인창.
- 잘림 수정(사전): '{label} · 다음날' 단축(+1d 등), '알람 추가'(de/fr/es/pt/en), 경조사 메모 placeholder 단축, es/pt 중번, de 기타·출근·퇴근.
- 정적 체크 ㉕. 딥링크 tab=… 단독 사용 가능.
- 남은 일: 32·노트 재설치 후 잘림 재확인, iPhone 빌드·한국어 표시 확인(시스템 언어일 때 한국어인지), bug-tracker 기록, 최종 보고.

### 7단계 완료 (2026-10-13) — 전 단계 완료
- 32·노트: 최종 빌드(ca7b275 기준) 설치, 영어·독일어·스페인어 잘림 재확인 OK, 한국어 복귀·알람 0·잔여 예약 0·크래시 0.
- iPhone(17 Pro Max): 설치 완료(Info.plist에 9개 언어 선언 확인). 폰이 잠겨 있어 실행·한국어 표시 확인은 못 함 → 사용자 확인 필요.
- bugs.md에 6건 기록, CLAUDE.md·에이전트 정의(alarm-logic, alarm-test) 갱신, 저장 키 상수 공유(ALARMS_STORAGE_KEY).
- 사용자에게 물을 것: main 병합·푸시 여부, 스토어 출시 여부(버전·스크린샷·스토어 설명 번역 필요), iOS 앱 이름 현지화, 해외 스토어 등록 정보.
