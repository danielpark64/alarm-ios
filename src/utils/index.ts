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
  if (al.rm==='yearly')  return `매년 ${new Date(al.sd||todayStr()).getMonth()+1}월 ${new Date(al.sd||todayStr()).getDate()}일`;
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
export function alarmsForDate(alarms: Alarm[], dateStr: string): Alarm[] {
  const date = new Date(dateStr);
  const dow  = (date.getDay() + 6) % 7; // 0=월 ~ 6=일
  return alarms.filter(a => {
    if (!a.active) return false;
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
      if (sdM === 2 && sdD === 29) {
        const y = date.getFullYear();
        const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
        return date.getMonth() === 1 && date.getDate() === 29 && isLeap;
      }
      return date.getMonth() === sdM - 1 && date.getDate() === sdD;
    }
    return false;
  });
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
