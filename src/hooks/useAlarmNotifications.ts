import { useState, useEffect, useRef } from 'react';
import { Platform, AppState, NativeModules, DeviceEventEmitter } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { Alarm } from '../constants';
import { requestNotificationPermission, registerNotificationCategories, rescheduleAll, cancelExpoGroupReps } from '../utils/notifications';

const { AlarmModule } = NativeModules;

export type RingingState = { title: string; body: string; alarmId?: number; groupKey?: string; source?: 'native' | 'expo' };

// 알림 권한/리스너/포그라운드 재스케줄/네이티브 울림 이벤트를 한곳에서 관리
export function useAlarmNotifications(alarms: Alarm[], updateAlarm: (id: number, patch: Partial<Alarm>) => Promise<void>) {
  const [notifGranted, setNotifGranted] = useState(false);
  const [tick, setTick] = useState(0);
  const [ringing, setRinging] = useState<RingingState | null>(null);
  const appStateRef    = useRef(AppState.currentState);
  const alarmsRef      = useRef(alarms);
  const updateAlarmRef = useRef(updateAlarm);
  alarmsRef.current     = alarms;
  updateAlarmRef.current = updateAlarm;

  useEffect(() => {
    (async () => {
      const ok = await requestNotificationPermission();
      setNotifGranted(ok);
      await registerNotificationCategories();
    })();
  }, []);

  // 1분마다 "다음 알람" 텍스트 갱신
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // 앱이 포그라운드로 돌아오면 전체 재스케줄링 (지나간 슬롯 보충)
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        await rescheduleAll(alarmsRef.current);
        setTick(n => n + 1);
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const s1 = Notifications.addNotificationReceivedListener(async n => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      if (Platform.OS === 'android') {
        const { title, body } = n.request.content;
        const d = n.request.content.data as any;
        setRinging({
          title: title ?? '⏰ 알람', body: body ?? '',
          alarmId: d?.alarmId, groupKey: d?.groupKey,
        });
      }
      const isRepeat = n.request.content.data?.isRepeat as boolean | undefined;
      const repIndex = n.request.content.data?.repIndex as number | undefined;
      const rm       = n.request.content.data?.rm as string | undefined;
      const firedId  = n.request.content.data?.alarmId as number | undefined;

      // '한 번' 알람의 마지막 반복(+2분)까지 울렸으면 자동 비활성화
      if (isRepeat && repIndex === 2 && rm === 'once' && firedId != null) {
        await updateAlarmRef.current(firedId, { active: false });
      }
      setTick(t => t + 1);
    });
    const s2 = Notifications.addNotificationResponseReceivedListener(async r => {
      const data     = r.notification.request.content.data as any;
      const alarmId  = data?.alarmId  as number | undefined;
      const groupKey = data?.groupKey as string | undefined;
      const rm       = data?.rm       as string | undefined;

      // 그룹 또는 개별 rep 슬롯 취소
      if (groupKey) {
        await Notifications.cancelScheduledNotificationAsync(`grp_${groupKey}_rep1`);
        await Notifications.cancelScheduledNotificationAsync(`grp_${groupKey}_rep2`);
      } else if (alarmId != null) {
        await Notifications.cancelScheduledNotificationAsync(`alarm_${alarmId}_rep1`);
        await Notifications.cancelScheduledNotificationAsync(`alarm_${alarmId}_rep2`);
      }

      if (r.actionIdentifier === 'snooze') {
        // Android 전용 — iOS는 스누즈 버튼 없음
        Notifications.scheduleNotificationAsync({
          content: { ...r.notification.request.content, title:'⏰ 스누즈', sound: __DEV__ ? true : 'alarm_long.wav' },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(Date.now()+5*60*1000) },
        });
      } else {
        // 끄기 또는 탭 — '한 번' 알람이면 자동 비활성화
        if (rm === 'once' && alarmId != null) {
          await updateAlarmRef.current(alarmId, { active: false });
        }
      }
    });
    return () => { s1.remove(); s2.remove(); };
  }, []);

  // 네이티브 AlarmService 알람 울림 이벤트 (포그라운드 인앱 끄기/스누즈 UI)
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = DeviceEventEmitter.addListener('alarmRinging', (e: { title: string; body: string; alarmId: number }) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setRinging({
        title: e.title ?? '⏰ 알람', body: e.body ?? '',
        alarmId: e.alarmId >= 0 ? e.alarmId : undefined,
        source: 'native',
      });
    });
    return () => sub.remove();
  }, []);

  const requestPermission = async () => {
    const ok = await requestNotificationPermission();
    setNotifGranted(ok);
  };

  const stopRinging = async () => {
    if (AlarmModule) AlarmModule.stopAlarm(ringing?.alarmId ?? -1);
    // expo-notifications rep 슬롯 취소
    if (ringing?.source === 'native') {
      await cancelExpoGroupReps(ringing.body);
    } else if (ringing?.groupKey) {
      await Notifications.cancelScheduledNotificationAsync(`grp_${ringing.groupKey}_rep1`);
      await Notifications.cancelScheduledNotificationAsync(`grp_${ringing.groupKey}_rep2`);
    } else if (ringing?.alarmId != null) {
      await Notifications.cancelScheduledNotificationAsync(`alarm_${ringing.alarmId}_rep1`);
      await Notifications.cancelScheduledNotificationAsync(`alarm_${ringing.alarmId}_rep2`);
    }
    setRinging(null);
  };

  const snoozeRinging = async () => {
    if (ringing?.source === 'native') {
      if (AlarmModule) AlarmModule.snoozeAlarm(ringing.alarmId ?? -1, ringing.title, ringing.body);
      await cancelExpoGroupReps(ringing.body);
      setRinging(null);
      return;
    }
    if (AlarmModule) AlarmModule.stopAlarm(ringing?.alarmId ?? -1);
    if (ringing?.groupKey) {
      await Notifications.cancelScheduledNotificationAsync(`grp_${ringing.groupKey}_rep1`);
      await Notifications.cancelScheduledNotificationAsync(`grp_${ringing.groupKey}_rep2`);
    } else if (ringing?.alarmId != null) {
      await Notifications.cancelScheduledNotificationAsync(`alarm_${ringing.alarmId}_rep1`);
      await Notifications.cancelScheduledNotificationAsync(`alarm_${ringing.alarmId}_rep2`);
    }
    if (ringing)
      Notifications.scheduleNotificationAsync({
        content: { title: '⏰ 스누즈', body: ringing.body, sound: 'alarm_long.wav' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(Date.now() + 5 * 60 * 1000) },
      });
    setRinging(null);
  };

  return { notifGranted, requestPermission, tick, ringing, stopRinging, snoozeRinging };
}
