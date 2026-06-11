import * as Notifications from 'expo-notifications';
import { Platform, NativeModules } from 'react-native';
import { Alarm } from '../constants';
import { getType, pad, getNextFireDate } from './index';

const { AlarmModule } = NativeModules;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true,
    shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true,
    shouldShowInForeground: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true, allowCriticalAlerts: true },
  });
  return status === 'granted';
}

// alarmId 또는 그룹 alarmIds에 포함된 알림 전부 취소
export async function cancelAlarmNotifications(alarmId: number) {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all.filter(n => {
      const d = n.content.data as any;
      return d?.alarmId === alarmId ||
             (Array.isArray(d?.alarmIds) && d.alarmIds.includes(alarmId));
    }).map(n => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
  if (Platform.OS === 'android' && AlarmModule) {
    for (let i = 0; i < 10; i++) AlarmModule.cancelAlarm(alarmId * 100  + i);
    for (let i = 0; i < 14; i++) AlarmModule.cancelAlarm(alarmId * 1000 + i);
    // rep 슬롯 취소 (+1분: 51, +2분: 52)
    AlarmModule.cancelAlarm(alarmId * 100 + 51);
    AlarmModule.cancelAlarm(alarmId * 100 + 52);
    // 스누즈로 예약된 재알림(AlarmService.SNOOZE_REQUEST_CODE) 취소 — 삭제 후 고아 알림 방지
    AlarmModule.cancelAlarm(9002);
  }
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

function getVibrationPattern(vib: string): number[] | undefined {
  if (vib === 'none') return undefined;
  return [0, 200, 150, 200, 150, 200];
}

function makeId(alarmId: number, suffix: string): string {
  return `alarm_${alarmId}_${suffix}`;
}

// ── Android 네이티브 헬퍼 ───────────────────────────────────────────
function scheduleNative(
  requestCode: number, triggerDate: Date,
  title: string, body: string,
  recurrence: string, hour: number, min: number, calWeekday: number
) {
  if (Platform.OS !== 'android' || !AlarmModule) return;
  AlarmModule.scheduleAlarm(requestCode, triggerDate.getTime(), title, body, recurrence, hour, min, calWeekday);
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
async function scheduleAlarmTriggers(alarm: Alarm, threadIdentifier?: string) {
  if (!alarm.active) return;

  const type     = getType(alarm.typeId);
  const title    = `${type.icon} ${alarm.label || type.label}`;
  const bodyText = `${pad(alarm.hour)}:${pad(alarm.min)} 알람`;

  const baseContent: Notifications.NotificationContentInput = {
    title, body: bodyText,
    sound: alarm.vib === 'none' ? undefined : (__DEV__ ? true : 'alarm_long.wav'),
    vibrationPattern: getVibrationPattern(alarm.vib),
    data: { alarmId: alarm.id, rm: alarm.rm },
    categoryIdentifier: 'alarm',
    ...(threadIdentifier ? { threadIdentifier } : {}),
  };

  // ── wdcustom (요일 선택) ──────────────────────────────────────────
  if (alarm.rm === 'wdcustom' && alarm.days.length > 0) {
    const iw = (d: number) => (d + 2) % 7 || 7;
    for (const d of alarm.days) {
      await Notifications.scheduleNotificationAsync({
        identifier: makeId(alarm.id, `cwd${d}`),
        content: baseContent,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: iw(d), hour: alarm.hour, minute: alarm.min },
      });
      scheduleNative(alarm.id * 100 + 3 + d, nextJsWeekday(alarm.hour, alarm.min, appDayToJs(d)), title, bodyText, 'weekly', alarm.hour, alarm.min, appDayToCalendar(d));
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
    else if (alarm.rm === 'cycle') {
      const s = new Date(alarm.sd || ds); s.setHours(0,0,0,0);
      const d = Math.round((date.getTime() - s.getTime()) / 86400000);
      fires = d >= 0 && d % (alarm.cd || 1) === 0;
    } else if (alarm.rm === 'rest') {
      const s = new Date(alarm.sd || ds); s.setHours(0,0,0,0);
      const d = Math.round((date.getTime() - s.getTime()) / 86400000);
      const p = (alarm.cd || 2) + (alarm.rd || 1);
      fires = d >= 0 && (d % p) < (alarm.cd || 2);
    }
    if (!fires) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: makeId(alarm.id, `date_${ds}`),
      content: baseContent,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: ft },
    });
    scheduleNative(alarm.id * 1000 + nativeIdx, ft, title, bodyText, 'once', alarm.hour, alarm.min, -1);
    nativeIdx++;
    if (alarm.rm === 'once') break;
  }
}

// ── 같은 시간대 알람 묶음 rep 슬롯 예약 (+1분/+2분) ───────────────────
async function scheduleGroupReps(group: Alarm[]) {
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
  const hasSound = active.some(a => a.vib !== 'none');

  const repBase: Notifications.NotificationContentInput = {
    title: `⏰ ${label}`,
    body: `${pad(first.hour)}:${pad(first.min)} 알람`,
    sound: hasSound ? (__DEV__ ? true : 'alarm_long.wav') : undefined,
    vibrationPattern: hasSound ? [0,200,150,200,150,200] : undefined,
    categoryIdentifier: 'alarm',
    threadIdentifier: `grp_${gkey}`,
  };

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

// ── 공개 API ──────────────────────────────────────────────────────────

// 전체 재스케줄 (같은 시간대 묶음 처리 포함)
export async function rescheduleAll(alarms: Alarm[]) {
  await cancelAllNotifications();
  const active = alarms.filter(a => a.active);

  // 시간대별 그룹화
  const groups = new Map<string, Alarm[]>();
  for (const a of active) {
    const key = `${a.hour}_${a.min}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }

  for (const [key, group] of groups) {
    // 메인 트리거 (개별, 같은 threadIdentifier로 묶음)
    for (const alarm of group) {
      await scheduleAlarmTriggers(alarm, `grp_${key}`);
    }
    // 그룹 rep 슬롯 (시간대당 1세트)
    await scheduleGroupReps(group);
  }
}

// 단일 알람 재스케줄 (개별 변경 시 fallback용)
export async function scheduleAlarm(alarm: Alarm) {
  if (!alarm.active) return;
  await cancelAlarmNotifications(alarm.id);
  await scheduleAlarmTriggers(alarm, `grp_${alarm.hour}_${alarm.min}`);
  await scheduleGroupReps([alarm]);
}

// iOS: 스누즈 없음 / Android: 스누즈 있음
export async function registerNotificationCategories() {
  if (Platform.OS === 'ios') {
    await Notifications.setNotificationCategoryAsync('alarm', [
      { identifier: 'stop', buttonTitle: '알람 끄기', options: { isDestructive: false, isAuthenticationRequired: false } },
    ]);
  } else {
    await Notifications.setNotificationCategoryAsync('alarm', [
      { identifier: 'stop',   buttonTitle: '알람 끄기', options: { isDestructive: false, isAuthenticationRequired: false } },
      { identifier: 'snooze', buttonTitle: '5분 후',    options: { isDestructive: false, isAuthenticationRequired: false } },
    ]);
  }
}
