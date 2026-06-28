import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { REPEAT } from '../../constants';
import { useColors } from '../../hooks/useTheme';
import { makeStyles } from './styles';

interface Props {
  rm: string;
  setRm: (id: string) => void;
}

const PRIMARY = [
  { id: 'cycle', icon: '🔁', label: 'N일 주기', hint: '예: 2일마다' },
  { id: 'rest',  icon: '🌙', label: 'N일 후 휴식', hint: '예: 4일 근무 2일 휴식' },
] as const;

const SECONDARY_ORDER = ['wdcustom', 'monthly', 'yearly', 'once'];

export function RepeatModeSelector({ rm, setRm }: Props) {
  const s = makeStyles(useColors());
  const secondary = SECONDARY_ORDER
    .map(id => REPEAT.find(r => r.id === id))
    .filter((r): r is typeof REPEAT[number] => !!r);

  return (
    <>
      <Text style={s.sLabel}>반복 방식</Text>

      <View style={s.repeatPrimaryRow}>
        {PRIMARY.map(p => {
          const active = rm === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              style={[s.repeatPrimaryCard, active && s.repeatPrimaryActive]}
              onPress={() => setRm(p.id)}
            >
              <Text style={s.repeatPrimaryIcon}>{p.icon}</Text>
              <Text style={[s.repeatPrimaryLabel, active && s.repeatPrimaryLabelActive]}>{p.label}</Text>
              <Text style={[s.repeatPrimaryHint, active && s.repeatPrimaryHintActive]}>{p.hint}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={s.repeatDivider} />

      <View style={s.repeatSecondaryRow}>
        {secondary.map(r => {
          const active = rm === r.id;
          return (
            <TouchableOpacity
              key={r.id}
              style={[s.pill, active && s.pillActive]}
              onPress={() => setRm(r.id)}
            >
              <Text style={[s.pillText, active && s.pillTextActive]}>{r.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}
