import { useState, useEffect, useRef } from 'react';
import { Platform, AppState, NativeModules, DeviceEventEmitter } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { Alarm } from '../constants';
import { requestNotificationPermission, registerNotificationCategories, rescheduleAll, cancelExpoGroupReps } from '../utils/notifications';
import { getAlarmDefaults } from './useAlarmDefaults';

const { AlarmModule } = NativeModules;

export type RingingState = { title: string; body: string; alarmId?: number; groupKey?: string; source?: 'native' | 'expo' };

// 알림 권한/리스너/포그라운드 재스케줄/네이티브 울림 이벤트를 한곳에서 관리
export function useAlarmNotifications(alarms: Alarm[], updateAlarm: (id: number, patch: Partial<Alarm>) => Promise<void>) {
  const [notifGranted, setNotifGranted] = useState(false);
  const [overlayGranted, setOverlayGranted] = useState<boolean | null>(null);
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

      // 알림 권한 다이얼로그가 완전히 닫힌 뒤에 오버레이 권한 체크를 시작 —
      // 두 팝업(OS 다이얼로그 + 커스텀 Alert)이 동시에 뜨면 일부 기기(One UI 등)에서
      // 뒤에 뜬 팝업이 터치를 못 받거나 아예 안 보이는 문제가 있었음
      if (Platform.OS === 'android' && AlarmModule?.canDrawOverlays) {
        setOverlayGranted(await AlarmModule.canDrawOverlays());
      }
    })();
  }, []);

  // "다른 앱 위에 표시" 권한 — 꺼져 있으면 OneUI 등에서 알람 끄기 팝업이 몇 초 후 강제로 닫힘
  useEffect(() => {
    if (Platform.OS !== 'android' || !AlarmModule?.canDrawOverlays) return;
    const check = async () => setOverlayGranted(await AlarmModule.canDrawOverlays());
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') check();
    });
    return () => sub.remove();
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
        // 네이티브 AlarmService가 이미 같은 알람을 처리 중이면 expo 쪽 중복 알림으로
        // ringing 상태를 덮어쓰지 않음 (alarmId/source가 깨져 끄기 팝업이 즉시 닫히는 문제 방지)
        setRinging(prev => {
          if (prev?.source === 'native') return prev;
          return {
            title: title ?? '⏰ 알람', body: body ?? '',
            alarmId: d?.alarmId, groupKey: d?.groupKey,
          };
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
          content: { title: '⏰ 스누즈', body: r.notification.request.content.body ?? undefined, sound: __DEV__ ? true : 'alarm_long.wav', categoryIdentifier: 'alarm' },
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

  // 앱 시작/포그라운드 복귀 시 AlarmService가 여전히 울리는 중이면 끄기 팝업 복구
  // (전체화면 인텐트로 인한 화면 재구성 등으로 ringing state가 사라져도 소리/진동은 계속되는 문제 보완)
  useEffect(() => {
    if (Platform.OS !== 'android' || !AlarmModule?.getCurrentRinging) return;
    const restore = async () => {
      const info = await AlarmModule.getCurrentRinging();
      if (info) {
        setRinging({
          title: info.title ?? '⏰ 알람', body: info.body ?? '',
          alarmId: info.alarmId >= 0 ? info.alarmId : undefined,
          source: 'native',
        });
      } else {
        // 폴더블 커버 화면 등 앱 UI 바깥에서 이미 알람이 꺼진 경우, JS 쪽 끄기 팝업도 같이 닫음
        setRinging(prev => (prev?.source === 'native' ? null : prev));
      }
    };
    restore();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') restore();
    });
    return () => sub.remove();
  }, []);

  const requestPermission = async () => {
    const ok = await requestNotificationPermission();
    setNotifGranted(ok);
  };

  const requestOverlayPermission = () => {
    AlarmModule?.requestOverlayPermission?.();
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
      if (AlarmModule) AlarmModule.snoozeAlarm(ringing.alarmId ?? -1, ringing.title, ringing.body, getAlarmDefaults().volume);
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

  return { notifGranted, requestPermission, overlayGranted, requestOverlayPermission, tick, ringing, stopRinging, snoozeRinging };
}
