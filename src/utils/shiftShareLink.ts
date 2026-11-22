// 근무표 공유(1.6.0, 2026-11-22) — 순수 계산만(저장·화면은 hooks/useShiftShare.tsx). 테스트: scripts/logic-tests/shift-share-link.test.js
// 보내기: 시스템 공유 창으로 안내 글 + https 링크 한 줄. 데이터는 링크의 # 뒤(서버로 전송되지 않음).
//   https://danielpark64.github.io/alarm-ios/s.html#v=1&i=<보낸 사람 id>&p=<encodeURIComponent(근무표 JSON)>
// 안내 페이지(docs/s.html)는 # 뒤를 그대로 붙여 1.6.0에서 새로 등록한 앱 주소로 연다:
//   alarmappshare://?v=1&i=…&p=…   (기존 alarmapp://를 쓰지 않는다 — 옛 버전이 열려 아무 일도 없게 되는 대신 스토어 안내로 가게)
// 근무표 형식(f·l·c·o·d·t)은 세이람 docs/shift-share-protocol.md "shifts"와 같다. 검사 함수 parseShiftBody·shiftOn·isNewerThan은
// 세이람 lib/shiftImport.ts에서 그대로 가져왔다(고칠 때는 두 앱을 함께).
// ⚠️ 받은 근무는 보기만 한다 — 알람 예약 경로(notifications/core.ts·rescheduleAll)에 절대 넣지 않는다(정적 체크).
import { Alarm, DayOverrides } from '../constants';
import { buildShiftTable } from './sayramShare';

export const SHARE_PAGE = 'https://danielpark64.github.io/alarm-ios/s.html';
export const SHARE_SCHEME = 'alarmappshare';
export const SHARE_DAYS = 215;       // 오늘부터 약 7개월 — 세이람 d 상한 800자 안
export const MAX_LINK = 4000;        // 이보다 긴 주소는 메신저가 자르거나 앱이 못 받는다 — 통째로 거부
export const MY_COLOR = '#A29BFE';   // 나 창·전체 창의 내 점(앱 강조색)
// 받은 사람 자동 색 — 내 색(보라)·비번 파랑·다 같이 쉬는 날 초록과 겹치지 않는 것들
export const AUTO_COLORS = ['#F0A35E', '#5EC8F0', '#F06E9C', '#E6D36A', '#9BE07A', '#C792EA', '#FF8A65', '#4DD0C8', '#B0BEC5', '#FFB3C7'];

export type ShiftData = {
  from: string; labels: string[]; colors: string[]; off: boolean[]; days: number[]; sentAt?: number;
};
export type SharedPerson = {
  id: string;          // 보낸 사람 id(링크 i) — 같은 사람이 다시 보내면 이걸로 알아본다
  name: string;        // 사용자가 지은 이름('' = 자동 이름 공유{seq})
  seq: number;         // 받은 순서(자동 이름 번호)
  color: string;       // '#RRGGBB'
  visible: boolean;    // 전체 창에 넣을지
  receivedAt: number;  // 받은 시각(ms)
  body: string;        // 근무표 JSON 원문(작게 — 이것만 저장한다)
};

const B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 보낼 근무표 JSON — 오늘부터 SHARE_DAYS일, 판정은 위젯·세이람 공유와 같은 buildShiftTable */
export function buildShareBody(alarms: Alarm[], overrides: DayOverrides, today: Date, now: number = Date.now()): string {
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return JSON.stringify({ ...buildShiftTable(alarms, overrides, from, SHARE_DAYS), t: now });
}

export function buildShareLink(body: string, senderId: string): string {
  return `${SHARE_PAGE}#v=1&i=${senderId}&p=${encodeURIComponent(body)}`;
}

/** 안내 페이지 주소 → 앱 주소(docs/s.html의 openApp과 같은 규칙) */
export function appLinkFromPage(pageUrl: string): string {
  const i = pageUrl.indexOf('#');
  return `${SHARE_SCHEME}://?${i >= 0 ? pageUrl.slice(i + 1) : ''}`;
}

