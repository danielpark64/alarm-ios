// 세이람 자동 공유(v2)의 네이티브 연결 — Android만(modules/alarmapp-share). iOS는 App Group이 생기면(유료 개발자
// 계정) 같은 함수 이름으로 붙인다. 계산은 sayramShare.ts(순수, 로직 테스트 대상)에 있고 여기는 쓰기·읽기만 한다.
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Alarm, DayOverrides } from '../constants';
import { buildShiftShare, parseShareConfig, parseSiblingEvents, shareEnabled, type SiblingEvents } from './sayramShare';

type Native = { writeOwn(name: string, json: string): void; readSibling(authority: string, name: string): Promise<string | null> };
const native = requireOptionalNativeModule<Native>('AlarmappShare');
const SAYRAM = 'com.danielpark.sayram.share';

/** 이 기기에서 자동 공유가 되는가(지금은 Android만) */
export const siblingShareAvailable = !!native;

/**
 * 내 공유 데이터 갱신 — 알람·하루 근무 변경·언어·스위치가 바뀔 때와 앱 시작 때 부른다.
 * 근무표는 스위치와 상관없이 창구에 둔다(세이람과 같은 방식) — 보일지는 세이람이 양쪽 스위치를 보고 정한다.
 * 내용이 같으면(만든 시각 t만 다르면) 다시 쓰지 않는다.
 */
let lastShare: boolean | null = null;
let lastShifts = '';
export function publishOwnShare(alarms: Alarm[], overrides: DayOverrides, shareOn: boolean) {
  if (!native) return;
  try {
    if (shareOn !== lastShare) {
      native.writeOwn('config', JSON.stringify({ share: shareOn, t: Date.now() }));
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

/** 세이람 쪽 공유 스위치(세이람이 없거나 막히면 false) */
export async function readSiblingShareOn(): Promise<boolean> {
  if (!native) return false;
  try { return !!parseShareConfig(await native.readSibling(SAYRAM, 'config'))?.share; } catch { return false; }
}

/**
 * 세이람 일정 읽기 — 앱 시작과 앱이 앞으로 올 때만 부른다(주기적으로 읽지 않는다).
 * 공유가 꺼져 있으면(양쪽 스위치 모두 꺼짐) 일정을 읽지 않고 null — 받아 둔 것도 지우라는 뜻이다.
 * raw는 직전과 같은지 비교하는 데 쓴다(같으면 달력을 다시 그리지 않게).
 */
export async function readSiblingEvents(mine: boolean): Promise<{ siblingOn: boolean; raw: string | null; events: SiblingEvents | null }> {
  if (!native) return { siblingOn: false, raw: null, events: null };
  const siblingOn = await readSiblingShareOn();
  if (!shareEnabled(mine, { share: siblingOn })) return { siblingOn, raw: null, events: null };
  try {
    const raw = await native.readSibling(SAYRAM, 'events');
    return { siblingOn, raw, events: parseSiblingEvents(raw) };
  } catch {
    return { siblingOn, raw: null, events: null };
  }
}
