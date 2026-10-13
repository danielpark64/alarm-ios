import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '../common/AppText';
import { TYPES, Alarm } from '../../constants';
import { useColors } from '../../hooks/useTheme';
import { makeStyles } from './styles';
import { useT } from '../../i18n';

interface Props {
  typeId: Alarm['typeId'];
  onChange: (typeId: Alarm['typeId']) => void;
  gridRef?: React.Ref<View>;
}

export function TypeSelector({ typeId, onChange, gridRef }: Props) {
  const C = useColors();
  const s = makeStyles(C);
  const { t } = useT();
  return (
    <View ref={gridRef} style={[s.typeGrid, { marginTop: 4 }]}>
      {TYPES.map(ty => {
        const active = typeId === ty.id;
        return (
          <TouchableOpacity
            key={ty.id}
            style={[
              s.typeBtn,
              { borderColor: active ? ty.color : ty.color + '40' },
              active && { backgroundColor: ty.color },
            ]}
            onPress={() => onChange(ty.id)}
          >
            <Text style={[s.typeBtnIcon, !active && { opacity: 0.6 }]}>{ty.icon}</Text>
            <Text style={[s.typeBtnLabel, { color: active ? '#fff' : C.txt3 }]}>
              {t(ty.label)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
