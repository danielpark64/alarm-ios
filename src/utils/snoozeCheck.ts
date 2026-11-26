// 1.6.3 "5분 후 다시"(Android 네이티브 스누즈, 요청코드 9002)가 아직 유효한지 판정하는 순수 함수.
// rescheduleAll이 스누즈를 지우지 않게 된 뒤(포그라운드 복귀만으로 스누즈가 사라지던 문제), 일정이 바뀌어
// 그 알람이 "그 근무일·그 시각"에 더 이상 울리지 않는데도 스누즈가 울리는 일이 생겼다 — 이날 끄기·하루 근무 변경(비번)·
// 시간 변경·끄기·삭제. 판정은 발화 시각을 만드는 기존 함수(getNextFireDate·workDateOfFire)를 그대로 써서 네 번째
// 발화 계산을 따로 만들지 않는다. 취소 자체는 notifications/snooze.ts cancelSnooze 한 곳에서만 한다(1.6.4부터 iOS도).
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

/**
 * 시작일이 지난 '한 번' 알람을 시작 때 자동으로 끌 때, 스누즈 대기 중인 알람이면 남겨 둔다(자정 직전 스누즈).
 * snooze: Android 네이티브 기록 하나, 또는 iOS 기록·AlarmKit 카운트다운 여러 개(notifications/snooze.ts getPendingSnoozes).
 */
export function keepOnceForSnooze(alarm: Alarm, snooze: PendingSnooze | PendingSnooze[] | null | undefined): boolean {
  const list = Array.isArray(snooze) ? snooze : snooze ? [snooze] : [];
  return alarm.rm === 'once' && list.some(s => s.baseAlarmId === alarm.id);
}

// ── 1.6.4 iOS [5분 후 다시] ─────────────────────────────────────────────────────────
// iOS 26 미만·AlarmKit 거부·진동만 알람(Expo 알림 경로)은 알림 버튼으로 미룬다. Android 네이티브 스누즈처럼 원래 알람의
// {알람 id, 근무일, 울린 시각}을 기록해 두고, rescheduleAll 끝(index.ts reconcileSnooze)에서 위 snoozeStillDue로 판정한다.
// 식별자: 본 알림 `snooze_{grp_h_m | alarm_id}`, 보조 알림 `…_rep{i}`(core.ts scheduleRepSeries/cancelRepSeries 규칙 그대로).

export const IOS_SNOOZE_PREFIX = 'snooze_';

/** iOS 스누즈 기록(AsyncStorage) — id는 본 알림 식별자, targets는 같은 시각 묶음이면 여러 개 */
export type IosSnoozeRecord = { id: string; snoozeAt: number; targets: PendingSnooze[] };

/** 응답한 알림의 data → 스누즈 식별자. 스누즈를 또 미루면 같은 식별자(덮어쓴다). */
export function iosSnoozeId(data: { snoozeId?: string; groupKey?: string; alarmId?: number } | null | undefined): string | null {
  if (data?.snoozeId) return data.snoozeId;
  if (data?.groupKey) return `${IOS_SNOOZE_PREFIX}grp_${data.groupKey}`;
  if (data?.alarmId != null) return `${IOS_SNOOZE_PREFIX}alarm_${data.alarmId}`;
  return null;
}
export function isIosSnoozeNotifId(id: string): boolean { return id.startsWith(IOS_SNOOZE_PREFIX); }
/** 보조 알림 식별자(`…_rep3`) → 기록 id */
export function iosSnoozeBaseId(id: string): string { return id.replace(/_rep\d+$/, ''); }

/**
 * 원래 알람이 울린 분(ms). 받은 알림의 표시 시각에서 보조 알림 순번×간격을 빼고 분 단위로 내린다.
 * deliveredMs가 초 단위로 오는 경우(1e12 미만)도 받는다.
 */
export function iosSnoozeOrigin(deliveredMs: number, repIndex: number | undefined, intervalSec: number): number {
  let ms = deliveredMs < 1e12 ? deliveredMs * 1000 : deliveredMs;
  ms -= (repIndex ?? 0) * intervalSec * 1000;
  const d = new Date(ms);
  d.setSeconds(0, 0);
  return d.getTime();
}

