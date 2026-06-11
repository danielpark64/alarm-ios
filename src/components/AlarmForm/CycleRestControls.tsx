import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { CYCLE_PRESETS } from '../../constants';
import { s } from './styles';

interface Props {
  rm: string;
  cd: number;
  setCd: (v: number) => void;
  rd: number;
  setRd: (v: number) => void;
}

export function CycleRestControls({ rm, cd, setCd, rd, setRd }: Props) {
  return (
    <View style={s.cycleBox}>
      {rm === 'rest' && <Text style={s.cycleLabel}>알람 일수</Text>}
      <View style={s.stepper}>
        <TouchableOpacity style={s.stepBtn} onPress={() => setCd(Math.max(1, cd - 1))}>
          <Text style={s.stepBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={s.stepVal}>
          {cd}<Text style={s.stepUnit}>{rm === 'rest' ? '일 알람' : '일마다'}</Text>
        </Text>
        <TouchableOpacity style={s.stepBtn} onPress={() => setCd(Math.min(365, cd + 1))}>
          <Text style={s.stepBtnText}>＋</Text>
        </TouchableOpacity>
      </View>
      <View style={s.presetRow}>
        {(rm === 'cycle' ? CYCLE_PRESETS : [1, 2, 3, 4, 5, 6, 7]).map(n => (
          <TouchableOpacity
            key={n}
            style={[s.preset, cd === n && s.presetActive]}
            onPress={() => setCd(n)}
          >
            <Text style={[s.presetText, cd === n && { color: '#fff' }]}>{n}일</Text>
          </TouchableOpacity>
        ))}
      </View>
      {rm === 'rest' && (
        <>
          <Text style={[s.cycleLabel, { marginTop: 12 }]}>휴식 일수</Text>
          <View style={s.stepper}>
            <TouchableOpacity style={s.stepBtn} onPress={() => setRd(Math.max(1, rd - 1))}>
              <Text style={s.stepBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={s.stepVal}>
              {rd}<Text style={s.stepUnit}>일 휴식</Text>
            </Text>
            <TouchableOpacity style={s.stepBtn} onPress={() => setRd(Math.min(30, rd + 1))}>
              <Text style={s.stepBtnText}>＋</Text>
            </TouchableOpacity>
          </View>
          <View style={s.cycleInfoBox}>
            <Text style={s.cycleInfo}>🔁 {cd}일 알람 → {rd}일 휴식 반복</Text>
          </View>
        </>
      )}
    </View>
  );
}
