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

# TDD 원칙 — 버그 수정·회귀 방지 로직 추가 시

이 프로젝트엔 Jest 같은 유닛 테스트 프레임워크가 없다. 대신 `scripts/test-alarm-suite.sh`의
정적 검사(파일 내용에 대한 정규식/패턴 기반 assertion)를 유닛 테스트처럼 취급해 TDD를 적용한다.

**순서 — 버그를 고치거나 "이 조건에서 반드시 이래야 한다"는 규칙을 코드에 넣을 때:**
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
2. **빌드·설치 후** — `./scripts/test-alarm-suite.sh RF9R3049REV` 실행, 결과를 사용자에게 보고
3. **3환경 수동 테스트 필요 시** — 스크립트 마지막에 출력되는 체크리스트를 사용자에게 안내

# 작업 완료 후 규칙

- 작업이 끝날 때마다 항상 커밋 및 푸시 여부를 사용자에게 물어볼 것
