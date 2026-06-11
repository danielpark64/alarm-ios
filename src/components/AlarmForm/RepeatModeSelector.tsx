import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { REPEAT } from '../../constants';
import { s } from './styles';

interface Props {
  rm: string;
  setRm: (id: string) => void;
}

export function RepeatModeSelector({ rm, setRm }: Props) {
  return (
    <>
      <Text style={s.sLabel}>반복 방식</Text>
      <View style={{ gap: 8 }}>
        {([0, 3] as const).map(start => (
          <View key={start} style={{ flexDirection: 'row', gap: 8 }}>
            {REPEAT.slice(start, start + 3).map(r => (
              <TouchableOpacity
                key={r.id}
                style={[s.pill, rm === r.id && s.pillActive]}
                onPress={() => setRm(r.id)}
              >
                <Text style={[s.pillText, rm === r.id && { color: '#fff' }]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </>
  );
}
