import { Platform, NativeModules } from 'react-native';
import { Alarm } from '../constants';
import { pad, todayStr, getType, getNextFireDate, shiftForDate, isOffDay, shiftColorMap, alarmsForDate, isWorkAlarm } from './index';

const { WidgetModule } = NativeModules;

const SHIFT_COLORS = ['#6c5ce7','#00b894','#e17055','#0984e3','#fd79a8','#fdcb6e','#55efc4'];

export async function syncWidget(alarms: Alarm[]) {
  if (Platform.OS !== 'android' || !WidgetModule?.updateWidgetData) return;

  const today = todayStr();
  const colorOf = shiftColorMap(alarms);

  // 다음 알람
  const nextFire = alarms
    .filter(a => a.active)
    .map(a => ({ alarm: a, date: getNextFireDate(a) }))
    .filter(x => x.date != null)
    .sort((a, b) => a.date!.getTime() - b.date!.getTime())[0];

  const nextAlarm = nextFire
    ? `${pad(nextFire.alarm.hour)}:${pad(nextFire.alarm.min)}`
    : '--:--';

  // 오늘 근무조
  const todayShift = shiftForDate(alarms, today);
  const isOffToday = isOffDay(alarms, today);
  const shiftName  = todayShift ? (getType(todayShift.typeId).label) : '--';
  const shiftColor = todayShift ? (colorOf[todayShift.id] ?? '#a29bfe') : '#a29bfe';

  // 다음 비번까지 D-day
  let daysUntilOff = -1;
  if (!isOffToday) {
    for (let i = 1; i <= 90; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const ds = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      if (isOffDay(alarms, ds)) { daysUntilOff = i; break; }
    }
  }

  // 이번 주 일정 (월~일, 이번 주 기준)
  const todayDate = new Date(today);
  const dow = (todayDate.getDay() + 6) % 7; // 0=월 6=일
  const weekSchedule = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - dow + i);
    const ds = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    const shift = shiftForDate(alarms, ds);
    const off   = isOffDay(alarms, ds);
    const events = alarmsForDate(alarms, ds)
      .filter(a => !isWorkAlarm(a))
      .map(a => a.label || getType(a.typeId).label)
      .filter(Boolean)
      .slice(0, 2); // 최대 2개
    return {
      date:    ds,
      shift:   shift ? getType(shift.typeId).label : '',
      color:   shift ? (colorOf[shift.id] ?? '#a29bfe') : '',
      isOff:   off,
      isToday: ds === today,
      events,
    };
  });

  const payload = JSON.stringify({
    nextAlarm,
    shiftName,
    shiftColor,
    isOffToday,
    daysUntilOff,
    weekSchedule,
  });

  WidgetModule.updateWidgetData(payload);
}
