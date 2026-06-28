import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { CYCLE_PRESETS } from '../../constants';
import { useColors } from '../../hooks/useTheme';
import { makeStyles } from './styles';

interface Props {
  rm: string;
  cd: number;
  setCd: (v: number) => void;
  rd: number;
  setRd: (v: number) => void;
  sd: string;
  setShowCal: (v: boolean) => void;
}

function addDaysMD(sd: string, n: number): string {
  const [y, m, d] = sd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

export function CycleRestControls({ rm, cd, setCd, rd, setRd, sd, setShowCal }: Props) {
  const s = makeStyles(useColors());
  const [, m, d] = sd.split('-').map(Number);

  return (
    <View style={s.cycleBox}>
      <View style={s.cycleDateRow}>
        <Text style={s.cycleDateLabel}>{rm === 'rest' ? '근무 시작일' : '오늘부터 며칠마다?'}</Text>
        <TouchableOpacity style={s.cycleDateChip} onPress={() => setShowCal(true)}>
          <Text>📅</Text>
          <Text style={s.cycleDateChipText}>{m}/{d} 시작</Text>
        </TouchableOpacity>
      </View>

      {rm === 'rest' && <Text style={s.cycleLabel}>근무(알람) 일수</Text>}
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
            <Text style={[s.presetText, cd === n && s.presetTextActive]}>{n}일</Text>
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
          <DotPreview cd={cd} rd={rd} s={s} />
        </>
      )}

      {rm === 'cycle' && (
        <View style={s.cycleInfoBox}>
          <Text style={s.cycleInfo}>
            다음: {[0, cd, cd * 2, cd * 3].map(n => addDaysMD(sd, n)).join(' · ')}
          </Text>
        </View>
      )}
    </View>
  );
}

function DotPreview({ cd, rd, s }: { cd: number; rd: number; s: ReturnType<typeof makeStyles> }) {
  const total = cd + rd;
  const showCount = Math.min(total, 10);
  const filledCount = Math.min(cd, showCount);
  const dots = Array.from({ length: showCount }, (_, i) => i < filledCount);
  return (
    <>
      <View style={s.previewDots}>
        {dots.map((filled, i) => (
          <View key={i} style={filled ? s.dotFilled : s.dotHollow} />
        ))}
      </View>
      <Text style={s.previewHint}>● 근무  ○ 휴식{total > showCount ? ' (일부만 표시)' : ''}</Text>
    </>
  );
}
