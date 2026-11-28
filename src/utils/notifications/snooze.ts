// "5분 후 다시"(스누즈) — 두 플랫폼의 대기 기록·취소 단일 진입점, iOS Expo 스누즈 예약(1.6.4).
//
// - Android: 네이티브 스누즈(요청코드 9002, AlarmService.ACTION_SNOOZE) — 울림 카드·커버 화면이 건다. 여기선 읽기·취소만.
// - iOS 26+ AlarmKit: [5분 후 다시]는 시스템 카운트다운(.countdown) — 앱 코드 없음. 일정이 바뀌면 rescheduleAll이
//   alarmKitKeepIds(snoozeCheck.ts)로 판정해 cancelAllAlarmKit에서 뺀다.
// - iOS 26 미만·AlarmKit 거부(Expo 알림 경로, 11-28부터 진동만 알람도 AlarmKit): 알림 버튼 [5분 후 다시] → 응답 리스너가 scheduleIosSnooze로 5분 뒤 Expo 알림 +
//   보조 알림 묶음을 건다. 원래 알람의 {알람 id, 근무일, 울린 시각}을 기록(AsyncStorage)해 두고, rescheduleAll 끝 reconcileSnooze가
//   snoozeStillDue로 판정한다 — 이날 끄기·하루 근무 변경·시간 변경·끄기·삭제면 취소, 앱만 다시 열면 유지(고친버그 30·31번).
//
// ⚠️ 스누즈 취소는 cancelSnooze 한 곳으로만(정적 체크) — 보조 알림 취소는 cancelRepSeries(REP_MAX까지).
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SNOOZE_MIN, IOS_REP_COUNT_NEAREST, IOS_REP_INTERVAL_SEC } from '../../constants';
import { getPendingSnooze, nativeCancelSnooze } from './android';
import { notifSound, scheduleRepSeries, cancelRepSeries } from './core';
import { listAlarmKit } from './alarmkit';
import { isIosSnoozeNotifId, iosSnoozeBaseId, iosSnoozeExpired, alarmKitFireAt, type IosSnoozeRecord, type PendingSnooze } from '../snoozeCheck';

const IOS_KEY = 'ios_snoozes_v1';
// 스누즈가 울리기 시작해 보조 알림까지 다 울리는 시간 + 여유 1분 — 이보다 지난 기록은 정리한다
export const IOS_SNOOZE_RING_MS = (IOS_REP_COUNT_NEAREST * IOS_REP_INTERVAL_SEC + 60) * 1000;

export async function loadIosSnoozes(): Promise<IosSnoozeRecord[]> {
  if (Platform.OS !== 'ios') return [];
  try {
    const raw = await AsyncStorage.getItem(IOS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((r: any) => r && typeof r.id === 'string') : [];
  } catch { return []; }
}

async function saveIosSnoozes(list: IosSnoozeRecord[]) {
  try { await AsyncStorage.setItem(IOS_KEY, JSON.stringify(list)); } catch {}
}

/**
 * 스누즈 취소의 단일 진입점.
 * - Android: 네이티브 스누즈(9002)와 대기 기록(하나뿐이라 id는 무시).
 * - iOS: id가 있으면 그 스누즈만, 없으면 기록된 전부 — 본 알림·보조 알림(cancelRepSeries)·기록을 함께 지운다.
 */
export function cancelSnooze(id?: string): Promise<void> {
  if (Platform.OS === 'android') { nativeCancelSnooze(); return Promise.resolve(); }
  if (Platform.OS !== 'ios') return Promise.resolve();
  return (async () => {
    const recs = await loadIosSnoozes();
    const ids = id ? [id] : recs.map(r => r.id);
    await Promise.all(ids.map(async x => {
      await Notifications.cancelScheduledNotificationAsync(x).catch(() => {});
      await cancelRepSeries(x);
    }));
    const left = recs.filter(r => !ids.includes(r.id));
    if (left.length !== recs.length) await saveIosSnoozes(left);
  })();
}

/**
 * 대기 중인 스누즈 전부(판정 대상) — '한 번' 알람 자동 끄기 제외(useAlarms keepOnceForSnooze)에 쓴다.
 * Android: 네이티브 기록 하나. iOS: 아직 울릴 Expo 스누즈 기록 + AlarmKit 카운트다운(다시 울림 대기) 예약.
 */
export async function getPendingSnoozes(): Promise<PendingSnooze[]> {
  if (Platform.OS === 'android') {
    const s = await getPendingSnooze();
    return s ? [s] : [];
  }
  if (Platform.OS !== 'ios') return [];
  const now = Date.now();
  const out: PendingSnooze[] = [];
  for (const r of await loadIosSnoozes()) if (!iosSnoozeExpired(r, now, IOS_SNOOZE_RING_MS)) out.push(...(r.targets ?? []));
  for (const e of await listAlarmKit()) {
    if ((e.state === 'countdown' || e.state === 'paused') && e.alarmId >= 0) out.push({ baseAlarmId: e.alarmId, workDate: '', fireAt: alarmKitFireAt(e.when, now) });
  }
  return out;
}

/**
 * rescheduleAll의 "전체 취소" — iOS는 기록이 있는 스누즈 알림(snooze_*)만 남긴다. 앱만 다시 열어도 도는 재예약이
 * 스누즈를 지우면 안 된다(고친버그 31번, Android는 cancelNativeAlarms가 9002를 안 지우는 것과 같은 규칙).
 * 남긴 스누즈가 바뀐 일정에서도 유효한지는 rescheduleAll 끝 reconcileSnooze가 판정한다. 기록이 없는 스누즈 알림은 같이 지운다.
 * Android·기록 없음: 예전 그대로 전부 취소(Android는 Expo 스누즈를 걸지 않는다).
 */
export async function cancelAllExceptSnooze() {
  if (Platform.OS !== 'ios') {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return;
  }
  // 종료 상태에서 [5분 후 다시]를 누르면 앱이 열리며 응답 리스너(scheduleIosSnooze)와 시작 재예약이 겹친다.
  // 전체 취소(cancelAll)를 쓰면 방금 건 스누즈가 지워질 수 있어 iOS는 읽은 목록만 하나씩 지운다(세이람 1.2.4와 같은 수정).
  // 순서가 중요: 예약 목록을 먼저 읽고 기록을 나중에 읽는다 — scheduleIosSnooze는 기록을 먼저 쓰고 예약하므로,
  // 목록에 보인 스누즈는 반드시 기록에도 있다(반대 순서면 그 사이에 걸린 스누즈를 "기록 없음"으로 보고 지운다).
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const keep = new Set((await loadIosSnoozes()).map(r => r.id));
  await Promise.all(all
    .filter(n => !(isIosSnoozeNotifId(n.identifier) && keep.has(iosSnoozeBaseId(n.identifier))))
    .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})));
}

