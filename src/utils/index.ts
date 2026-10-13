import KoreanLunarCalendar from 'korean-lunar-calendar';
import { Alarm, TYPES, SOUNDS, VIBS, DAYS, MONTH_KEYS, SHIFTS, ShiftPeriod, WorkSegment, DayOverride, DayOverrides, OverrideKind, OVERRIDE_KINDS } from '../constants';
import { t, translate } from '../i18n/translate';
import { LANGS, N } from '../i18n/lang';
import { isStatutoryHoliday } from '../constants/holidays';
export const pad = (n: number) => String(n).padStart(2, '0');
export const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
export const fmtDate = (s: string) => { if (!s) return ''; const [y,m,d] = s.split('-'); return `${y}.${m}.${d}`; };
export const getType  = (id: string) => TYPES.find(t => t.id === id) ?? TYPES[TYPES.length-1];
export const getSound = (id: string) => SOUNDS.find(s => s.id === id) ?? SOUNDS[1];
export const getVib   = (id: string) => VIBS.find(v => v.id === id) ?? VIBS[0];
// 달력 근무일 칸 라벨 — 사용자가 근무 시간대를 직접 지정했으면(해당사항없음 제외) 그 이름을, 아니면 기존 종류(출근/퇴근)명을 보여준다
// 기타는 사용자가 직접 입력한 shiftCustom 텍스트를 우선 사용(비어있으면 "기타")
// resolved를 넘기면(로테이션 알람의 특정 날짜 세그먼트 등) 그 값을 우선 사용 — 생략 시 기존처럼 a.shift를 그대로 읽음
export const shiftPeriodLabel = (a: Alarm, resolved?: { shift: ShiftPeriod; shiftCustom?: string } | null): string => {
  const r = resolved !== undefined ? resolved : (a.shift && a.shift !== 'none' ? { shift: a.shift, shiftCustom: a.shiftCustom } : null);
  if (r) {
    if (r.shift === 'custom') return r.shiftCustom?.trim() || t(SHIFTS.find(s => s.id === 'custom')!.label);
    if (r.shift !== 'none') return t(SHIFTS.find(s => s.id === r.shift)!.label);
  }
  return t(getType(a.typeId).label);
};
// 근무 시간대가 사용자에 의해 명시적으로 지정된 경우에만 고정 색을 반환 — 달력에서 시간순 자동 배색과 구분해 눈에 띄게 표시
export const shiftPeriodColor = (a: Alarm, resolved?: { shift: ShiftPeriod; shiftCustom?: string } | null): string | null => {
  const r = resolved !== undefined ? resolved : (a.shift && a.shift !== 'none' ? { shift: a.shift, shiftCustom: a.shiftCustom } : null);
  if (r && r.shift !== 'none') return SHIFTS.find(s => s.id === r.shift)!.color;
  return null;
};

// 달력 배지용 — 색(hex) 대신 **시간대 id**를 돌려준다.
// 색을 여기서 정하면 테마별 분기를 할 수 없어서(라이트에서 대비 2.2:1까지 떨어졌던 원인),
// 화면단이 C.shift[id]에서 배지 배경/글자 한 쌍을 꺼내 쓰도록 id만 넘긴다.
export const shiftPeriodId = (a: Alarm, resolved?: { shift: ShiftPeriod; shiftCustom?: string } | null): ShiftPeriod | null => {
  const r = resolved !== undefined ? resolved : (a.shift && a.shift !== 'none' ? { shift: a.shift, shiftCustom: a.shiftCustom } : null);
  if (r && r.shift !== 'none') return r.shift;
  return null;
};
// 라벨 입력칸 맨 앞에 붙는 근무 시간대 접두어. 해당사항없음이면 빈 문자열(기존과 동일).
// 기타는 shiftCustom 텍스트(비어있으면 접두어 없음 — 사용자가 아직 입력 전이므로 라벨을 건드리지 않음)
export const shiftPrefixFor = (shift: ShiftPeriod, shiftCustom?: string): string => {
  if (shift === 'none') return '';
  if (shift === 'custom') return shiftCustom?.trim() ? `${shiftCustom.trim()} ` : '';
  return `${t(SHIFTS.find(s => s.id === shift)!.label)} `;
};
// ─── 알람 기본 라벨의 언어 맞춤 ────────────────────────────────────────────────
// 알람을 만들 때 라벨 입력칸에는 기본 라벨("출근", "초번 출근")이 채워져 alarm.label로 저장된다. 이 값은 만든 시점의
// 언어로 굳어 있어서, 언어를 바꾸면 카드·알림 제목에 이전 언어가 남는다. 저장값이 "어느 언어로든 기본 라벨과 똑같은"
// 경우에만 현재 언어의 기본 라벨로 바꿔 보여 준다 — 사용자가 직접 고쳐 쓴 라벨은 손대지 않는다.
// 조립 규칙은 폼(useAlarmFormState)과 같다: shiftPrefixFor(…) + 타입 라벨 = "<근무조> <타입>".
let defaultLabelIndex: Map<string, { typeLabel: string; shiftLabel?: string }> | null = null;
function buildDefaultLabelIndex() {
  const idx = new Map<string, { typeLabel: string; shiftLabel?: string }>();
  const shifts = SHIFTS.filter(s => s.id !== 'none' && s.id !== 'custom');
  for (const lang of LANGS) {
    for (const ty of TYPES) {
      idx.set(translate(lang, ty.label), { typeLabel: ty.label });
      for (const sh of shifts) {
        const shl = translate(lang, sh.label);
        // 폼이 조립하는 꼴("<근무조> <타입>")과, 근무표 알람·위젯이 쓰는 문장 키 꼴 둘 다 기본 라벨로 인정한다.
        idx.set(`${shl} ${translate(lang, ty.label)}`, { typeLabel: ty.label, shiftLabel: sh.label });
        const key = ROLE_KEYS[ty.id];
        if (key) idx.set(translate(lang, key, { shift: shl }), { typeLabel: ty.label, shiftLabel: sh.label });
      }
    }
  }
  return idx;
}
// 출근·퇴근은 언어마다 어순이 달라 문장 키로 만든다(workPattern.roleLabel과 같은 키) — 같은 알람이 카드와 위젯에서
// 다른 이름으로 보이지 않게 한다. 그 외 타입은 "<근무조> <타입>".
const ROLE_KEYS: Record<string, string> = { commute: N('{shift} 출근'), offwork: N('{shift} 퇴근') };
export function localizeDefaultLabel(label: string | undefined | null): string {
  const raw = (label ?? '').trim();
  if (!raw) return '';
  if (!defaultLabelIndex) defaultLabelIndex = buildDefaultLabelIndex();
  const hit = defaultLabelIndex.get(raw);
  if (!hit) return label as string;
  if (!hit.shiftLabel) return t(hit.typeLabel);
  const roleKey = ROLE_KEYS[TYPES.find(x => x.label === hit.typeLabel)?.id ?? ''];
  return roleKey ? t(roleKey, { shift: t(hit.shiftLabel) }) : `${t(hit.shiftLabel)} ${t(hit.typeLabel)}`;
}
/** 화면·알림에 보여 줄 알람 이름 — 저장된 라벨(기본 라벨이면 현재 언어로), 없으면 타입 이름. */
export function alarmLabel(a: Pick<Alarm, 'label' | 'typeId'>): string {
  return localizeDefaultLabel(a.label) || t(getType(a.typeId).label);
}

