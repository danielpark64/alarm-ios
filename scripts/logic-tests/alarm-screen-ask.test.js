// 알람 화면 권한 안내(src/utils/alarmScreenAsk.ts) — 울릴 때 끄기 화면이 맨 앞에 뜨게 하는 권한이 꺼져 있으면 알려 준다.
// 자주 묻지 않는다: 켜진 알람이 있을 때만, 한 번 물으면 3일 동안 다시 묻지 않는다.
// "다른 앱 위에 표시"는 기존 안내(앱을 켤 때마다, app/index.tsx showOverlayPrompt)가 따로 묻는다 — 여기서 겹쳐 묻지 않는다.
module.exports = (U, M) => {
  const A = M.alarmScreenAsk;
  check('alarmScreenAsk 모듈이 있다', !!A);
  if (!A) return;
  const DAY = 24 * 60 * 60 * 1000;
  check('묻는 간격은 3일', A.ASK_INTERVAL_MS === 3 * DAY);

  // ── 무엇을 물을지 ──
  const env = (o) => ({ os: 'android', fullScreenIntent: true, overlay: true, alarmKit: 'unavailable', ...o });
  check('Android 모두 허용 → 없음', A.nextAlarmScreenNeed(env({})) === null);
  check('Android 14+ 전체 화면 알림 꺼짐(오버레이 켜짐) → fsi', A.nextAlarmScreenNeed(env({ fullScreenIntent: false })) === 'fsi');
  check('오버레이가 꺼져 있으면 기존 안내가 맡음 → 없음(겹쳐 묻지 않음)', A.nextAlarmScreenNeed(env({ fullScreenIntent: false, overlay: false })) === null);
  check('iOS AlarmKit 거부 → alarmkit', A.nextAlarmScreenNeed(env({ os: 'ios', alarmKit: 'denied' })) === 'alarmkit');
  check('iOS 아직 안 물음 → 없음(시작 흐름이 시스템 창으로 묻는다)', A.nextAlarmScreenNeed(env({ os: 'ios', alarmKit: 'notDetermined' })) === null);
  check('iOS 26 미만 → 없음', A.nextAlarmScreenNeed(env({ os: 'ios', alarmKit: 'unavailable' })) === null);
  check('iOS 허용 → 없음', A.nextAlarmScreenNeed(env({ os: 'ios', alarmKit: 'authorized' })) === null);
  check('이미 물은 것은 건너뜀', A.nextAlarmScreenNeed(env({ fullScreenIntent: false }), ['fsi']) === null);

  // ── 1.6.2: 알림 권한·알람 저장 때 '다른 앱 위에 표시'(세이람 1.2.3 lib/alarmScreenAsk.ts에서 가져옴) ──
  check('알림 권한 꺼짐 → notif가 먼저(Android)', A.nextAlarmScreenNeed(env({ notifications: false, fullScreenIntent: false })) === 'notif');
  check('알림 권한 꺼짐 → notif(iOS)', A.nextAlarmScreenNeed(env({ os: 'ios', notifications: false, alarmKit: 'denied' })) === 'notif');
  check('알림 권한을 모르면(undefined) 켜진 것으로', A.nextAlarmScreenNeed(env({})) === null);
  check('모두 켜짐 + 저장 때 → 없음', A.nextAlarmScreenNeed(env({ notifications: true }), [], { withOverlay: true }) === null);
  check('저장 때 오버레이 꺼짐 → overlay', A.nextAlarmScreenNeed(env({ overlay: false }), [], { withOverlay: true }) === 'overlay');
  check('저장 때 알림·오버레이 둘 다 꺼짐 → notif 먼저', A.nextAlarmScreenNeed(env({ overlay: false, notifications: false }), [], { withOverlay: true }) === 'notif');
  check('저장 때 오버레이 켜짐·전체 화면 꺼짐 → fsi', A.nextAlarmScreenNeed(env({ fullScreenIntent: false }), [], { withOverlay: true }) === 'fsi');
  check('저장 때 iOS는 오버레이 없음 → 없음', A.nextAlarmScreenNeed(env({ os: 'ios', overlay: false, alarmKit: 'authorized' }), [], { withOverlay: true }) === null);
  check('알람 저장 직후: 켜진 알람이고 이번 실행에 안 물었으면 물음', A.shouldAskAfterSave(true, false) === true);
  check('알람 저장 직후: 이미 물었으면 안 물음', A.shouldAskAfterSave(true, true) === false);
  check('알람 저장 직후: 꺼진 알람이면 안 물음', A.shouldAskAfterSave(false, false) === false);

  // ── 언제 물을지 ──
  const now = Date.UTC(2026, 10, 24, 3, 0, 0);
  check('켜진 알람이 없으면 안 물음', A.shouldAskAlarmScreen(0, now, false) === false);
  check('처음이면 물음', A.shouldAskAlarmScreen(0, now, true) === true);
  check('하루 전에 물었으면 안 물음', A.shouldAskAlarmScreen(now - DAY, now, true) === false);
  check('3일 지났으면 다시 물음', A.shouldAskAlarmScreen(now - 3 * DAY, now, true) === true);
  check('시계를 되돌린 경우(미래 값)도 다시 물음', A.shouldAskAlarmScreen(now + DAY, now, true) === true);
};
