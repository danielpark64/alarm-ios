import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '../common/AppText';
import { DAYS } from '../../constants';
import { useColors } from '../../hooks/useTheme';
import { makeStyles } from './styles';

interface Props {
  days: number[];
  toggleDay: (i: number) => void;
}

export function DayOfWeekSelector({ days, toggleDay }: Props) {
  const C = useColors();
  const s = makeStyles(C);
  return (
    <View style={{ gap: 8 }}>
      <View style={s.dayRow}>
        {DAYS.map((d, i) => (
          <TouchableOpacity
            key={i}
            style={[s.dayBtn, days.includes(i) && s.dayBtnActive]}
            onPress={() => toggleDay(i)}
          >
            <Text style={[s.dayText, { color: days.includes(i) ? '#fff' : C.txt3 }]}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
