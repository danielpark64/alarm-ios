// 알람 소리 고르기(2026-11-23) — 알람마다 소리 하나. ⚠️ 소리 파일 이름은 이 파일에서만 정한다
// (정적 체크 ⑦: 다른 곳에 'alarm_long.wav'를 박으면 그 경로만 고른 소리를 무시하고 기본음으로 울린다).
// Android 네이티브 쪽 같은 표는 android/.../AlarmTones.kt — id를 바꾸면 두 곳을 함께 고친다.
//
// 순수 모듈 — React Native import 금지(scripts/logic-tests가 node에서 돈다).
// 기존 알람은 tone이 없다 → 'default'(지금까지의 alarm_long) 그대로 울린다.
import { N } from '../i18n/lang';

export type ToneId = 'default' | 'beep' | 'chime' | 'oldclock' | 'marimba' | 'piano' | 'musicbox';

// ios: 앱 번들 파일(app.json expo-notifications sounds) — iOS 알림 소리는 30초 이하 wav/caf/aiff여야 한다.
// android: res/raw 리소스 이름(네이티브 AlarmService가 반복 재생). 원본은 CC0(freesound), 29초로 자르고 끝을 짧게 줄였다.
export const ALARM_TONES: { id: ToneId; label: string; ios: string; android: string }[] = [
  { id: 'default',  label: N('기본'),        ios: 'alarm_long.wav',    android: 'alarm_long' },
  { id: 'beep',     label: N('디지털 비프'), ios: 'tone_beep.caf',     android: 'snd_beep' },
  { id: 'chime',    label: N('종소리 행진'), ios: 'tone_chime.caf',    android: 'snd_chime' },
  { id: 'oldclock', label: N('옛날 자명종'), ios: 'tone_oldclock.caf', android: 'snd_oldclock' },
  { id: 'marimba',  label: N('마림바'),      ios: 'tone_marimba.caf',  android: 'snd_marimba' },
  { id: 'piano',    label: N('잔잔한 피아노'), ios: 'tone_piano.caf',  android: 'snd_piano' },
  { id: 'musicbox', label: N('오르골 왈츠'), ios: 'tone_musicbox.caf', android: 'snd_musicbox' },
];

// 진동만 알림에 붙이는 iOS 무음 파일 — iOS는 소리 없는 알림엔 진동도 하지 않는다(core.ts notifSound 주석).
export const SILENT_IOS_SOUND = 'silent_short.wav';
// Android Expo 알림의 sound 문자열 — Android 8+는 채널이 소리를 정하고 실제 울림은 네이티브 AlarmService라
// 이 값은 예전 그대로 둔다(고른 소리는 네이티브 예약 데이터로 따로 간다).
const ANDROID_EXPO_SOUND = 'alarm_long.wav';

// 점점 크게 울리기(Android 전용) — 11-23 UI 토글은 뺐다(항상 꺼짐). 네이티브 경로는 남겨 둠. 켜면 네이티브가 아주 작게 시작해 이 시간 동안 설정 음량까지 키운다.
export const CRESCENDO_MS = 20000;
// 미리듣기 길이
export const TONE_PREVIEW_MS = 3000;

function find(id: unknown) {
  return ALARM_TONES.find(x => x.id === id);
}

// 알 수 없는 id(옛 버전·깨진 데이터·지운 소리)는 기본으로 — 소리가 안 나는 것보다 기본음이 낫다.
export function normalizeTone(id: unknown): ToneId {
  return find(id)?.id ?? 'default';
}
export function toneLabel(id: unknown): string {
  return (find(id) ?? ALARM_TONES[0]).label;
}
export function toneIosFile(id: unknown): string {
  return (find(id) ?? ALARM_TONES[0]).ios;
}
export function toneAndroidRes(id: unknown): string {
  return (find(id) ?? ALARM_TONES[0]).android;
}

// 알림 content.sound — soundOn=false(진동만)면 iOS는 무음 파일(진동이 오게), Android는 없음.
// dev: 개발 빌드는 번들 소리 대신 시스템 기본음(true) — 예전 동작 그대로.
export function notifSoundFor(os: string, soundOn: boolean, tone: unknown, dev = false): string | boolean | undefined {
  if (soundOn) {
    if (dev) return true;
    return os === 'ios' ? toneIosFile(tone) : ANDROID_EXPO_SOUND;
  }
  return os === 'ios' ? SILENT_IOS_SOUND : undefined;
}

// 같은 시각 묶음 보조 알림의 소리 — 소리를 켠 첫 알람의 소리(없으면 기본).
export function groupTone(alarms: { snd?: string; tone?: unknown }[]): ToneId {
  return normalizeTone(alarms.find(a => a.snd === 'default')?.tone);
}

export function crescendoOn(a?: { crescendo?: boolean } | null): boolean {
  return a?.crescendo === true;
}
