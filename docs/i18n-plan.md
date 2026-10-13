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
- [ ] 2. 번역 틀(src/i18n: lang.ts, index.tsx, dicts.ts) + 설정 화면 언어 선택 + 언어 변경 시 재예약
- [ ] 3. 화면·알림 문구를 t()로 감싸기 (한국어 표시는 그대로여야 함)
- [ ] 4. 8개 언어 사전 작성 (en ja zh-Hans zh-Hant es fr de pt)
- [ ] 5. 지역별 차이: 근무조 이름 묶음, 근무표 프리셋, 하루 근무 변경 종류(대체휴무·대기근무 추가, 반반차는 ko만),
        한국 전용 숨김(공휴일·휴일근무 집계·음력·24절기·후원 계좌), 달력 주 시작 설정
- [ ] 6. 네이티브 문구(Android strings.xml values-xx, 알림 버튼·위젯), 앱 이름 현지화 플러그인
- [ ] 7. 최종: 정적 체크 추가, verify-fix, bug-tracker 기록, 32·폰 빌드 설치, 사용자 보고(커밋/푸시/출시 여부 질문)

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
