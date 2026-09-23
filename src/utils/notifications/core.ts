import * as Notifications from 'expo-notifications';
import { Alarm, DayOverrides, ShiftPeriod } from '../../constants';
import { getType, pad, getNextFireDate, lunarToSolarInYear, effectiveShift, effectiveTime, dayWorkFor, isOverridableAlarm, isHolidaySkipped, skipsStatutoryHoliday } from '../index';
import { isStatutoryHoliday } from '../../constants/holidays';
import { roleLabel } from '../workPattern';
import { scheduleNative } from './android';
import { weekdaySlotId, mainNativeId } from './alarmIds';
import { getAlarmDefaults } from '../../hooks/useAlarmDefaults';

function getVibrationPattern(vib: string): number[] | undefined {
  if (vib === 'none') return undefined;
  return [0, 200, 150, 200, 150, 200];
}

function makeId(alarmId: number, suffix: string): string {
  return `alarm_${alarmId}_${suffix}`;
}

function nextJsWeekday(h: number, m: number, jsDay: number): Date {
  const now = new Date();
  const d = new Date(); d.setHours(h, m, 0, 0);
  let diff = (jsDay - now.getDay() + 7) % 7;
  if (diff === 0 && d <= now) diff = 7;
  d.setDate(d.getDate() + diff);
  return d;
}
function appDayToCalendar(d: number): number { return d === 6 ? 1 : d + 2; }
function appDayToJs(d: number): number       { return d === 6 ? 0 : d + 1; }

// ── 근무 시간대 로테이션(rm==='pattern') 전용 경로 — 날짜마다 시각/라벨이 달라서
// 일반 알람처럼 title/bodyText를 루프 밖에서 한 번만 계산할 수 없다. 세그먼트가 바뀌지
// 않는 일반 알람 경로(아래 scheduleAlarmTriggers 본문)는 이 분기와 완전히 분리해서
// 한 글자도 건드리지 않는다 — 가장 많이 테스트된 영역이라 회귀 위험을 최소화하기 위함.
async function schedulePatternAlarmTriggers(alarm: Alarm, overrides: DayOverrides, threadIdentifier?: string) {
  const type    = getType(alarm.typeId);
  const soundOn = alarm.snd === 'default';
  const vibOn   = alarm.vib === 'pulse';
  const volume  = getAlarmDefaults().volume;
  const role    = alarm.groupRole ?? 'commute';

  const p2 = (n: number) => String(n).padStart(2, '0');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let nativeIdx = 0;
  for (let i = 0; i < 14; i++) {
    const date = new Date(today); date.setDate(today.getDate() + i);
    const ds = `${date.getFullYear()}-${p2(date.getMonth()+1)}-${p2(date.getDate())}`;
    if (alarm.sd && ds < alarm.sd) continue;

    // 하루 근무 변경(dayOverride)이 있으면 그날의 기존 판정(세그먼트/휴식/skips)을 전부 대체한다.
    // 없으면(dw===null) 지금까지와 똑같이 skips→effectiveShift/effectiveTime 순으로 판정한다.
    // ⚠️ "이날만 끄기(skips)"는 override가 없을 때만 확인한다 — 날짜기반 루프(아래
    // scheduleAlarmTriggers 본문)도 반드시 같은 우선순위(override > skips)를 따라야 한다.
    // 한쪽만 순서가 다르면 "달력엔 대근인데 이 알람만 안 울린다" 같은 불일치가 생긴다.
    const dw = dayWorkFor(alarm, overrides[ds]);
    let shiftInfo: { shift: ShiftPeriod; shiftCustom?: string } | null;
    let t: { hour: number; min: number } | null;
    if (dw) {
      if (!dw.fires) continue;
      t = dw.time ?? null;
      if (!t) continue;
      shiftInfo = dw.shift ? { shift: dw.shift } : effectiveShift(alarm, ds);
    } else {
      if (alarm.skips?.includes(ds)) continue; // 이날만 끄기
      shiftInfo = effectiveShift(alarm, ds); // 휴식일이면 null
      if (!shiftInfo) continue;
      t = effectiveTime(alarm, ds); // 이 역할(퇴근 등)이 이 세그먼트에 없으면 null
      if (!t) continue;
    }

    const ft = new Date(date); ft.setHours(t.hour, t.min, 0, 0);
    if (ft <= new Date()) continue;

    const title    = `${type.icon} ${shiftInfo ? roleLabel(shiftInfo, role) : type.label}`;
    const bodyText = `${pad(t.hour)}:${pad(t.min)} 알람`;
    const content = {
      title, body: bodyText,
      sound: soundOn ? (__DEV__ ? true : 'alarm_long.wav') : undefined,
      vibrate: getVibrationPattern(alarm.vib),
      data: { alarmId: alarm.id, rm: alarm.rm, groupKey: `${alarm.hour}_${alarm.min}` },
      categoryIdentifier: 'alarm',
      ...(threadIdentifier ? { threadIdentifier } : {}),
    } as Notifications.NotificationContentInput;

    await Notifications.scheduleNotificationAsync({
      identifier: makeId(alarm.id, `date_${ds}`),
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: ft },
    });
    scheduleNative(mainNativeId(alarm.id, nativeIdx), ft, title, bodyText, 'once', t.hour, t.min, -1, soundOn, vibOn, volume, alarm.id);
    nativeIdx++;
  }
}