export const repeatLabel = (al: Alarm): string => {
  if (al.rm==='once') return t('한 번');
  if (al.rm==='wdcustom' || al.rm==='daily' || al.rm==='weekdays' || al.rm==='weekends') {
    const days = al.rm==='daily' ? [0,1,2,3,4,5,6]
               : al.rm==='weekdays' ? [0,1,2,3,4]
               : al.rm==='weekends' ? [5,6]
               : (al.days ?? []);
    if (days.length === 7) return t('매일');
    if (days.length === 5 && !days.includes(5) && !days.includes(6)) return t('평일');
    if (days.length === 2 && days.includes(5) && days.includes(6)) return t('주말');
    const n = days.map(d => t(DAYS[d])).join(' ');
    return n || t('요일 선택');
  }
  if (al.rm==='cycle')   return t('{n}일 주기', { n: al.cd??1 });
  if (al.rm==='rest')    return t('{n}일 알람 후 {r}일 휴식', { n: al.cd??2, r: al.rd??1 });
  if (al.rm==='pattern') {
    const segs = al.pattern ?? [];
    if (segs.length <= 1) return t('근무 로테이션');
    return t('{pattern} 반복', { pattern: segs.map(s => s.isRest ? t('{n}일 비번', { n: s.days }) : t('{n}일', { n: s.days })).join(' → ') });
  }
  // sd는 반드시 문자열로 쪼개 쓴다 — new Date('2026-07-29')는 UTC 자정으로 파싱돼서
  // UTC 음수 오프셋 지역에서 하루 밀린다. 스케줄러(getNextFireDate/core.ts)가 sd.split('-')
  // 기준이라, 여기서 Date로 파싱하면 카드에 적힌 날짜와 실제 울리는 날이 어긋난다.
  const [, sdM, sdD] = (al.sd || todayStr()).split('-').map(Number);
  if (al.rm==='monthly') return al.lastDay ? t('매월 말일') : t('매월 {d}일', { d: sdD });
  if (al.rm==='yearly') {
    const M = sdM, D = sdD;
    // 월 이름은 MONTH_KEYS로 번역한다(범위 밖이면 기존 표기 그대로)
    if (!al.lunar) return t('매년 {month} {d}일', { month: MONTH_KEYS[M-1] ? t(MONTH_KEYS[M-1]) : `${M}월`, d: D });
    // 음력은 해마다 양력 날짜가 달라져서 음력 표기만으로는 언제 울리는지 알 수 없다.
    // 다음에 울릴 양력 날짜를 병기한다 — 올해분이 이미 지났으면 내년 기준으로 환산.
    const y = new Date().getFullYear();
    const thisYear = lunarToSolarInYear(y, M, D);
    const solar = (thisYear && thisYear >= todayStr()) ? thisYear : lunarToSolarInYear(y + 1, M, D);
    // 변환 지원 범위(1000~2050) 밖이면 조용히 음력 표기만 남긴다
    const suffix = solar ? ` (양력 ${Number(solar.split('-')[1])}월 ${Number(solar.split('-')[2])}일)` : '';
    return `매년 음력 ${M}월 ${D}일${suffix}`;
  }
  return t('한 번');
};

function dayDiff(a: Date, b: Date): number {
  return Math.floor((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate()) -
                     Date.UTC(a.getFullYear(),a.getMonth(),a.getDate())) / 86400000);
}

