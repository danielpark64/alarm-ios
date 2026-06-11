import { Platform, NativeModules } from 'react-native';
import { mainNativeId, repSlotId, SNOOZE_REQUEST_CODE } from './alarmIds';

const { AlarmModule } = NativeModules;

export function scheduleNative(
  requestCode: number, triggerDate: Date,
  title: string, body: string,
  recurrence: string, hour: number, min: number, calWeekday: number
) {
  if (Platform.OS !== 'android' || !AlarmModule) return;
  AlarmModule.scheduleAlarm(requestCode, triggerDate.getTime(), title, body, recurrence, hour, min, calWeekday);
}

// alarmId에 연결된 모든 네이티브 AlarmManager 예약 취소 (요일 슬롯 + 날짜 슬롯 + rep 슬롯 + 스누즈)
export function cancelNativeAlarms(alarmId: number) {
  if (Platform.OS !== 'android' || !AlarmModule) return;
  for (let i = 0; i < 10; i++) AlarmModule.cancelAlarm(alarmId * 100 + i);
  for (let i = 0; i < 14; i++) AlarmModule.cancelAlarm(mainNativeId(alarmId, i));
  AlarmModule.cancelAlarm(repSlotId(alarmId, 1));
  AlarmModule.cancelAlarm(repSlotId(alarmId, 2));
  // 스누즈로 예약된 재알림(AlarmService.SNOOZE_REQUEST_CODE) 취소 — 삭제 후 고아 알림 방지
  AlarmModule.cancelAlarm(SNOOZE_REQUEST_CODE);
}
