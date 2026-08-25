// ─── 달력 가독성 토큰 ─────────────────────────────────────────────────────────
// 근무조·비번·공휴일 색을 컴포넌트에 하드코딩하면 한쪽 테마에서 반드시 무너진다.
// 실제로 말번(#D98A4A)은 라이트 배경 대비 2.22:1까지 떨어져 60대 사용자가 못 읽었다.
// 그래서 "글자색" 하나가 아니라 **배지 배경 + 배지 글자** 한 쌍으로 테마별로 정의한다.
//
// 설계 기준 (노안 대응):
//   · 배지 안 대비(글자 대 배지배경) ≥ 4.5:1  — 작은 글씨도 읽히게
//   · 서로 다른 항목끼리 ΔE ≥ 18            — 색상만 다르고 명도가 비슷하면 훑어볼 때 뭉친다
//   · 채도는 낮게                            — 진한 원색은 눈이 거슬린다는 요구
// 값을 바꿀 때는 반드시 이 지표들을 다시 계산할 것.
//
// 색상 배치: 빨강 구역(340~60°)은 **비번 전용**으로 비워둔다. 말번을 주황에 두었더니
// 다크에서 비번(적색)과 구분이 안 된다는 지적이 있어 황토(72°)로 옮겼고, 자동 배색도
// 그 구역을 피해서 뽑는다. 파랑↔자주처럼 색상만으로 안 갈리는 쌍은 명도(L)를 벌려 분리했다.
//
// 비번은 파란 2px 라인 박스 + 같은 색 글자(offBg/offFg/offBorder). 주말·공휴일 색과
// 겹치지 않는 색상대라 그 위계는 그대로 유지된다 — 별도 반전 토큰이 필요 없다.

type ShiftTone = { bg: string; fg: string };

const DARK_SHIFT: Record<string, ShiftTone> = {
  early:    { bg:'#253e51', fg:'#cde5fe' },
  mid:      { bg:'#37564b', fg:'#c6ebdc' },
  late:     { bg:'#5a4835', fg:'#f6dec7' },
  custom:   { bg:'#6c5b71', fg:'#efdcf6' },
  none:     { bg:'#3a3a44', fg:'#d4d4de' },
};

const LIGHT_SHIFT: Record<string, ShiftTone> = {
  early:    { bg:'#abc7e2', fg:'#144664' },
  mid:      { bg:'#b7e0d0', fg:'#144b3a' },
  late:     { bg:'#f3d8be', fg:'#563d20' },
  custom:   { bg:'#c4afcb', fg:'#51395a' },
  none:     { bg:'#c8c8d2', fg:'#3c3c4a' },
};

// 시간대를 지정하지 않은 근무 알람에 시각순으로 배정되는 자동 배색
const DARK_AUTO: ShiftTone[] = [
  { bg:'#284054', fg:'#cde5fe' },
  { bg:'#204b4e', fg:'#beebee' },
  { bg:'#37564b', fg:'#c6ebdc' },
  { bg:'#494b33', fg:'#e4e4c7' },
  { bg:'#5a4835', fg:'#f6dec7' },
  { bg:'#6c5b71', fg:'#efdcf6' },
];

const LIGHT_AUTO: ShiftTone[] = [
  { bg:'#abc7e2', fg:'#144664' },
  { bg:'#a5d8dc', fg:'#004b50' },
  { bg:'#b7e0d0', fg:'#144b3a' },
  { bg:'#d3d4b3', fg:'#414520' },
  { bg:'#f3d8be', fg:'#563d20' },
  { bg:'#c4afcb', fg:'#51395a' },
];

// 알람 종류별 칩 색 — **일반(비교대) 사용자에게는 달력의 유일한 정보**라 반드시 구분돼야 한다.
// 근무조 배지보다 한 단계 조용한 톤(채도·명도 낮춤)으로 위계를 유지한다.
const DARK_CHIP: Record<string, ShiftTone> = {
  commute:  { bg:'#2b3b49', fg:'#bfd4e9' },
  offwork:  { bg:'#213e40', fg:'#b3d9db' },
  meal:     { bg:'#2d3d31', fg:'#c0d7c5' },
  exercise: { bg:'#433729', fg:'#e2cfba' },
  custom:   { bg:'#403544', fg:'#ddcce2' },
};

const LIGHT_CHIP: Record<string, ShiftTone> = {
  commute:  { bg:'#bbd1e8', fg:'#254a65' },
  offwork:  { bg:'#add6d9', fg:'#084f53' },
  meal:     { bg:'#bcd5c1', fg:'#2e4e37' },
  exercise: { bg:'#e0ccb6', fg:'#584329' },
  custom:   { bg:'#dbc9e0', fg:'#543f5c' },
};

export const DARK = {
  bg:'#0b0b1c', bg2:'#141430', bg3:'#1c1c40',
  border:'#24244a', border2:'#30306a',
  txt:'#f0f0ff', txt2:'#e0e0f5', txt3:'#c8c8e0',
  accent:'#a29bfe', accent2:'#6c5ce7',

  shift: DARK_SHIFT,
  shiftAuto: DARK_AUTO,
  chip: DARK_CHIP,
  // 비번 = 토스 블루 계열 2px 라인 박스(시안 4b/4d 채택). 회색 채움 대신 테두리 + 같은 색
  // 글씨로 강조 — 주말 빨강·공휴일 골드와 충돌하지 않는 색상대라 그 위계는 그대로 유지된다.
  offBg:'rgba(69,147,252,0.16)', offFg:'#4593fc', offCellBg:'rgba(69,147,252,0.16)', offBorder:'#4593fc',
  holidayFg:'#f0d19a', holidayBg:'#463a27',
  weekendFg:'#f0a0a0',
  chipBg:'#2a2a45', chipFg:'#cfcfe8',
  todayBg:'#6c5ce7', todayFg:'#ffffff',
};

export const LIGHT = {
  bg:'#e7e7f0', bg2:'#f2f2f8', bg3:'#dfdfeb',
  border:'#d2d2e2', border2:'#bcbcd4',
  txt:'#16162a', txt2:'#33334d', txt3:'#6a6a86',
  accent:'#7c6ff0', accent2:'#6c5ce7',

  shift: LIGHT_SHIFT,
  shiftAuto: LIGHT_AUTO,
  chip: LIGHT_CHIP,
  // #3182f6(원 시안)은 셀 배경 대비 3.36으로 AA(4.5:1) 미달 — 노안 사용자 고려해 어둡게 조정.
  offBg:'#eef4ff', offFg:'#1b66d4', offCellBg:'#eef4ff', offBorder:'#1b66d4',
  holidayFg:'#5c4310', holidayBg:'#e6d5a8',
  weekendFg:'#b03b3b',
  chipBg:'#d9d9e6', chipFg:'#33334d',
  todayBg:'#6c5ce7', todayFg:'#ffffff',
};

export type Palette = typeof DARK;

// 테마 컨텍스트 연결 전 기존 코드 호환용 기본값 (다크) — useColors() 사용 권장
export const C = DARK;
