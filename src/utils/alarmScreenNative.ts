// 알람 화면 권한(울릴 때 끄기 화면이 맨 앞에 뜨게 하는 것) — 네이티브 확인·설정 열기만 모은다. 판정은 ./alarmScreenAsk.ts(순수).
//   Android: "다른 앱 위에 표시"(AlarmModule.canDrawOverlays) · Android 14+ "전체 화면 알림"(AlarmModule.canUseFullScreenIntent)
//   iOS 26+: AlarmKit("알람 및 타이머") 권한
// 알람 예약·취소는 여기서 하지 않는다 — AlarmKit 권한이 바뀌면 useAlarmNotifications의 포그라운드 재예약 키(auth 포함)가 다시 건다.
import { Linking, NativeModules, Platform } from 'react-native';
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

export async function alarmScreenEnv(): Promise<AlarmScreenEnv> {
  return {
    os: Platform.OS,
    fullScreenIntent: await canUseFullScreenIntent(),
    overlay: await canDrawOverlays(),
    alarmKit: alarmKitAuthState(),
  };
}
