import { Platform, NativeModules } from 'react-native';
import { mainNativeId, weekdaySlotId, repSlotId, SNOOZE_REQUEST_CODE } from './alarmIds';

const { AlarmModule } = NativeModules;

// baseAlarmId: JS 알람 원본 id — AlarmReceiver의 비활성 차단 게이트가 activeAlarmIds(bare id
// 목록)와 비교하는 값. requestCode(합성 슬롯 id)와 별개로 반드시 함께 넘겨야 한다.
export function scheduleNative(
  requestCode: number, triggerDate: Date,
  title: string, body: string,
  recurrence: string, hour: number, min: number, calWeekday: number,
  soundOn: boolean, vibOn: boolean, volume: number,
  baseAlarmId: number,
) {
  if (Platform.OS !== 'android' || !AlarmModule) return;
  AlarmModule.scheduleAlarm(requestCode, triggerDate.getTime(), title, body, recurrence, hour, min, calWeekday, soundOn, vibOn, volume, baseAlarmId);
}

// alarmId에 연결된 모든 네이티브 AlarmManager 예약 취소 (요일 슬롯 + 날짜 슬롯 + rep 슬롯 + 스누즈)
// rep(+1분/+2분) 슬롯은 AlarmReceiver가 실제 발화 시 사용한 합성 ID(mainNativeId/weekdaySlotId)를
// 기준으로 스케줄되므로, 가능한 모든 합성 ID 기준 rep 슬롯도 함께 취소함.
// 취소 대상이 알람당 약 70개라 개별 브릿지 호출 대신 배열 1회 호출(cancelAlarms)로 묶는다 —
// rescheduleAll이 알람 변경마다 전 알람을 취소하므로 브릿지 왕복이 부하의 주범이었음.
export function cancelNativeAlarms(alarmId: number) {
  if (Platform.OS !== 'android' || !AlarmModule) return;
  const ids: number[] = [];
  // bare alarmId — 구버전 예약분 방어용 (현재 예약은 전부 합성 슬롯 id 사용;
  // weekly 재예약도 AlarmReceiver가 발화 intent의 합성 weekdaySlotId 그대로 재등록함)
  ids.push(alarmId);
  for (let i = 0; i < 10; i++) ids.push(alarmId * 100 + i);
  for (let i = 0; i < 14; i++) {
    const id = mainNativeId(alarmId, i);
    ids.push(id, repSlotId(id, 1), repSlotId(id, 2));
  }
  for (let d = 0; d < 7; d++) {
    const id = weekdaySlotId(alarmId, d);
    ids.push(repSlotId(id, 1), repSlotId(id, 2));
  }
  ids.push(repSlotId(alarmId, 1), repSlotId(alarmId, 2));
  // 스누즈로 예약된 재알림(AlarmService.SNOOZE_REQUEST_CODE) 취소 — 삭제 후 고아 알림 방지
  ids.push(SNOOZE_REQUEST_CODE);

  if (AlarmModule.cancelAlarms) {
    AlarmModule.cancelAlarms(ids);
  } else {
    // 구 네이티브 빌드(배치 API 없음) 폴백
    ids.forEach(id => AlarmModule.cancelAlarm(id));
  }
}

// 삭제된 알람의 잔여 네이티브 예약 정리 — rescheduleAll 끝에서 한 번 호출한다.
// rescheduleAll의 cancelNativeAlarms 루프는 "남아 있는 알람"만 돌기 때문에 삭제분은
// 취소되지 않는다. 네이티브 원장(AlarmStore)에서 baseAlarmId가 살아있는 목록에 없는
// 예약을 찾아 취소하므로, JS가 삭제 id를 따로 기억할 필요가 없다.
export function syncActiveNativeAlarms(aliveIds: number[]) {
  if (Platform.OS !== 'android' || !AlarmModule?.syncActiveAlarms) return;
  AlarmModule.syncActiveAlarms(aliveIds);
}