// 근무 시간대 로테이션 패턴에서 sd(시작일) 기준 dateStr이 속한 세그먼트를 찾는다.
// cycle의 d%cd===0, rest의 d%p<cd 수식을 "블록 여러 개"로 일반화한 버전 — 달력/스케줄러 공용 순수 함수.
export function resolveSegment(pattern: WorkSegment[], sd: string, dateStr: string): { segment: WorkSegment; index: number } | null {
  if (!pattern.length) return null;
  const s = new Date((sd || dateStr) + 'T00:00:00');
  const d = new Date(dateStr + 'T00:00:00');
  const diff = dayDiff(s, d);
  if (diff < 0) return null;
  const total = pattern.reduce((sum, seg) => sum + Math.max(1, seg.days), 0);
  const offset = diff % total;
  let acc = 0;
  for (let i = 0; i < pattern.length; i++) {
    acc += Math.max(1, pattern[i].days);
    if (offset < acc) return { segment: pattern[i], index: i };
  }
  return null;
}

// 로테이션 알람이 dateStr에 실제로 어떤 시간대로 표시돼야 하는지 — 근무 세그먼트가 아니면(휴식/범위 밖) null.
// 비로테이션 알람은 기존 alarm.shift를 그대로 반환(하위호환).
export function effectiveShift(a: Alarm, dateStr: string): { shift: ShiftPeriod; shiftCustom?: string } | null {
  if (a.rm === 'pattern' && a.pattern?.length) {
    const r = resolveSegment(a.pattern, a.sd, dateStr);
    if (r && !r.segment.isRest) return { shift: r.segment.shift, shiftCustom: r.segment.shiftCustom };
    return null;
  }
  if (a.shift && a.shift !== 'none') return { shift: a.shift, shiftCustom: a.shiftCustom };
  return null;
}

// ─── 자정을 넘는 근무(야간 22~06시, 24시간 근무 등) ─────────────────────────────
// 퇴근 시각이 출근 시각보다 이르거나 같으면 그 근무는 다음 날 끝난다(근무가 시작 전에 끝날 수는 없으므로
// 따로 "다음날" 플래그를 받지 않고 시각만으로 판정한다. 08:00→08:00은 24시간 근무).
// 이 판정은 여기 한 곳에만 둔다 — effectiveTime/dayWorkFor가 dayOffset으로 돌려주고, 발화 시각을 만드는
// 세 곳(core.ts 로테이션 루프·날짜기반 루프, 아래 getNextFireDate)이 그 값을 날짜에 더한다.
export type ClockTime = { hour: number; min: number };
export function isOvernight(start: ClockTime | undefined, end: ClockTime | undefined): boolean {
  if (!start || !end) return false;
  return end.hour * 60 + end.min <= start.hour * 60 + start.min;
}
// "이날만 끄기"(skips) 중 더 볼 필요 없는 지난 날짜를 걷어낸다. skips는 근무일 기준이고 자정 넘는 근무의
// 퇴근은 근무일 다음 날 울리므로 "어제"까지는 남겨야 한다 — 오늘 이전을 전부 지우면, 어젯밤 근무분을 꺼둔
// 사용자가 자정 뒤 앱을 열 때 skip이 사라져 오늘 아침 퇴근 알람이 다시 예약된다.
export function pruneSkips(skips: string[] | undefined, today: string): string[] | undefined {
  if (!skips?.length) return skips;
  const [y, m, d] = today.split('-').map(Number);
  const yd = new Date(y, m - 1, d - 1);
  const keepFrom = `${yd.getFullYear()}-${pad(yd.getMonth() + 1)}-${pad(yd.getDate())}`;
  const kept = skips.filter(x => x >= keepFrom);
  return kept.length ? kept : undefined;
}
// 발화 시각 date가 속한 "근무일" — 자정 넘는 근무의 퇴근이면 하루 전, 아니면 발화일 그대로.
// 헤더·위젯처럼 발화 시각에서 거꾸로 근무조 라벨을 만드는 곳이 쓴다(알림 제목은 예약 루프가 근무일로 직접 만든다).
export function workDateOfFire(alarm: Alarm, date: Date, overrides: DayOverrides = {}): string {
  const dsOf = (x: Date) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
  const fireDs = dsOf(date);
  if (overnightFrom(alarm) === 0) return fireDs;
  const prev = new Date(date); prev.setDate(prev.getDate() - 1);
  const prevDs = dsOf(prev);
  const same = (t: { hour: number; min: number } | null | undefined) => !!t && t.hour === date.getHours() && t.min === date.getMinutes();
  const dw = dayWorkFor(alarm, overrides[prevDs]);
  if (dw) return dw.fires && dw.dayOffset === 1 && same(dw.time) ? prevDs : fireDs;
  if (alarm.skips?.includes(prevDs)) return fireDs;
  const t = effectiveTime(alarm, prevDs);
  return t?.dayOffset === 1 && same(t) ? prevDs : fireDs;
}
// 발화 시각을 훑는 루프가 "며칠 전 근무일"부터 봐야 하는지 — 퇴근 알람은 어젯밤 근무의 퇴근이 오늘
// 아침에 울릴 수 있으므로 어제(-1)부터, 그 외는 오늘(0)부터. 대상은 하루 근무 변경·로테이션이 닿는
// 출퇴근 알람(isOverridableAlarm)의 퇴근 쪽뿐이라 나머지 알람 종류는 지금까지와 완전히 같다.
export function overnightFrom(a: Alarm): number {
  return a.typeId === 'offwork' && isOverridableAlarm(a) ? -1 : 0;
}

// 로테이션 알람이 dateStr에 실제로 울리는 시각(출근/퇴근 세그먼트별) — 휴식일이면 null.
// 비로테이션 알람은 기존 alarm.hour/min을 그대로 반환(하위호환).
// dayOffset=1이면 그 시각은 dateStr(근무일)의 "다음 날"이다 — 자정 넘는 근무의 퇴근(isOvernight).
export function effectiveTime(a: Alarm, dateStr: string): { hour: number; min: number; dayOffset?: number } | null {
  if (a.rm === 'pattern' && a.pattern?.length) {
    const r = resolveSegment(a.pattern, a.sd, dateStr);
    if (!r || r.segment.isRest) return null;
    if (a.groupRole === 'offwork') {
      const t = r.segment.offworkTime;
      if (!t) return null;
      return isOvernight(r.segment.commuteTime, t) ? { hour: t.hour, min: t.min, dayOffset: 1 } : t;
    }
    return r.segment.commuteTime ?? null;
  }
  return { hour: a.hour, min: a.min };
}

