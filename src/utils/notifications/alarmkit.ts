// iOS 26+ AlarmKit 연결(modules/alarmapp-alarmkit) — 경로 결정은 ../alarmkitRoute.ts(순수), 여기는 네이티브 호출만.
//
// 원장: 네이티브가 "AlarmKit 예약 UUID → 알람 id"를 UserDefaults에 적어 둔다(Android AlarmStore와 같은 역할).
// 개별 취소(cancelAlarmKitFor)는 원장에서 그 알람 id의 UUID를 전부 찾아 지우고, 전체 정리(cancelAllAlarmKit)는
// 원장 + AlarmKit이 알고 있는 이 앱의 예약 전부를 지운다 — 목록에서 사라진(삭제된) 알람 id도 함께 지워진다.
//
// ⚠️ 모든 예약·취소는 serial() 직렬 큐로만 보낸다. rescheduleAll이 겹쳐 돌면 앞 호출의 늦게 끝난 schedule이
// 뒤 호출의 cancelAll보다 나중에 처리돼 꺼진 알람이 AlarmKit에 남을 수 있다 — JS 호출 순서대로 처리하면 막힌다.
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { alarmKitEnabled, shouldAskAlarmKit, alarmKitUuid, alarmKitSound, alarmKitWeekdays, type AlarmKitAuth, type AlarmKitEnv } from '../alarmkitRoute';
import { SNOOZE_MIN, toneIosFile, type SoundMode } from '../../constants';
import { snoozeLabel } from '../ringCard';
import { t } from '../../i18n/translate';

type ScheduleOptions = {
  id: string; alarmId: number;
  fireMs: number;          // 날짜 예약(.fixed) — weekdays가 비어 있을 때
  hour: number; minute: number; weekdays: string[]; // 요일 반복(.relative weekly)
  title: string; stopText: string; snoozeText: string; snoozeMin: number;
  silent: boolean;         // 개발 테스트 전용(무음 파일) — 사용자 알람은 항상 false
  sound: string;           // 앱 번들 소리 파일 이름 — 소리 알람은 고른 소리, 진동만은 silent_30s.wav(alarmKitSound)
};
type Native = {
  isAvailable(): boolean;
  authorizationState(): AlarmKitAuth;
  requestAuthorization(): Promise<AlarmKitAuth>;
  schedule(o: ScheduleOptions): Promise<boolean>;
  cancelForAlarm(alarmId: number): Promise<number>;
  cancelAll(keepActiveIds: number[]): Promise<number>;
  listScheduled(): Promise<AlarmKitListItem[]>;
  previewSound?(name: string, ms: number): void;
  stopPreview?(): void;
};

// when: 날짜 예약이면 원래 울릴 시각(ms), 요일 반복이면 "weekly HH:MM"(Swift listScheduled)
export type AlarmKitListItem = { id: string; alarmId: number; state: string; when?: number | string | null };

const native = Platform.OS === 'ios' ? requireOptionalNativeModule<Native>('AlarmappAlarmKit') : null;

let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const p = queue.then(fn, fn);
  queue = p.catch(() => {});
  return p;
}

export function alarmKitEnv(): AlarmKitEnv {
  const available = !!native && native.isAvailable();
  let auth: AlarmKitAuth = 'unavailable';
  if (available) { try { auth = native!.authorizationState(); } catch {} }
  return { os: Platform.OS, available, auth };
}

// 현재 방식 — rescheduleAll이 시작할 때마다 refreshAlarmKitMode로 갱신한다(설정 앱에서 권한을 바꾸거나 iOS를 올려도
// 다음 재예약부터 따라간다). core.ts의 예약 분기가 이 값을 읽는다.
let enabled = false;
export function isAlarmKitMode(): boolean { return enabled; }
export async function refreshAlarmKitMode(): Promise<boolean> {
  enabled = alarmKitEnabled(alarmKitEnv());
  return enabled;
}

// iOS 26+에서 아직 안 물었으면 한 번 묻는다. 반환: 이번에 방식이 바뀌었는지(→ 호출한 쪽이 재예약).
export async function requestAlarmKitIfNeeded(): Promise<boolean> {
  if (!native || !shouldAskAlarmKit(alarmKitEnv())) return false;
  try { await native.requestAuthorization(); } catch {}
  return alarmKitEnabled(alarmKitEnv()) !== enabled;
}

// 울림 화면 버튼 — 문구·간격은 세이람과 같다(1.6.4): [알람 끄기] · [5분 후 다시](SNOOZE_MIN분 카운트다운 뒤 시스템이 다시 울림).
// iOS 전용 값이라 SNOOZE_ENABLED(Android 알림·워치 스누즈, Doze 때문에 꺼 둠)와 떼어 둔다. 카운트다운 중 일정이 바뀌면
// rescheduleAll이 snoozeCheck.alarmKitKeepIds로 판정해 cancelAllAlarmKit에서 지운다.
function buttons() {
  const snoozeMin = Platform.OS === 'ios' ? SNOOZE_MIN : 0;
  return { stopText: t('알람 끄기'), snoozeText: snoozeLabel(), snoozeMin };
}

