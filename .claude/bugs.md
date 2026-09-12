# 버그 이력

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
