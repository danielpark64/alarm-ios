import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { TYPES, Alarm } from '../../constants';
import { s } from './styles';

interface Props {
  typeId: Alarm['typeId'];
  onChange: (typeId: Alarm['typeId']) => void;
}

export function TypeSelector({ typeId, onChange }: Props) {
  return (
    <View style={[s.typeGrid, { marginTop: 4 }]}>
      {TYPES.map(t => (
        <TouchableOpacity
          key={t.id}
          style={[
            s.typeBtn,
            { borderColor: t.color },
            typeId === t.id && { backgroundColor: t.color, borderColor: t.color },
          ]}
          onPress={() => onChange(t.id)}
        >
          <Text style={[s.typeBtnLabel, { color: t.color }, typeId === t.id && { color: '#fff' }]}>
            {t.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
