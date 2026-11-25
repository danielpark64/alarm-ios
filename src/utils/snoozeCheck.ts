// 1.6.3 "5분 후 다시"(Android 네이티브 스누즈, 요청코드 9002)가 아직 유효한지 판정하는 순수 함수.
// rescheduleAll이 스누즈를 지우지 않게 된 뒤(포그라운드 복귀만으로 스누즈가 사라지던 문제), 일정이 바뀌어
// 그 알람이 "그 근무일·그 시각"에 더 이상 울리지 않는데도 스누즈가 울리는 일이 생겼다 — 이날 끄기·하루 근무 변경(비번)·
// 시간 변경·끄기·삭제. 판정은 발화 시각을 만드는 기존 함수(getNextFireDate·workDateOfFire)를 그대로 써서 네 번째
// 발화 계산을 따로 만들지 않는다. 취소 자체는 notifications/android.ts cancelSnooze 한 곳에서만 한다.
// 순수 모듈 — logic-tests(scripts/logic-tests/snooze.test.js)가 돈다.
import { Alarm, DayOverrides } from '../constants';
import { getNextFireDate, workDateOfFire } from './index';

/** 네이티브가 남긴 대기 중인 스누즈 기록(AlarmModule.getPendingSnooze) */
export type PendingSnooze = {
  baseAlarmId: number;  // JS 알람 원본 id(-1이면 옛 예약 — 판정 불가)
  workDate: string;     // 근무일(YYYY-MM-DD, 야간 퇴근은 울린 날의 전날). 빈 값이면 근무일 비교를 건너뛴다
  fireAt: number;       // 원래 알람이 울린 예정 시각(ms, 분 단위). 0이면 판정 불가
};

/**
 * 스누즈를 그대로 둘지. false면 취소해야 한다.
 * 기준: 지금 일정으로 그 알람의 "fireAt 직전 이후 첫 발화"가 정확히 fireAt이고, 그 발화의 근무일이 기록된 근무일과 같은가.
 * 기록이 없거나 판정할 정보가 없으면(옛 예약) 그대로 둔다 — 지운·끈 알람은 AlarmReceiver 비활성 게이트가 따로 막는다.
 */
export function snoozeStillDue(alarm: Alarm | undefined, snooze: PendingSnooze | null | undefined, overrides: DayOverrides = {}): boolean {
  if (!snooze || snooze.baseAlarmId < 0 || !snooze.fireAt) return true;
  if (!alarm || !alarm.active) return false;
  const fire = new Date(snooze.fireAt);
  fire.setSeconds(0, 0);
  const next = getNextFireDate(alarm, overrides, new Date(fire.getTime() - 60_000));
  if (!next || next.getTime() !== fire.getTime()) return false;
  if (snooze.workDate && workDateOfFire(alarm, next, overrides) !== snooze.workDate) return false;
  return true;
}

/** 시작일이 지난 '한 번' 알람을 시작 때 자동으로 끌 때, 스누즈 대기 중인 알람이면 남겨 둔다(자정 직전 스누즈). */
export function keepOnceForSnooze(alarm: Alarm, snooze: PendingSnooze | null | undefined): boolean {
  return !!snooze && alarm.rm === 'once' && snooze.baseAlarmId === alarm.id;
}
