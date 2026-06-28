import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useColors } from '../../hooks/useTheme';
import { makeStyles } from './styles';

interface Props {
  rm: string;
  lastDay: boolean;
  setLastDay: (fn: (v: boolean) => boolean) => void;
  setShowCal: (v: boolean) => void;
  dateLabel: string;
  dateLocked: boolean;
  isLeapDay: boolean;
}

export function DateSection({
  rm, lastDay, setLastDay, setShowCal, dateLabel, dateLocked, isLeapDay,
}: Props) {
  const s = makeStyles(useColors());
  return (
    <>
      <Text style={s.sLabel}>시작 일자</Text>
      <View style={s.dateRow}>
        <TouchableOpacity
          style={[s.dateBtn, dateLocked && s.dateBtnDim]}
          onPress={() => !dateLocked && setShowCal(true)}
          disabled={dateLocked}
        >
          <Text style={s.dateBtnIcon}>📅</Text>
          <Text style={s.dateBtnLabel}>
            {dateLocked ? '매월 말일' : dateLabel}
          </Text>
          {!dateLocked && <Text style={s.dateBtnArrow}>▼</Text>}
        </TouchableOpacity>
        {rm === 'monthly' && (
          <TouchableOpacity
            style={[s.lastDayBtn, lastDay && s.lastDayBtnActive]}
            onPress={() => setLastDay(v => !v)}
          >
            <Text style={[s.lastDayText, lastDay && { color: '#fff' }]}>말일</Text>
          </TouchableOpacity>
        )}
      </View>
      {rm === 'yearly' && isLeapDay && (
        <View style={s.leapNoticeBox}>
          <Text>⚠️</Text>
          <Text style={s.leapNoticeText}>윤년이 아닐 때는 2월 28일에 울려요</Text>
        </View>
      )}
    </>
  );
}
