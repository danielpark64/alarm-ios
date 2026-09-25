import React, { useState } from 'react';
import { View, StyleSheet, TextStyle, LayoutChangeEvent } from 'react-native';
import { Text } from '../common/AppText';

type Next = { icon: string; label: string; when: string };

// 넘칠 때 줄이는 순서: ① 알람 이름을 "…"으로 → ② 그래도 안 되면 이 줄 글씨 전체를 작게.
// 날짜·시각은 끝까지 잘리지 않아야 한다(알람 앱에선 이름보다 시각이 중요).
// 글씨를 키우는 쪽으로는 절대 바꾸지 않는다(최대 1배).
const MIN_SCALE = 0.7;
// "…"만 남더라도 이름 자리로 최소 이만큼은 남긴다(날짜·시각 폭 대비 비율)
const LABEL_MIN_RATIO = 0.25;

export function NextAlarmLine({ next, textStyle }: { next: Next | null; textStyle: TextStyle }) {
  const [rowW, setRowW] = useState(0);
  // 배율 1 기준으로 환산한 "다음 🚇 " / " · 날짜 시각" 폭 — 측정 시점 배율로 나눠서 저장해야
  // 배율을 바꿀 때마다 다시 재도 값이 흔들리지 않는다.
  const [prefixW, setPrefixW] = useState(0);
  const [whenW, setWhenW] = useState(0);

  const baseSize = (StyleSheet.flatten(textStyle) as TextStyle).fontSize ?? 15;
  const needed = prefixW + whenW * (1 + LABEL_MIN_RATIO);
  const scale = rowW > 0 && needed > rowW ? Math.max(MIN_SCALE, rowW / needed) : 1;
  const style = [textStyle, { fontSize: baseSize * scale }];

  const measure = (set: React.Dispatch<React.SetStateAction<number>>) => (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width / scale;
    set(prev => (Math.abs(prev - w) > 0.5 ? w : prev));
  };

  return (
    <View style={s.row} onLayout={e => setRowW(e.nativeEvent.layout.width)}>
      {next ? (
        <>
          <Text style={style} onLayout={measure(setPrefixW)}>다음 {next.icon} </Text>
          <Text style={[style, s.label]} numberOfLines={1}>{next.label}</Text>
          <Text style={style} onLayout={measure(setWhenW)}> · {next.when}</Text>
        </>
      ) : (
        <Text style={textStyle} numberOfLines={1}>예정된 알람 없음</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  label: { flexShrink: 1 },
});
