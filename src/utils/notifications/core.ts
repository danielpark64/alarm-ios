import * as Notifications from 'expo-notifications';
import { Alarm } from '../../constants';
import { getType, pad, getNextFireDate, lunarToSolarInYear } from '../index';
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

// ── 메인 트리거만 예약 (rep 슬롯 제외) ────────────────────────────────
export async function scheduleAlarmTriggers(alarm: Alarm, threadIdentifier?: string) {
  if (!alarm.active) return;

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

  // ── wdcustom (요일 선택) ──────────────────────────────────────────
  if (alarm.rm === 'wdcustom' && alarm.days.length > 0 && !hasUpcomingSkips) {
    const iw = (d: number) => (d + 2) % 7 || 7;
    for (const d of alarm.days) {
      await Notifications.scheduleNotificationAsync({
        identifier: makeId(alarm.id, `cwd${d}`),
        content: baseContent,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: iw(d), hour: alarm.hour, minute: alarm.min },
      });
      scheduleNative(weekdaySlotId(alarm.id, d), nextJsWeekday(alarm.hour, alarm.min, appDayToJs(d)), title, bodyText, 'weekly', alarm.hour, alarm.min, appDayToCalendar(d), soundOn, vibOn, volume);
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
    const ft = new Date(date); ft.setHours(alarm.hour, alarm.min, 0, 0);
    if (ft <= new Date()) continue;
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
    if (!fires) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: makeId(alarm.id, `date_${ds}`),
      content: baseContent,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: ft },
    });
    scheduleNative(mainNativeId(alarm.id, nativeIdx), ft, title, bodyText, 'once', alarm.hour, alarm.min, -1, soundOn, vibOn, volume);
    nativeIdx++;
    if (alarm.rm === 'once') break;
  }
}

// ── 같은 시간대 알람 묶음 rep 슬롯 예약 (+1분/+2분) ───────────────────
export async function scheduleGroupReps(group: Alarm[]) {
  const active = group.filter(a => a.active);
  if (!active.length) return;

  // 슬롯 여유 확인
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  if (scheduled.length + 2 > 62) return;

  const [first] = active;
  const gkey = `${first.hour}_${first.min}`;

  const nextDates = active.map(a => getNextFireDate(a)).filter(Boolean) as Date[];
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
