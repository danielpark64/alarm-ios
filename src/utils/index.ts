import { Alarm, TYPES, SOUNDS, VIBS, DAYS } from '../constants';
export const pad = (n: number) => String(n).padStart(2, '0');
export const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
export const fmtDate = (s: string) => { if (!s) return ''; const [y,m,d] = s.split('-'); return `${y}.${m}.${d}`; };
export const getType  = (id: string) => TYPES.find(t => t.id === id) ?? TYPES[TYPES.length-1];
export const getSound = (id: string) => SOUNDS.find(s => s.id === id) ?? SOUNDS[1];
export const getVib   = (id: string) => VIBS.find(v => v.id === id) ?? VIBS[0];
export const repeatLabel = (al: Alarm): string => {
  if (al.rm==='once')     return '한 번';
  if (al.rm==='daily')    return '매일';
  if (al.rm==='weekdays') return '평일';
  if (al.rm==='weekends') return '주말';
  if (al.rm==='wdcustom') { const n=(al.days??[]).map(d=>DAYS[d]).join(', '); return n?`매주 ${n}`:'요일 선택'; }
  if (al.rm==='cycle')    return `${al.cd??1}일 주기`;
  if (al.rm==='rest')     return `${al.cd??2}일 알람 후 ${al.rd??1}일 휴식`;
  return '한 번';
};

function dayDiff(a: Date, b: Date): number {
  return Math.floor((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate()) -
                     Date.UTC(a.getFullYear(),a.getMonth(),a.getDate())) / 86400000);
}

function getNextFireDate(alarm: Alarm): Date | null {
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
