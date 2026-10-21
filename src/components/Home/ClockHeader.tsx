import React, { useState, useEffect, memo } from 'react';
import { Platform } from 'react-native';
import { Text } from '../common/AppText';
import { pad } from '../../utils';
import { useScale, rf } from '../../utils/responsive';
import { useColors } from '../../hooks/useTheme';
import { DAYS_DISPLAY, MONTH_KEYS } from '../../constants';
import { useT } from '../../i18n';

// 시계 헤더 — 1초마다 리렌더되는 범위를 이 컴포넌트 안으로 격리
export const ClockHeader = memo(function ClockHeader() {
  const [clock, setClock] = useState(new Date());
  const scale = useScale();
  const C = useColors();
  const { t } = useT();
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <>
      <Text style={{ fontSize:rf(19,scale), fontWeight:'900', color:C.txt2, letterSpacing:0.3, marginBottom:4 }}>
        {t('{month} {d}일 {dow}요일', { month: t(MONTH_KEYS[clock.getMonth()]), d: clock.getDate(), dow: t(DAYS_DISPLAY[clock.getDay()]) })}
      </Text>
      {/* 글자크기 최대 설정에서 초가 줄바꿈되지 않도록 한 줄 고정 + 자동 축소(Android만).
          iOS에서는 안에 작은 Text(초)가 들어간 줄에 adjustsFontSizeToFit을 쓰면 시계가 점 하나 크기로
          쪼그라들어 사라졌다(2026-10-21 iPhone 17 Pro Max 시뮬레이터) — iOS는 축소 없이 한 줄만 고정한다.
          가장 큰 글자에서도 "00:00:00"이 한 줄에 들어가는 크기라 넘치지 않는다. */}
      <Text numberOfLines={1} adjustsFontSizeToFit={Platform.OS === 'android'} minimumFontScale={0.6} style={{ fontFamily:Platform.OS==='ios'?'Courier':'monospace', fontSize:rf(52,scale), fontWeight:'700', letterSpacing:-2, lineHeight:rf(58,scale), color:C.txt }}>
        {pad(clock.getHours())}:{pad(clock.getMinutes())}
        <Text style={{ fontSize:rf(18,scale), opacity:0.28, color:C.txt }}>:{pad(clock.getSeconds())}</Text>
      </Text>
    </>
  );
});
