import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { TYPES, Alarm } from '../../constants';
import { useColors } from '../../hooks/useTheme';
import { makeStyles } from './styles';

interface Props {
  typeId: Alarm['typeId'];
  onChange: (typeId: Alarm['typeId']) => void;
  gridRef?: React.Ref<View>;
}

export function TypeSelector({ typeId, onChange, gridRef }: Props) {
  const C = useColors();
  const s = makeStyles(C);
  return (
    <View ref={gridRef} style={[s.typeGrid, { marginTop: 4 }]}>
      {TYPES.map(t => {
        const active = typeId === t.id;
        return (
          <TouchableOpacity
            key={t.id}
            style={[
              s.typeBtn,
              { borderColor: active ? t.color : t.color + '40' },
              active && { backgroundColor: t.color },
            ]}
            onPress={() => onChange(t.id)}
          >
            <Text style={[s.typeBtnIcon, !active && { opacity: 0.6 }]}>{t.icon}</Text>
            <Text style={[s.typeBtnLabel, { color: active ? '#fff' : C.txt3 }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
