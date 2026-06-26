import React, { useState, useEffect, memo } from 'react';
import { Text, Platform } from 'react-native';
import { pad } from '../../utils';
import { useScale, rf } from '../../utils/responsive';
import { C } from '../../constants/colors';

// 시계 헤더 — 1초마다 리렌더되는 범위를 이 컴포넌트 안으로 격리
export const ClockHeader = memo(function ClockHeader() {
  const [clock, setClock] = useState(new Date());
  const scale = useScale();
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      <Text style={{ fontSize:rf(19,scale), fontWeight:'900', color:C.txt2, letterSpacing:0.3, marginBottom:4 }}>
        {clock.toLocaleDateString('ko-KR',{weekday:'long',month:'long',day:'numeric'})}
      </Text>
      <Text style={{ fontFamily:Platform.OS==='ios'?'Courier':'monospace', fontSize:rf(52,scale), fontWeight:'700', letterSpacing:-2, lineHeight:rf(58,scale), color:C.txt }}>
        {pad(clock.getHours())}:{pad(clock.getMinutes())}
        <Text style={{ fontSize:rf(18,scale), opacity:0.28, color:C.txt }}>:{pad(clock.getSeconds())}</Text>
      </Text>
    </>
  );
});
