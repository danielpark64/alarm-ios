// iOS 26+ AlarmKit 경로 결정 — 순수 함수만(React Native·네이티브 import 금지, scripts/logic-tests/alarmkit.test.js가 node에서 돈다).
//
// 방식은 자동 전환이다(설정 항목 없음, 2026-11-21 사용자 결정):
//   iOS 26 이상 + AlarmKit 권한 허용  → 소리 알람은 AlarmKit만(무음·집중 모드를 뚫고 시계 앱처럼 전체 화면으로 울림)
//   거부 · 아직 안 물음 · iOS 26 미만 · Android → 지금까지의 Expo 알림(+Android 네이티브) 그대로
// ⚠️ 한 알람을 두 경로에 동시에 걸면 두 번 울린다 — 분기는 반드시 usesAlarmKit 하나로만 판단한다.
import type { Alarm } from '../constants';

export type AlarmKitAuth = 'notDetermined' | 'denied' | 'authorized' | 'unavailable';
export type AlarmKitEnv = { os: string; available: boolean; auth: AlarmKitAuth };

export function alarmKitEnabled(env: AlarmKitEnv): boolean {
  return env.os === 'ios' && env.available && env.auth === 'authorized';
}

// 권한은 iOS 26+에서 아직 묻지 않았을 때 한 번만 요청한다(거부했으면 다시 묻지 않고 Expo 방식).
export function shouldAskAlarmKit(env: AlarmKitEnv): boolean {
  return env.os === 'ios' && env.available && env.auth === 'notDetermined';
}

// 진동만 알람은 Expo에 남긴다 — AlarmKit의 소리는 기본음/앱 번들 파일 둘 중 하나뿐이고 "소리 없이 진동만"을
// 지정하는 API가 없다(AlertConfiguration.AlertSound: default / named). 무음 파일로 진동이 오는지는 문서에 없어서
// 지금처럼 Expo 알림 + silent_short.wav(진동이 확실히 오는 검증된 방식)를 유지한다.
export function usesAlarmKit(alarm: Pick<Alarm, 'snd'>, enabled: boolean): boolean {
  return enabled && alarm.snd === 'default';
}

// 예약 id — 같은 알람·같은 날(key)은 항상 같은 UUID. 겹쳐 돈 재예약이 같은 슬롯을 다시 걸면 덮어쓰게 되어
// 무작위 UUID처럼 "같은 시각에 두 개"가 남지 않는다. key: 근무일 'YYYY-MM-DD' 또는 요일 반복 'weekly'.
export function alarmKitUuid(alarmId: number, key: string): string {
  const s = `alarmapp:${alarmId}:${key}`;
  const part = (seed: number) => {
    let h = (0x811c9dc5 ^ seed) >>> 0; // FNV-1a 32비트, 씨앗을 바꿔 4번 → 128비트
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).toUpperCase().padStart(8, '0');
  };
  const hex = part(1) + part(2) + part(3) + part(4);
  const v = '89AB'[parseInt(hex[16], 16) & 3];
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${v}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// 앱 요일(0=월 … 6=일) → Locale.Weekday rawValue
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
export function alarmKitWeekdays(days: number[]): string[] {
  return days.filter(d => Number.isInteger(d) && d >= 0 && d <= 6).map(d => WEEKDAYS[d]);
}
