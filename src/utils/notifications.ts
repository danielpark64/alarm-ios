import * as Notifications from 'expo-notifications';
import { Alarm } from '../constants';
import { getType, pad } from './index';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true,
    shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true,
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
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

function getVibrationPattern(vib: string): number[] | undefined {
  if (vib === 'none') return undefined;
  return [0, 200, 150, 200, 150, 200];
}

// 같은 시간 여러 알람이 각각 별도로 울리도록 alarmId 포함한 고유 identifier 사용
function makeId(alarmId: number, suffix: string): string {
  return `alarm_${alarmId}_${suffix}`;
}

export async function scheduleAlarm(alarm: Alarm) {
  if (!alarm.active) return;
  await cancelAlarmNotifications(alarm.id);

  const type = getType(alarm.typeId);
  const baseContent: Notifications.NotificationContentInput = {
    title: `${type.icon} ${alarm.label || type.label}`,
    body: `${pad(alarm.hour)}:${pad(alarm.min)} 알람`,
    sound: alarm.vib === 'none' ? undefined : 'alarm_long.wav',
    vibrationPattern: getVibrationPattern(alarm.vib),
    data: { alarmId: alarm.id },
    categoryIdentifier: 'alarm',
  };

  if (alarm.rm === 'daily') {
    await Notifications.scheduleNotificationAsync({
      identifier: makeId(alarm.id, 'daily'),
      content: baseContent,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: alarm.hour, minute: alarm.min },
    });
    return;
  }

  if (alarm.rm === 'weekdays') {
    for (let w = 2; w <= 6; w++)
      await Notifications.scheduleNotificationAsync({
        identifier: makeId(alarm.id, `wd${w}`),
        content: baseContent,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: w, hour: alarm.hour, minute: alarm.min },
      });
    return;
  }

  if (alarm.rm === 'weekends') {
    for (const w of [1, 7])
      await Notifications.scheduleNotificationAsync({
        identifier: makeId(alarm.id, `we${w}`),
        content: baseContent,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: w, hour: alarm.hour, minute: alarm.min },
      });
    return;
  }

  if (alarm.rm === 'wdcustom' && alarm.days.length > 0) {
    const iw = (d: number) => (d + 2) % 7 || 7;
    for (const d of alarm.days)
      await Notifications.scheduleNotificationAsync({
        identifier: makeId(alarm.id, `cwd${d}`),
        content: baseContent,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: iw(d), hour: alarm.hour, minute: alarm.min },
      });
    return;
  }

  // once / cycle / rest — date-based
  const p2 = (n: number) => String(n).padStart(2, '0');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 60; i++) {
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
