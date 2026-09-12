import { Platform, NativeModules } from 'react-native';
import { Alarm, DayOverrides, SHIFTS } from '../constants';
import { pad, todayStr, getType, getNextFireDate, shiftForDate, isOffDay, shiftColorMap, alarmsForDate, isWorkAlarm, effectiveShift, dayOverrideDisplay } from './index';
import { roleLabel } from './workPattern';

const { WidgetModule } = NativeModules;

const SHIFT_COLORS = ['#6c5ce7','#00b894','#e17055','#0984e3','#fd79a8','#fdcb6e','#55efc4'];

// "활성 알람 0개"를 뜻하는 센티널 — 네이티브 AlarmReceiver의 게이트와 값을 맞춰야 한다.
// (빈 문자열은 '미초기화'로 해석돼 fail-safe open이 되므로 쓰면 안 된다)
export const ACTIVE_IDS_NONE = 'none';

export async function syncWidget(alarms: Alarm[], overrides: DayOverrides = {}) {
  if (Platform.OS !== 'android' || !WidgetModule?.updateWidgetData) return;

  const today = todayStr();
  const colorOf = shiftColorMap(alarms);

  // 다음 알람
  const nextFire = alarms
    .filter(a => a.active)
    .map(a => ({ alarm: a, date: getNextFireDate(a, overrides) }))
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

  // 오늘 근무조 — override가 있으면 그걸로 확정(연차 등은 비번 취급, 대근 등은 그 이름으로).
  // 없으면(ovToday===null) 기존 shiftForDate/isOffDay 경로 그대로.
  const ovToday = dayOverrideDisplay(overrides[today]);
  const todayShift = ovToday ? null : shiftForDate(alarms, today);
  const isOffToday = ovToday ? ovToday.isOff : isOffDay(alarms, today);
  const shiftName  = ovToday ? ovToday.label : (todayShift ? shiftLabelFor(todayShift, today) : '--');
  // override로 대근·특근 등 근무조가 정해진 날은 그 근무조 고유색(SHIFTS.color)을 쓴다 —
  // colorOf는 알람 id 기준 팔레트라 override(가상의 근무)에는 매칭되는 항목이 없다.
  const shiftColor = ovToday?.shift
    ? (SHIFTS.find(s => s.id === ovToday.shift)?.color ?? '#a29bfe')
    : (todayShift ? (colorOf[todayShift.id] ?? '#a29bfe') : '#a29bfe');

  // 다음 비번까지 D-day — override로 근무가 켜진 날(대근 등)은 비번이 아니고,
  // override로 꺼진 날(연차 등)은 비번으로 센다.
  const isOffOn = (ds: string) => {
    const ov = dayOverrideDisplay(overrides[ds]);
    return ov ? ov.isOff : isOffDay(alarms, ds);
  };
  let daysUntilOff = -1;
  if (!isOffToday) {
    for (let i = 1; i <= 90; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const ds = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      if (isOffOn(ds)) { daysUntilOff = i; break; }
    }
  }

  // 이번 주 일정 (일~토, 이번 주 기준)
  // ⚠️ 이 배열의 순서는 WidgetListService.kt의 dayNames와 위치로만 맞춰진다.
  //    한쪽만 바꾸면 위젯 요일 라벨이 전부 어긋나므로 반드시 같은 빌드로 배포할 것.
  const todayDate = new Date(today);
  const dow = todayDate.getDay(); // 0=일 6=토
  const weekSchedule = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - dow + i);
    const ds = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    const ov = dayOverrideDisplay(overrides[ds]);
    const shift = ov ? null : shiftForDate(alarms, ds);
    const off   = ov ? ov.isOff : isOffDay(alarms, ds);
    const events = alarmsForDate(alarms, ds)
      .filter(a => !isWorkAlarm(a))
      .map(a => a.label || getType(a.typeId).label)
      .filter(Boolean)
      .slice(0, 2); // 최대 2개
    return {
      date:    ds,
      shift:   ov ? ov.label : (shift ? shiftLabelFor(shift, ds) : ''),
      color:   ov?.shift ? (SHIFTS.find(s => s.id === ov.shift)?.color ?? '#a29bfe')
                          : (shift ? (colorOf[shift.id] ?? '#a29bfe') : ''),
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
