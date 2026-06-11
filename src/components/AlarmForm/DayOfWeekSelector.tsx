import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { DAYS } from '../../constants';
import { s } from './styles';

interface Props {
  days: number[];
  setDays: (days: number[]) => void;
  toggleDay: (i: number) => void;
}

export function DayOfWeekSelector({ days, setDays, toggleDay }: Props) {
  return (
    <View style={{ marginTop: 18, gap: 8 }}>
      <View style={s.optDivider}>
        <View style={s.optDividerLine} />
        <Text style={s.optDividerLabel}>요일 선택</Text>
        <View style={s.optDividerLine} />
      </View>
      <View style={s.quickRow}>
        {([
          { label: '매일', days: [0, 1, 2, 3, 4, 5, 6] },
          { label: '평일', days: [0, 1, 2, 3, 4] },
          { label: '주말', days: [5, 6] },
        ] as const).map(p => {
          const active = p.days.length === days.length && p.days.every(d => days.includes(d));
          return (
            <TouchableOpacity
              key={p.label}
              style={[s.quickBtn, active && s.dayBtnActive]}
              onPress={() => setDays([...p.days])}
            >
              <Text style={[s.quickBtnText, active && { color: '#fff' }]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={s.dayRow}>
        {DAYS.map((d, i) => (
          <TouchableOpacity
            key={i}
            style={[s.dayBtn, days.includes(i) && s.dayBtnActive]}
            onPress={() => toggleDay(i)}
          >
            <Text style={[s.dayText, { color: days.includes(i) ? '#fff' : '#555' }]}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
