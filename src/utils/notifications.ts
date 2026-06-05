import * as Notifications from 'expo-notifications';
import { Platform, NativeModules } from 'react-native';
import { Alarm } from '../constants';
import { getType, pad } from './index';

const { AlarmModule } = NativeModules;

// 포그라운드에서도 iOS 시스템이 직접 처리 → 애플워치 미러링 정상 동작
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

export async function cancelAlarmNotifications(alarmId: number) {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all.filter(n => n.content.data?.alarmId === alarmId)
       .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
  // Android 네이티브 알람 취소
  if (Platform.OS === 'android' && AlarmModule) {
    for (let i = 0; i < 10; i++)  AlarmModule.cancelAlarm(alarmId * 100  + i);
    for (let i = 0; i < 14; i++)  AlarmModule.cancelAlarm(alarmId * 1000 + i);
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

// ── 네이티브 알람 스케줄 헬퍼 (Android 전용) ─────────────────────────
function scheduleNative(
  requestCode: number, triggerDate: Date,
  title: string, body: string,
  recurrence: string, hour: number, min: number, calWeekday: number
) {
  if (Platform.OS !== 'android' || !AlarmModule) return;
  AlarmModule.scheduleAlarm(requestCode, triggerDate.getTime(), title, body, recurrence, hour, min, calWeekday);
}

// 다음 매일 발동 시각
function nextDaily(h: number, m: number): Date {
  const d = new Date(); d.setHours(h, m, 0, 0);
  if (d <= new Date()) d.setDate(d.getDate() + 1);
  return d;
}
// 다음 특정 JS요일(0=일..6=토) 발동 시각
function nextJsWeekday(h: number, m: number, jsDay: number): Date {
  const now = new Date();
  const d = new Date(); d.setHours(h, m, 0, 0);
  let diff = (jsDay - now.getDay() + 7) % 7;
  if (diff === 0 && d <= now) diff = 7;
  d.setDate(d.getDate() + diff);
  return d;
}
// 다음 평일
function nextWeekday(h: number, m: number): Date {
  const d = new Date(); d.setHours(h, m, 0, 0);
  if (d <= new Date()) d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}
// 다음 주말
function nextWeekend(h: number, m: number): Date {
  const d = new Date(); d.setHours(h, m, 0, 0);
  if (d <= new Date()) d.setDate(d.getDate() + 1);
  while (d.getDay() !== 0 && d.getDay() !== 6) d.setDate(d.getDate() + 1);
  return d;
}
// 앱 요일(0=월..6=일) → Java Calendar 요일(2=월..7=토, 1=일)
function appDayToCalendar(d: number): number { return d === 6 ? 1 : d + 2; }
// 앱 요일(0=월..6=일) → JS getDay 요일(0=일..6=토)
function appDayToJs(d: number): number { return d === 6 ? 0 : d + 1; }

export async function scheduleAlarm(alarm: Alarm) {
  if (!alarm.active) return;
  await cancelAlarmNotifications(alarm.id);

  const type = getType(alarm.typeId);
  const title    = `${type.icon} ${alarm.label || type.label}`;
  const bodyText = `${pad(alarm.hour)}:${pad(alarm.min)} 알람`;

  const baseContent: Notifications.NotificationContentInput = {
    title,
    body: bodyText,
    sound: alarm.vib === 'none' ? undefined : (__DEV__ ? true : 'alarm_long.wav'),
    vibrationPattern: getVibrationPattern(alarm.vib),
    data: { alarmId: alarm.id },
    categoryIdentifier: 'alarm',
  };

  // ── 매일 ──────────────────────────────────────────────────────────
  if (alarm.rm === 'daily') {
    await Notifications.scheduleNotificationAsync({
      identifier: makeId(alarm.id, 'daily'),
      content: baseContent,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: alarm.hour, minute: alarm.min },
    });
    scheduleNative(alarm.id * 100, nextDaily(alarm.hour, alarm.min), title, bodyText, 'daily', alarm.hour, alarm.min, -1);
    return;
  }

  // ── 평일 ──────────────────────────────────────────────────────────
  if (alarm.rm === 'weekdays') {
    for (let w = 2; w <= 6; w++)
      await Notifications.scheduleNotificationAsync({
        identifier: makeId(alarm.id, `wd${w}`),
        content: baseContent,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: w, hour: alarm.hour, minute: alarm.min },
      });
    scheduleNative(alarm.id * 100 + 1, nextWeekday(alarm.hour, alarm.min), title, bodyText, 'weekdays', alarm.hour, alarm.min, -1);
    return;
  }

  // ── 주말 ──────────────────────────────────────────────────────────
  if (alarm.rm === 'weekends') {
    for (const w of [1, 7])
      await Notifications.scheduleNotificationAsync({
        identifier: makeId(alarm.id, `we${w}`),
        content: baseContent,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: w, hour: alarm.hour, minute: alarm.min },
      });
    scheduleNative(alarm.id * 100 + 2, nextWeekend(alarm.hour, alarm.min), title, bodyText, 'weekends', alarm.hour, alarm.min, -1);
    return;
  }

  // ── 사용자 지정 요일 ───────────────────────────────────────────────
  if (alarm.rm === 'wdcustom' && alarm.days.length > 0) {
    const iw = (d: number) => (d + 2) % 7 || 7;
    for (const d of alarm.days) {
      await Notifications.scheduleNotificationAsync({
        identifier: makeId(alarm.id, `cwd${d}`),
        content: baseContent,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: iw(d), hour: alarm.hour, minute: alarm.min },
      });
      scheduleNative(
        alarm.id * 100 + 3 + d,
        nextJsWeekday(alarm.hour, alarm.min, appDayToJs(d)),
        title, bodyText, 'weekly', alarm.hour, alarm.min, appDayToCalendar(d)
      );
    }
    return;
  }

  // ── 날짜 기반 (once / cycle / rest) ──────────────────────────────
  // iOS 로컬 알림 최대 64개 제한: 14일치만 등록 후 앱 재진입 시 재스케줄링
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

export async function rescheduleAll(alarms: Alarm[]) {
  await cancelAllNotifications();
  for (const a of alarms) if (a.active) await scheduleAlarm(a);
}

export async function registerNotificationCategories() {
  await Notifications.setNotificationCategoryAsync('alarm', [
    { identifier: 'stop',   buttonTitle: '알람 끄기', options: { isDestructive: false, isAuthenticationRequired: false } },
    { identifier: 'snooze', buttonTitle: '5분 후',    options: { isDestructive: false, isAuthenticationRequired: false } },
  ]);
}
