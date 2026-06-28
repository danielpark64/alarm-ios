import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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

  return (
    <View style={cal.wrap}>
      <View style={cal.nav}>
        <TouchableOpacity onPress={prevMonth} style={cal.navBtn}>
          <Text style={cal.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={cal.navTitle}>{year}년 {month + 1}월</Text>
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
  });
}
