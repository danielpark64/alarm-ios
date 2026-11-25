// 알림 응답·끈 알람 뒷정리의 순수 판정 — React Native·expo import 금지(scripts/logic-tests/alarm-response.test.js가 node에서 돈다).
// 1.6.2(2026-11-25 실기기 점검)에서 나온 두 가지를 한곳에서 정한다.

export type ResponseAction = 'openRinging' | 'snooze' | 'stop';

/**
 * 알림 응답(본문 탭·액션 버튼·닫기) → 할 일.
 *
 * - '5분 후 다시'(snooze) → 스누즈(1.6.4부터 iOS 알림 버튼. Android 알림·워치엔 버튼이 없다 — alarmCategoryActions).
 * - **Android 본문 탭 + 네이티브(AlarmService)가 울리는 중 → 끄지 않고 울림 화면을 연다.**
 *   본문 탭은 "알람을 보러 왔다"는 뜻이다. 예전엔 액션과 구분 없이 꺼 버려, 알림을 눌렀는데 울림 화면 대신 알람이 그냥 꺼졌다.
 *   울림 화면(MainActivity 위 끄기 모달)에서 직접 끄거나 다시 알림을 고르게 한다.
 * - Android 본문 탭 + 안 울림(이미 끈 뒤 남은 지난 알림·Expo 보조 알림만 뜬 경우) → 예전처럼 끄기 뒷정리.
 *   열 울림 화면이 없으니, 본 것으로 보고 남은 보조 알림(+1/+2분)을 지운다.
 * - **iOS 본문 탭 → 예전처럼 끈다.** iOS는 앱 안 울림 화면이 없다(AlarmKit 알람은 시스템 화면이고 Expo 응답으로 오지 않는다).
 *   iOS 26 미만·진동만 알람은 Expo 알림 + 30초 간격 보조 알림 묶음으로 울리므로, 본문 탭으로 앱만 열고 안 끄면
 *   보조 알림이 계속 울린다 — 본문 탭이 곧 "끄기"다.
 * - '알람 끄기' 액션(워치·잠금 화면)·닫기(iOS customDismissAction) → 끈다.
 *
 * defaultId: Notifications.DEFAULT_ACTION_IDENTIFIER(expo를 import하지 않으려고 넘겨받는다).
 */
export function responseAction(os: string, actionIdentifier: string, nativeRinging: boolean, defaultId: string): ResponseAction {
  if (actionIdentifier === 'snooze') return 'snooze';
  if (os === 'android' && actionIdentifier === defaultId && nativeRinging) return 'openRinging';
  return 'stop';
}

/**
 * 알림 카테고리 'alarm'의 버튼(= 워치에 보이는 버튼) — 순서는 세이람과 같다: [알람 끄기, 5분 후 다시].
 * - iOS(1.6.4): 늘 둘 다. iOS 26 미만·AlarmKit 거부·진동만 알람은 Expo 알림으로 울리므로 여기서 미룬다(5분 뒤 Expo 알림).
 * - Android: 알림·워치 스누즈는 Expo 예약만 걸려 Doze에 약해 끈다(snoozeEnabled = SNOOZE_ENABLED, 기본 false).
 *   Android의 [5분 후 다시]는 울림 카드·커버 화면의 네이티브 스누즈(AlarmService.ACTION_SNOOZE) 한 길이다.
 */
export function alarmCategoryActions(os: string, snoozeEnabled: boolean): ('stop' | 'snooze')[] {
  return os === 'ios' || snoozeEnabled ? ['stop', 'snooze'] : ['stop'];
}

/** 네이티브 알람 본문("HH:MM 알람" — 키가 {time}으로 시작)에서 같은 시각 묶음 키("7_5"). 없으면 null */
export function groupKeyFromBody(body: string | undefined | null): string | null {
  const m = (body ?? '').match(/^(\d{2}):(\d{2})/);
  if (!m) return null;
  return `${parseInt(m[1], 10)}_${parseInt(m[2], 10)}`;
}

export type PresentedLite = { identifier: string; data?: any };
export type DismissTarget = { alarmIds?: number[]; groupKey?: string | null };

/**
 * 끈 알람의 "표시된"(알림 줄에 떠 있는) 알림 중 지울 식별자.
 * 알람 id(data.alarmId / data.alarmIds)나 같은 시각 묶음(data.groupKey, 보조 알림 grp_{묶음}_rep*)이 맞는 것만 — 다른 알람은 건드리지 않는다.
 * 지난 날짜의 같은 알람 알림도 함께 지운다(알림 줄에 쌓이던 것).
 */
export function presentedToDismiss(presented: PresentedLite[], target: DismissTarget): string[] {
  const ids = new Set((target.alarmIds ?? []).filter(n => n != null && n >= 0));
  const gk = target.groupKey || null;
  if (!ids.size && !gk) return [];
  return presented.filter(p => {
    const d = p.data ?? {};
    if (d.alarmId != null && ids.has(d.alarmId)) return true;
    if (Array.isArray(d.alarmIds) && d.alarmIds.some((x: number) => ids.has(x))) return true;
    if (gk && (d.groupKey === gk || p.identifier.startsWith(`grp_${gk}_`))) return true;
    return false;
  }).map(p => p.identifier);
}
