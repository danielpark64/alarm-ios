# 버그 이력

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
