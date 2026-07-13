import React from 'react';
import { View } from 'react-native';
import { Text } from '../common/AppText';
import { ScrollPicker } from '../common/ScrollPicker';
import { useColors } from '../../hooks/useTheme';
import { makeStyles } from './styles';
import { SndVibSelector } from './SndVibSelector';

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
        <SndVibSelector sndVibMode={sndVibMode} setSndVibMode={setSndVibMode} />
      </View>
    </>
  );
}
