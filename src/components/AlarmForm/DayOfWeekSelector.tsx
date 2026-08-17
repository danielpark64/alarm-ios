import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '../common/AppText';
import { DAYS_DISPLAY, displayToStore } from '../../constants';
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
        {/* 버튼은 일요일부터 보여주되(달력과 동일), 저장값은 기존 체계(0=월)를 그대로 유지한다.
            displayToStore를 거치지 않고 화면 인덱스를 저장하면 요일이 하루씩 밀린다. */}
        {DAYS_DISPLAY.map((d, i) => {
          const store = displayToStore(i);
          const on = days.includes(store);
          return (
            <TouchableOpacity
              key={i}
              style={[s.dayBtn, on && s.dayBtnActive]}
              onPress={() => toggleDay(store)}
            >
              <Text style={[s.dayText, { color: on ? '#fff' : C.txt3 }]}>{d}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
