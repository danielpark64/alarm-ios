import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { VibIcon } from '../VibIcon';
import { ScrollPicker } from '../common/ScrollPicker';
import { useColors } from '../../hooks/useTheme';
import { makeStyles } from './styles';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINS  = Array.from({ length: 12 }, (_, i) => i * 5);

interface Props {
  hour: number;
  setHour: (v: number) => void;
  min: number;
  setMin: (v: number) => void;
  sndVibMode: string;
  setSndVibMode: (mode: 'both' | 'snd' | 'vib') => void;
  pickerRef?: React.Ref<View>;
}

export function TimePickerSection({ hour, setHour, min, setMin, sndVibMode, setSndVibMode, pickerRef }: Props) {
  const C = useColors();
  const s = makeStyles(C);
  const SND_VIB_OPTS: { mode: 'both'|'snd'|'vib'; label: string; renderIcon: () => React.ReactNode }[] = [
    { mode: 'both', label: '소리+진동', renderIcon: () => <><Text style={s.sndVibIconFixed}>🔔</Text><VibIcon size={16} color={sndVibMode === 'both' ? C.txt : C.txt3}/></> },
    { mode: 'snd',  label: '소리만',   renderIcon: () => <Text style={s.sndVibIconFixed}>🔔</Text> },
    { mode: 'vib',  label: '진동만',   renderIcon: () => <VibIcon size={16} color={sndVibMode === 'vib' ? C.txt : C.txt3}/> },
  ];

  return (
    <>
      <Text style={s.sLabel}>시간</Text>
      <View style={s.timeRow}>
        <View ref={pickerRef} style={s.timePickerSide}>
          <View style={s.timeStepper}>
            <ScrollPicker value={hour} items={HOURS} onChange={setHour} />
          </View>
          <Text style={s.timeColon}>:</Text>
          <View style={s.timeStepper}>
            <ScrollPicker value={min} items={MINS} onChange={setMin} />
          </View>
        </View>
        <View style={s.timeDivider} />
        <View style={s.sndVibSide}>
          {SND_VIB_OPTS.map(({ mode, label, renderIcon }) => (
            <TouchableOpacity
              key={mode}
              style={[s.sndVibBtn, sndVibMode === mode && s.sndVibActive]}
              onPress={() => setSndVibMode(mode)}
            >
              <View style={s.sndVibIconWrap}>{renderIcon()}</View>
              {mode === 'both' ? (
                <View style={{ alignItems: 'center' }}>
                  <Text style={[s.sndVibLabel, sndVibMode === mode && s.sndVibLabelActive]}>소리</Text>
                  <Text style={[s.sndVibPlus,  sndVibMode === mode && s.sndVibLabelActive]}>+</Text>
                  <Text style={[s.sndVibLabel, sndVibMode === mode && s.sndVibLabelActive]}>진동</Text>
                </View>
              ) : (
                <Text style={[s.sndVibLabel, sndVibMode === mode && s.sndVibLabelActive]}>
                  {label}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </>
  );
}