export function getNextFireDate(alarm: Alarm, overrides: DayOverrides = {}): Date | null {
  const now  = new Date();
  const today = todayStr();
  const startDate = alarm.sd || today;
  // 매년(음력 포함) 알람은 1년 가까이 뒤일 수 있어 "다음 알람" 미리보기가 놓치지 않도록 넉넉히 훑는다.
  // (실제 OS 알림 예약은 별도로 14일 창만 쓰므로 여기 범위 확장은 성능에 영향 없음)
  const searchDays = alarm.rm === 'yearly' ? 400 : 14;
  // 퇴근 알람은 어제 근무일부터 본다 — 어젯밤 야간 근무의 퇴근이 오늘 아침일 수 있다(overnightFrom).
  for (let ahead = overnightFrom(alarm); ahead <= searchDays; ahead++) {
    const cand = new Date(now);
    cand.setDate(cand.getDate() + ahead);
    const cs = `${cand.getFullYear()}-${pad(cand.getMonth()+1)}-${pad(cand.getDate())}`;
    if (cs < startDate) continue;

    // 하루 근무 변경 — override가 skips보다 우선한다(core.ts 예약 루프와 같은 순서를 반드시
    // 유지해야 한다 — 안 그러면 "다음 알람" 문구가 실제 예약과 다른 날짜를 가리킬 수 있다).
    // 이 알람이 근무 알람이 아니면(dw===null) 기존 판정을 그대로 탄다.
    const dw = dayWorkFor(alarm, overrides[cs]);
    if (dw) {
      if (!dw.fires) continue;
      if (!dw.time) continue;
      cand.setHours(dw.time.hour, dw.time.min, 0, 0);
      if (dw.dayOffset) cand.setDate(cand.getDate() + dw.dayOffset); // 자정 넘는 근무의 퇴근
      if (cand <= now) continue;
      return cand;
    }
    if (alarm.skips?.includes(cs)) continue;
    // 법정공휴일 — 위 dayWorkFor 블록보다 뒤에 와야 한다. 공휴일에 출근해야 하는 날은
    // 달력에서 "하루 근무 변경(특근/대근)"을 걸면 그 블록이 먼저 return하므로 정상 발화한다.
    if (isHolidaySkipped(alarm, cs)) continue;

    // 로테이션 알람은 날짜마다 시각이 달라서(세그먼트별 출근/퇴근 시각) 일반 알람처럼
    // 맨 위에서 alarm.hour/min으로 setHours할 수 없다 — 세그먼트를 먼저 찾은 뒤 그 시각을 쓴다.
    if (alarm.rm === 'pattern') {
      const t = effectiveTime(alarm, cs);
      if (!t) continue;
      cand.setHours(t.hour, t.min, 0, 0);
      if (t.dayOffset) cand.setDate(cand.getDate() + t.dayOffset); // 자정 넘는 근무의 퇴근
      if (cand <= now) continue;
      return cand;
    }

    cand.setHours(alarm.hour, alarm.min, 0, 0);
    if (cand <= now) continue;
    const dow = (cand.getDay() + 6) % 7; // 0=Mon 6=Sun
    let fires = false;
    switch (alarm.rm) {
      case 'once':     fires = cs === startDate; break;
      case 'daily':    fires = true; break;
      case 'weekdays': fires = dow < 5; break;
      case 'weekends': fires = dow >= 5; break;
      case 'wdcustom': fires = (alarm.days||[]).includes(dow); break;
      case 'cycle': {
        const start = new Date(startDate + 'T00:00:00');
        const diff  = dayDiff(start, cand);
        fires = diff >= 0 && diff % Math.max(1, alarm.cd||1) === 0;
        break;
      }
      case 'rest': {
        const start = new Date(startDate + 'T00:00:00');
        const diff  = dayDiff(start, cand);
        const cycle = (alarm.cd||2) + (alarm.rd||1);
        fires = diff >= 0 && diff % cycle < (alarm.cd||2);
        break;
      }
      case 'monthly': {
        if (alarm.lastDay) {
          const lastDayOfMonth = new Date(cand.getFullYear(), cand.getMonth()+1, 0).getDate();
          fires = cand.getDate() === lastDayOfMonth;
        } else {
          const sdDay = alarm.sd ? parseInt(alarm.sd.split('-')[2]) : 1;
          fires = cand.getDate() === sdDay;
        }
        break;
      }
      case 'yearly': {
        if (alarm.sd) {
          const [, sdM, sdD] = alarm.sd.split('-').map(Number);
          if (alarm.lunar) {
            fires = cs === lunarToSolarInYear(cand.getFullYear(), sdM, sdD);
          } else if (sdM === 2 && sdD === 29) {
            const y = cand.getFullYear();
            const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
            fires = cand.getMonth() === 1 && cand.getDate() === (isLeap ? 29 : 28);
          } else {
            fires = cand.getMonth() === sdM - 1 && cand.getDate() === sdD;
          }
        }
        break;
      }
    }
    if (fires) return cand;
  }
  return null;
}