export type IosSnoozeRequest = {
  id: string;               // snoozeCheck.iosSnoozeId — 같은 알람을 또 미루면 같은 id(덮어쓴다)
  title: string; body: string;
  soundOn: boolean;         // 원래 알람의 소리 설정 — 진동만이면 false(notifSound가 무음 파일을 붙여 진동만 난다)
  tone?: string;            // 원래 알람의 소리(constants/alarmTones.ts)
  rm?: string;              // 원래 알람의 반복 방식 — '한 번' 알람은 마지막 보조 알림 뒤 자동으로 꺼진다(수신 리스너)
  targets: PendingSnooze[]; // 판정 대상(snoozeCheck.iosSnoozeTargets) — 비어 있으면(지운 알람) 걸지 않는다
};

/**
 * iOS Expo 스누즈 — 지금부터 SNOOZE_MIN(5)분 뒤 본 알림 + 보조 알림 묶음(가장 가까운 알람과 같은 IOS_REP_COUNT_NEAREST개, 30초 간격).
 * 버튼은 원래 알람과 같은 카테고리('alarm') — 또 미루기·끄기·닫기가 된다. 기록을 먼저 쓰고 예약한다(중간에 앱이 멈춰도
 * 기록 없는 스누즈가 남지 않게 — 남으면 다음 재예약의 cancelAllExceptSnooze가 지운다).
 */
export async function scheduleIosSnooze(p: IosSnoozeRequest): Promise<boolean> {
  if (Platform.OS !== 'ios' || !p.targets.length) return false;
  // 같은 스누즈를 또 미루면 남은 보조 알림부터 지운다(기록은 아래에서 덮어쓴다)
  await Notifications.cancelScheduledNotificationAsync(p.id).catch(() => {});
  await cancelRepSeries(p.id);
  const at = new Date(Date.now() + SNOOZE_MIN * 60_000);
  const recs = (await loadIosSnoozes()).filter(r => r.id !== p.id);
  recs.push({ id: p.id, snoozeAt: at.getTime(), targets: p.targets });
  await saveIosSnoozes(recs);

  const ids = Array.from(new Set(p.targets.map(t => t.baseAlarmId)));
  const data = {
    alarmIds: ids, alarmId: ids.length === 1 ? ids[0] : undefined,
    rm: ids.length === 1 ? p.rm : 'group', tone: p.tone, snd: p.soundOn,
    snoozeId: p.id, snoozeTargets: p.targets,
  };
  const base = {
    title: p.title, body: p.body,
    sound: notifSound(p.soundOn, p.tone), // 진동만도 무음 파일(silent_short.wav) — iOS는 소리가 있어야 진동이 온다
    categoryIdentifier: 'alarm',
    threadIdentifier: p.id,
    interruptionLevel: 'timeSensitive',
  } as Notifications.NotificationContentInput;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: p.id,
      content: { ...base, data },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
    await scheduleRepSeries(p.id, base, data, at, IOS_REP_COUNT_NEAREST);
    return true;
  } catch {
    return false;
  }
}
