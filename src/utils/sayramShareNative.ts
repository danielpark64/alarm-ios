// 세이람 자동 공유의 네이티브 연결(modules/alarmapp-share). Android는 ContentProvider, iOS는 App Group
// "group.com.danielpark.shared" 공유 폴더 — 두 플랫폼 모두 같은 함수 이름이다(iOS는 파일만 읽어 상대를 깨우지 않으므로
// pushToSibling은 늘 "same", pullToInbox는 공유 폴더 읽기). 계산은 sayramShare.ts(순수, 로직 테스트 대상)에 있고 여기는 쓰기·읽기만 한다.
//
// v3(2026-10-18, "시스템에 부하는 절대로 주면 안 돼"): 상대 앱을 깨우지 않는다.
//  - 열 때(시작·active)는 세이람이 넣어 준 파일(inbox)만 읽는다 — 세이람 프로세스를 부르지 않는다.
//  - 내 데이터는 바뀌었을 때만, 앱을 떠날 때(background) 세이람 창구에 넣어 준다(push). 같으면 안 넣는다.
//  - 직접 가져오기(query)는 받은 게 없을 때(처음)·세이람이 옛 버전일 때만, 실행당 한 번(needsPull).
//  형식·짝 구현: 세이람 저장소 docs/shift-share-protocol.md, docs/alarmapp-task-v3-no-wake.md, lib/siblingShare.ts
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Alarm, DayOverrides } from '../constants';
import { buildShiftShare, needsPull, parseShareConfig, parseSiblingEvents, shareEnabled, type SiblingEvents } from './sayramShare';

type Native = {
  writeOwn(name: string, json: string): void;
  readInbox(name: string): string | null;
  pushToSibling(authority: string, name: string): Promise<'same' | 'pushed' | 'fail'>;
  pullToInbox(authority: string, name: string): Promise<string | null>;
  isInstalled?(pkg: string): boolean;
};
const native = requireOptionalNativeModule<Native>('AlarmappShare');
const SAYRAM = 'com.danielpark.sayram.share';

/** 이 기기에서 자동 공유가 되는가(Android·iOS) */
export const siblingShareAvailable = !!native;

/** 세이람이 이 폰에 깔려 있는가 — 실행 때 한 번만 확인하고 기억한다(배너가 돌 때·앞으로 올 때마다 확인하지 않는다).
 *  새로 깔거나 지운 건 다음 실행 때 반영된다. 기기 안에서만 확인하고 어디로도 보내지 않는다. 모듈 없음·예외는 false(iOS는 mallo:// 열 수 있는지로 본다). */
let installedCache: boolean | null = null;
export function sayramInstalled(): boolean {
  if (installedCache !== null) return installedCache;
  try { installedCache = !!native?.isInstalled?.('com.danielpark.sayram'); } catch { installedCache = false; }
  return installedCache;
}

/**
 * 내 공유 데이터 갱신(이 폰 안 내 파일만 쓴다 — 세이람을 건드리지 않는다). 알람·하루 근무 변경·언어·스위치·날짜가
 * 바뀔 때와 앱 시작 때 부른다. 근무표는 스위치와 상관없이 둔다 — 보일지는 세이람이 양쪽 스위치를 보고 정한다.
 * 내용이 같으면(만든 시각 t만 다르면) 다시 쓰지 않는다. 세이람에 넣어 주는 건 떠날 때 pushOwnShare가 한다.
 */
let lastShare: boolean | null = null;
let lastShifts = '';
export function publishOwnShare(alarms: Alarm[], overrides: DayOverrides, shareOn: boolean) {
  if (!native) return;
  try {
    if (shareOn !== lastShare) {
      // push: 1 — "바뀔 때 넣어 주는 v3"라는 표시. 세이람이 이걸 보면 교대알람에서 직접 가져오지 않는다(깨우지 않는다)
      native.writeOwn('config', JSON.stringify({ share: shareOn, push: 1, t: Date.now() }));
      lastShare = shareOn;
    }
    const shifts = buildShiftShare(alarms, overrides, new Date());
    const body = shifts.replace(/,"t":\d+\}$/, '}');
    if (body === lastShifts) return;
    lastShifts = body;
    native.writeOwn('shifts', shifts);
  } catch (e) {
    console.warn('세이람 공유 데이터 쓰기 실패:', e);
  }
}

/**
 * 앱을 떠날 때(AppState background) 바뀐 것만 세이람에 넣어 준다. 설정(config)은 늘, 근무표(shifts)는 공유가 켜져 있을 때만.
 * 지난번에 넣어 준 내용과 같으면 네이티브가 "same"을 돌려주고 세이람을 건드리지 않는다.
 * 실패하면(세이람이 옛 버전이라 받는 창구가 없음) 이번 실행에는 다시 시도하지 않는다.
 */
let pushFailedThisRun = false;
export async function pushOwnShare(mine: boolean): Promise<void> {
  if (!native || !sayramInstalled() || pushFailedThisRun) return;
  try {
    if ((await native.pushToSibling(SAYRAM, 'config')) === 'fail') { pushFailedThisRun = true; return; }
    const cfg = parseShareConfig(native.readInbox('config'));
    if (shareEnabled(mine, cfg) && (await native.pushToSibling(SAYRAM, 'shifts')) === 'fail') pushFailedThisRun = true;
  } catch {
    pushFailedThisRun = true;
  }
}

/** 처음이거나 세이람이 옛 버전이면(needsPull) 실행당 한 번만 직접 가져와 inbox에 둔다 — 이때만 세이람이 깬다 */
let pulledThisRun = false;
async function pullIfNeeded() {
  if (!native) return;
  if (needsPull(native.readInbox('config'), pulledThisRun)) {
    pulledThisRun = true;
    await native.pullToInbox(SAYRAM, 'config');
    await native.pullToInbox(SAYRAM, 'events');
  }
}

/**
 * 세이람 일정 읽기 — 앱 시작과 앱이 앞으로 올 때만 부른다. 평소엔 받은 파일(inbox)만 읽어 가볍다.
 * 공유가 꺼져 있으면(양쪽 스위치 모두 꺼짐) 일정을 돌려주지 않는다(null) — 받아 둔 것도 지우라는 뜻이다.
 * raw는 직전과 같은지 비교하는 데 쓴다(같으면 달력을 다시 그리지 않게).
 */
export async function readSiblingEvents(mine: boolean): Promise<{ siblingOn: boolean; raw: string | null; events: SiblingEvents | null }> {
  const none = { siblingOn: false, raw: null, events: null };
  if (!native || !sayramInstalled()) return none;
  try {
    await pullIfNeeded();
    const siblingOn = !!parseShareConfig(native.readInbox('config'))?.share;
    if (!shareEnabled(mine, { share: siblingOn })) return { siblingOn, raw: null, events: null };
    const raw = native.readInbox('events');
    return { siblingOn, raw, events: parseSiblingEvents(raw) };
  } catch {
    return none;
  }
}
