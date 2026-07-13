import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '../common/AppText';
import { VibIcon } from '../VibIcon';
import { useColors } from '../../hooks/useTheme';
import { makeStyles } from './styles';

interface Props {
  sndVibMode: string;
  setSndVibMode: (mode: 'both' | 'snd' | 'vib') => void;
  // TimePickerSection 안에서는 시간 피커 옆에 좁게 세로로(기본), 근무 시간대 폼처럼 단독으로
  // 쓸 때는 가로로 넓게 — 두 자리 다 자연스럽게 보이도록 레이아웃만 다르게 받는다.
  layout?: 'column' | 'row';
}

// TimePickerSection에서 시간 피커와 나란히 쓰던 소리/진동 선택기를 떼어낸 컴포넌트 —
// 근무 시간대(패턴) 모드는 시간이 블록별로 따로 있어 TimePickerSection 전체를 못 쓰므로
// 이 부분만 독립시켜 양쪽에서 같이 쓴다.
export function SndVibSelector({ sndVibMode, setSndVibMode, layout = 'column' }: Props) {
  const C = useColors();
  const s = makeStyles(C);
  const SND_VIB_OPTS: { mode: 'both'|'snd'|'vib'; label: string; renderIcon: () => React.ReactNode }[] = [
    { mode: 'both', label: '소리+진동', renderIcon: () => <><Text style={s.sndVibIconFixed}>🔔</Text><VibIcon size={16} color={sndVibMode === 'both' ? C.txt : C.txt3}/></> },
    { mode: 'snd',  label: '소리만',   renderIcon: () => <Text style={s.sndVibIconFixed}>🔔</Text> },
    { mode: 'vib',  label: '진동만',   renderIcon: () => <VibIcon size={16} color={sndVibMode === 'vib' ? C.txt : C.txt3}/> },
  ];

  return (
    <View style={[s.sndVibSide, layout === 'row' && { flexDirection: 'row', minWidth: 0 }]}>
      {SND_VIB_OPTS.map(({ mode, label, renderIcon }) => (
        <TouchableOpacity
          key={mode}
          style={[s.sndVibBtn, layout === 'row' && { flex: 1, justifyContent: 'center' }, sndVibMode === mode && s.sndVibActive]}
          onPress={() => setSndVibMode(mode)}
        >
          <View style={[s.sndVibIconWrap, layout === 'row' && { width: 'auto', marginRight: 4 }]}>{renderIcon()}</View>
          {mode === 'both' && layout !== 'row' ? (
            <View style={{ alignItems: 'center' }}>
              <Text style={[s.sndVibLabel, sndVibMode === mode && s.sndVibLabelActive]}>소리</Text>
              <Text style={[s.sndVibPlus,  sndVibMode === mode && s.sndVibLabelActive]}>+</Text>
              <Text style={[s.sndVibLabel, sndVibMode === mode && s.sndVibLabelActive]}>진동</Text>
            </View>
          ) : (
            <Text style={[s.sndVibLabel, sndVibMode === mode && s.sndVibLabelActive]} numberOfLines={1}>
              {label}
            </Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}