/** 미룬 알람들의 판정 대상 — 지금 목록에 없는(지운) 알람은 뺀다. 근무일은 발화 시각에서 거꾸로(야간 퇴근 = 전날). */
export function iosSnoozeTargets(alarms: Alarm[], ids: number[], fireAt: number, overrides: DayOverrides = {}): PendingSnooze[] {
  const out: PendingSnooze[] = [];
  for (const id of ids) {
    const a = alarms.find(x => x.id === id);
    if (a) out.push({ baseAlarmId: a.id, workDate: workDateOfFire(a, new Date(fireAt), overrides), fireAt });
  }
  return out;
}

/** iOS 스누즈를 그대로 둘지 — 같은 시각 묶음이면 하나라도 그대로 울리면 유지. 대상이 없으면 취소. */
export function iosSnoozeStillDue(alarms: Alarm[], rec: IosSnoozeRecord, overrides: DayOverrides = {}): boolean {
  if (!rec?.targets?.length) return false;
  return rec.targets.some(s => snoozeStillDue(alarms.find(a => a.id === s.baseAlarmId), s, overrides));
}

/** 울리고 나서 ringMs가 지난 기록 — 정리한다(대기 알림은 이미 다 울렸다) */
export function iosSnoozeExpired(rec: IosSnoozeRecord, now: number, ringMs: number): boolean {
  return now > rec.snoozeAt + ringMs;
}

// ── iOS 26+ AlarmKit [5분 후 다시](카운트다운) ─────────────────────────────────────────
// AlarmKit은 [5분 후 다시]를 누르면 시스템이 카운트다운 뒤 다시 울린다(앱 코드 없음). rescheduleAll의 cancelAllAlarmKit은
// 켜진 알람의 울림·카운트다운을 남기는데, 그 사이 일정이 바뀌었으면(이날 끄기·하루 근무 변경·시간 변경) 남기면 안 된다.

/** AlarmKit 목록 한 줄(alarmkit.ts listAlarmKit) — when: 날짜 예약이면 ms, 요일 반복이면 "weekly HH:MM" */
export type AlarmKitEntry = { alarmId: number; state: string; when?: number | string | null };

/** 그 AlarmKit 예약이 원래 울린 시각(ms, 분 단위). 요일 반복은 지금보다 앞선 가장 가까운 그 시각. 모르면 0. */
export function alarmKitFireAt(when: number | string | null | undefined, now: number): number {
  if (typeof when === 'number') { const d = new Date(when); d.setSeconds(0, 0); return d.getTime(); }
  const m = /(\d{1,2}):(\d{2})/.exec(String(when ?? ''));
  if (!m) return 0;
  const d = new Date(now);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  if (d.getTime() > now) d.setDate(d.getDate() - 1);
  return d.getTime();
}

const AK_SNOOZING = new Set(['countdown', 'paused']);

/**
 * cancelAllAlarmKit에 넘길 "남길 알람 id" — 켜진 알람 중, 카운트다운(다시 울림 대기) 예약이 바뀐 일정에서 더는 유효하지 않은 알람은 뺀다.
 * 울리는 중(alerting)은 판정하지 않고 남긴다(사용자가 지금 보고 있다).
 */
export function alarmKitKeepIds(alarms: Alarm[], entries: AlarmKitEntry[], overrides: DayOverrides, now: number): number[] {
  const drop = new Set<number>();
  for (const e of entries) {
    if (!AK_SNOOZING.has(e.state) || e.alarmId < 0) continue;
    const alarm = alarms.find(a => a.id === e.alarmId);
    if (!snoozeStillDue(alarm, { baseAlarmId: e.alarmId, workDate: '', fireAt: alarmKitFireAt(e.when, now) }, overrides)) drop.add(e.alarmId);
  }
  return alarms.filter(a => a.active && !drop.has(a.id)).map(a => a.id);
}
