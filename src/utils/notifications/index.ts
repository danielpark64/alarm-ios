import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Alarm } from '../../constants';
import { cancelNativeAlarms, syncActiveNativeAlarms } from './android';
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

  // 근무 시간대 로테이션 알람(rm==='pattern')은 날짜마다 시각이 달라 최상위 hour/min이
  // 첫 세그먼트 기준 레거시 값일 뿐이라, 그 값으로 hour_min 그룹핑/rep 슬롯에 묶으면
  // 실제로 무관한 알람과 잘못 묶이거나 회전 도중 반복알림이 어긋날 수 있다.
  // v1은 pattern 알람을 그룹/rep 슬롯 대상에서 제외하고 개별 스케줄링만 한다
  // (주 알람이 정확한 시각에 울리는 것 자체엔 영향 없음, +1/+2분 보조 알림만 없음).
  const patternAlarms = active.filter(a => a.rm === 'pattern');
  const regular = active.filter(a => a.rm !== 'pattern');

  for (const alarm of patternAlarms) {
    await scheduleAlarmTriggers(alarm);
  }

  // 시간대별 그룹화
  const groups = new Map<string, Alarm[]>();
  for (const a of regular) {
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

  // 삭제된 알람의 잔여 네이티브 예약 정리 — 위 cancelNativeAlarms 루프는 "남아 있는 알람"만
  // 돌기 때문에 삭제분을 못 지운다. 반드시 재등록이 끝난 뒤에 호출해야 방금 건 예약이
  // 유령으로 오인돼 취소되지 않는다.
  syncActiveNativeAlarms(alarms.map(a => a.id));
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
    // customDismissAction: 워치/배너에서 그냥 닫기(스와이프 등)만 해도 응답 리스너가 호출되도록 함.
    // 꺼져 있으면(기본값) 단순 닫기는 이벤트가 안 와서 +1분/+2분 재알림 취소가 누락됨.
    await Notifications.setNotificationCategoryAsync('alarm', [
      { identifier: 'stop', buttonTitle: '알람 끄기', options: { isDestructive: false, isAuthenticationRequired: false } },
    ], { customDismissAction: true });
  } else {
    await Notifications.setNotificationCategoryAsync('alarm', [
      { identifier: 'stop',   buttonTitle: '알람 끄기', options: { isDestructive: false, isAuthenticationRequired: false } },
      { identifier: 'snooze', buttonTitle: '5분 후',    options: { isDestructive: false, isAuthenticationRequired: false } },
    ]);
  }
}
