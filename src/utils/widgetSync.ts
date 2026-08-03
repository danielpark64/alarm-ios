import { Platform, NativeModules } from 'react-native';
import { Alarm } from '../constants';
import { pad, todayStr, getType, getNextFireDate, shiftForDate, isOffDay, shiftColorMap, alarmsForDate, isWorkAlarm, effectiveShift } from './index';
import { roleLabel } from './workPattern';

const { WidgetModule } = NativeModules;

const SHIFT_COLORS = ['#6c5ce7','#00b894','#e17055','#0984e3','#fd79a8','#fdcb6e','#55efc4'];

// "활성 알람 0개"를 뜻하는 센티널 — 네이티브 AlarmReceiver의 게이트와 값을 맞춰야 한다.
// (빈 문자열은 '미초기화'로 해석돼 fail-safe open이 되므로 쓰면 안 된다)
export const ACTIVE_IDS_NONE = 'none';

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

  // 로테이션 알람의 alarm.hour/min은 레거시 폴백값이라 실제 발화 시각과 다르다 — date에서 뽑는다
  const nextAlarm = nextFire?.date
    ? `${pad(nextFire.date.getHours())}:${pad(nextFire.date.getMinutes())}`
    : '--:--';

  // 근무조 표시 라벨 — 로테이션 알람이면 그날 세그먼트 기준 "초번 출근"처럼 시간대를 앞에 붙인다.
  // (AlarmCard의 displayLabel과 같은 규칙. 시간대 정보가 없으면 기존처럼 "출근"/"퇴근"만)
  const shiftLabelFor = (a: Alarm, ds: string): string => {
    const info = effectiveShift(a, ds);
    return info ? roleLabel(info, a.groupRole ?? 'commute') : getType(a.typeId).label;
  };

  // 오늘 근무조
  const todayShift = shiftForDate(alarms, today);
  const isOffToday = isOffDay(alarms, today);
  const shiftName  = todayShift ? shiftLabelFor(todayShift, today) : '--';
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
      shift:   shift ? shiftLabelFor(shift, ds) : '',
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

  // 활성 알람 ID 목록을 네이티브에 전달 — AlarmReceiver가 비활성 알람을 차단하는 데 사용.
  //
  // 활성이 0개일 때 빈 문자열을 저장하면 AlarmReceiver가 "아직 앱이 한 번도 안 돈 상태"로
  // 오인해 fail-safe open(전부 허용)으로 빠진다 — 알람을 전부 꺼둔 사용자에게 잔여 예약이
  // 울리는 경로가 된다. 그래서 "활성 0개"는 센티널로 명시해 '미초기화'와 구분한다.
  const ids = alarms.filter(a => a.active).map(a => a.id);
  WidgetModule.saveActiveAlarmIds?.(ids.length ? ids.join(',') : ACTIVE_IDS_NONE);
}