// 반복 울림(보조 알림)을 받지 못하는 알람 ID 집합 — 2026-10-10부터 항상 빈 집합.
// 예전엔 "메인 슬롯 추정 + 60개 한도"로 보조를 포기한 묶음을 "⚠ 1회만"으로 표시했는데, 추정이
// 부정확했고(날짜 기반 알람을 2슬롯으로 계산, 실제 최대 14) 이제 rescheduleAll이 보조 알림을
// 메인보다 먼저 걸어 한도 때문에 보조가 빠지는 경우가 없다. 호출부(AlarmCard 배지)는 그대로 두고
// 빈 집합을 돌려 배지가 뜨지 않게 한다 — 나중에 실제 예약 결과로 다시 살릴 수 있게 시그니처 유지.
export function getRepLimitedIds(_alarms: Alarm[]): Set<number> {
  return new Set();
}

// 해당 날짜에 울리는 알람 목록 계산
// includeSkipped: 하루 팝업처럼 "이날 꺼진 알람"도 함께 보여줘야 할 때 true
export function alarmsForDate(alarms: Alarm[], dateStr: string, includeSkipped = false): Alarm[] {
  const date = new Date(dateStr);
  const dow  = (date.getDay() + 6) % 7; // 0=월 ~ 6=일
  return alarms.filter(a => {
    if (!a.active) return false;
    if (!includeSkipped && a.skips?.includes(dateStr)) return false;
    // 공휴일도 "이날만 끄기"와 같은 급으로 다룬다 — includeSkipped=true로 부르는 달력 하루
    // 팝업에서는 계속 보여야 사용자가 그 자리에서 "하루 근무 변경(특근)"을 걸 수 있다.
    if (!includeSkipped && isHolidaySkipped(a, dateStr)) return false;
    if (a.sd && dateStr < a.sd) return false;
    if (a.rm === 'daily')    return true;
    if (a.rm === 'weekdays') return dow < 5;
    if (a.rm === 'weekends') return dow >= 5;
    if (a.rm === 'once')     return dateStr === a.sd;
    if (a.rm === 'wdcustom') return a.days.includes(dow);
    if (a.rm === 'cycle') {
      const s = new Date(a.sd || dateStr); s.setHours(0,0,0,0);
      const d = Math.round((date.getTime()-s.getTime())/86400000);
      return d >= 0 && d % (a.cd||1) === 0;
    }
    if (a.rm === 'rest') {
      const s = new Date(a.sd || dateStr); s.setHours(0,0,0,0);
      const d = Math.round((date.getTime()-s.getTime())/86400000);
      const p = (a.cd||2) + (a.rd||1);
      return d >= 0 && (d % p) < (a.cd||2);
    }
    if (a.rm === 'pattern') {
      if (!a.pattern?.length) return false;
      const r = resolveSegment(a.pattern, a.sd, dateStr);
      return !!r && !r.segment.isRest;
    }
    if (a.rm === 'monthly') {
      if (a.lastDay) {
        const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth()+1, 0).getDate();
        return date.getDate() === lastDayOfMonth;
      }
      const sdDay = a.sd ? parseInt(a.sd.split('-')[2]) : 1;
      return date.getDate() === sdDay;
    }
    if (a.rm === 'yearly') {
      if (!a.sd) return false;
      const [, sdM, sdD] = a.sd.split('-').map(Number);
      if (a.lunar) return dateStr === lunarToSolarInYear(date.getFullYear(), sdM, sdD);
      if (sdM === 2 && sdD === 29) {
        const y = date.getFullYear();
        const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
        return date.getMonth() === 1 && date.getDate() === (isLeap ? 29 : 28);
      }
      return date.getMonth() === sdM - 1 && date.getDate() === sdD;
    }
    return false;
  });
}

// ─── 달력 근무표 표시 ───
// 근무표 판정 대상: 주기(cycle/rest) 반복 + 출근/퇴근 타입 알람만.
// 운동·식사 등 다른 타입은 주기 알람이어도 근무표(배경색/비번)에 관여하지 않는다.
export const isWorkAlarm = (a: Alarm) =>
  a.active && (a.rm === 'cycle' || a.rm === 'rest' || a.rm === 'pattern') && (a.typeId === 'commute' || a.typeId === 'offwork');

// 하루 근무 변경(dayOverride) 대상 판정 — isWorkAlarm보다 넓다. isWorkAlarm은 달력의
// 근무조 배지·비번 표시 대상을 "교대근무 로테이션(cycle/rest/pattern)"으로 일부러 좁혀둔
// 기존 정의라, 교대근무 마법사 없이 "출근"/"퇴근" 버튼만으로 요일 반복(wdcustom) 알람을
// 만든 일반 사용자는 여기 안 걸린다. wdcustom까지 포함해 "규칙적으로 반복되는 출퇴근
// 알람"이면 다 된다.
// ⚠️ once(한 번)/monthly/yearly는 일부러 뺀다 — 이건 "매일 반복되는 내 출퇴근 스케줄"이
// 아니라 하루짜리 약속이나 연례 행사에 가까워서, 전혀 무관한 날짜의 override가 이 알람을
// 건드릴 이유가 없다. dayWorkFor는 그 알람이 어떤 날짜(ds)에 불려도 rm/sd를 안 보고 override
// 유무만으로 fires를 통째로 대체하므로, once를 포함시키면 그 알람의 원래 예정일과 전혀
// 다른 날짜에 유령처럼 다시 울릴 수 있다.
export const isOverridableAlarm = (a: Alarm) =>
  (a.typeId === 'commute' || a.typeId === 'offwork')
  && (a.rm === 'cycle' || a.rm === 'rest' || a.rm === 'pattern' || a.rm === 'wdcustom');

