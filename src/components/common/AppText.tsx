import React from 'react';
import { Text as RNText, TextProps, StyleSheet } from 'react-native';
import { useFontScale } from '../../hooks/useFontScale';

// 설정의 "글자크기"(작게/보통/크게)를 앱 전체 Text에 적용하는 배율.
// large가 1.18이던 시절엔 달력의 9px 글자가 10.6px밖에 안 돼 60대 사용자에게 사실상 무의미했다.
// 1.30으로 올리면서, 달력 칸 높이도 이 배율을 따라가도록 CalendarView의 cellH를 함께 고쳤다
// (안 그러면 글자만 커지고 칸은 그대로여서 잘린다).
const SCALE: Record<string, number> = { small: 0.88, medium: 1, large: 1.30 };

// 앱 전체에서 react-native의 Text 대신 이 컴포넌트를 사용 — 각 화면이 fontSize를 직접 정의해도
// 여기서 배율을 곱해 설정값이 일괄 반영되도록 함
export function Text(props: TextProps) {
  const { fontScale } = useFontScale();
  const scale = SCALE[fontScale] ?? 1;
  if (scale === 1) return <RNText {...props} />;

  const flat = StyleSheet.flatten(props.style) as { fontSize?: number } | undefined;
  const fontSize = (flat?.fontSize ?? 14) * scale;
  return <RNText {...props} style={[props.style, { fontSize }]} />;
}