// ── 메인 트리거만 예약 (rep 슬롯 제외) ────────────────────────────────
export async function scheduleAlarmTriggers(alarm: Alarm, overrides: DayOverrides = {}, threadIdentifier?: string) {
  if (!alarm.active) return;
  if (alarm.rm === 'pattern') {
    if (alarm.pattern?.length) await schedulePatternAlarmTriggers(alarm, overrides, threadIdentifier);
    return;
  }

  const type     = getType(alarm.typeId);
  const title    = `${type.icon} ${alarm.label || type.label}`;
  const bodyText = `${pad(alarm.hour)}:${pad(alarm.min)} 알람`;
  const soundOn  = alarm.snd === 'default';
  const vibOn    = alarm.vib === 'pulse';
  const volume   = getAlarmDefaults().volume;

  const baseContent = {
    title, body: bodyText,
    sound: soundOn ? (__DEV__ ? true : 'alarm_long.wav') : undefined,
    vibrate: getVibrationPattern(alarm.vib),
    data: { alarmId: alarm.id, rm: alarm.rm, groupKey: `${alarm.hour}_${alarm.min}` },
    categoryIdentifier: 'alarm',
    ...(threadIdentifier ? { threadIdentifier } : {}),
  } as Notifications.NotificationContentInput;

  // "이날만 끄기"가 예약 창(14일) 안에 있으면 요일 알람도 날짜 기반으로 전환
  // (주간 반복 트리거는 특정 날짜 하나만 뺄 수 없기 때문)
  const p2d = (n: number) => String(n).padStart(2, '0');
  const now0 = new Date();
  const todayDs = `${now0.getFullYear()}-${p2d(now0.getMonth()+1)}-${p2d(now0.getDate())}`;
  const hasUpcomingSkips = (alarm.skips ?? []).some(s => s >= todayDs);
  // 하루 근무 변경도 같은 이유로 요일 알람을 날짜 기반으로 전환시켜야 한다 — WEEKLY 트리거는
  // 특정 날짜 하나만 골라 시각을 바꾸거나 끌 수 없다. isOverridableAlarm이 아니면(운동·식사 등)
  // override가 있어도 이 알람과 무관하므로 전환하지 않는다.
  const end13 = new Date(now0); end13.setDate(end13.getDate() + 13);
  const end13Ds = `${end13.getFullYear()}-${p2d(end13.getMonth()+1)}-${p2d(end13.getDate())}`;
  const hasUpcomingOverride = isOverridableAlarm(alarm)
    && Object.keys(overrides).some(ds => ds >= todayDs && ds <= end13Ds);
  // 법정공휴일도 같은 이유로 날짜 기반 전환이 필요한데, 이쪽은 이유가 하나 더 있다.
  // ⚠️ 네이티브(AlarmScheduling.nextWeeklyTrigger)는 recurrence='weekly' 예약을 JS와 무관하게
  // 자체 재계산해서 발화 때마다 스스로 다음 주를 다시 잡는다(AlarmReceiver). 그래서 WEEKLY
  // 경로로 내려보내면 JS에서 아무리 공휴일을 걸러도 네이티브 알람이 그대로 울린다.
  // 날짜 기반('once')으로 내려보내야 공휴일이 실제로 빠진다.
  // 그 알람이 울리는 요일과 겹치는 공휴일만 센다 — 안 그러면 주말에만 걸린 공휴일 때문에
  // 평일 알람까지 불필요하게 14일 창 방식으로 바뀐다.
  const hasUpcomingHoliday = skipsStatutoryHoliday(alarm) && (() => {
    for (let i = 0; i < 14; i++) {
      const d = new Date(now0); d.setDate(d.getDate() + i);
      const ds = `${d.getFullYear()}-${p2d(d.getMonth()+1)}-${p2d(d.getDate())}`;
      const dow = (d.getDay() + 6) % 7; // 0=월 ~ 6=일
      if (!(alarm.days || []).includes(dow)) continue;
      if (isStatutoryHoliday(ds)) return true;
    }
    return false;
  })();

  // ── wdcustom (요일 선택) ──────────────────────────────────────────
  if (alarm.rm === 'wdcustom' && alarm.days.length > 0 && !hasUpcomingSkips && !hasUpcomingOverride && !hasUpcomingHoliday) {
    const iw = (d: number) => (d + 2) % 7 || 7;
    for (const d of alarm.days) {
      await Notifications.scheduleNotificationAsync({
        identifier: makeId(alarm.id, `cwd${d}`),
        content: baseContent,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: iw(d), hour: alarm.hour, minute: alarm.min },
      });
      scheduleNative(weekdaySlotId(alarm.id, d), nextJsWeekday(alarm.hour, alarm.min, appDayToJs(d)), title, bodyText, 'weekly', alarm.hour, alarm.min, appDayToCalendar(d), soundOn, vibOn, volume, alarm.id);
    }
    return;
  }

  // ── 날짜 기반 (once / cycle / rest) ──────────────────────────────
  const p2 = (n: number) => String(n).padStart(2, '0');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let nativeIdx = 0;
  for (let i = 0; i < 14; i++) {
    const date = new Date(today); date.setDate(today.getDate() + i);
    const ds = `${date.getFullYear()}-${p2(date.getMonth()+1)}-${p2(date.getDate())}`;
    if (alarm.sd && ds < alarm.sd) continue;
    let fires = false;
    if (alarm.rm === 'once') fires = ds === alarm.sd;
    else if (alarm.rm === 'wdcustom') {
      const dow = (date.getDay() + 6) % 7; // 0=월 ~ 6=일
      fires = (alarm.days || []).includes(dow);
    }
    else if (alarm.rm === 'cycle') {
      const s = new Date(alarm.sd || ds); s.setHours(0,0,0,0);
      const d = Math.round((date.getTime() - s.getTime()) / 86400000);
      fires = d >= 0 && d % (alarm.cd || 1) === 0;
    } else if (alarm.rm === 'rest') {
      const s = new Date(alarm.sd || ds); s.setHours(0,0,0,0);
      const d = Math.round((date.getTime() - s.getTime()) / 86400000);
      const p = (alarm.cd || 2) + (alarm.rd || 1);
      fires = d >= 0 && (d % p) < (alarm.cd || 2);
    } else if (alarm.rm === 'monthly') {
      if (alarm.lastDay) {
        const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth()+1, 0).getDate();
        fires = date.getDate() === lastDayOfMonth;
      } else {
        const sdDay = alarm.sd ? parseInt(alarm.sd.split('-')[2]) : 1;
        fires = date.getDate() === sdDay;
      }
    } else if (alarm.rm === 'yearly' && alarm.sd) {
      const [, sdM, sdD] = alarm.sd.split('-').map(Number);
      if (alarm.lunar) {
        fires = ds === lunarToSolarInYear(date.getFullYear(), sdM, sdD);
      } else if (sdM === 2 && sdD === 29) {
        const y = date.getFullYear();
        const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
        fires = date.getMonth() === 1 && date.getDate() === (isLeap ? 29 : 28);
      } else {
        fires = date.getMonth() === sdM - 1 && date.getDate() === sdD;
      }
    }
    if (fires && alarm.skips?.includes(ds)) fires = false; // 이날만 끄기
    // 법정공휴일 — 교대근무가 아닌 출퇴근 알람만. 바로 아래 dayWorkFor가 fires를 통째로
    // 대체하므로, 공휴일에 특근/대근을 걸어둔 날은 이 줄과 무관하게 정상 발화한다.
    if (fires && isHolidaySkipped(alarm, ds)) fires = false;

    // 하루 근무 변경 — dayWorkFor는 출근/퇴근 타입이 아닌 알람이면 항상 null이라
    // 운동·식사·생일 등 나머지 알람 종류는 이 블록의 영향을 전혀 받지 않는다.
    // 있으면 위에서 계산한 fires/시각을 통째로 대체한다(연차=강제 미발화, 대근=시각 지정).
    let hh = alarm.hour, mm = alarm.min;
    const dw = dayWorkFor(alarm, overrides[ds]);
    if (dw) {
      fires = dw.fires;
      if (dw.time) { hh = dw.time.hour; mm = dw.time.min; }
    }
    if (!fires) continue;

    const ft = new Date(date); ft.setHours(hh, mm, 0, 0);
    if (ft <= new Date()) continue;

    await Notifications.scheduleNotificationAsync({
      identifier: makeId(alarm.id, `date_${ds}`),
      // override로 시각이 바뀐 날만 알림 배너 문구도 그 시각으로 — 아니면 알림엔 원래 시각이
      // 뜨는데 실제로는 다른 시각에 울리는 불일치가 생긴다.
      content: dw?.time ? { ...baseContent, body: `${pad(hh)}:${pad(mm)} 알람` } : baseContent,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: ft },
    });
    // ⚠️ 네이티브는 override여도 bodyText를 원래 시각 그대로 넘긴다(고쳤다가 되돌림) —
    // 이 문자열이 실제 발화 시 cancelExpoGroupReps(ringing.body)의 정규식 파싱으로 rep
    // 슬롯 gkey(`${first.hour}_${first.min}`, scheduleGroupReps는 override를 모르는 고정값)를
    // 재구성하는 유일한 통로다. 여기서 override 시각을 넣으면 gkey가 어긋나 rep 취소가
    // 실패해서(+1분/+2분 보조 알림이 안 지워짐) 알람을 꺼도 잠시 뒤 다시 울린다.
    // 대가로 override 날엔 네이티브 알림 문구(화면 텍스트)가 원래 시각으로 보일 수 있으나,
    // 실제 발화 시각(ft/hh/mm)은 정확하다 — 문구 정확도보다 rep 취소 정확도가 우선이다.
    scheduleNative(mainNativeId(alarm.id, nativeIdx), ft, title, bodyText, 'once', hh, mm, -1, soundOn, vibOn, volume, alarm.id);
    nativeIdx++;
    if (alarm.rm === 'once') break;
  }
}

