import React, { useState, useEffect, memo } from 'react';
import { Text, StyleSheet, Platform } from 'react-native';
import { pad } from '../../utils';
import { C } from '../../constants/colors';

// 시계 헤더 — 1초마다 리렌더되는 범위를 이 컴포넌트 안으로 격리
export const ClockHeader = memo(function ClockHeader() {
  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      <Text style={s.date}>
        {clock.toLocaleDateString('ko-KR',{weekday:'long',month:'long',day:'numeric'})}
      </Text>
      <Text style={s.clock}>
        {pad(clock.getHours())}:{pad(clock.getMinutes())}
        <Text style={s.sec}>:{pad(clock.getSeconds())}</Text>
      </Text>
    </>
  );
});

const s = StyleSheet.create({
  date:  { fontSize:14, fontWeight:'800', color:C.txt3, letterSpacing:1, marginBottom:2 },
  clock: { fontFamily:Platform.OS==='ios'?'Courier':'monospace', fontSize:52, fontWeight:'700', letterSpacing:-2, lineHeight:58, color:C.txt },
  sec:   { fontSize:18, opacity:0.28, color:C.txt },
});
