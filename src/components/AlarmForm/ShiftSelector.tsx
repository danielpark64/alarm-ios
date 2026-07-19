import React from 'react';
import { View, TouchableOpacity, TextInput } from 'react-native';
import { Text } from '../common/AppText';
import { SHIFTS, ShiftPeriod } from '../../constants';
import { useColors } from '../../hooks/useTheme';
import { makeStyles } from './styles';

interface Props {
  shift: ShiftPeriod;
  onChange: (shift: ShiftPeriod) => void;
  shiftCustom: string;
  onCustomChange: (text: string) => void;
  gridRef?: React.Ref<View>;
}

export function ShiftSelector({ shift, onChange, shiftCustom, onCustomChange, gridRef }: Props) {
  const C = useColors();
  const s = makeStyles(C);
  return (
    <View>
      {/* 칩마다 flex:1이라 화면 폭에 맞춰 5등분되어 자동으로 늘어남 — 폭이 넓은 기기(폴드/플립 펼친 화면 등)에서
          글자 크기만큼만 차지해 오른쪽에 크게 남던 것을 없애고, 탭 영역도 화면 폭에 비례해 커짐.
          고정폭+가로스크롤 방식은 폭 좁은 기기에서 스크롤이 상위 폼과 제스처 충돌을 일으켜 폐기 —
          flex 배분은 수학적으로 화면 밖으로 넘칠 수 없어 스크롤 자체가 필요 없어짐. */}
      <View ref={gridRef} style={s.shiftGrid}>
        {SHIFTS.map(sh => {
          const active = shift === sh.id;
          return (
            <TouchableOpacity
              key={sh.id}
              style={[s.shiftBtn, active && { backgroundColor: sh.color, borderColor: sh.color }]}
              onPress={() => onChange(sh.id)}
            >
              <Text style={[s.shiftBtnLabel, { color: active ? '#fff' : sh.color }]} numberOfLines={1} adjustsFontSizeToFit>
                {sh.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {shift === 'custom' && (
        <TextInput
          style={s.shiftCustomInput}
          value={shiftCustom}
          onChangeText={onCustomChange}
          placeholder="근무 시간대 이름을 입력하세요 (예: 새벽조)"
          placeholderTextColor={C.txt3}
          returnKeyType="done"
        />
      )}
    </View>
  );
}
