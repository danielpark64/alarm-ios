import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '../common/AppText';
import { REPEAT } from '../../constants';
import { useColors } from '../../hooks/useTheme';
import { makeStyles } from './styles';

interface Props {
  rm: string;
  setRm: (id: string) => void;
  showRepeatConfig: boolean;
  setShowRepeatConfig: (v: boolean) => void;
  cycleRef?: React.Ref<View>;
  children?: React.ReactNode; // 요일 선택기(월화수...) 등 — N일 주기 카드 줄보다 위, 구분선 아래에 끼워 넣는 슬롯
}

const PRIMARY = [
  { id: 'cycle', icon: '🔁', label: 'N일 주기', hint: '예: 3일마다' },
  { id: 'rest',  icon: '🌙', label: 'N일 후 휴식', hint: '예: 2일 알람 후 1일 휴식' },
] as const;

const SECONDARY_ORDER = ['wdcustom', 'monthly', 'yearly', 'once'];

export function RepeatModeSelector({ rm, setRm, showRepeatConfig, setShowRepeatConfig, cycleRef, children }: Props) {
  const s = makeStyles(useColors());
  const secondary = SECONDARY_ORDER
    .map(id => REPEAT.find(r => r.id === id))
    .filter((r): r is typeof REPEAT[number] => !!r);

  return (
    <>
      {/* 팝업(N일 주기/N일 후 휴식 설정)이 떠 있는 동안은 다른 반복방식으로 못 건너뛰게 숨긴다 —
          팝업을 닫아야만 다시 보이고, rm 값 자체는 팝업을 닫아도 그대로 유지된다. */}
      {!showRepeatConfig && (
        <>
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

          {children}
        </>
      )}

      <Text style={s.sLabel}>반복 방식</Text>

      <View style={s.repeatPrimaryRow}>
        {PRIMARY.map(p => {
          const active = rm === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              ref={p.id === 'cycle' ? cycleRef : undefined}
              style={[s.repeatPrimaryCard, active && s.repeatPrimaryActive]}
              onPress={() => { setRm(p.id); setShowRepeatConfig(true); }}
            >
              <Text style={s.repeatPrimaryIcon}>{p.icon}</Text>
              <Text style={[s.repeatPrimaryLabel, active && s.repeatPrimaryLabelActive]}>{p.label}</Text>
              <Text style={[s.repeatPrimaryHint, active && s.repeatPrimaryHintActive]}>{p.hint}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}
