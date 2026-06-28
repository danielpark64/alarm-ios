import { StyleSheet } from 'react-native';
import { Palette } from '../../constants/colors';

// 알람/추가 탭 공용 스크롤 스타일
export function makeHomeStyles(C: Palette) {
  return StyleSheet.create({
    scroll:  { flex:1, backgroundColor:C.bg },
    scrollC: { padding:14, paddingBottom:100 },
  });
}
