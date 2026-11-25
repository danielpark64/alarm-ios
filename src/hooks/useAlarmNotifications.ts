import { useState, useEffect, useRef } from 'react';
import { Platform, AppState, NativeModules, DeviceEventEmitter } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { Alarm, notifSoundFor } from '../constants';
import { requestNotificationPermission, registerNotificationCategories, rescheduleAll, refreshRepsOnly, cancelExpoGroupReps, cancelRepSeries, dismissPresentedAlarm } from '../utils/notifications';
import { notificationPermissionGranted, openNotificationSettings } from '../utils/alarmScreenNative';
import { responseAction, groupKeyFromBody } from '../utils/alarmResponse';
import { getAlarmDefaults } from './useAlarmDefaults';
import { getDayOverridesCache } from '../utils/dayOverrideStore';
import { todayStr, workDateOfFire } from '../utils';
import { loadLanguageSetting } from '../i18n';
import { getHolidayVersion } from '../constants/holidays';
// 문구가 리스너 콜백 안에 있어 훅(useT)이 아니라 순수 번역 함수를 쓴다. 지역 변수 t와 겹치지 않게 tr로 가져온다
import { t as tr } from '../i18n/translate';
import { syncIosWidget } from '../utils/iosWidgetNative';
import { requestAlarmKitIfNeeded, alarmKitEnv } from '../utils/notifications/alarmkit';

const { AlarmModule } = NativeModules;

// alarmId: Expo 경로면 알람 원본 id, 네이티브 경로면 합성 requestCode. baseAlarmId: 네이티브 경로에서
// 함께 오는 알람 원본 id(구버전 예약분은 없음) — '한 번' 알람 자동 비활성화 등 알람 목록 조회에 쓴다.
// workDate — 울림 카드에 보일 근무일(YYYY-MM-DD, 1.6.3). 네이티브가 예약 때 받은 값, Expo 갈래는 알람에서 거꾸로 계산, 없으면 울린 날
export type RingingState = { title: string; body: string; alarmId?: number; baseAlarmId?: number; groupKey?: string; source?: 'native' | 'expo'; tone?: string; workDate?: string };

// AlarmModule.getCurrentRinging() 결과 → 울림 화면 상태(포그라운드 복구·알림 본문 탭 공용)
const nativeRingingState = (info: any): RingingState => ({
  title: info.title ?? tr('⏰ 알람'), body: info.body ?? '',
  alarmId: info.alarmId >= 0 ? info.alarmId : undefined,
  baseAlarmId: (info.baseAlarmId ?? -1) >= 0 ? info.baseAlarmId : undefined,
  source: 'native',
  workDate: info.workDate || undefined,
});