// 법정공휴일에 건너뛸 알람인지 — "교대근무가 아닌 출퇴근 알람"만 해당한다.
// ⚠️ isOverridableAlarm을 재사용하면 안 된다. 그쪽은 cycle/rest/pattern(교대근무)을
// 포함하는데, 교대근무자는 공휴일에도 근무하므로 그 알람이 꺼지면 결근한다.
// once/monthly/yearly도 뺀다 — 하루짜리 약속이나 연례 행사라 공휴일과 무관하다.
// (daily/weekdays/weekends는 useAlarms에서 wdcustom으로 마이그레이션되지만,
//  마이그레이션 전 데이터가 스케줄링 경로로 흘러도 같게 동작하도록 같이 적는다)
export const skipsStatutoryHoliday = (a: Alarm) =>
  (a.typeId === 'commute' || a.typeId === 'offwork')
  && (a.rm === 'wdcustom' || a.rm === 'daily' || a.rm === 'weekdays' || a.rm === 'weekends');

// 그 알람이 그 날짜에 공휴일이라 안 울리는가. 표시·예약 양쪽에서 같은 답을 내야
// "달력엔 울린다고 나오는데 실제로는 안 울린다"는 불일치가 안 생긴다.
export const isHolidaySkipped = (a: Alarm, dateStr: string) =>
  skipsStatutoryHoliday(a) && isStatutoryHoliday(dateStr);

// 위와 같되 하루 근무 변경까지 반영한 최종 판정 — 표시 경로(달력 칩·위젯 이벤트)용.
// 공휴일에 특근/대근을 걸어둔 날은 실제로 울리므로 목록에서 빼면 안 된다.
// 예약 경로(core.ts)는 dayWorkFor가 fires를 통째로 덮는 구조라 이 함수가 필요 없다.
export const isHolidayOffWithOverride = (a: Alarm, dateStr: string, ov?: DayOverride) =>
  isHolidaySkipped(a, dateStr) && !dayWorkFor(a, ov)?.fires;

// "휴일근무" — 법정공휴일인데 실제로 근무한 날. 달력 아래 집계 전용이며 사용자가 손대는 값이 없다.
// 판정 순서는 달력 셀·홈·위젯과 똑같이 override 우선: 하루 근무 변경이 있으면 그걸로 확정
// (연차=휴일근무 아님, 대근·특근=휴일근무), 없으면 교대근무 로테이션(isWorkAlarm: cycle/rest/pattern)이
// 그날 근무인지로 판정한다. 요일 반복 출퇴근(wdcustom)은 공휴일에 알람이 꺼지는 규칙이라 그 사용자는
// 특근 override를 걸어야만 휴일근무로 센다(= 위 override 우선 분기). "이날 끄기"는 알람만 끈 것이지
// 근무가 없어진 게 아니므로 shiftForDate/isOffDay와 같이 includeSkipped=true로 본다.
// dateStr가 공휴일이 아니면 항상 false — 호출부가 공휴일 목록만 넘겨도, 아무 날짜나 넘겨도 안전.
export function isHolidayWorkDay(alarms: Alarm[], dateStr: string, ov?: DayOverride): boolean {
  if (!isStatutoryHoliday(dateStr)) return false;
  const disp = dayOverrideDisplay(ov);
  if (disp) return !disp.isOff;
  return alarmsForDate(alarms.filter(isWorkAlarm), dateStr, true).length > 0;
}

// 근무조 색 팔레트 — 시간대가 아니라 알람별로 배정한다.
// 같은 시간대 안에서 갈리는 교대(예: 04:20 초번 / 05:20 말번)도 색으로 구분되도록,
// 근무 알람을 시각순으로 정렬해 순서대로 색을 준다.
// 비번이 빨간색이므로 팔레트에서 빨강 계열(주황/분홍)은 제외
const SHIFT_PALETTE = ['#3B9BE0', '#1D9E75', '#00ACC1', '#7C6FE0', '#C9A227', '#8B7355'];

// 활성 근무 알람 전체 기준으로 알람 id → 색 매핑을 만든다
export function shiftColorMap(alarms: Alarm[]): Record<number, string> {
  const work = alarms.filter(isWorkAlarm).sort((a,b) => a.hour-b.hour || a.min-b.min || a.id-b.id);
  const map: Record<number, string> = {};
  work.forEach((a, i) => { map[a.id] = SHIFT_PALETTE[i % SHIFT_PALETTE.length]; });
  return map;
}

// 달력 배지용 자동 배색 — 위와 같은 이유로 색이 아니라 **팔레트 인덱스**를 돌려준다.
// 화면단이 C.shiftAuto[idx]에서 테마에 맞는 배지 톤을 꺼낸다.
// (shiftColorMap은 위젯이 hex를 그대로 네이티브로 넘기므로 건드리지 않는다)
export function shiftToneIndexMap(alarms: Alarm[]): Record<number, number> {
  const work = alarms.filter(isWorkAlarm).sort((a,b) => a.hour-b.hour || a.min-b.min || a.id-b.id);
  const map: Record<number, number> = {};
  work.forEach((a, i) => { map[a.id] = i; });
  return map;
}

