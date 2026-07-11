import { StyleSheet, Platform } from 'react-native';
import { PICK_H } from '../common/ScrollPicker';
import { Palette } from '../../constants/colors';

export function makeStyles(C: Palette) {
return StyleSheet.create({
  // 폼 루트 + 상단 고정 바
  formRoot:        { flex: 1, backgroundColor: C.bg },
  topBar:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  topBarTitle:     { fontSize: 15, fontWeight: '700', color: C.txt, flex: 1, textAlign: 'center', marginHorizontal: 4 },
  topBarCancelBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderColor: C.border2, backgroundColor: 'transparent' },
  topBarCancelText:{ fontSize: 16, fontWeight: '700', color: C.txt2 },
  topBarSaveBtn:   { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, backgroundColor: C.accent2 },
  topBarSaveText:  { fontSize: 16, fontWeight: '800', color: C.txt },
  scrollContent:   { padding: 14, paddingBottom: 100 },
  sLabel:          { fontSize: 12, fontWeight: '900', letterSpacing: 0.5, color: C.txt3, marginTop: 16, marginBottom: 8 },
  // 종류
  typeGrid:        { flexDirection: 'row', gap: 6 },
  typeBtn:         { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderRadius: 12, borderWidth: 1.5, backgroundColor: C.bg2 },
  typeBtnIcon:     { fontSize: 14, marginBottom: 2 },
  typeBtnLabel:    { fontSize: 10, fontWeight: '700' },
  // 근무 시간대(초번/중번/말번/기타/해당없음) — 간격(반복 주기) 선택기와 동일하게 칩마다 글자 폭만큼만 차지하는
  // 한 줄 알약 스타일. 항목별 고정색은 SHIFTS 상수 참조, active면 그 색으로 채우고 비active는 글자만 그 색.
  shiftGrid:       { flexDirection: 'row', gap: 6, marginTop: 4 },
  shiftBtn:        { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, borderWidth: 1.3, borderColor: C.border2, backgroundColor: C.bg2 },
  shiftBtnLabel:   { fontSize: 13, fontWeight: '700' },
  shiftCustomInput:{ minHeight: 44, borderWidth: 1, borderColor: C.border2, borderRadius: 12, paddingHorizontal: 13, fontSize: 14, fontWeight: '600', color: C.txt, backgroundColor: C.bg2, marginTop: 8 },
  // 날짜
  dateRow:         { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  dateBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border2, borderRadius: 13, padding: 14, gap: 8 },
  dateBtnDim:      { opacity: 0.45 },
  dateBtnIcon:     { fontSize: 18 },
  dateBtnLabel:    { flex: 1, fontSize: 15, fontWeight: '700', color: C.txt },
  dateBtnArrow:    { fontSize: 12, color: C.txt3 },
  lastDayBtn:      { paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', borderRadius: 13, borderWidth: 1, borderColor: C.border2, backgroundColor: C.bg2 },
  lastDayBtnActive:{ backgroundColor: C.accent2, borderColor: C.accent2 },
  lastDayText:     { fontSize: 13, fontWeight: '900', color: C.txt2 },
  leapNoticeBox:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#412402', borderWidth: 1, borderColor: '#854f0b', borderRadius: 12, padding: 11, marginTop: 8 },
  leapNoticeText:  { fontSize: 12, fontWeight: '700', color: '#fac775', flexShrink: 1 },
  // 캘린더 모달
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent:    { width: '90%', backgroundColor: C.bg2, borderRadius: 20, padding: 20 },
  // 시간
  timeRow:         { flexDirection: 'row', alignItems: 'stretch', backgroundColor: C.bg2, borderRadius: 18, borderWidth: 1, borderColor: C.border, paddingVertical: 10, paddingHorizontal: 10 },
  timePickerSide:  { flexDirection: 'row', alignItems: 'center', flex: 1 },
  timeDivider:     { width: 1, height: PICK_H * 3, backgroundColor: C.border, marginHorizontal: 10 },
  timeStepper:     { flex: 1, alignItems: 'center' },
  timeColon:       { fontSize: 26, fontWeight: '900', color: C.txt3, marginHorizontal: 4 },
  // 소리+진동
  sndVibSide:      { gap: 6, alignItems: 'stretch', minWidth: 90, justifyContent: 'center' },
  sndVibBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, paddingHorizontal: 9, borderRadius: 10, borderWidth: 1.5, borderColor: C.border2, backgroundColor: C.bg3 },
  sndVibActive:    { backgroundColor: C.accent2, borderColor: C.accent2 },
  sndVibIconFixed: { fontSize: 13 },
  sndVibIconWrap:  { flexDirection: 'row', alignItems: 'center', gap: 3, width: 34 },
  sndVibLabel:     { fontSize: 11, fontWeight: '700', color: C.txt3, textAlign: 'center' },
  sndVibPlus:      { fontSize: 8,  fontWeight: '900', color: C.txt3, textAlign: 'center', lineHeight: 10 },
  sndVibLabelActive: { color: C.txt },
  // 라벨
  input:           { minHeight: 50, borderWidth: 1, borderColor: C.border2, borderRadius: 13, padding: 13, fontSize: 16, fontWeight: '600', color: C.txt, backgroundColor: C.bg2 },
  // 반복 — 우선 카드(N일 주기 / N일 후 휴식)
  repeatPrimaryRow:    { flexDirection: 'row', gap: 8 },
  repeatPrimaryCard:   { flex: 1, backgroundColor: C.bg2, borderWidth: 1.5, borderColor: C.border, borderRadius: 16, padding: 13 },
  repeatPrimaryActive: { backgroundColor: C.bg3, borderColor: C.accent2 },
  repeatPrimaryIcon:   { fontSize: 18, marginBottom: 5 },
  repeatPrimaryLabel:  { fontSize: 13, fontWeight: '700', color: C.txt3 },
  repeatPrimaryLabelActive: { color: C.txt },
  repeatPrimaryHint:   { fontSize: 10, fontWeight: '600', color: C.txt3, marginTop: 2 },
  repeatPrimaryHintActive: { color: C.accent },
  repeatDivider:       { height: 1, backgroundColor: C.bg3, marginVertical: 12 },
  repeatSecondaryRow:  { flexDirection: 'row', gap: 6 },
  // 반복 (기존 pill — 캘린더 요일 등에 재사용)
  pill:            { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: C.border2, backgroundColor: C.bg2 },
  pillActive:      { backgroundColor: C.bg3, borderColor: C.accent2, borderWidth: 1.5 },
  pillText:        { fontSize: 11, fontWeight: '700', color: C.txt3 },
  pillTextActive:  { color: C.txt },
  // 구분선
  optDivider:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  optDividerLine:  { flex: 1, height: 1, backgroundColor: C.border },
  optDividerLabel: { fontSize: 11, fontWeight: '800', color: C.txt3, letterSpacing: 0.8 },
  // 요일
  quickRow:        { flexDirection: 'row', gap: 8 },
  quickBtn:        { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: C.border2, backgroundColor: C.bg2, alignItems: 'center' },
  quickBtnText:    { fontSize: 12, fontWeight: '700', color: C.txt3 },
  dayRow:          { flexDirection: 'row', gap: 5 },
  dayBtn:          { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: C.border2, backgroundColor: C.bg2 },
  dayBtnActive:    { backgroundColor: C.accent2, borderColor: C.accent2 },
  dayText:         { fontSize: 13, fontWeight: '700' },
  // N일 주기/휴식 카드
  cycleBox:        { backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 16, marginTop: 10 },
  cycleDateRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  cycleDateLabel:  { fontSize: 12, fontWeight: '600', color: C.txt3 },
  cycleDateChip:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border2, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10 },
  cycleDateChipText: { fontSize: 12, fontWeight: '700', color: C.accent },
  cycleLabel:      { fontSize: 11, fontWeight: '700', color: C.txt3, marginBottom: 8 },
  stepper:         { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn:         { width: 38, height: 38, borderRadius: 11, borderWidth: 1, borderColor: C.border2, backgroundColor: C.bg3, alignItems: 'center', justifyContent: 'center' },
  stepBtnText:     { fontSize: 19, fontWeight: '900', color: C.accent },
  stepVal:         { flex: 1, textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 34, fontWeight: '900', color: C.txt },
  stepUnit:        { fontSize: 13, fontWeight: '500', color: C.txt3 },
  presetRow:       { flexDirection: 'row', gap: 6, marginTop: 12 },
  preset:          { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: C.border2, backgroundColor: 'transparent' },
  presetActive:    { backgroundColor: C.accent2, borderColor: C.accent2 },
  presetText:      { fontSize: 11, fontWeight: '600', color: C.txt3 },
  presetTextActive:{ color: C.txt },
  cycleInfoBox:    { backgroundColor: C.bg3, borderRadius: 12, padding: 10, marginTop: 12 },
  cycleInfo:       { textAlign: 'center', fontSize: 12, fontWeight: '700', color: C.txt2 },
  // 점/날짜 미리보기
  previewDots:     { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 10 },
  dotFilled:       { width: 10, height: 10, borderRadius: 5, backgroundColor: C.accent2 },
  dotHollow:       { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: C.border2 },
  previewHint:     { fontSize: 10, fontWeight: '500', color: C.txt3, textAlign: 'center', marginTop: 8 },
  // 매월/매년 요약
  repeatInfoBox:   { backgroundColor: C.bg3, borderRadius: 12, padding: 11, marginTop: 10 },
  repeatInfoText:  { fontSize: 13, fontWeight: '700', color: C.txt2, textAlign: 'center' },
  // 삭제
  deleteBtn:       { marginTop: 26, padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#5a2f2f', backgroundColor: 'rgba(224,112,112,0.08)', alignItems: 'center' },
  deleteBtnText:   { fontSize: 15, fontWeight: '700', color: '#e07070' },
  bottomActions:   { flexDirection: 'row', gap: 10, marginTop: 26 },
  bottomCancelBtn: { flex: 1, padding: 15, borderRadius: 16, borderWidth: 1, borderColor: C.border2, backgroundColor: 'transparent', alignItems: 'center' },
  bottomCancelText:{ fontSize: 15, fontWeight: '700', color: C.txt2 },
  bottomSaveBtn:   { flex: 1, padding: 15, borderRadius: 16, backgroundColor: C.accent2, alignItems: 'center' },
  bottomSaveText:  { fontSize: 15, fontWeight: '800', color: C.txt },
});
}
