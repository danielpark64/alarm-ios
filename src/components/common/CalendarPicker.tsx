import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from './AppText';
import { DAYS } from '../../constants';
import { pad, todayStr } from '../../utils';
import { Palette } from '../../constants/colors';
import { useColors } from '../../hooks/useTheme';

// ─── 날짜 포맷 ────────────────────────────────────────────────────────────────
export function fmtDisplayDate(s: string): string {
  const ds    = s || todayStr();
  const parts = ds.split('-').map(Number);
  const date  = new Date(parts[0], parts[1] - 1, parts[2]);
  const dow   = (date.getDay() + 6) % 7;
  return `${pad(parts[1])}.${pad(parts[2])} (${DAYS[dow]})`;
}

// 연도 선택 그리드 — CalendarView.tsx의 연도 피커와 같은 8년(2열×4행) 페이지 방식
const YEAR_ROWS = 4;
const YEARS_PER_PAGE = YEAR_ROWS * 2;
const YEAR_CENTER_OFFSET = 2;

// ─── 달력 피커 ────────────────────────────────────────────────────────────────
export function CalendarPicker({
  value, onChange, onClose,
}: { value: string; onChange: (s: string) => void; onClose: () => void }) {
  const C = useColors();
  const cal = makeStyles(C);
  const init = value ? new Date(value) : new Date();
  const [year,  setYear]  = useState(init.getFullYear());
  const [month, setMonth] = useState(init.getMonth());
  const today = todayStr();
  // 연도 직접 선택 — 월 화살표로 한 달씩만 넘기면 몇 년 전/후 날짜(제사 등 음력 기념일 포함)를
  // 고를 때 수십 번 눌러야 해서 답답함. 연도 텍스트를 탭하면 연도 그리드로 바로 점프 가능하게.
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [yearPageStart, setYearPageStart] = useState(year - YEAR_CENTER_OFFSET);

  const openYearPicker = () => {
    setYearPageStart(year - YEAR_CENTER_OFFSET);
    setShowYearPicker(true);
  };
  const yearOptions = Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearPageStart + i);
  const yearCol1 = yearOptions.slice(0, YEAR_ROWS);
  const yearCol2 = yearOptions.slice(YEAR_ROWS);
  const selectYear = (y: number) => { setYear(y); setShowYearPicker(false); };

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1);
  };

  const firstDow    = new Date(year, month, 1).getDay();
  const offset      = (firstDow + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  if (showYearPicker) {
    return (
      <View style={cal.wrap}>
        <View style={cal.nav}>
          <TouchableOpacity onPress={() => setYearPageStart(p => p - YEARS_PER_PAGE)} style={cal.navBtn}>
            <Text style={cal.navArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={cal.navTitle}>연도 선택</Text>
          <TouchableOpacity onPress={() => setYearPageStart(p => p + YEARS_PER_PAGE)} style={cal.navBtn}>
            <Text style={cal.navArrow}>›</Text>
          </TouchableOpacity>
        </View>
        <View style={cal.yearGrid}>
          {[yearCol1, yearCol2].map((col, ci) => (
            <View key={ci} style={cal.yearCol}>
              {col.map(y => {
                const isActive = y === year;
                return (
                  <TouchableOpacity
                    key={y}
                    style={[cal.yearBtn, isActive && cal.yearBtnActive]}
                    onPress={() => selectYear(y)}
                  >
                    <Text style={[cal.yearBtnText, isActive && cal.yearBtnTextActive]}>{y}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
        <TouchableOpacity style={cal.todayBtn} onPress={() => setShowYearPicker(false)}>
          <Text style={cal.todayBtnText}>닫기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={cal.wrap}>
      <View style={cal.nav}>
        <TouchableOpacity onPress={prevMonth} style={cal.navBtn}>
          <Text style={cal.navArrow}>‹</Text>
        </TouchableOpacity>
        <View style={cal.navTitleRow}>
          {/* 연도는 CalendarView(달력 탭)의 연도 피커와 똑같이 배경 있는 알약 버튼으로 —
              화살표(‹›)는 그대로 월 이동 전용이고, 연도만 따로 탭해서 점프하는 게 명확해짐 */}
          <TouchableOpacity style={cal.yearTapBtn} activeOpacity={0.6} onPress={openYearPicker}>
            <Text style={cal.navTitle}>{year}년</Text>
            <Text style={cal.yearChevron}>▾</Text>
          </TouchableOpacity>
          <Text style={cal.navTitle}> {month + 1}월</Text>
        </View>
        <TouchableOpacity onPress={nextMonth} style={cal.navBtn}>
          <Text style={cal.navArrow}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={cal.grid}>
        {DAYS.map((d, i) => (
          <View key={i} style={cal.headCell}>
            <Text style={[cal.headText, i >= 5 && { color: '#e07070' }]}>{d}</Text>
          </View>
        ))}
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={cal.cell} />;
          const ds      = `${year}-${pad(month + 1)}-${pad(d)}`;
          const isPast  = ds < today;
          const isSel   = ds === value;
          const isToday = ds === today;
          const dow     = (offset + d - 1) % 7;
          return (
            <TouchableOpacity
              key={i}
              style={[cal.cell, isSel && cal.cellSel, isToday && !isSel && cal.cellToday]}
              onPress={() => { if (!isPast) { onChange(ds); onClose(); } }}
              disabled={isPast}
            >
              <Text style={[
                cal.cellText,
                dow >= 5 && { color: '#e07070' },
                isPast && { color: C.border2 },
                isSel && { color: C.txt, fontWeight: '900' },
                isToday && !isSel && { fontWeight: '900', color: C.accent },
              ]}>{d}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity style={cal.todayBtn} onPress={() => { onChange(today); onClose(); }}>
        <Text style={cal.todayBtnText}>오늘로 설정</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    wrap:         { gap: 8 },
    nav:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    navBtn:       { padding: 8 },
    navArrow:     { fontSize: 22, color: C.accent, fontWeight: '900' },
    navTitle:     { fontSize: 15, fontWeight: '700', color: C.txt },
    grid:         { flexDirection: 'row', flexWrap: 'wrap' },
    headCell:     { width: '14.28%', alignItems: 'center', paddingVertical: 4 },
    headText:     { fontSize: 11, fontWeight: '600', color: C.txt3 },
    cell:         { width: '14.28%', alignItems: 'center', paddingVertical: 6 },
    cellText:     { fontSize: 13, color: C.txt2, fontWeight: '500' },
    cellSel:      { backgroundColor: C.accent2, borderRadius: 99 },
    cellToday:    { borderWidth: 1.5, borderColor: C.accent2, borderRadius: 99 },
    todayBtn:     { marginTop: 12, padding: 12, backgroundColor: C.accent2, borderRadius: 14, alignItems: 'center' },
    todayBtnText: { fontSize: 14, fontWeight: '700', color: C.txt },
    // 연도 직접 선택 — 월 단위로만 넘기면 년 단위 이동이 너무 느려서 추가.
    // CalendarView(달력 탭)의 연도 버튼과 똑같이 배경 있는 알약 형태로 통일
    navTitleRow:  { flexDirection: 'row', alignItems: 'center' },
    yearTapBtn:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 11, backgroundColor: C.bg3, borderWidth: 1.3, borderColor: C.border2 },
    yearChevron:  { fontSize: 12, fontWeight: '900', color: C.txt3, marginLeft: 3 },
    yearGrid:     { flexDirection: 'row', gap: 8 },
    yearCol:      { flex: 1, gap: 8 },
    yearBtn:      { paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border2 },
    yearBtnActive:{ backgroundColor: C.accent2, borderColor: C.accent2 },
    yearBtnText:      { fontSize: 14, fontWeight: '700', color: C.txt2 },
    yearBtnTextActive:{ color: C.txt, fontWeight: '900' },
  });
}
