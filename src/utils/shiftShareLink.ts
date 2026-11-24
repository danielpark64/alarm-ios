// 근무표 공유(1.6.0, 2026-11-22) — 순수 계산만(저장·화면은 hooks/useShiftShare.tsx). 테스트: scripts/logic-tests/shift-share-link.test.js
// 보내기: 시스템 공유 창으로 요약 글 + https 링크(세이람 보내기 글과 같은 모양). 데이터는 링크의 # 뒤(서버로 전송되지 않음).
//   v2(빌드 10~): https://danielpark64.github.io/alarm-ios/s/#v2.<base64url(UTF-8 JSON)> — 짧고, 안내 페이지에 미리보기 카드(og)
//   v1(처음 보낸 링크, 계속 읽는다): https://danielpark64.github.io/alarm-ios/s.html#v=1&i=<보낸 사람 id>&p=<encodeURIComponent(근무표 JSON)>
// 안내 페이지(docs/s/index.html·docs/s.html)는 # 뒤를 그대로 붙여 1.6.0에서 새로 등록한 앱 주소로 연다:
//   alarmappshare://?v2.…  /  alarmappshare://?v=1&i=…&p=…   (기존 alarmapp://를 쓰지 않는다 — 옛 버전이 열려 아무 일도 없게 되는 대신 스토어 안내로 가게)
// 근무표 형식(f·l·c·o·d·t)은 세이람 docs/shift-share-protocol.md "shifts"와 같다. 검사 함수 parseShiftBody·shiftOn·isNewerThan은
// 세이람 lib/shiftImport.ts에서 그대로 가져왔다(고칠 때는 두 앱을 함께).
// ⚠️ 받은 근무는 보기만 한다 — 알람 예약 경로(notifications/core.ts·rescheduleAll)에 절대 넣지 않는다(정적 체크).
import { Alarm, DayOverrides } from '../constants';
import { MONTH_KEYS, DAYS } from '../constants';
import { buildShiftTable } from './sayramShare';
import { t } from '../i18n/translate';

export const SHARE_PAGE = 'https://danielpark64.github.io/alarm-ios/s/';      // v2 링크
export const SHARE_PAGE_V1 = 'https://danielpark64.github.io/alarm-ios/s.html'; // v1 링크(이미 보낸 것 — 계속 읽는다)
export const SHARE_SCHEME = 'alarmappshare';
export const SHARE_DAYS = 215;       // 오늘부터 약 7개월 — 세이람 d 상한 800자 안
export const MAX_LINK = 4000;        // 이보다 긴 주소는 메신저가 자르거나 앱이 못 받는다 — 통째로 거부
export const MY_COLOR = '#A29BFE';
export const SENDER_NAME_MAX = 20;   // 보낸 사람 이름(v2 배열 8번째 칸, 1.6.1~) 최대 글자 수(코드 포인트)
// 새 형식 안내 [업데이트] — 플랫폼별 스토어(Android는 market:// 실패 시 웹)
export const STORE_IOS = 'https://apps.apple.com/app/id6825757463';
export const STORE_ANDROID = 'market://details?id=com.danielpark.alarmapp';
export const STORE_ANDROID_WEB = 'https://play.google.com/store/apps/details?id=com.danielpark.alarmapp';   // 나 창·전체 창의 내 점(앱 강조색)
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

/** v1 링크(이미 보낸 링크 형식 — 테스트·하위호환 확인용으로만 만든다) */
export function buildShareLinkV1(body: string, senderId: string): string {
  return `${SHARE_PAGE_V1}#v=1&i=${senderId}&p=${encodeURIComponent(body)}`;
}

/** 보낸 사람 이름 정리 — 보낼 때·받을 때 같은 규칙(안내 페이지 docs/s/index.html의 cleanName도 같게).
 *  제어문자·줄바꿈 → 공백, 글자 방향을 뒤집는 문자·폭 없는 문자 제거, 공백 한 칸으로, 앞뒤 자르기, 최대 SENDER_NAME_MAX자. */
export function cleanSenderName(v: unknown): string {
  if (typeof v !== 'string') return '';
  const s = v.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
    .replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  return [...s].slice(0, SENDER_NAME_MAX).join('').trim();
}

/** v2 링크 — #v2.<base64url(JSON 배열)>. 자리로 구분해 키 이름을 뺐다:
 *  [보낸 사람 id, 시작일 YYYYMMDD, 라벨[], 색(6자리 16진수 이어 붙임), 쉬는 날(0/1 이어 붙임), 보낸 시각(ms, 36진법), 칸, (이름)]
 *  칸 = 그대로 문자열(d) 또는 [주기 q, 길이 n, 어긋난 날 x](packDays)
 *  이름(8번째, 1.6.1~)은 있을 때만 넣는다 — 1.6.0 앱은 앞 7칸만 읽으므로(length < 7만 거부) 그대로 받는다. */
