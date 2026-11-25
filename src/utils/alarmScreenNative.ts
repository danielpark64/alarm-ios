// 알람 화면 권한(울릴 때 끄기 화면이 맨 앞에 뜨게 하는 것) — 네이티브 확인·설정 열기만 모은다. 판정은 ./alarmScreenAsk.ts(순수).
//   Android: "다른 앱 위에 표시"(AlarmModule.canDrawOverlays) · Android 14+ "전체 화면 알림"(AlarmModule.canUseFullScreenIntent)
//   iOS 26+: AlarmKit("알람 및 타이머") 권한
// 알람 예약·취소는 여기서 하지 않는다 — AlarmKit 권한이 바뀌면 useAlarmNotifications의 포그라운드 재예약 키(auth 포함)가 다시 건다.
import { Linking, NativeModules, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { alarmKitEnv, requestAlarmKitIfNeeded } from './notifications/alarmkit';
import type { AlarmScreenEnv } from './alarmScreenAsk';

const { AlarmModule } = NativeModules;

export async function canDrawOverlays(): Promise<boolean> {
  if (Platform.OS !== 'android' || !AlarmModule?.canDrawOverlays) return true;
  try { return !!(await AlarmModule.canDrawOverlays()); } catch { return true; }
}

export function requestOverlayPermission(): void {
  if (Platform.OS !== 'android') return;
  try { AlarmModule?.requestOverlayPermission?.(); } catch {}
}

/** Android 14+ 전체 화면 알림 허용 여부. 13 이하·iOS·구버전 네이티브는 true(안내 불필요) */
export async function canUseFullScreenIntent(): Promise<boolean> {
  if (Platform.OS !== 'android' || !AlarmModule?.canUseFullScreenIntent) return true;
  try { return !!(await AlarmModule.canUseFullScreenIntent()); } catch { return true; }
}

export function openFullScreenIntentSettings(): void {
  if (Platform.OS !== 'android') return;
  try { AlarmModule?.openFullScreenIntentSettings?.(); } catch {}
}

/** iOS AlarmKit 권한 상태('unavailable' = iOS 26 미만·Android) */
export function alarmKitAuthState(): AlarmScreenEnv['alarmKit'] {
  return alarmKitEnv().auth;
}

/** 아직 안 물었으면 시스템 창으로 묻고, 거부했으면 설정 앱의 이 앱 화면("알람 및 타이머" 스위치)을 연다 */
export async function openAlarmKitPermission(): Promise<void> {
  const auth = alarmKitAuthState();
  if (auth === 'notDetermined') { await requestAlarmKitIfNeeded().catch(() => false); return; }
  if (auth === 'denied') { try { await Linking.openSettings(); } catch {} }
}

// ── 1.6.2: 알림 권한·배터리 최적화(세이람 1.2.3 lib/notifications.ts·lib/nativeAlarm.ts에서 가져옴) ──

/** 알림 권한이 켜져 있는지. 아직 안 물은 상태·확인 실패는 true(안내 불필요 — 시작 흐름이 시스템 창으로 묻는다) */
export async function notificationPermissionGranted(): Promise<boolean> {
  try {
    const p = await Notifications.getPermissionsAsync();
    return p.granted || p.status !== 'denied';
  } catch {
    return true;
  }
}

/** 알림이 꺼져 있을 때 켜는 화면: Android는 앱 알림 설정, iOS(또는 네이티브 없음)는 설정 앱의 이 앱 화면 */
export function openNotificationSettings(): void {
  if (Platform.OS === 'android' && AlarmModule?.openNotificationSettings) {
    try { AlarmModule.openNotificationSettings(); return; } catch {}
  }
  Linking.openSettings().catch(() => {});
}

/** 배터리 최적화에서 빠져 있는지(Android). iOS·구버전 네이티브는 true(줄을 숨긴다) */
export async function isIgnoringBatteryOptimizations(): Promise<boolean> {
  if (Platform.OS !== 'android' || !AlarmModule?.isIgnoringBatteryOptimizations) return true;
  try { return !!(await AlarmModule.isIgnoringBatteryOptimizations()); } catch { return true; }
}

/** 배터리 최적화 목록 화면을 연다 — 바로 묻는 창은 Play 선언이 필요해 쓰지 않는다. 설정 화면 줄에서만 부른다 */
export function openBatteryOptimizationSettings(): void {
  if (Platform.OS !== 'android') return;
  try { AlarmModule?.openBatteryOptimizationSettings?.(); } catch {}
}

export async function alarmScreenEnv(): Promise<AlarmScreenEnv> {
  return {
    os: Platform.OS,
    fullScreenIntent: await canUseFullScreenIntent(),
    overlay: await canDrawOverlays(),
    alarmKit: alarmKitAuthState(),
    notifications: await notificationPermissionGranted(),
  };
}