// 날짜 하나에 한 번 — key는 근무일(YYYY-MM-DD). 반환 false면 예약 실패(한도 초과 등).
// title에 앱 이름("교대알람 · ")을 붙이지 않는다(1.6.2 결정) — AlarmKit 울림 화면은 시스템이 앱 이름을 함께 보여 준다
// (WWDC25 "Wake up to the AlarmKit API": 알림에 "the custom alarm title, as well as the name of your app"이 나온다).
// 붙이면 이름이 두 번 나오고 근무 이름(가장 중요한 글자)이 밀린다. title은 core.ts가 만든 근무 이름/알람 이름 그대로.
// snd: 알람의 소리 설정 — 'none'(진동만)이면 완전 무음 30초 파일로 울려 진동만 온다(alarmkitRoute.ts usesAlarmKit 주석).
export function scheduleAlarmKitDate(alarmId: number, key: string, fire: Date, title: string, tone: unknown, snd: SoundMode): Promise<boolean> {
  if (!native) return Promise.resolve(false);
  const o: ScheduleOptions = { id: alarmKitUuid(alarmId, key), alarmId, fireMs: fire.getTime(), hour: 0, minute: 0, weekdays: [], title, ...buttons(), silent: false, sound: alarmKitSound({ snd }, toneIosFile(tone)) };
  return serial(() => native.schedule(o)).catch(() => false);
}

// 요일 반복 — 끝없이 반복되므로 14일 창이 필요 없다(Expo WEEKLY 경로와 같은 조건일 때만 쓴다).
export function scheduleAlarmKitWeekly(alarmId: number, days: number[], hour: number, minute: number, title: string, tone: unknown, snd: SoundMode): Promise<boolean> {
  if (!native) return Promise.resolve(false);
  const o: ScheduleOptions = { id: alarmKitUuid(alarmId, 'weekly'), alarmId, fireMs: 0, hour, minute, weekdays: alarmKitWeekdays(days), title, ...buttons(), silent: false, sound: alarmKitSound({ snd }, toneIosFile(tone)) };
  return serial(() => native.schedule(o)).catch(() => false);
}

export function cancelAlarmKitFor(alarmId: number): Promise<number> {
  if (!native || !native.isAvailable()) return Promise.resolve(0);
  return serial(() => native.cancelForAlarm(alarmId)).catch(() => 0);
}

// keepActiveIds: 지금 울리는 중·다시 울림 대기 중인 예약 가운데 이 알람 id들(여전히 켜져 있는 알람)의 것은 남긴다 —
// 울리는 도중 앱을 열어 재예약이 돌아도 울림·다시 울림이 끊기지 않게. 꺼졌거나 삭제된 알람의 것은 상태와 무관하게 지운다.
export function cancelAllAlarmKit(keepActiveIds: number[] = []): Promise<number> {
  if (!native || !native.isAvailable()) return Promise.resolve(0);
  return serial(() => native.cancelAll(keepActiveIds)).catch(() => 0);
}

export function listAlarmKit(): Promise<AlarmKitListItem[]> {
  if (!native || !native.isAvailable()) return Promise.resolve([]);
  return serial(() => native.listScheduled()).catch(() => []);
}

// 개발 딥링크(akTest) 전용 — 앱 알람 목록과 무관한 무음 테스트 알람(alarmId -1). 울림 화면 확인용.
// snd(11-28 진동 시험): 'quiet'=거의 안 들리는 30초(quiet_30s.wav), 'long0'=완전 무음 30초(silent_30s.wav).
// 0.5초 무음(silent_short.wav)은 화면이 꺼진 폰에서 진동이 안 왔다(11-28 사용자 폰) — 길이·소리 유무로 진동이 오는지 가린다.
export function scheduleAlarmKitTest(minutes: number, snd?: string): Promise<boolean> {
  if (!native) return Promise.resolve(false);
  const fire = new Date(Date.now() + minutes * 60_000);
  const o: ScheduleOptions = { id: alarmKitUuid(-1, String(fire.getTime())), alarmId: -1, fireMs: fire.getTime(), hour: 0, minute: 0, weekdays: [], title: '⏰ AlarmKit 테스트', ...buttons(),
    ...(snd === 'quiet' ? { silent: false, sound: 'quiet_30s.wav' } : snd === 'long0' ? { silent: false, sound: 'silent_30s.wav' } : { silent: true, sound: toneIosFile('default') }) };
  return serial(() => native.schedule(o)).catch(() => false);
}

// 알람 소리 미리듣기(iOS) — 번들 파일을 미디어 음량으로 ms만큼만 재생. 실제 알람 경로와 무관.
export function previewIosSound(name: string, ms: number) { try { native?.previewSound?.(name, ms); } catch {} }
export function stopIosPreview() { try { native?.stopPreview?.(); } catch {} }
