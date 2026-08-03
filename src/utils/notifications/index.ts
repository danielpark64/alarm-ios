import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Alarm, SNOOZE_ENABLED } from '../../constants';
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

// 알림(폰 배너/잠금화면 + 워치로 브릿지되는 것)의 액션 버튼 구성.
//
// ⚠️ 워치를 직접 테스트할 수단이 없으므로(보유 기기 없음) 여기 구성이 곧 워치 동작을 결정한다.
// 폰-워치 표준 Bluetooth 알림 브릿지는 이 알림을 그대로 워치에 띄우고, 워치에서 누른 액션이
// 그대로 이 앱의 응답 리스너로 돌아온다. 즉 아래 버튼 목록 = 워치에서 사용자가 보게 될 버튼.
export async function registerNotificationCategories() {
  // 인앱 울림 화면과 알림/워치의 버튼 구성은 반드시 일치해야 한다 — 앱에선 스누즈를 없앴는데
  // 알림에만 '5분 후'가 남아 있으면, 특히 액션 버튼이 크게 보이는 워치에서 사용자가 그 버튼을
  // 누르게 된다. 그 경로는 Expo 예약만 걸고 네이티브 AlarmManager는 안 걸어서 Doze 구간에
  // 들어가면 스누즈가 안 울린다 — 앱에서 제거한 기능이 워치에서만 살아나 가장 약한 경로로
  // 동작하는 셈이라, SNOOZE_ENABLED와 묶어둔다.
  const actions = [
    { identifier: 'stop', buttonTitle: '알람 끄기', options: { isDestructive: false, isAuthenticationRequired: false } },
    ...(SNOOZE_ENABLED
      ? [{ identifier: 'snooze', buttonTitle: '5분 후', options: { isDestructive: false, isAuthenticationRequired: false } }]
      : []),
  ];

  if (Platform.OS === 'ios') {
    // customDismissAction: 워치/배너에서 그냥 닫기(스와이프 등)만 해도 응답 리스너가 호출되도록 함.
    // 꺼져 있으면(기본값) 단순 닫기는 이벤트가 안 와서 +1분/+2분 재알림 취소가 누락된다.
    // 워치에서의 "닫기"는 커스텀 액션이 아니라 시스템 기본 닫기인 경우가 많아 이 옵션이 필수.
    await Notifications.setNotificationCategoryAsync('alarm', actions, { customDismissAction: true });
  } else {
    // Android는 customDismissAction 옵션이 없다. 대신 네이티브 알림이 setOngoing(true)이라
    // 스와이프로 지워지지 않아, 끄기를 누르지 않고 알림만 치우는 경로 자체가 막혀 있다.
    await Notifications.setNotificationCategoryAsync('alarm', actions);
  }
}
