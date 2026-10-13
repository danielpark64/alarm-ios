import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '../common/AppText';
import { MONTH_KEYS } from '../../constants';
import { useColors } from '../../hooks/useTheme';
import { makeStyles } from './styles';
import { useT } from '../../i18n';

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
  const { t, lang } = useT();
  return (
    <>
      <Text style={s.sLabel}>{t('시작 일자')}</Text>
      <View style={s.dateRow}>
        <TouchableOpacity
          style={[s.dateBtn, dateLocked && s.dateBtnDim]}
          onPress={() => !dateLocked && setShowCal(true)}
          disabled={dateLocked}
        >
          <Text style={s.dateBtnIcon}>📅</Text>
          <Text style={s.dateBtnLabel}>
            {dateLocked ? t('매월 말일') : dateLabel}
          </Text>
          {!dateLocked && <Text style={s.dateBtnArrow}>▼</Text>}
        </TouchableOpacity>
        {rm === 'monthly' && (
          <TouchableOpacity
            style={[s.lastDayBtn, lastDay && s.lastDayBtnActive]}
            onPress={() => setLastDay(v => !v)}
          >
            <Text style={[s.lastDayText, lastDay && { color: '#fff' }]}>{t('말일')}</Text>
          </TouchableOpacity>
        )}
        {/* 음력 반복은 한국 전용 — 한국어일 때만 고를 수 있다. 이미 음력으로 저장된 알람은 켜진 상태라 끌 수 있게 계속 보인다 */}
        {rm === 'yearly' && (lang === 'ko' || lunar) && (
          <TouchableOpacity
            style={[s.lastDayBtn, lunar && s.lastDayBtnActive]}
            onPress={() => setLunar(v => !v)}
          >
            <Text style={[s.lastDayText, lunar && { color: '#fff' }]}>{t('음력')}</Text>
          </TouchableOpacity>
        )}
      </View>
      {rm === 'yearly' && lunar && (
        <View style={s.leapNoticeBox}>
          <Text>🌙</Text>
          <Text style={s.leapNoticeText}>
            {lunarSolarPreview
              ? t('달력에서 고른 월·일을 음력 기준으로 매년 계산해요 (올해는 양력 {month} {d}일)', {
                  month: t(MONTH_KEYS[Number(lunarSolarPreview.split('-')[1]) - 1]),
                  d: Number(lunarSolarPreview.split('-')[2]),
                })
              : t('달력에서 고른 월·일을 음력 기준으로 매년 계산해요')}
          </Text>
        </View>
      )}
      {rm === 'yearly' && !lunar && isLeapDay && (
        <View style={s.leapNoticeBox}>
          <Text>⚠️</Text>
          <Text style={s.leapNoticeText}>{t('윤년이 아닐 때는 2월 28일에 울려요')}</Text>
        </View>
      )}
    </>
  );
}
