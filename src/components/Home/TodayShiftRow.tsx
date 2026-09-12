import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../common/AppText';
import { Alarm, DayOverrides } from '../../constants';
import {
  pad, todayStr, isOffDay, shiftForDate, effectiveShift,
  shiftPeriodLabel, shiftPeriodId, shiftToneIndexMap, dayOverrideDisplay,
} from '../../utils';
import { Palette } from '../../constants/colors';
import { useColors } from '../../hooks/useTheme';
import { useScale, rf } from '../../utils/responsive';

// 헤더의 "오늘/내일 근무" 줄. 위젯(widgetSync)은 이미 같은 값을 계산해 쓰고 있었는데
// 정작 앱을 열면 "내일이 야간인지"를 달력까지 들어가야 알 수 있었다.
// 색·라벨은 달력 셀과 반드시 같은 경로로 뽑는다 — 두 화면 색이 다르면 같은 근무조로 안 읽힌다.

type DayInfo = { label: string; bg: string; fg: string; border: string | null };

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayInfo(alarms: Alarm[], ds: string, toneIdxOf: Record<number, number>, C: Palette, overrides: DayOverrides): DayInfo | null {
  // 하루 근무 변경(연차·대근 등)이 있으면 그걸로 확정 — 없으면(ov===null) 기존 경로 그대로.
  // 달력 셀과 반드시 같은 순서로 확인해야 "홈엔 있는데 달력엔 없다"는 불일치가 안 생긴다.
  const ov = dayOverrideDisplay(overrides[ds]);
  if (ov) {
    if (ov.isOff) return { label: ov.label, bg: C.offBg, fg: C.offFg, border: C.offBorder };
    const id = ov.shift ?? null;
    const tone = id ? C.shift[id] : C.shiftAuto[0];
    return { label: ov.label, bg: tone.bg, fg: tone.fg, border: null };
  }
  // 비번은 달력과 같은 "파란 테두리 박스" — 채운 알약으로 그리면 근무조와 같은 비중으로 읽힌다
  if (isOffDay(alarms, ds)) return { label: '비번', bg: C.offBg, fg: C.offFg, border: C.offBorder };
  const a = shiftForDate(alarms, ds);
  if (!a) return null;
  const resolved = effectiveShift(a, ds);
  // 달력 셀(CalendarView.tsx)과 표시 조건을 맞춘다 — 시간대(초/중/말/기타)를 지정하지 않은
  // 알람은 resolved가 null이고, 달력은 이 경우 배지를 아예 안 그린다. 여기서도 똑같이 숨겨야
  // "홈엔 배지가 있는데 달력엔 없다"는 불일치가 안 생긴다.
  if (!resolved) return null;
  const id = shiftPeriodId(a, resolved);
  const tone = id ? C.shift[id] : C.shiftAuto[(toneIdxOf[a.id] ?? 0) % C.shiftAuto.length];
  return { label: shiftPeriodLabel(a, resolved), bg: tone.bg, fg: tone.fg, border: null };
}

export const TodayShiftRow = React.memo(function TodayShiftRow(
  { alarms, tick, overrides }: { alarms: Alarm[]; tick: number; overrides: DayOverrides }
) {
  const C = useColors();
  const scale = useScale();
  const s = makeStyles(C, scale);
  const toneIdxOf = useMemo(() => shiftToneIndexMap(alarms), [alarms]);
  // tick을 dep에 넣는 이유는 자정 롤오버 — 알람이 안 바뀌면 날짜가 넘어가도 어제 값이 남는다
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const [today, tomorrow] = useMemo(() => {
    const t = todayStr();
    return [dayInfo(alarms, t, toneIdxOf, C, overrides), dayInfo(alarms, addDays(t, 1), toneIdxOf, C, overrides)];
  }, [alarms, toneIdxOf, C, overrides, tick]);

  // 근무 알람이 없는 일반 사용자는 줄 자체가 뜨지 않는다(isWorkAlarm이 걸러줌)
  if (!today && !tomorrow) return null;

  return (
    <View style={s.row}>
      {today && (
        <View style={s.item}>
          <Text style={s.prefix}>오늘</Text>
          {/* key를 라벨로 줘서 override 직후 실기기(Android)에서 배경만 바뀌고 글자가 안 그려지는
              드문 리페인트 결함을 우회한다 — 내용이 바뀌면 새 엘리먼트로 교체돼 새로 그려진다 */}
          <Text key={today.label} style={[s.badge, { color: today.fg, backgroundColor: today.bg },
                        today.border ? { borderWidth: 2, borderColor: today.border } : null]}
                numberOfLines={1}>{today.label}</Text>
        </View>
      )}
      {tomorrow && (
        <View style={s.item}>
          <Text style={s.prefix}>내일</Text>
          <Text key={tomorrow.label} style={[s.badge, { color: tomorrow.fg, backgroundColor: tomorrow.bg },
                        tomorrow.border ? { borderWidth: 2, borderColor: tomorrow.border } : null]}
                numberOfLines={1}>{tomorrow.label}</Text>
        </View>
      )}
    </View>
  );
});

function makeStyles(C: Palette, scale: number) {
  return StyleSheet.create({
    row:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 7, flexWrap: 'wrap' },
    item:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
    // 접두어는 배지 바깥에 둔다 — 배지 색은 근무조 식별용이라 "오늘/내일"까지 물들이면 의미가 흐려진다
    prefix: { fontSize: rf(12.5, scale), fontWeight: '700', color: C.txt3 },
    badge:  { fontSize: rf(13, scale), fontWeight: '800', borderRadius: 99,
              overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 1 },
  });
}
