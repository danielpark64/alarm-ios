import KoreanLunarCalendar from 'korean-lunar-calendar';
import { Alarm, TYPES, SOUNDS, VIBS, DAYS } from '../constants';
export const pad = (n: number) => String(n).padStart(2, '0');
export const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
export const fmtDate = (s: string) => { if (!s) return ''; const [y,m,d] = s.split('-'); return `${y}.${m}.${d}`; };
export const getType  = (id: string) => TYPES.find(t => t.id === id) ?? TYPES[TYPES.length-1];
export const getSound = (id: string) => SOUNDS.find(s => s.id === id) ?? SOUNDS[1];
export const getVib   = (id: string) => VIBS.find(v => v.id === id) ?? VIBS[0];
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
  if (al.rm==='monthly') return al.lastDay ? '매월 말일' : `매월 ${new Date(al.sd||todayStr()).getDate()}일`;
  if (al.rm==='yearly')  return `매년 ${al.lunar ? '음력 ' : ''}${new Date(al.sd||todayStr()).getMonth()+1}월 ${new Date(al.sd||todayStr()).getDate()}일`;
  return '한 번';
};

function dayDiff(a: Date, b: Date): number {
  return Math.floor((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate()) -
                     Date.UTC(a.getFullYear(),a.getMonth(),a.getDate())) / 86400000);
}

export function getNextFireDate(alarm: Alarm): Date | null {
  const now  = new Date();
  const today = todayStr();
  const startDate = alarm.sd || today;
  for (let ahead = 0; ahead <= 14; ahead++) {
    const cand = new Date(now);
    cand.setDate(cand.getDate() + ahead);
    cand.setHours(alarm.hour, alarm.min, 0, 0);
    if (cand <= now) continue;
    const cs = `${cand.getFullYear()}-${pad(cand.getMonth()+1)}-${pad(cand.getDate())}`;
    if (cs < startDate) continue;
    if (alarm.skips?.includes(cs)) continue;
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
  a.active && (a.rm === 'cycle' || a.rm === 'rest') && (a.typeId === 'commute' || a.typeId === 'offwork');

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
export function shiftForDate(alarms: Alarm[], dateStr: string): Alarm | null {
  const rings = alarmsForDate(alarms.filter(isWorkAlarm), dateStr);
  if (!rings.length) return null;
  rings.sort((a, b) =>
    (a.typeId === 'commute' ? 0 : 1) - (b.typeId === 'commute' ? 0 : 1) ||
    a.hour - b.hour || a.min - b.min);
  return rings[0];
}

// 비번: 근무 알람이 하나라도 있고 그 시작일 이후인데, 그날 아무 근무 알람도 안 울리는 날
export function isOffDay(alarms: Alarm[], dateStr: string): boolean {
  const work = alarms.filter(isWorkAlarm);
  if (!work.length) return false;
  if (!work.some(a => !a.sd || dateStr >= a.sd)) return false;
  return alarmsForDate(work, dateStr).length === 0;
}

// 양력 날짜(YYYY-MM-DD) → 음력 "M월 D일" 문자열. 지원 범위(1000~2050년) 밖이면 빈 문자열.
export function lunarDateText(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const cal = new KoreanLunarCalendar();
  if (!cal.setSolarDate(y, m, d)) return '';
  const { month, day, intercalation } = cal.getLunarCalendar();
  return `음력 ${intercalation ? '윤' : ''}${month}월 ${day}일`;
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
