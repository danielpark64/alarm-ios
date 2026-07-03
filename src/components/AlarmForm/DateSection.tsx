import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '../common/AppText';
import { useColors } from '../../hooks/useTheme';
import { makeStyles } from './styles';

interface Props {
  rm: string;
  lastDay: boolean;
  setLastDay: (fn: (v: boolean) => boolean) => void;
  lunar: boolean;
  setLunar: (fn: (v: boolean) => boolean) => void;
  setShowCal: (v: boolean) => void;
  dateLabel: string;
  dateLocked: boolean;
  isLeapDay: boolean;
  lunarSolarPreview?: string | null;
}

export function DateSection({
  rm, lastDay, setLastDay, lunar, setLunar, setShowCal, dateLabel, dateLocked, isLeapDay, lunarSolarPreview,
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
        {rm === 'yearly' && (
          <TouchableOpacity
            style={[s.lastDayBtn, lunar && s.lastDayBtnActive]}
            onPress={() => setLunar(v => !v)}
          >
            <Text style={[s.lastDayText, lunar && { color: '#fff' }]}>음력</Text>
          </TouchableOpacity>
        )}
      </View>
      {rm === 'yearly' && lunar && (
        <View style={s.leapNoticeBox}>
          <Text>🌙</Text>
          <Text style={s.leapNoticeText}>
            달력에서 고른 월·일을 음력 기준으로 매년 계산해요
            {lunarSolarPreview ? ` (올해는 양력 ${Number(lunarSolarPreview.split('-')[1])}월 ${Number(lunarSolarPreview.split('-')[2])}일)` : ''}
          </Text>
        </View>
      )}
      {rm === 'yearly' && !lunar && isLeapDay && (
        <View style={s.leapNoticeBox}>
          <Text>⚠️</Text>
          <Text style={s.leapNoticeText}>윤년이 아닐 때는 2월 28일에 울려요</Text>
        </View>
      )}
    </>
  );
}