// 알림 권한/리스너/포그라운드 재스케줄/네이티브 울림 이벤트를 한곳에서 관리
// loaded: useAlarms의 로드 완료 여부 — 로드 전엔 alarms가 []라 포그라운드 재스케줄을 돌리면 안 된다.
export function useAlarmNotifications(alarms: Alarm[], updateAlarm: (id: number, patch: Partial<Alarm>) => Promise<void>, loaded = true) {
  const [notifGranted, setNotifGranted] = useState(false);
  const [overlayGranted, setOverlayGranted] = useState<boolean | null>(null);
  // 시작 때 권한 창(알림·AlarmKit 시스템 창, 표시 권한 확인)이 다 끝났는지 — 뒤이은 안내 창(useAlarmScreenAsk)이 겹치지 않게
  const [startupPermsDone, setStartupPermsDone] = useState(false);
  const [tick, setTick] = useState(0);
  const [ringing, setRinging] = useState<RingingState | null>(null);
  const appStateRef    = useRef(AppState.currentState);
  const alarmsRef      = useRef(alarms);
  const updateAlarmRef = useRef(updateAlarm);
  const loadedRef      = useRef(loaded);
  alarmsRef.current     = alarms;
  updateAlarmRef.current = updateAlarm;
  loadedRef.current      = loaded;
  // 포그라운드 재스케줄 변경 감지 키(아래 AppState 효과 참고). 알람이 울리면 null로 리셋한다 —
  // Expo +1/+2분 rep 슬롯(grp_{h}_{m}_rep1/2)은 "다음 1회분"만 걸려 있어 울리면 소모되는데,
  // 식별자가 날짜와 무관해 날짜 키만으로는 다음 날 rep 재생성이 보장되지 않기 때문이다
  // (Android는 AlarmReceiver가 네이티브 rep를 따로 걸지만 iOS는 Expo rep만 있다).
  const lastRescheduleKeyRef = useRef<string | null>(null);
  // iOS 26+ AlarmKit 권한 결과로 방식이 바뀐 횟수 — 바뀌면 (로드가 끝난 뒤) 한 번 전체 재예약한다.
  const [alarmKitChanged, setAlarmKitChanged] = useState(0);

  // 네이티브 경로로 끈 알람의 후속 처리 — Expo +1/+2분 재알림 취소 + '한 번' 알람 자동 비활성화.
  // 인앱 팝업(stopRinging)과 네이티브 알림 버튼/커버 화면(alarmStopped 이벤트·consumeLastStopped)
  // 어느 경로로 꺼도 같은 뒷정리를 거치게 한곳에 모은다.
  const afterNativeStop = async (body: string | undefined, baseAlarmId: number | undefined) => {
    if (body) await cancelExpoGroupReps(body);
    // 끈 알람의 지난 알림이 알림 줄에 쌓이지 않게(1.6.2) — 같은 시각 묶음·이 알람의 표시된 알림만 지운다
    await dismissPresentedAlarm({ groupKey: groupKeyFromBody(body), alarmIds: baseAlarmId != null && baseAlarmId >= 0 ? [baseAlarmId] : [] });
    if (baseAlarmId != null && baseAlarmId >= 0) {
      const a = alarmsRef.current.find(x => x.id === baseAlarmId);
      if (a?.rm === 'once' && a.active) await updateAlarmRef.current(a.id, { active: false });
    }
  };

  useEffect(() => {
    (async () => {
      const ok = await requestNotificationPermission();
      setNotifGranted(ok);
      await loadLanguageSetting(); // 알림 버튼('알람 끄기')은 등록 시점 언어로 굳는다 — 저장된 언어 설정을 먼저 읽는다
      await registerNotificationCategories();
      // iOS 26+: AlarmKit 권한을 한 번 묻는다(알림 권한 창이 닫힌 뒤 — 두 시스템 창이 겹치지 않게).
      // 허용하면 소리 알람이 AlarmKit으로 옮겨 가도록 재예약, 거부하면 지금 방식 그대로.
      if (await requestAlarmKitIfNeeded()) setAlarmKitChanged(n => n + 1);

      // 알림 권한 다이얼로그가 완전히 닫힌 뒤에 오버레이 권한 체크를 시작 —
      // 두 팝업(OS 다이얼로그 + 커스텀 Alert)이 동시에 뜨면 일부 기기(One UI 등)에서
      // 뒤에 뜬 팝업이 터치를 못 받거나 아예 안 보이는 문제가 있었음
      if (Platform.OS === 'android' && AlarmModule?.canDrawOverlays) {
        setOverlayGranted(await AlarmModule.canDrawOverlays());
      }
      setStartupPermsDone(true);
    })().catch(() => setStartupPermsDone(true));
  }, []);

  // AlarmKit 방식이 바뀌었으면 재예약 — 로드 전이면 loaded가 true가 될 때 돈다(useAlarms의 첫 재예약이
  // 권한 응답보다 먼저 끝나 예전 방식으로 걸렸을 수 있으므로).
  useEffect(() => {
    if (!alarmKitChanged || !loaded) return;
    lastRescheduleKeyRef.current = null;
    rescheduleAll(alarmsRef.current, getDayOverridesCache());
  }, [alarmKitChanged, loaded]);

  // "다른 앱 위에 표시" 권한 — 꺼져 있으면 OneUI 등에서 알람 끄기 팝업이 몇 초 후 강제로 닫힘
  useEffect(() => {
    if (Platform.OS !== 'android' || !AlarmModule?.canDrawOverlays) return;
    const check = async () => setOverlayGranted(await AlarmModule.canDrawOverlays());
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') { check(); notificationPermissionGranted().then(setNotifGranted).catch(() => {}); }
    });
    return () => sub.remove();
  }, []);

  // 1분마다 "다음 알람" 텍스트 갱신
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // 앱이 포그라운드로 돌아오면 전체 재스케줄링 (지나간 슬롯 보충)
  //
  // 두 가지 가드:
  //  1) loaded 전엔 건너뛴다 — 스플래시~로드 사이에 다른 앱으로 갔다 오면 alarmsRef가 []라
  //     rescheduleAll([])이 전체 취소 + syncActiveNativeAlarms([])로 네이티브 원장을 통째로 비웠다.
  //  2) 알람·override·날짜가 마지막 재스케줄 때와 같으면 건너뛴다 — 재스케줄은 알람 N개 기준
  //     Expo 예약 최대 14N회(직렬 await, 수 초)라 복귀마다 무조건 돌릴 일이 아니다. 14일 창은
  //     날짜가 바뀔 때만 밀리므로 날짜를 키에 넣으면 "지나간 슬롯 보충"은 그대로 보장된다.
  //     (useAlarms의 변경 경로는 이 키를 갱신하지 않아 변경 뒤 첫 복귀엔 한 번 더 돈다 — 무해)
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active' && loadedRef.current) {
        // iOS 위젯은 넘겨 준 기간까지만 그린다 — 앱에 들어올 때마다 기간을 민다(내용이 같으면 네이티브가 아무것도 안 한다).
        if (Platform.OS === 'ios') syncIosWidget(alarmsRef.current, getDayOverridesCache());
        // 공휴일 버전도 키에 넣는다 — API로 임시공휴일이 새로 들어온 날 그 공휴일 스킵이 다음 복귀 때 예약에 반영되게.
        // AlarmKit 권한 상태도 키에 넣는다 — 설정 앱에서 켜고/끄고 돌아오면 방식이 바뀌어야 한다.
        const key = `${todayStr()}|${getHolidayVersion()}|${alarmKitEnv().auth}|${JSON.stringify(alarmsRef.current)}|${JSON.stringify(getDayOverridesCache())}`;
        if (key !== lastRescheduleKeyRef.current) {
          lastRescheduleKeyRef.current = key;
          await rescheduleAll(alarmsRef.current, getDayOverridesCache());
        }
        setTick(n => n + 1);
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const s1 = Notifications.addNotificationReceivedListener(async n => {
      lastRescheduleKeyRef.current = null; // 울림 → 다음 포그라운드 복귀 때 rep 재생성 보장
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      if (Platform.OS === 'android') {
        const { title, body } = n.request.content;
        const d = n.request.content.data as any;
        // 네이티브 AlarmService가 이미 같은 알람을 처리 중이면 expo 쪽 중복 알림으로
        // ringing 상태를 덮어쓰지 않음 (alarmId/source가 깨져 끄기 팝업이 즉시 닫히는 문제 방지)
        setRinging(prev => {
          if (prev?.source === 'native') return prev;
          const a = d?.alarmId != null ? alarmsRef.current.find(x => x.id === d.alarmId) : undefined;
          return {
            title: title ?? tr('⏰ 알람'), body: body ?? '',
            alarmId: d?.alarmId, groupKey: d?.groupKey, tone: d?.tone,
            workDate: a ? workDateOfFire(a, new Date(), getDayOverridesCache()) : undefined,
          };
        });
      }
      const isRepeat = n.request.content.data?.isRepeat as boolean | undefined;
      const isLast   = n.request.content.data?.isLast as boolean | undefined;
      const rm       = n.request.content.data?.rm as string | undefined;
      const firedId  = n.request.content.data?.alarmId as number | undefined;

      // '한 번' 알람의 마지막 보조 알림까지 울렸으면 자동 비활성화 (묶음 길이가 플랫폼·알람마다 달라 isLast로 판정)
      if (isRepeat && isLast && rm === 'once' && firedId != null) {
        await updateAlarmRef.current(firedId, { active: false });
      }
      setTick(t => t + 1);
    });
    const s2 = Notifications.addNotificationResponseReceivedListener(async r => {
      const data     = r.notification.request.content.data as any;
      const alarmId  = data?.alarmId  as number | undefined;
      const alarmIds = data?.alarmIds as number[] | undefined;
      const groupKey = data?.groupKey as string | undefined;
      const rm       = data?.rm       as string | undefined;

      // 본문 탭인지 액션(알람 끄기·5분 후·닫기)인지 먼저 가른다(1.6.2) — 판정은 src/utils/alarmResponse.ts responseAction 한 곳.
      // Android: 네이티브가 울리는 중에 본문을 누르면 끄지 않고 울림 화면을 연다(알림을 누르면 앱이 열리고, 이 상태로 끄기 모달이 뜬다).
      //   예전엔 본문 탭도 아래 끄기 뒷정리를 그대로 타서, 울림 화면 대신 알람이 그냥 꺼졌다(11-25 32·노트에서 확인).
      // iOS: 앱 안 울림 화면이 없어 본문 탭이 곧 끄기다(안 끄면 30초 간격 보조 알림이 계속 울린다) — 예전 그대로.
      const nativeInfo = Platform.OS === 'android' && r.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER && AlarmModule?.getCurrentRinging
        ? await AlarmModule.getCurrentRinging().catch(() => null) : null;
      const action = responseAction(Platform.OS, r.actionIdentifier, !!nativeInfo, Notifications.DEFAULT_ACTION_IDENTIFIER);
      if (action === 'openRinging') {
        setRinging(nativeRingingState(nativeInfo));
        return;
      }

      // 그룹 또는 개별 보조 알림 전부 취소 (Expo 쪽) — 워치/잠금화면의 "알람 끄기"·닫기가 여기로 온다
      if (groupKey) await cancelRepSeries(`grp_${groupKey}`);
      else if (alarmId != null) await cancelRepSeries(`alarm_${alarmId}`);

      // 네이티브 쪽 rep도 같이 취소 — Expo 알림의 액션 버튼으로 껐을 때 네이티브
      // AlarmManager가 발화 시점에 독립적으로 걸어둔 +1/+2분 예약이 안 지워지면
      // 잠시 후 다시 울리는 문제가 있었음 (cancelReps는 PendingIntent.FLAG_NO_CREATE라
      // 해당 없는 id를 넘겨도 안전)
      if (AlarmModule) {
        for (const id of alarmIds ?? (alarmId != null ? [alarmId] : [])) {
          AlarmModule.stopAlarm(id);
        }
      }

      // 이 알람의 표시된 알림도 지운다(1.6.2) — 액션 버튼은 Android에서 알림을 자동으로 안 지운다
      await dismissPresentedAlarm({ groupKey, alarmIds: alarmIds ?? (alarmId != null ? [alarmId] : []) });

      if (action === 'snooze') {
        // Android 전용 — iOS는 스누즈 버튼 없음
        Notifications.scheduleNotificationAsync({
          content: { title: tr('⏰ 스누즈'), body: r.notification.request.content.body ?? undefined, sound: notifSoundFor(Platform.OS, true, data?.tone, __DEV__), categoryIdentifier: 'alarm', data: { tone: data?.tone } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(Date.now()+5*60*1000) },
        });
      } else {
        // 끄기 또는 탭 — '한 번' 알람이면 자동 비활성화
        if (rm === 'once' && alarmId != null) {
          await updateAlarmRef.current(alarmId, { active: false });
        }
      }
      // iOS: 응답 처리로 앱이 (백그라운드로라도) 깨어난 지금 보조 알림만 다시 걸어 다음 알람이 긴 묶음을
      // 받게 한다. 앱을 열지 않고 잠금화면/워치에서만 끄는 사용자는 이게 없으면 다음 알람이 짧은 묶음만
      // 받는다. 전체 재예약(rescheduleAll)은 쓰지 않는다 — 백그라운드 실행 시간이 수 초뿐이라 중간에
      // 멈추면 메인 예약이 빈 채 남을 수 있다(refreshRepsOnly 주석 참고). 다음 포그라운드 복귀 때
      // 키를 비워 전체 재예약이 한 번 돌게 한다. 로드 전(alarms가 [])이면 건너뛴다.
      if (Platform.OS === 'ios' && loadedRef.current) {
        lastRescheduleKeyRef.current = null;
        await refreshRepsOnly(alarmsRef.current, getDayOverridesCache());
      }
    });
    return () => { s1.remove(); s2.remove(); };
  }, []);

  // 네이티브 AlarmService 알람 울림 이벤트 (포그라운드 인앱 끄기/스누즈 UI)
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = DeviceEventEmitter.addListener('alarmRinging', (e: { title: string; body: string; alarmId: number; baseAlarmId?: number; workDate?: string }) => {
      lastRescheduleKeyRef.current = null; // 울림 → 다음 포그라운드 복귀 때 rep 재생성 보장
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setRinging({
        title: e.title ?? tr('⏰ 알람'), body: e.body ?? '',
        alarmId: e.alarmId >= 0 ? e.alarmId : undefined,
        baseAlarmId: (e.baseAlarmId ?? -1) >= 0 ? e.baseAlarmId : undefined,
        source: 'native',
        workDate: e.workDate || undefined,
      });
    });
    // 네이티브 알림의 "끄기" 버튼(워치 포함)·커버 화면으로 끈 경우 — JS 팝업을 거치지 않아
    // Expo rep 취소가 빠졌던 경로. AlarmService.notifyStopped가 보내준다.
    const stopped = DeviceEventEmitter.addListener('alarmStopped', async (e: { body?: string; baseAlarmId?: number }) => {
      lastRescheduleKeyRef.current = null;
      setRinging(prev => (prev?.source === 'native' ? null : prev));
      await afterNativeStop(e.body, e.baseAlarmId);
    });
    // "5분 후 다시"(1.6.3) — 커버 화면처럼 JS를 거치지 않은 스누즈도 Expo +1/+2분 보조 알림을 지우고 울림 모달을 닫는다.
    // 끄기 뒷정리(afterNativeStop)와 달리 '한 번' 알람을 끄지 않는다 — 끄면 스누즈 재알림이 비활성 게이트에 막힌다.
    const snoozed = DeviceEventEmitter.addListener('alarmSnoozed', async (e: { body?: string }) => {
      lastRescheduleKeyRef.current = null;
      setRinging(prev => (prev?.source === 'native' ? null : prev));
      if (e.body) await cancelExpoGroupReps(e.body);
    });
    return () => { sub.remove(); stopped.remove(); snoozed.remove(); };
  }, []);

  // 앱 시작/포그라운드 복귀 시 AlarmService가 여전히 울리는 중이면 끄기 팝업 복구
  // (전체화면 인텐트로 인한 화면 재구성 등으로 ringing state가 사라져도 소리/진동은 계속되는 문제 보완)
  useEffect(() => {
    if (Platform.OS !== 'android' || !AlarmModule?.getCurrentRinging) return;
    const restore = async () => {
      const info = await AlarmModule.getCurrentRinging();
      if (info) {
        setRinging(nativeRingingState(info));
      } else {
        // 폴더블 커버 화면 등 앱 UI 바깥에서 이미 알람이 꺼진 경우, JS 쪽 끄기 팝업도 같이 닫음
        setRinging(prev => (prev?.source === 'native' ? null : prev));
        // 앱이 죽어 있어 alarmStopped 이벤트를 못 받았을 수 있다 — 네이티브가 남긴 "마지막 끈 알람"
        // 기록을 읽어(한 번 읽으면 지워짐) 같은 뒷정리를 한다.
        if (AlarmModule?.consumeLastStopped) {
          const last = await AlarmModule.consumeLastStopped();
          if (last) await afterNativeStop(last.body, last.baseAlarmId);
        }
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
    // 1.6.2: 이미 거부돼 시스템 창이 다시 안 뜨면 알림 설정 화면을 연다(돌아오면 아래 포그라운드 확인이 칩을 지운다)
    if (!ok) openNotificationSettings();
  };

  const requestOverlayPermission = () => {
    AlarmModule?.requestOverlayPermission?.();
  };

  const stopRinging = async () => {
    if (AlarmModule) AlarmModule.stopAlarm(ringing?.alarmId ?? -1);
    // expo-notifications rep 슬롯 취소
    if (ringing?.source === 'native') {
      // stopAlarm → ACTION_STOP → notifyStopped가 alarmStopped도 보내지만, 여기서 바로 처리해도
      // 취소는 멱등이고 '한 번' 비활성화는 active 검사로 한 번만 적용된다.
      await afterNativeStop(ringing.body, ringing.baseAlarmId);
    } else if (ringing?.groupKey) {
      await cancelRepSeries(`grp_${ringing.groupKey}`);
    } else if (ringing?.alarmId != null) {
      await cancelRepSeries(`alarm_${ringing.alarmId}`);
    }
    // 끈 알람의 표시된 알림 지우기(1.6.2) — 네이티브 갈래는 afterNativeStop이 이미 했다(멱등)
    if (ringing && ringing.source !== 'native') {
      await dismissPresentedAlarm({ groupKey: ringing.groupKey, alarmIds: ringing.alarmId != null ? [ringing.alarmId] : [] });
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
      await cancelRepSeries(`grp_${ringing.groupKey}`);
    } else if (ringing?.alarmId != null) {
      await cancelRepSeries(`alarm_${ringing.alarmId}`);
    }
    if (ringing)
      Notifications.scheduleNotificationAsync({
        content: { title: tr('⏰ 스누즈'), body: ringing.body, sound: notifSoundFor(Platform.OS, true, ringing.tone) as string, data: { tone: ringing.tone } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(Date.now() + 5 * 60 * 1000) },
      });
    setRinging(null);
  };

  return { notifGranted, requestPermission, overlayGranted, requestOverlayPermission, tick, ringing, stopRinging, snoozeRinging, startupPermsDone };
}
