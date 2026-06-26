import { useWindowDimensions } from 'react-native';

// iPhone 기준 표준 폭(375) 대비 화면 폭 비율로 스케일 계산.
// 0.85~1.15로 clamp — 아이폰 미니처럼 작은 화면도 과하게 줄지 않고, 큰 화면도 과하게 커지지 않게 함.
const BASE_WIDTH = 375;
const MIN_SCALE = 0.85;
const MAX_SCALE = 1.15;

export function useScale(): number {
  const { width } = useWindowDimensions();
  const raw = width / BASE_WIDTH;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, raw));
}

export function rf(size: number, scale: number): number {
  return Math.round(size * scale);
}