export function buildShareLink(body: string, senderId: string, name?: string): string {
  const b = JSON.parse(body);
  const pk = packDays(String(b.d));
  const arr = [
    senderId, String(b.f).replace(/-/g, ''), b.l,
    (b.c || []).map((x: string) => String(x).replace(/^#/, '')).join(''),
    (b.o || []).map((x: number) => (x === 1 ? '1' : '0')).join(''),
    Number(b.t).toString(36),
    'd' in pk ? pk.d : [pk.q, pk.n, pk.x ?? ''],
  ];
  const nm = cleanSenderName(name);
  if (nm) arr.push(nm);
  return `${SHARE_PAGE}#v2.${toBase64Url(JSON.stringify(arr))}`;
}

// ── 근무 칸 줄이기: 교대 근무표는 대부분 같은 순서가 되풀이된다 → 주기(q) + 길이(n) + 어긋난 날(x: 날짜 번호 2자리 36진법 + 칸 1자) ──
export function packDays(d: string): { d: string } | { q: string; n: number; x?: string } {
  const len = d.length;
  let best: { q: string; x: string } | null = null;
  for (let p = 1; p <= Math.min(62, Math.floor(len / 2)); p++) {
    const q = d.slice(0, p);
    let x = '';
    for (let i = p; i < len; i++) if (d[i] !== q[i % p]) x += i.toString(36).padStart(2, '0') + d[i];
    if (!best || q.length + x.length < best.q.length + best.x.length) best = { q, x };
  }
  if (!best || best.q.length + best.x.length + 12 >= len) return { d };
  return { q: best.q, n: len, ...(best.x ? { x: best.x } : {}) };
}

export function unpackDays(o: any): string | null {
  if (typeof o?.d === 'string') return o.d;
  if (typeof o?.q !== 'string' || !o.q.length || typeof o.n !== 'number' || o.n < 1 || o.n > 800 || o.n !== Math.floor(o.n)) return null;
  const a: string[] = [];
  for (let i = 0; i < o.n; i++) a.push(o.q[i % o.q.length]);
  const x = o.x == null ? '' : o.x;
  if (typeof x !== 'string' || x.length % 3) return null;
  for (let k = 0; k < x.length; k += 3) {
    const i = parseInt(x.slice(k, k + 2), 36);
    if (!(i >= 0 && i < o.n)) return null;
    a[i] = x[k + 2];
  }
  return a.join('');
}

// ── base64url (UTF-8) — 세이람 lib/sendSchedule.ts와 같은 구현(Buffer·btoa 없이 Hermes·노드·브라우저 같은 결과) ──
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function utf8Bytes(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    let cp = ch.codePointAt(0)!;
    if (cp >= 0xd800 && cp <= 0xdfff) cp = 0xfffd;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  return out;
}
function utf8Decode(b: number[]): string | null {
  let s = '';
  for (let i = 0; i < b.length; ) {
    const c = b[i];
    let cp: number; let n: number;
    if (c < 0x80) { cp = c; n = 0; }
    else if (c >= 0xc2 && c < 0xe0) { cp = c & 31; n = 1; }
    else if (c >= 0xe0 && c < 0xf0) { cp = c & 15; n = 2; }
    else if (c >= 0xf0 && c < 0xf5) { cp = c & 7; n = 3; }
    else return null;
    if (i + n >= b.length) return null;
    for (let k = 1; k <= n; k++) {
      const x = b[i + k];
      if (x == null || (x & 0xc0) !== 0x80) return null;
      cp = (cp << 6) | (x & 63);
    }
    if ((n === 2 && cp < 0x800) || (n === 3 && (cp < 0x10000 || cp > 0x10ffff)) || (cp >= 0xd800 && cp <= 0xdfff)) return null;
    s += String.fromCodePoint(cp);
    i += n + 1;
  }
  return s;
}
export function toBase64Url(s: string): string {
  const b = utf8Bytes(s);
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < b.length) out += B64[(n >> 6) & 63];
    if (i + 2 < b.length) out += B64[n & 63];
  }
  return out;
}
export function fromBase64Url(s: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) return null;
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i += 4) {
    const chunk = s.slice(i, i + 4);
    const v = [...chunk].map((ch) => B64.indexOf(ch));
    const n = (v[0] << 18) | (v[1] << 12) | ((v[2] ?? 0) << 6) | (v[3] ?? 0);
    bytes.push((n >> 16) & 255);
    if (chunk.length > 2) bytes.push((n >> 8) & 255);
    if (chunk.length > 3) bytes.push(n & 255);
  }
  return utf8Decode(bytes);
}

/** 근무표 기간 'M월 D일 ~ M월 D일'(받기 팝업·보내기 글 공용) */
export function dateRangeText(data: ShiftData, tr: (k: string, p?: any) => string = t): string {
  const [y, m, d] = data.from.split('-').map(Number);
  const a = new Date(y, m - 1, d);
  const b = new Date(y, m - 1, d + data.days.length - 1);
  const md = (x: Date) => tr('{month} {d}일', { month: tr(MONTH_KEYS[x.getMonth()]), d: x.getDate() });
  const right = b.getFullYear() !== a.getFullYear() ? `${tr('{year}년', { year: b.getFullYear() })} ${md(b)}` : md(b);
  return `${md(a)} ~ ${right}`;
}