// 해당 날짜의 근무조 대표 알람. 같은 날 여러 개(출근+퇴근)면 출근 우선, 이른 시각 우선.
// 단, 시간대(초번/말번 등) 정보가 있는 알람을 최우선으로 고른다 — 시간대 없는 일반 출근/퇴근
// 알람(예: 기상 알람)이 로테이션 알람보다 이른 시각이라는 이유만으로 대표로 뽑히면
// effectiveShift가 null이 돼서 달력에 시간대 라벨 자체가 안 뜨는 문제가 있었음.
export function shiftForDate(alarms: Alarm[], dateStr: string): Alarm | null {
  // includeSkipped=true — "이날 끄기"는 알람만 끈 것이지 근무가 없어진 게 아니므로,
  // 근무표(시간대 라벨) 판정에는 skip된 날도 근무일로 포함한다
  const rings = alarmsForDate(alarms.filter(isWorkAlarm), dateStr, true);
  if (!rings.length) return null;
  // 로테이션 알람은 최상위 hour/min이 레거시 값이라 그날 실제 시각(effectiveTime)으로 정렬해야 함
  const effTime = (a: Alarm) => effectiveTime(a, dateStr) ?? { hour: a.hour, min: a.min };
  const withShift = rings.filter(a => effectiveShift(a, dateStr) != null);
  const pool = withShift.length ? withShift : rings;
  pool.sort((a, b) => {
    const ta = effTime(a), tb = effTime(b);
    return (a.typeId === 'commute' ? 0 : 1) - (b.typeId === 'commute' ? 0 : 1) ||
      ta.hour - tb.hour || ta.min - tb.min;
  });
  return pool[0];
}

// 비번: 근무 알람이 하나라도 있고 그 시작일 이후인데, 그날 아무 근무 알람도 안 울리는 날.
// includeSkipped=true — "이날 끄기"로 알람만 하루 끈 근무일이 비번(빨간 날)으로
// 오판정되지 않도록, 근무표 판정에는 skip된 날도 근무일로 포함한다.
export function isOffDay(alarms: Alarm[], dateStr: string): boolean {
  const work = alarms.filter(isWorkAlarm);
  if (!work.length) return false;
  if (!work.some(a => !a.sd || dateStr >= a.sd)) return false;
  return alarmsForDate(work, dateStr, true).length === 0;
}

// ─── 하루 근무 변경(day override) ───────────────────────────────────────
// 이 파일의 기존 함수(effectiveShift/effectiveTime/shiftForDate/isOffDay/alarmsForDate)는
// 전혀 건드리지 않는다 — override가 없는 날짜는 지금까지와 100% 동일하게 동작해야 하므로,
// override는 "기존 판정에 없던 새 갈래"가 아니라 "호출부가 먼저 확인하고 있으면 그걸로
// 확정, 없으면 기존 로직 그대로 진행"하는 짧은 우회로로만 추가한다.

// kind가 지금 OVERRIDE_KINDS에 실제로 있는 값인지 — 예전 버전에서 저장된 뒤 나중에 목록에서
// 빠진 kind(예: 한때 있던 "기타")가 그대로 남아있으면 라벨을 못 찾아 빈 문자열로 표시되거나
// (달력에 텅 빈 배지) 최악의 경우 여전히 근무 상태를 바꾸는 것처럼 오판정될 수 있다.
// kind 종류가 바뀔 때마다 매번 마이그레이션 코드를 짜는 대신, "지금 목록에 없으면 kind
// 없는 것과 동일하게 취급"으로 자동 방어한다.
const isKnownKind = (kind: OverrideKind | undefined): kind is OverrideKind =>
  !!kind && OVERRIDE_KINDS.some(k => k.id === kind);

export function overrideLabel(ov: DayOverride): string {
  return OVERRIDE_KINDS.find(k => k.id === ov.kind)?.label ?? '';
}

// 달력 셀·홈 헤더·위젯이 그날을 그릴 때 먼저 확인하는 표시 정보. override에 kind가 없으면
// (family 메모만 있거나 override 자체가 없으면) null — 이 경우 호출부는 shiftForDate/isOffDay/
// effectiveShift 등 기존 경로를 그대로 쓴다. family는 근무 상태와 무관한 별도 메모라 여기
// 판정에 관여하지 않는다(경조사가 있어도 근무일 표시는 그대로 유지).
// isOff는 "근무 알람이 꺼진 날"이라는 뜻으로, 대근·특근(work 있음)은 false다.
export function dayOverrideDisplay(ov: DayOverride | undefined): { label: string; isOff: boolean; shift?: ShiftPeriod } | null {
  if (!ov || !isKnownKind(ov.kind)) return null;
  return { label: overrideLabel(ov), isOff: !ov.work, shift: ov.work?.shift };
}

// 이 알람이 override가 걸린 날 실제로 울리는지/몇 시에 울리는지 — 예약 경로(core.ts) 전용 게이트.
// override에 kind가 없으면(family 메모만 있는 날 포함) null을 반환해 호출부가 기존 발화
// 판정(effectiveShift/effectiveTime, rm별 fires 계산)을 그대로 쓰게 한다 — 경조사 메모만으로는
// 알람이 꺼지거나 시각이 바뀌면 안 된다. kind가 있으면 그 판정을 완전히 대체한다:
//   - work 없음(연차 등)  → fires:false, 이 알람은 그날 절대 안 울림
//   - work 있음(대근 등)  → typeId가 commute/offwork 중 무엇인지로 해당 역할의 시각을 골라
//                          fires:true — 원래 그날 안 울리던 알람(비번)도 이 경로로 새로 울릴 수 있다
export function dayWorkFor(
  alarm: Alarm, ov: DayOverride | undefined
): { fires: boolean; time?: { hour: number; min: number }; shift?: ShiftPeriod; dayOffset?: number } | null {
  if (!ov || !isKnownKind(ov.kind)) return null;
  // 출근/퇴근 알람이 아니면 override는 이 알람에 아무 영향을 주지 않는다 — 연차를 걸어도
  // 운동·식사·생일 같은 알람은 그대로 둔다. isWorkAlarm이 아니라 더 넓은 isOverridableAlarm을
  // 쓰는 이유: 교대근무 마법사(cycle/rest/pattern) 없이 "출근"/"퇴근" 버튼만으로 요일 반복
  // 등을 만든 일반 사용자의 알람도 하루 근무 변경 대상이어야 한다.
  if (!isOverridableAlarm(alarm)) return null;
  if (!ov.work) return { fires: false };
  const time = alarm.typeId === 'offwork' ? ov.work.end : ov.work.start;
  if (!time) return { fires: false };
  // 대근·특근을 야간으로 넣은 날(예: 22:00~06:00) — 퇴근은 그 날짜의 다음 날 아침이다.
  const dayOffset = alarm.typeId === 'offwork' && isOvernight(ov.work.start, ov.work.end) ? 1 : undefined;
  return { fires: true, time, shift: ov.work.shift, dayOffset };
}

