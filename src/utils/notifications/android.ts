import { Platform, NativeModules } from 'react-native';
import { mainNativeId, weekdaySlotId, repSlotId, SNOOZE_REQUEST_CODE } from './alarmIds';

const { AlarmModule } = NativeModules;

export function scheduleNative(
  requestCode: number, triggerDate: Date,
  title: string, body: string,
  recurrence: string, hour: number, min: number, calWeekday: number,
  soundOn: boolean, vibOn: boolean
) {
  if (Platform.OS !== 'android' || !AlarmModule) return;
  AlarmModule.scheduleAlarm(requestCode, triggerDate.getTime(), title, body, recurrence, hour, min, calWeekday, soundOn, vibOn);
}

// alarmId에 연결된 모든 네이티브 AlarmManager 예약 취소 (요일 슬롯 + 날짜 슬롯 + rep 슬롯 + 스누즈)
// rep(+1분/+2분) 슬롯은 AlarmReceiver가 실제 발화 시 사용한 합성 ID(mainNativeId/weekdaySlotId)를
// 기준으로 스케줄되므로, 가능한 모든 합성 ID 기준 rep 슬롯도 함께 취소함
export function cancelNativeAlarms(alarmId: number) {
  if (Platform.OS !== 'android' || !AlarmModule) return;
  for (let i = 0; i < 10; i++) AlarmModule.cancelAlarm(alarmId * 100 + i);
  for (let i = 0; i < 14; i++) {
    const id = mainNativeId(alarmId, i);
    AlarmModule.cancelAlarm(id);
    AlarmModule.cancelAlarm(repSlotId(id, 1));
    AlarmModule.cancelAlarm(repSlotId(id, 2));
  }
  for (let d = 0; d < 7; d++) {
    const id = weekdaySlotId(alarmId, d);
    AlarmModule.cancelAlarm(repSlotId(id, 1));
    AlarmModule.cancelAlarm(repSlotId(id, 2));
  }
  AlarmModule.cancelAlarm(repSlotId(alarmId, 1));
  AlarmModule.cancelAlarm(repSlotId(alarmId, 2));
  // 스누즈로 예약된 재알림(AlarmService.SNOOZE_REQUEST_CODE) 취소 — 삭제 후 고아 알림 방지
  AlarmModule.cancelAlarm(SNOOZE_REQUEST_CODE);
}