// ── 같은 시간대 알람 묶음 rep 슬롯 예약 (+1분/+2분) ───────────────────
export async function scheduleGroupReps(group: Alarm[], overrides: DayOverrides = {}) {
  const active = group.filter(a => a.active);
  if (!active.length) return;

  // 슬롯 여유 확인
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  if (scheduled.length + 2 > 62) return;

  const [first] = active;
  const gkey = `${first.hour}_${first.min}`;

  const nextDates = active.map(a => getNextFireDate(a, overrides)).filter(Boolean) as Date[];
  if (!nextDates.length) return;
  const next = new Date(Math.min(...nextDates.map(d => d.getTime())));

  // 묶음 라벨: 알람이 여러 개면 합침
  const label = active.length === 1
    ? (active[0].label || getType(active[0].typeId).label)
    : active.map(a => a.label || getType(a.typeId).label).join(' · ');
  const hasSound = active.some(a => a.snd === 'default');
  const hasVib   = active.some(a => a.vib === 'pulse');

  const repBase = {
    title: `⏰ ${label}`,
    body: `${pad(first.hour)}:${pad(first.min)} 알람`,
    sound: hasSound ? (__DEV__ ? true : 'alarm_long.wav') : undefined,
    vibrate: hasVib ? [0,200,150,200,150,200] : undefined,
    categoryIdentifier: 'alarm',
    threadIdentifier: `grp_${gkey}`,
  } as Notifications.NotificationContentInput;

  for (const offset of [1, 2]) {
    await Notifications.scheduleNotificationAsync({
      identifier: `grp_${gkey}_rep${offset}`,
      content: {
        ...repBase,
        data: {
          alarmIds: active.map(a => a.id),
          groupKey: gkey,
          isRepeat: true,
          repIndex: offset,
          rm: active.length === 1 ? active[0].rm : 'group',
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(next.getTime() + offset * 60 * 1000),
      },
    });
  }
}