export type ParseResult =
  | { ok: true; sender: string; data: ShiftData; body: string }
  | { ok: false; reason: 'notShare' | 'format' | 'version' | 'tooLong' | 'expired' };

/** 받은 주소 읽기 — 안내 페이지(https …s.html#…)와 앱 주소(alarmappshare://?…) 둘 다 */
export function parseShareLink(url: string, today: Date = new Date()): ParseResult {
  if (typeof url !== 'string') return { ok: false, reason: 'notShare' };
  let rest: string;
  if (url.startsWith(SHARE_PAGE + '#')) rest = url.slice(SHARE_PAGE.length + 1);
  else if (url.startsWith(SHARE_SCHEME + '://')) {
    const m = /^[^?#]*[?#](.*)$/.exec(url.slice(SHARE_SCHEME.length + 3));
    rest = m ? m[1] : '';
  } else return { ok: false, reason: 'notShare' };
  if (url.length > MAX_LINK) return { ok: false, reason: 'tooLong' };
  const q = new Map<string, string>();
  for (const part of rest.split(/[&#]/)) {
    const k = part.indexOf('=');
    if (k > 0) q.set(part.slice(0, k), part.slice(k + 1));
  }
  const v = q.get('v');
  if (v !== '1') return { ok: false, reason: v && /^\d+$/.test(v) && Number(v) > 1 ? 'version' : 'format' };
  const sender = q.get('i') ?? '';
  if (!/^[0-9a-z]{6,16}$/.test(sender)) return { ok: false, reason: 'format' };
  let body: string; let raw: any;
  try { body = decodeURIComponent(q.get('p') ?? ''); raw = JSON.parse(body); } catch { return { ok: false, reason: 'format' }; }
  const data = parseShiftBody(raw);
  if (!data || data.sentAt == null) return { ok: false, reason: 'format' };
  const [y, m, d] = data.from.split('-').map(Number);
  const last = new Date(y, m - 1, d + data.days.length - 1);
  if (last < new Date(today.getFullYear(), today.getMonth(), today.getDate())) return { ok: false, reason: 'expired' };
  return { ok: true, sender, data, body };
}

// ── 세이람 lib/shiftImport.ts에서 그대로 가져옴 ─────────────────────────────────
/** 근무표 본문(JSON 객체) 검사·변환. 하나라도 틀리면 null */
export function parseShiftBody(body: any): ShiftData | null {
  try {
    if (typeof body?.f !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.f)) return null;
    const [fy, fm, fd] = body.f.split('-').map(Number);
    const fdate = new Date(fy, fm - 1, fd);
    if (fdate.getFullYear() !== fy || fdate.getMonth() !== fm - 1 || fdate.getDate() !== fd) return null;
    const labels: string[] = Array.isArray(body.l) ? body.l.map((x: unknown) => String(x).slice(0, 12)) : [];
    const colors: string[] = Array.isArray(body.c) ? body.c.map((x: unknown) => (/^#[0-9a-fA-F]{6}$/.test(String(x)) ? String(x) : '#9AA0A6')) : [];
    const off: boolean[] = Array.isArray(body.o) ? body.o.map((x: unknown) => x === 1) : [];
    if (!labels.length || labels.length > 36 || typeof body.d !== 'string' || body.d.length > 800) return null;
    if (!/^[0-9a-z-]*$/.test(body.d)) return null;
    const days = [...body.d].map((ch: string) => (ch === '-' ? -1 : B36.indexOf(ch)));
    if (days.some((i) => i < -1 || i >= labels.length)) return null;
    const sentAt = typeof body.t === 'number' && Number.isFinite(body.t) ? body.t : undefined;
    return {
      from: body.f, labels,
      colors: colors.slice(0, labels.length), off: off.slice(0, labels.length),
      days, ...(sentAt != null ? { sentAt } : {}),
    };
  } catch {
    return null;
  }
}

/** 그 날의 근무(없으면 null) */
export function shiftOn(data: ShiftData | null, date: Date): { label: string; color: string; off: boolean } | null {
  if (!data) return null;
  const [y, mo, d] = data.from.split('-').map(Number);
  const start = new Date(y, mo - 1, d);
  const idx = Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - start.getTime()) / 86_400_000);
  if (idx < 0 || idx >= data.days.length) return null;
  const i = data.days[idx];
  if (i < 0) return null;
  return { label: data.labels[i], color: data.colors[i] ?? '#9AA0A6', off: !!data.off[i] };
}

/** 받은 근무표가 저장된 것보다 새것인가(보낸 시각 t 기준) */
export function isNewerThan(incoming: ShiftData, stored: ShiftData | null): boolean {
  if (!stored || stored.sentAt == null || incoming.sentAt == null) return true;
  return incoming.sentAt > stored.sentAt;
}
// ───────────────────────────────────────────────────────────────────────────────

export function dataOf(p: SharedPerson): ShiftData | null {
  try { return parseShiftBody(JSON.parse(p.body)); } catch { return null; }
}

/** 'YYYY-MM-DD' 날짜의 상태 — 근무 'work' · 쉬는 날 'off' · 근무표 없음 null */
export function dayStatus(data: ShiftData | null, ds: string): 'work' | 'off' | null {
  const [y, m, d] = ds.split('-').map(Number);
  const s = shiftOn(data, new Date(y, m - 1, d));
  return s ? (s.off ? 'off' : 'work') : null;
}

/** 다 같이 쉬는 날 — 고른 사람(2명 이상)이 모두 쉬는 날. 근무표가 없는 사람이 끼면 아니다 */
export function isTogetherOff(statuses: ('work' | 'off' | null)[]): boolean {
  return statuses.length >= 2 && statuses.every((s) => s === 'off');
}

/** 받은 링크를 어떻게 할까 — 처음(new) · 더 새것(update, "새것으로 바꿀까요?") · 같거나 옛것(same) · 내 링크(self) */
export function decideIncoming(people: SharedPerson[], sender: string, sentAt: number, myId?: string):
  { kind: 'new' } | { kind: 'update'; person: SharedPerson } | { kind: 'same'; person: SharedPerson } | { kind: 'self' } {
  if (myId && sender === myId) return { kind: 'self' };
  const p = people.find((x) => x.id === sender);
  if (!p) return { kind: 'new' };
  return isNewerThan({ sentAt } as ShiftData, dataOf(p)) ? { kind: 'update', person: p } : { kind: 'same', person: p };
}

/** 자동 색 — 이미 쓰는 색과 겹치지 않는 첫 색, 다 쓰면 가장 적게 쓴 색 */
export function pickAutoColor(used: string[]): string {
  const n = new Map<string, number>();
  for (const c of used) n.set(c.toUpperCase(), (n.get(c.toUpperCase()) ?? 0) + 1);
  let best = AUTO_COLORS[0]; let bestN = Infinity;
  for (const c of AUTO_COLORS) {
    const k = n.get(c) ?? 0;
    if (k < bestN) { best = c; bestN = k; }
  }
  return best;
}

/** 자동 이름 번호(공유1·공유2…) — 받은 순서대로 */
export function nextSeq(people: { seq: number }[]): number {
  return people.reduce((m, p) => Math.max(m, p.seq || 0), 0) + 1;
}

/** 칸의 색 점 — 4개까지 + 나머지 숫자 */
export function dotsFor<T>(items: T[], max = 4): { dots: T[]; more: number } {
  return { dots: items.slice(0, max), more: Math.max(0, items.length - max) };
}

/** 이 설치의 보낸 사람 id(8자) — 처음 보낼 때 한 번 만들어 저장한다 */
export function newSenderId(rand: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += B36[Math.floor(rand() * 36) % 36];
  return s;
}

export const todayYmd = (d: Date = new Date()) => ymd(d);
