# Android 상태 점검 (2026-06-06)

## 아키텍처 개요

Android는 iOS와 다르게 두 개의 알람 경로가 있다.

```
[expo-notifications] WEEKLY/DATE 트리거 → 포그라운드 AlarmRinging 모달 표시
[AlarmModule]        AlarmManager → AlarmReceiver → AlarmService (ForegroundService, 소리 루프)
```

- **포그라운드**: expo-notifications 수신 → AlarmRinging 모달
- **백그라운드/종료**: AlarmModule → AlarmService → 소리 반복 + "끄기/5분 후" 알림

---

## 정상 동작 ✅

| 항목 | 상태 |
|------|------|
| ForegroundService 알람 소리 루프 | ✅ 백그라운드/종료 상태에서 소리 반복 |
| 알람 끄기/스누즈 (ForegroundService 알림) | ✅ "끄기" "5분 후" 버튼 |
| wdcustom 요일별 AlarmModule 재스케줄 | ✅ AlarmReceiver → weekly 재스케줄 |
| 진동 | ✅ VibrationEffect |
| 포그라운드 AlarmRinging 모달 | ✅ addNotificationReceivedListener |
| 스누즈 (Android 전용 유지) | ✅ iOS는 제거, Android만 유지 |

---

## 문제점 🔴

### 1. rep 슬롯 (+1분/+2분) 백그라운드 소리 없음
- rep 슬롯은 expo-notifications DATE 트리거로만 예약됨
- 백그라운드에서 rep 슬롯 발화 시 AlarmService가 시작되지 않음
- → **조용한 알림만 표시됨. 소리/진동 없음**

**수정 방법**: AlarmModule에도 rep 슬롯을 같이 예약
```kotlin
// AlarmReceiver에서 본 알람 발화 시 rep 슬롯도 AlarmManager로 예약
scheduleAlarm(alarmId + REP1_OFFSET, now + 60_000, "once", ...)
scheduleAlarm(alarmId + REP2_OFFSET, now + 120_000, "once", ...)
```

### 2. AlarmRinging 모달에서 rep 슬롯 취소 안 됨
- 모달의 "끄기" 버튼 → `AlarmModule.stopAlarm()` 만 호출
- expo-notifications로 예약된 rep1/rep2는 취소되지 않음
- → **모달로 끄고나서 1분, 2분 뒤에 또 알림 표시됨**

**수정 방법**: onStop/onSnooze 시 cancelAlarmNotifications 호출
```javascript
onStop={() => {
  AlarmModule.stopAlarm();
  cancelRepNotifications(alarmId); // 추가 필요
  setRinging(null);
}}
```

### 3. AlarmReceiver dead code
- `daily`, `weekdays`, `weekends` recurrence 처리 코드 존재
- 모든 알람이 `wdcustom` → `weekly`로 통합돼서 더 이상 호출 안 됨
- → 기능 영향 없음, 코드 정리 필요

---

## 미테스트 항목 🟡

| 항목 | 비고 |
|------|------|
| rep 슬롯 포그라운드 AlarmRinging 표시 | isRepeat 여부 무관하게 모달 뜸 — 의도 확인 필요 |
| wdcustom 7일 알람 AlarmModule 재스케줄 | `weekly` recurrence로 정상 동작 예상 |
| once 알람 자동 비활성화 | 포그라운드만 처리, 백그라운드 미확인 |
| 알람 묶음(같은 시간) rep 슬롯 그룹 취소 | groupKey 기반 취소 Android 미확인 |

---

## 수정 우선순위

| 순위 | 항목 | 난이도 |
|------|------|--------|
| 1 | rep 슬롯 백그라운드 소리 없음 | 중 (AlarmReceiver 수정) |
| 2 | AlarmRinging 끄기 시 rep 취소 | 하 (index.tsx 수정) |
| 3 | AlarmReceiver dead code 정리 | 하 |
| 4 | 미테스트 항목 실기기 확인 | - |
