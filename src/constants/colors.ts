export const DARK = {
  bg:'#0b0b1c', bg2:'#141430', bg3:'#1c1c40',
  border:'#24244a', border2:'#30306a',
  txt:'#f0f0ff', txt2:'#e0e0f5', txt3:'#c8c8e0',
  accent:'#a29bfe', accent2:'#6c5ce7',
};

export const LIGHT = {
  bg:'#f3f3f9', bg2:'#ffffff', bg3:'#ececf6',
  border:'#e2e2ee', border2:'#cfcfe2',
  txt:'#16162a', txt2:'#33334d', txt3:'#73738f',
  accent:'#7c6ff0', accent2:'#6c5ce7',
};

export type Palette = typeof DARK;

// 테마 컨텍스트 연결 전 기존 코드 호환용 기본값 (다크) — useColors() 사용 권장
export const C = DARK;