// 양력 날짜(YYYY-MM-DD) → 음력 "M월 D일" 문자열. 지원 범위(1000~2050년) 밖이면 빈 문자열.
export function lunarDateText(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const cal = new KoreanLunarCalendar();
  if (!cal.setSolarDate(y, m, d)) return '';
  const { month, day, intercalation } = cal.getLunarCalendar();
  return `음력 ${intercalation ? '윤' : ''}${month}월 ${day}일`;
}

// 달력 칸에 넣을 짧은 음력 표시 — "6.4" 형식. 지원 범위 밖이면 빈 문자열.
export function lunarShortText(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const cal = new KoreanLunarCalendar();
  if (!cal.setSolarDate(y, m, d)) return '';
  const { month, day, intercalation } = cal.getLunarCalendar();
  return `${intercalation ? '윤' : ''}${month}.${day}`;
}

// 매년 반복(음력 기준) 알람용 — 특정 solarYear 안에서 그 음력 월/일에 해당하는 양력 날짜(YYYY-MM-DD)를 찾는다.
// 음력 12월은 다음 양력 해로 넘어갈 수 있어 lunarYear를 solarYear, solarYear-1 순으로 시도한다.
// 윤달(intercalation)은 무시하고 평달 기준으로만 계산한다.
export function lunarToSolarInYear(solarYear: number, lunarMonth: number, lunarDay: number): string | null {
  const cal = new KoreanLunarCalendar();
  for (const lunarYear of [solarYear, solarYear - 1]) {
    if (cal.setLunarDate(lunarYear, lunarMonth, lunarDay, false)) {
      const { year, month, day } = cal.getSolarCalendar();
      if (year === solarYear) return `${year}-${pad(month)}-${pad(day)}`;
    }
  }
  return null;
}

// 헤더 "다음 알람" — 조각으로 돌려준다. 이름(label)은 길면 말줄임되고 날짜·시각(when)은
// 항상 다 보여야 해서, 한 문자열로 합치면 한 줄 Text의 꼬리 말줄임에 시각이 잘린다.
export const nextAlarmParts = (
  alarms: Alarm[], overrides: DayOverrides = {}
): { icon: string; label: string; when: string } | null => {
  const active = alarms.filter(a => a.active);
  if (!active.length) return null;
  const candidates = active
    .map(a => ({ alarm: a, date: getNextFireDate(a, overrides) }))
    .filter((x): x is { alarm: Alarm; date: Date } => x.date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  if (!candidates.length) return null;
  const { alarm, date } = candidates[0];
  const type = getType(alarm.typeId);
  const now  = new Date();
  const isToday = date.getDate()===now.getDate() && date.getMonth()===now.getMonth() && date.getFullYear()===now.getFullYear();
  const dowLabel = t(DAYS[(date.getDay()+6)%7]);
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  // 언어마다 어순이 달라 날짜+시각을 문장 통째로 키로 둔다(한국어 결과는 기존과 동일: "오늘 06:00", "10/14 수 06:00")
  const when = isToday
    ? t('오늘 {time}', { time })
    : t('{m}/{d} {dow} {time}', { m: date.getMonth()+1, d: date.getDate(), dow: dowLabel, time });
  // 시각은 반드시 getNextFireDate가 돌려준 date에서 뽑는다 — 로테이션(pattern) 알람의
  // alarm.hour/min은 첫 블록 시각으로 고정된 레거시 폴백값이라, 그날 실제 울릴 시각과 다르다.
  // (AlarmCard는 patternTime으로 이미 고쳤지만 이 헤더 문구가 빠져 있었음)
  // 로테이션 알람의 alarm.label은 첫 블록 기준 레거시 값이라, 그날 세그먼트의 근무조로 다시 만든다
  // (workPattern.roleLabel과 같은 규칙 — 그 모듈이 이 파일을 import해서 순환을 피하려고 직접 조립).
  // 근무조는 "근무일" 기준 — 자정 넘는 근무의 퇴근은 발화일이 근무일 다음 날이라 발화일로 찾으면
  // 다른 블록(또는 비번)을 보게 된다(workDateOfFire).
  const ds = workDateOfFire(alarm, date, overrides);
  const seg = alarm.rm === 'pattern' ? effectiveShift(alarm, ds) : null;
  // shiftPrefixFor는 번역된 근무조 이름 + 공백(없으면 '')을 돌려준다 — 이름만 떼어 문장 키에 넣는다
  const shiftName = seg ? shiftPrefixFor(seg.shift, seg.shiftCustom).trim() : '';
  const label = seg
    ? (alarm.groupRole === 'offwork'
        ? (shiftName ? t('{shift} 퇴근', { shift: shiftName }) : t('퇴근'))
        : (shiftName ? t('{shift} 출근', { shift: shiftName }) : t('출근')))
    : alarmLabel(alarm);
  return { icon: type.icon, label, when };
};
