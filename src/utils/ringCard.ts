// 1.6.3 울림 카드(docs/시안/울림화면-카드-시안.html "바꿀 모양") — 울림 화면에 보일 글자만 만든다.
// 시간·이모지는 넣지 않는다(교대알람은 정시에 울린다). 같은 규칙을 네이티브 커버 화면(CoverAlarmActivity.ringTitle·
// ringDateLabel)도 따른다 — 하나를 바꾸면 둘 다 바꾼다.
// 순수 모듈 — '../i18n/translate'의 t만 쓴다(logic-tests가 돈다).
import { MONTH_KEYS, DAYS_DISPLAY, SNOOZE_MIN } from '../constants';
import { t } from '../i18n/translate';

/** 글자(문자·숫자)가 하나라도 있는가 — 이모지·기호만인 토큰을 가려낸다 */
const hasLetter = (s: string) => /[0-9A-Za-zÀ-ɏͰ-ϿЀ-ӿ぀-ヿ㐀-鿿가-힣ᄀ-ᇿ㄰-㆏]/.test(s);

/** 알림 제목("🚆 초번 출근")에서 앞의 알람 아이콘을 떼고 이름만. 글자로 시작하면 그대로, 아이콘뿐이면 원래 값. */
export function ringTitle(title: string): string {
  const s = (title ?? '').trim();
  if (!s) return '';
  const parts = s.split(/\s+/);
  let i = 0;
  while (i < parts.length && !hasLetter(parts[i])) i++;
  if (i === 0) return s;
  if (i >= parts.length) return s;
  return parts.slice(i).join(' ');
}

const DS_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad2 = (n: number) => (n < 10 ? '0' : '') + n;

/** 근무일(YYYY-MM-DD) — 네이티브가 넘긴 workDate가 맞는 형식이면 그대로(야간 퇴근은 전날), 아니면 울린 날 */
export function ringWorkDate(workDate: string | undefined | null, firedAt: Date = new Date()): string {
  if (workDate && DS_RE.test(workDate)) return workDate;
  return `${firedAt.getFullYear()}-${pad2(firedAt.getMonth() + 1)}-${pad2(firedAt.getDate())}`;
}

/** "11월 26일 목요일" — 홈 시계(ClockHeader)와 같은 9개 언어 날짜 형식 */
export function ringDateLabel(ds: string): string {
  const m = DS_RE.exec(ds ?? '');
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return t('{month} {d}일 {dow}요일', { month: t(MONTH_KEYS[d.getMonth()]), d: d.getDate(), dow: t(DAYS_DISPLAY[d.getDay()]) });
}

/** "5분 후 다시" */
export function snoozeLabel(): string {
  return t('{n}분 후 다시', { n: SNOOZE_MIN });
}
