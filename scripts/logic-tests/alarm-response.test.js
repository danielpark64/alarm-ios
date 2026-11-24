// 알림 응답 처리(src/utils/alarmResponse.ts) — 1.6.2(2026-11-25 실기기 점검)에서 나온 두 가지.
//  ① 울리는 중 Expo 알림 '본문'을 누르면 알람이 꺼져 버렸다 → Android는 네이티브가 울리는 중이면 끄지 않고 울림 화면을 연다.
//     '알람 끄기' 액션(워치·잠금 화면)·닫기는 그대로 끈다. iOS는 앱 안 울림 화면이 없어 본문 탭도 끈다(보조 알림이 계속 울리면 안 됨).
//  ② 끈 알람의 표시된 알림이 알림 줄에 계속 쌓였다 → 끈 알람·같은 시각 묶음의 표시된 알림을 골라 지운다.
module.exports = (U, M) => {
  const R = M.alarmResponse;
  check('alarmResponse 모듈이 있다', !!R);
  if (!R) return;
  const DEF = 'expo.modules.notifications.actions.DEFAULT';
  const DISMISS = 'expo.modules.notifications.actions.DISMISS';

  // ── ① 응답 → 할 일 ──
  check('Android 본문 탭 + 네이티브 울리는 중 → 울림 화면', R.responseAction('android', DEF, true, DEF) === 'openRinging');
  check('Android 본문 탭 + 안 울림(지난 알림) → 끄기 뒷정리', R.responseAction('android', DEF, false, DEF) === 'stop');
  check('Android 알람 끄기 버튼 + 울리는 중 → 끔', R.responseAction('android', 'stop', true, DEF) === 'stop');
  check('Android 5분 후 → 스누즈', R.responseAction('android', 'snooze', true, DEF) === 'snooze');
  check('iOS 본문 탭 → 끔(앱 안 울림 화면 없음, 보조 알림 남으면 안 됨)', R.responseAction('ios', DEF, false, DEF) === 'stop');
  check('iOS 본문 탭은 울림 여부와 무관하게 끔', R.responseAction('ios', DEF, true, DEF) === 'stop');
  check('iOS 닫기(customDismissAction) → 끔', R.responseAction('ios', DISMISS, false, DEF) === 'stop');
  check('iOS 알람 끄기(워치) → 끔', R.responseAction('ios', 'stop', false, DEF) === 'stop');

  // ── 네이티브 본문 "HH:MM 알람" → 묶음 키 ──
  check('본문에서 묶음 키', R.groupKeyFromBody('07:05 알람') === '7_5');
  check('본문에서 묶음 키(영어)', R.groupKeyFromBody('07:05 alarm') === '7_5');
  check('시각 없는 본문 → null', R.groupKeyFromBody('알람') === null);

  // ── ② 지울 표시된 알림 고르기 ──
  const P = [
    { identifier: 'alarm_3_date_2026-11-24', data: { alarmId: 3, rm: 'pattern' } },
    { identifier: 'alarm_3_date_2026-11-25', data: { alarmId: 3, rm: 'pattern' } },
    { identifier: 'alarm_4_wd1', data: { alarmId: 4, groupKey: '7_5' } },
    { identifier: 'grp_7_5_rep1', data: { alarmIds: [4, 5], groupKey: '7_5', isRepeat: true } },
    { identifier: 'alarm_9_wd1', data: { alarmId: 9, groupKey: '8_0' } },
    { identifier: 'other', data: {} },
    { identifier: 'nodata' },
  ];
  const ids = (t) => R.presentedToDismiss(P, t).sort().join(',');
  check('알람 id로 지난 알림 전부', ids({ alarmIds: [3] }) === 'alarm_3_date_2026-11-24,alarm_3_date_2026-11-25', ids({ alarmIds: [3] }));
  check('묶음 키로 본·보조 알림', ids({ groupKey: '7_5' }) === 'alarm_4_wd1,grp_7_5_rep1', ids({ groupKey: '7_5' }));
  check('묶음 보조 알림은 alarmIds로도', ids({ alarmIds: [5] }) === 'grp_7_5_rep1', ids({ alarmIds: [5] }));
  check('다른 알람은 안 지움', !R.presentedToDismiss(P, { alarmIds: [3], groupKey: '7_5' }).includes('alarm_9_wd1'));
  check('대상 없으면 아무것도 안 지움', R.presentedToDismiss(P, {}).length === 0);
};
