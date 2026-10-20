// 세이람과 자동 공유(v2) — 순수 계산만 둔다(네이티브 연결은 sayramShareNative.ts). 형식은 세이람 저장소
// docs/shift-share-protocol.md: 교대알람 근무 → 세이람 달력 칸, 세이람 일정 → 교대알람 달력. 인터넷은 쓰지 않고
// 서로 읽기만 한다. 알람은 각자 자기 것만 울린다(세이람 일정으로 교대알람 알람을 만들지 않는다).
import { Alarm, DayOverrides, SHIFTS } from '../constants';
import { pad, shiftForDate, isOffDay, shiftColorMap, dayOverrideDisplay, effectiveShift } from './index';
import { t } from '../i18n/translate';

const B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
const DAYS = 215;          // 앞 31일 + 오늘부터 약 183일 — 세이람 상한 800자보다 넉넉히 짧게
const MAX_KINDS = 36;      // 한 글자(36진수)로 쓸 수 있는 근무 종류 수
const OFF_COLOR = '#9AA0A6';
const FALLBACK_COLOR = '#A29BFE';

const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hex6 = (c: string | undefined) => (c && /^#[0-9A-Fa-f]{6}$/.test(c) ? c.toUpperCase() : FALLBACK_COLOR);

/** 그날 세이람 칸에 보낼 이름 — 달력 배지와 같은 규칙. 세이람 칸이 좁아 "초번 출근" 같은 알람 이름이 아니라 근무조 이름만 */
function shiftNameFor(a: Alarm, ds: string): string {
  const r = effectiveShift(a, ds);
  if (r?.shift === 'custom') return r.shiftCustom?.trim() || t('근무');
  if (r && r.shift !== 'none') return t(SHIFTS.find(s => s.id === r.shift)!.label);
  return t('근무'); // 근무조를 안 정한 교대 알람(N일 주기 등) — 알람 이름 대신 "근무"
}

/**
 * 세이람에 보낼 근무표. 판정 순서는 위젯(widgetSync weekSchedule)·달력과 같다 — 하루 근무 변경이 먼저,
 * 없으면 shiftForDate/isOffDay. 평소 쉬는 날도 "비번"으로 보낸다(위젯은 쉬는 날 라벨이 ''라 그대로 쓰면 비번이 빠진다).
 */
export function buildShiftShare(alarms: Alarm[], overrides: DayOverrides, today: Date): string {
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 31);
  const colorOf = shiftColorMap(alarms);
  const keyOf = new Map<string, number>();
  const l: string[] = []; const c: string[] = []; const o: number[] = [];
  let d = '';
  for (let i = 0; i < DAYS; i++) {
    const ds = ymd(new Date(from.getFullYear(), from.getMonth(), from.getDate() + i));
    const ov = dayOverrideDisplay(overrides[ds]);
    const shift = ov ? null : shiftForDate(alarms, ds);
    const off = ov ? ov.isOff : isOffDay(alarms, ds);
    let label = ov ? t(ov.label) : (shift ? shiftNameFor(shift, ds) : '');
    if (!label && off) label = t('비번');
    if (!label) { d += '-'; continue; }
    const r = shift ? effectiveShift(shift, ds) : null;
    const color = ov?.shift ? hex6(SHIFTS.find(s => s.id === ov.shift)?.color)
      : ov ? (off ? OFF_COLOR : FALLBACK_COLOR)
      : shift ? hex6(r && r.shift !== 'none' ? SHIFTS.find(s => s.id === r.shift)?.color : colorOf[shift.id])
      : OFF_COLOR;
    const name = label.slice(0, 12);
    const key = `${name}|${color}|${off ? 1 : 0}`;
    if (!keyOf.has(key)) {
      if (l.length >= MAX_KINDS) { d += '-'; continue; }
      keyOf.set(key, l.length); l.push(name); c.push(color); o.push(off ? 1 : 0);
    }
    d += B36[keyOf.get(key)!];
  }
  return JSON.stringify({ f: ymd(from), l, c, o, d, t: Date.now() });
}

// push: 1 = 바뀔 때 넣어 주는 v3 앱 — 이 표시가 있으면 상대에게서 직접 가져오지 않는다(상대 앱을 깨우지 않게)
export type ShareConfig = { share: boolean; push?: number; t?: number };

/** 한쪽 앱 설정만 켜도 공유한다 */
export function shareEnabled(mine: boolean, sibling: ShareConfig | null | undefined): boolean {
  return mine || !!sibling?.share;
}

export function parseShareConfig(raw: string | null | undefined): ShareConfig | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && typeof v.share === 'boolean'
      ? { share: v.share, push: v.push === 1 ? 1 : undefined, t: typeof v.t === 'number' ? v.t : undefined } : null;
  } catch { return null; }
}

/**
 * 세이람 창구에서 직접 가져와야 하는가(v3). 평소엔 세이람이 바뀔 때 넣어 준 파일(inbox)만 읽는다 — 직접 가져오면(query)
 * 꺼져 있던 세이람 프로세스가 깨어나기 때문. 가져오는 건 받은 게 아직 없을 때(처음)와 세이람이 옛 버전(push 표시 없음)일 때만,
 * 그것도 실행당 한 번(pulledThisRun).
 */
export function needsPull(inboxConfigRaw: string | null | undefined, pulledThisRun: boolean): boolean {
  if (pulledThisRun) return false;
  if (!inboxConfigRaw) return true;
  try { return JSON.parse(inboxConfigRaw)?.push !== 1; } catch { return true; }
}

/** 교대알람 달력에 그릴 세이람 일정 — 날짜별. time은 "HH:MM"(시각 있는 일정만) */
export type SiblingEvent = { name: string; time?: string };
export type SiblingEvents = Record<string, SiblingEvent[]>;

const MAX_EVENTS = 1000;
const MAX_SPAN = 366;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
function realDate(s: unknown): Date | null {
  if (typeof s !== 'string') return null;
  const m = DATE_RE.exec(s);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
}

/** 세이람 events 창구 내용을 날짜별로 편다. 형식이 통째로 다르면 null, 항목 하나가 틀리면 그 항목만 버린다 */
export function parseSiblingEvents(raw: string | null | undefined): SiblingEvents | null {
  if (!raw) return null;
  let v: any;
  try { v = JSON.parse(raw); } catch { return null; }
  if (!v || typeof v !== 'object' || !Array.isArray(v.e)) return null;
  const out: SiblingEvents = {};
  for (const item of v.e.slice(0, MAX_EVENTS)) {
    if (!item || typeof item !== 'object') continue;
    const start = realDate(item.d);
    if (!start) continue;
    const end = item.e != null ? realDate(item.e) : null;
    const name = (typeof item.n === 'string' ? item.n.split('\n')[0].trim().slice(0, 30) : '') || '•';
    const h = item.h;
    const time = end == null && Number.isInteger(h) && h >= 0 && h < 1440 ? `${pad(Math.floor(h / 60))}:${pad(h % 60)}` : undefined;
    const span = end && end >= start ? Math.min(MAX_SPAN, Math.round((end.getTime() - start.getTime()) / 86400000) + 1) : 1;
    for (let i = 0; i < span; i++) {
      const ds = ymd(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
      (out[ds] ??= []).push(time ? { name, time } : { name });
    }
  }
  // 하루 안에서는 시각 있는 것을 시각순으로 앞에, 하루 종일·기간 일정은 뒤에
  for (const list of Object.values(out)) list.sort((a, b) => (a.time ?? '99') < (b.time ?? '99') ? -1 : (a.time ?? '99') > (b.time ?? '99') ? 1 : 0);
  return out;
}
