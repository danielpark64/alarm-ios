import React from 'react';
import { View, TouchableOpacity, TextInput } from 'react-native';
import { Text } from '../common/AppText';
import { SHIFTS, ShiftPeriod } from '../../constants';
import { useColors } from '../../hooks/useTheme';
import { makeStyles } from './styles';

interface Props {
  shift: ShiftPeriod;
  onChange: (shift: ShiftPeriod) => void;
  shiftCustom: string;
  onCustomChange: (text: string) => void;
}

export function ShiftSelector({ shift, onChange, shiftCustom, onCustomChange }: Props) {
  const C = useColors();
  const s = makeStyles(C);
  return (
    <View>
      <View style={s.shiftGrid}>
        {SHIFTS.map(sh => {
          const active = shift === sh.id;
          return (
            <TouchableOpacity
              key={sh.id}
              style={[s.shiftBtn, active && { backgroundColor: sh.color, borderColor: sh.color }]}
              onPress={() => onChange(sh.id)}
            >
              <Text style={[s.shiftBtnLabel, { color: active ? '#fff' : sh.color }]}>
                {sh.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {shift === 'custom' && (
        <TextInput
          style={s.shiftCustomInput}
          value={shiftCustom}
          onChangeText={onCustomChange}
          placeholder="근무 시간대 이름을 입력하세요 (예: 새벽조)"
          placeholderTextColor={C.txt3}
          returnKeyType="done"
        />
      )}
    </View>
  );
}
