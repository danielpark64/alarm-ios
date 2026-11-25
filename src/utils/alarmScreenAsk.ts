// 알람 화면 권한 안내 — 울릴 때 끄기 화면이 맨 앞에 뜨게 하는 권한이 꺼져 있으면 알려 준다(세이람 lib/alarmScreenAsk.ts 이식).
// 순수 함수만 — React Native·네이티브 import 금지(scripts/logic-tests/alarm-screen-ask.test.js가 node에서 돈다).
//
// Android: "다른 앱 위에 표시"는 기존 안내(app/index.tsx showOverlayPrompt — 앱을 켤 때마다)가 따로 묻는다. 여기서는
//   그게 켜진 뒤에 남는 Android 14+ "전체 화면 알림"만 본다(꺼져 있으면 잠금·화면 꺼짐 때 울림 화면 대신 배너만 뜰 수 있다).
//   오버레이가 꺼져 있을 때 함께 물으면 창이 두 개 겹치므로 묻지 않는다.
// iOS: 앱이 스스로 맨 앞에 나올 수 없다. iOS 26+에서 AlarmKit("알람 및 타이머")을 거부했으면 일반 알림 배너로만 울리므로 켜 달라고 한다.
//
// 자주 묻지 않는다: 켜진 알람이 있을 때만, 한 번 물으면 ASK_INTERVAL_MS 동안 다시 묻지 않는다(설정 화면 줄은 늘 있다).
//
// 1.6.2(세이람 1.2.3 lib/alarmScreenAsk.ts에서 가져옴):
//  - 두 플랫폼 공통: 알림 권한이 꺼져 있으면 알람 알림도, Android의 전체 화면 알림 경로도 막힌다 → 가장 먼저 묻는다('notif').
//  - 알람을 저장한 직후에도 꺼진 것이 있으면 한 실행에 한 번 묻는다(shouldAskAfterSave). 이때는 '다른 앱 위에 표시'도
//    본다(withOverlay) — 시작 때만 따로 묻던 안내라, 저장 때는 여기서 함께 정한다.
//  - 배터리 최적화는 여기서 묻지 않는다(시작·저장 때 절대 안 띄움 — 사용자 결정 2026-11-25). 설정 화면 줄에서만.

export type AlarmScreenNeed = 'notif' | 'overlay' | 'fsi' | 'alarmkit';

export type AlarmScreenEnv = {
  os: string;
  /** Android 14+ 전체 화면 알림 허용(13 이하는 늘 true) */
  fullScreenIntent: boolean;
  /** Android "다른 앱 위에 표시" */
  overlay: boolean;
  /** iOS AlarmKit 권한('unavailable' = iOS 26 미만·Android) */
  alarmKit: 'notDetermined' | 'denied' | 'authorized' | 'unavailable';
  /** 알림 권한(Android 13+ POST_NOTIFICATIONS·iOS). 모르면 true */
  notifications?: boolean;
};

export const ASK_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;

/** 지금 꺼져 있어 안내할 권한 하나. 없으면 null */
export function nextAlarmScreenNeed(
  env: AlarmScreenEnv, skip: AlarmScreenNeed[] = [], opts: { withOverlay?: boolean } = {},
): AlarmScreenNeed | null {
  const order: AlarmScreenNeed[] = [];
  if ((env.os === 'android' || env.os === 'ios') && env.notifications === false) order.push('notif');
  if (env.os === 'android') {
    // 저장 때(withOverlay)는 '다른 앱 위에 표시'도 여기서 — 시작 때는 기존 안내(showOverlayPrompt)가 맡는다
    if (opts.withOverlay && !env.overlay) order.push('overlay');
    if (env.overlay && !env.fullScreenIntent) order.push('fsi');
  } else if (env.os === 'ios') {
    // 아직 안 물은 상태(notDetermined)는 시작 흐름(useAlarmNotifications)이 시스템 창으로 묻는다 — 거부한 경우만 안내
    if (env.alarmKit === 'denied') order.push('alarmkit');
  }
  return order.find((n) => !skip.includes(n)) ?? null;
}

/** 시작할 때 물을지: 켜진 알람이 있고, 마지막으로 물은 지 ASK_INTERVAL_MS가 지났을 때 */
export function shouldAskAlarmScreen(lastAskedAt: number, now: number, hasActiveAlarm: boolean): boolean {
  if (!hasActiveAlarm) return false;
  if (!(lastAskedAt > 0)) return true;
  // 기기 시계를 되돌린 경우(미래 값)도 다시 물을 수 있게
  return now - lastAskedAt >= ASK_INTERVAL_MS || lastAskedAt > now;
}

/** 알람을 저장한 직후 물을지: 켜진 알람이고, 이번 실행에서 아직 안 물었을 때(꺼진 권한이 있는지는 호출자가 본다). 세이람 1.2.3과 같음 */
export function shouldAskAfterSave(armed: boolean, askedThisRun: boolean): boolean {
  return armed && !askedThisRun;
}
