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

# 작업 완료 후 규칙

- 작업이 끝날 때마다 항상 커밋 및 푸시 여부를 사용자에게 물어볼 것
