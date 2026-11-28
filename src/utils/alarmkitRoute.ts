// iOS 26+ AlarmKit 경로 결정 — 순수 함수만(React Native·네이티브 import 금지, scripts/logic-tests/alarmkit.test.js가 node에서 돈다).
//
// 방식은 자동 전환이다(설정 항목 없음, 2026-11-21 사용자 결정):
//   iOS 26 이상 + AlarmKit 권한 허용  → 모든 알람(소리·진동만)이 AlarmKit만(무음·집중 모드를 뚫고 시계 앱처럼 울림)
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

// 진동만 알람도 AlarmKit으로 보낸다(2026-11-28, 사용자 폰 iPhone 17 Pro Max에서 확인).
// 예전엔 진동만을 Expo 알림 + silent_short.wav + 보조 알림 묶음으로 남겼는데, 일반 알림이라 iOS가 다른 기기로 넘긴다 —
// 맥의 "iPhone 알림"이 켜져 있으면 맥에만 뜨고 폰은 진동하지 않았고(재현·확정), 워치를 차면 워치만 진동했다.
// AlarmKit에 완전 무음 30초 파일(silent_30s.wav, alarmKitSound)을 소리로 주면 잠금 상태 폰이 진동하고, 잠금 화면에
// 알람 UI(끄기·5분 후, 암호 없이)가 뜨고, 맥에는 안 뜬다. 0.5초 무음(silent_short.wav)은 꺼진 화면에서 진동이 없었다.
// snd·vib 값은 판정에 쓰지 않는다 — 폼은 '소리+진동 / 소리만 / 진동만' 셋뿐이라 둘 다 끈 알람은 만들 수 없다.
// (예전 데이터에 snd·vib 둘 다 'none'이 있어도 Expo 경로 역시 무음 파일을 붙여 진동했으므로 동작은 같다.)
export function usesAlarmKit(_alarm: Pick<Alarm, 'snd'>, enabled: boolean): boolean {
  return enabled;
}

// AlarmKit 소리 파일 — 소리 알람은 고른 소리(toneFile), 진동만은 완전 무음 30초. ⚠️ AlarmKit의 진동은 시스템 기본
// 패턴이라 앱의 진동 설정(vib)은 반영되지 않는다. 파일은 app.json expo-notifications sounds로 앱 번들에 들어간다.
export const ALARMKIT_VIBRATE_ONLY_SOUND = 'silent_30s.wav';
export function alarmKitSound(alarm: Pick<Alarm, 'snd'>, toneFile: string): string {
  return alarm.snd === 'default' ? toneFile : ALARMKIT_VIBRATE_ONLY_SOUND;
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
