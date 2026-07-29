import KoreanLunarCalendar from 'korean-lunar-calendar';
import { Alarm, TYPES, SOUNDS, VIBS, DAYS, SHIFTS, ShiftPeriod, WorkSegment } from '../constants';
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
    if (r.shift === 'custom') return r.shiftCustom?.trim() || SHIFTS.find(s => s.id === 'custom')!.label;
    if (r.shift !== 'none') return SHIFTS.find(s => s.id === r.shift)!.label;
  }
  return getType(a.typeId).label;
};
// 근무 시간대가 사용자에 의해 명시적으로 지정된 경우에만 고정 색을 반환 — 달력에서 시간순 자동 배색과 구분해 눈에 띄게 표시
export const shiftPeriodColor = (a: Alarm, resolved?: { shift: ShiftPeriod; shiftCustom?: string } | null): string | null => {
  const r = resolved !== undefined ? resolved : (a.shift && a.shift !== 'none' ? { shift: a.shift, shiftCustom: a.shiftCustom } : null);
  if (r && r.shift !== 'none') return SHIFTS.find(s => s.id === r.shift)!.color;
  return null;
};
// 라벨 입력칸 맨 앞에 붙는 근무 시간대 접두어. 해당사항없음이면 빈 문자열(기존과 동일).
// 기타는 shiftCustom 텍스트(비어있으면 접두어 없음 — 사용자가 아직 입력 전이므로 라벨을 건드리지 않음)
export const shiftPrefixFor = (shift: ShiftPeriod, shiftCustom?: string): string => {
  if (shift === 'none') return '';
  if (shift === 'custom') return shiftCustom?.trim() ? `${shiftCustom.trim()} ` : '';
  return `${SHIFTS.find(s => s.id === shift)!.label} `;
};
export const repeatLabel = (al: Alarm): string => {
  if (al.rm==='once') return '한 번';
  if (al.rm==='wdcustom' || al.rm==='daily' || al.rm==='weekdays' || al.rm==='weekends') {
    const days = al.rm==='daily' ? [0,1,2,3,4,5,6]
               : al.rm==='weekdays' ? [0,1,2,3,4]
               : al.rm==='weekends' ? [5,6]
               : (al.days ?? []);
    if (days.length === 7) return '매일';
    if (days.length === 5 && !days.includes(5) && !days.includes(6)) return '평일';
    if (days.length === 2 && days.includes(5) && days.includes(6)) return '주말';
    const n = days.map(d => DAYS[d]).join(' ');
    return n || '요일 선택';
  }
  if (al.rm==='cycle')   return `${al.cd??1}일 주기`;
  if (al.rm==='rest')    return `${al.cd??2}일 알람 후 ${al.rd??1}일 휴식`;
  if (al.rm==='pattern') {
    const segs = al.pattern ?? [];
    if (segs.length <= 1) return '근무 로테이션';
    return segs.map(s => `${s.days}일${s.isRest ? ' 비번' : ''}`).join(' → ') + ' 반복';
  }
  // sd는 반드시 문자열로 쪼개 쓴다 — new Date('2026-07-29')는 UTC 자정으로 파싱돼서
  // UTC 음수 오프셋 지역에서 하루 밀린다. 스케줄러(getNextFireDate/core.ts)가 sd.split('-')
  // 기준이라, 여기서 Date로 파싱하면 카드에 적힌 날짜와 실제 울리는 날이 어긋난다.
  const [, sdM, sdD] = (al.sd || todayStr()).split('-').map(Number);
  if (al.rm==='monthly') return al.lastDay ? '매월 말일' : `매월 ${sdD}일`;
  if (al.rm==='yearly') {
    const M = sdM, D = sdD;
    if (!al.lunar) return `매년 ${M}월 ${D}일`;
    // 음력은 해마다 양력 날짜가 달라져서 음력 표기만으로는 언제 울리는지 알 수 없다.
    // 다음에 울릴 양력 날짜를 병기한다 — 올해분이 이미 지났으면 내년 기준으로 환산.
    const y = new Date().getFullYear();
    const thisYear = lunarToSolarInYear(y, M, D);
    const solar = (thisYear && thisYear >= todayStr()) ? thisYear : lunarToSolarInYear(y + 1, M, D);
    // 변환 지원 범위(1000~2050) 밖이면 조용히 음력 표기만 남긴다
    const suffix = solar ? ` (양력 ${Number(solar.split('-')[1])}월 ${Number(solar.split('-')[2])}일)` : '';
    return `매년 음력 ${M}월 ${D}일${suffix}`;
  }
  return '한 번';
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

// 로테이션 알람이 dateStr에 실제로 울리는 시각(출근/퇴근 세그먼트별) — 휴식일이면 null.
// 비로테이션 알람은 기존 alarm.hour/min을 그대로 반환(하위호환).
export function effectiveTime(a: Alarm, dateStr: string): { hour: number; min: number } | null {
  if (a.rm === 'pattern' && a.pattern?.length) {
    const r = resolveSegment(a.pattern, a.sd, dateStr);
    if (!r || r.segment.isRest) return null;
    const t = a.groupRole === 'offwork' ? r.segment.offworkTime : r.segment.commuteTime;
    return t ?? null;
  }
  return { hour: a.hour, min: a.min };
}

export function getNextFireDate(alarm: Alarm): Date | null {
  const now  = new Date();
  const today = todayStr();
  const startDate = alarm.sd || today;
  // 매년(음력 포함) 알람은 1년 가까이 뒤일 수 있어 "다음 알람" 미리보기가 놓치지 않도록 넉넉히 훑는다.
  // (실제 OS 알림 예약은 별도로 14일 창만 쓰므로 여기 범위 확장은 성능에 영향 없음)
  const searchDays = alarm.rm === 'yearly' ? 400 : 14;
  for (let ahead = 0; ahead <= searchDays; ahead++) {
    const cand = new Date(now);
    cand.setDate(cand.getDate() + ahead);
    const cs = `${cand.getFullYear()}-${pad(cand.getMonth()+1)}-${pad(cand.getDate())}`;
    if (cs < startDate) continue;
    if (alarm.skips?.includes(cs)) continue;

    // 로테이션 알람은 날짜마다 시각이 달라서(세그먼트별 출근/퇴근 시각) 일반 알람처럼
    // 맨 위에서 alarm.hour/min으로 setHours할 수 없다 — 세그먼트를 먼저 찾은 뒤 그 시각을 쓴다.
    if (alarm.rm === 'pattern') {
      const t = effectiveTime(alarm, cs);
      if (!t) continue;
      cand.setHours(t.hour, t.min, 0, 0);
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

// 반복 울림(rep) 슬롯을 받지 못하는 알람 ID 집합 계산
export function getRepLimitedIds(alarms: Alarm[]): Set<number> {
  const active = alarms.filter(a => a.active);

  // 메인 트리거 슬롯 수 추정
  let mainSlots = 0;
  const groups = new Map<string, Alarm[]>();
  for (const a of active) {
    const key = `${a.hour}_${a.min}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
    mainSlots += a.rm === 'wdcustom' ? Math.max(1, a.days?.length || 1) : 2;
  }

  const maxRepGroups = Math.floor(Math.max(0, 62 - mainSlots) / 2);

  // 다음 발화 기준 오름차순 정렬 → 가까운 알람 우선 rep 배정
  const sorted = [...groups.values()].sort((a, b) => {
    const tA = Math.min(...a.map(x => getNextFireDate(x)?.getTime() ?? Infinity));
    const tB = Math.min(...b.map(x => getNextFireDate(x)?.getTime() ?? Infinity));
    return tA - tB;
  });

  const limited = new Set<number>();
  sorted.slice(maxRepGroups).forEach(group => group.forEach(a => limited.add(a.id)));
  return limited;
}

// 해당 날짜에 울리는 알람 목록 계산
// includeSkipped: 하루 팝업처럼 "이날 꺼진 알람"도 함께 보여줘야 할 때 true
export function alarmsForDate(alarms: Alarm[], dateStr: string, includeSkipped = false): Alarm[] {
  const date = new Date(dateStr);
  const dow  = (date.getDay() + 6) % 7; // 0=월 ~ 6=일
  return alarms.filter(a => {
    if (!a.active) return false;
    if (!includeSkipped && a.skips?.includes(dateStr)) return false;
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

export const nextAlarmText = (alarms: Alarm[]): string => {
  const active = alarms.filter(a => a.active);
  if (!active.length) return '';
  const candidates = active
    .map(a => ({ alarm: a, date: getNextFireDate(a) }))
    .filter((x): x is { alarm: Alarm; date: Date } => x.date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  if (!candidates.length) return '';
  const { alarm, date } = candidates[0];
  const type = getType(alarm.typeId);
  const now  = new Date();
  const isToday = date.getDate()===now.getDate() && date.getMonth()===now.getMonth() && date.getFullYear()===now.getFullYear();
  const dowLabel = DAYS[(date.getDay()+6)%7];
  const dateStr  = isToday ? `오늘` : `${date.getMonth()+1}/${date.getDate()} ${dowLabel}`;
  return `다음 ${type.icon} ${dateStr} ${pad(alarm.hour)}:${pad(alarm.min)}`;
};
