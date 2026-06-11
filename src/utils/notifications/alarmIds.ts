// Android AlarmManager PendingIntent request-code 산식.
// AlarmReceiver/AlarmService(Kotlin)와 동일한 규칙을 공유하는 단일 소스.

export const SNOOZE_REQUEST_CODE = 9002;

// 날짜 기반(once/cycle/rest) 메인 트리거: 알람당 최대 14개(idx 0~13)
export function mainNativeId(alarmId: number, idx: number): number {
  return alarmId * 1000 + idx;
}

// 같은 시간대 묶음 재알림(+1분/+2분) 슬롯
export function repSlotId(alarmId: number, repIdx: number): number {
  return alarmId * 100 + 50 + repIdx;
}

// wdcustom(요일 선택) 메인 트리거: 요일별(0~6) 슬롯
export function weekdaySlotId(alarmId: number, day: number): number {
  return alarmId * 100 + 3 + day;
}
