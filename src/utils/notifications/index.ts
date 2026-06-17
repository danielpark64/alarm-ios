import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Alarm } from '../../constants';
import { cancelNativeAlarms } from './android';
import { scheduleAlarmTriggers, scheduleGroupReps } from './core';

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
  cancelNativeAlarms(alarmId);
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// 네이티브 알람 울림(body="HH:MM 알람")에서 시간을 파싱해 expo 그룹 rep 슬롯(+1/+2분) 취소
export async function cancelExpoGroupReps(body: string) {
  const m = body.match(/^(\d{2}):(\d{2})/);
  if (!m) return;
  const gkey = `${parseInt(m[1], 10)}_${parseInt(m[2], 10)}`;
  await Notifications.cancelScheduledNotificationAsync(`grp_${gkey}_rep1`).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(`grp_${gkey}_rep2`).catch(() => {});
}

// 전체 재스케줄 (같은 시간대 묶음 처리 포함)
export async function rescheduleAll(alarms: Alarm[]) {
  await cancelAllNotifications();
  for (const alarm of alarms) cancelNativeAlarms(alarm.id);
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