/** 보내기 글(세이람 보내기 글과 같은 모양): 요약 줄 · 이번 주 근무 → 빈 줄 → '눌러서 교대알람에서 보기 ▶ 링크'(링크가 맨 끝) */
export function buildShareMessage(body: string, link: string): string {
  const data = parseShiftBody(JSON.parse(body));
  const lines: string[] = [];
  if (data) {
    lines.push(`📅 ${t('근무표를 보냈어요 ({range})', { range: dateRangeText(data) })}`);
    const [y, m, d] = data.from.split('-').map(Number);
    const week: string[] = [];
    for (let i = 0; i < 7 && i < data.days.length; i++) {
      const day = new Date(y, m - 1, d + i);
      const s = shiftOn(data, day);
      if (s) week.push(`${t(DAYS[(day.getDay() + 6) % 7])} ${s.label}`);
    }
    if (week.length) lines.push(t('이번 주: {list}', { list: week.join(' · ') }));
  }
  return `${lines.join('\n')}${lines.length ? '\n\n' : ''}${t('눌러서 교대알람에서 보기 ▶')} ${link}`;
}

/** 안내 페이지 주소 → 앱 주소(docs/s.html의 openApp과 같은 규칙) */
export function appLinkFromPage(pageUrl: string): string {
  const i = pageUrl.indexOf('#');
  return `${SHARE_SCHEME}://?${i >= 0 ? pageUrl.slice(i + 1) : ''}`;
}

export type ParseResult =
  | { ok: true; sender: string; data: ShiftData; body: string; name: string } // name: 보낸 사람 이름('' = 없음)
  | { ok: false; reason: 'notShare' | 'format' | 'version' | 'tooLong' | 'expired' };

/** 받은 주소 읽기 — 안내 페이지(https …/s/#v2.… · …s.html#v=1…)와 앱 주소(alarmappshare://?…) 모두 */
export function parseShareLink(url: string, today: Date = new Date()): ParseResult {
  if (typeof url !== 'string') return { ok: false, reason: 'notShare' };
  let rest: string;
  if (url.startsWith(SHARE_PAGE + '#')) rest = url.slice(SHARE_PAGE.length + 1);
  else if (url.startsWith(SHARE_PAGE_V1 + '#')) rest = url.slice(SHARE_PAGE_V1.length + 1);
  else if (url.startsWith(SHARE_SCHEME + '://')) {
    const m = /^[^?#]*[?#](.*)$/.exec(url.slice(SHARE_SCHEME.length + 3));
    rest = m ? m[1] : '';
  } else return { ok: false, reason: 'notShare' };
  if (url.length > MAX_LINK) return { ok: false, reason: 'tooLong' };
  const vm = /^v(\d+)\.(.*)$/.exec(rest);
  if (vm) {
    if (vm[1] !== '2') return { ok: false, reason: Number(vm[1]) > 2 ? 'version' : 'format' };
    return finishV2(vm[2], today);
  }
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
  return finish(sender, raw, body, today, '');
}

function finishV2(b64: string, today: Date): ParseResult {
  const json = fromBase64Url(b64);
  if (json == null) return { ok: false, reason: 'format' };
  let a: any;
  try { a = JSON.parse(json); } catch { return { ok: false, reason: 'format' }; }
  if (!Array.isArray(a) || a.length < 7) return { ok: false, reason: 'format' };
  const [sender, f8, l, c, o, t36, cells, nm] = a;
  if (typeof sender !== 'string' || !/^[0-9a-z]{6,16}$/.test(sender)) return { ok: false, reason: 'format' };
  if (typeof f8 !== 'string' || !/^\d{8}$/.test(f8) || typeof c !== 'string' || !/^([0-9a-fA-F]{6})*$/.test(c)
    || typeof o !== 'string' || !/^[01]*$/.test(o) || typeof t36 !== 'string' || !/^[0-9a-z]{1,12}$/.test(t36)) return { ok: false, reason: 'format' };
  const d = typeof cells === 'string' ? cells
    : Array.isArray(cells) ? unpackDays({ q: cells[0], n: cells[1], x: cells[2] }) : null;
  if (d == null) return { ok: false, reason: 'format' };
  // 저장 형식은 v1과 같은 근무표 JSON(f·l·c·o·d·t) — 저장·표시 코드는 링크 판을 모른다
  const raw = {
    f: `${f8.slice(0, 4)}-${f8.slice(4, 6)}-${f8.slice(6)}`, l,
    c: (c.match(/.{6}/g) || []).map((x: string) => '#' + x), o: [...o].map(Number), d, t: parseInt(t36, 36),
  };
  return finish(sender, raw, JSON.stringify(raw), today, cleanSenderName(nm));
}

function finish(sender: string, raw: any, body: string, today: Date, name: string): ParseResult {
  const data = parseShiftBody(raw);
  if (!data || data.sentAt == null) return { ok: false, reason: 'format' };
  const [y, m, d] = data.from.split('-').map(Number);
  const last = new Date(y, m - 1, d + data.days.length - 1);
  if (last < new Date(today.getFullYear(), today.getMonth(), today.getDate())) return { ok: false, reason: 'expired' };
  return { ok: true, sender, data, body, name };
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
