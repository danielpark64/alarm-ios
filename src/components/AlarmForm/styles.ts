import { StyleSheet, Platform } from 'react-native';
import { PICK_H } from '../common/ScrollPicker';

export const s = StyleSheet.create({
  sLabel:          { fontSize: 13, fontWeight: '900', letterSpacing: 0.5, color: '#555', marginTop: 14, marginBottom: 6 },
  // 종류
  typeGrid:        { flexDirection: 'row', gap: 6 },
  typeBtn:         { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, backgroundColor: '#f5f5f5' },
  typeBtnLabel:    { fontSize: 13, fontWeight: '800' },
  // 날짜
  dateRow:         { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  dateBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', borderWidth: 1.5, borderColor: '#aaa', borderRadius: 13, padding: 14, gap: 8 },
  dateBtnDim:      { opacity: 0.5 },
  dateBtnIcon:     { fontSize: 20 },
  dateBtnLabel:    { flex: 1, fontSize: 15, fontWeight: '800', color: '#000' },
  dateBtnArrow:    { fontSize: 12, color: '#888' },
  lastDayBtn:      { paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', borderRadius: 13, borderWidth: 1.5, borderColor: '#aaa', backgroundColor: '#f0f0f0' },
  lastDayBtnActive:{ backgroundColor: '#444', borderColor: '#444' },
  lastDayText:     { fontSize: 14, fontWeight: '900', color: '#333' },
  leapNotice:      { fontSize: 12, fontWeight: '700', color: '#e05555', marginTop: 6, paddingLeft: 4 },
  // 캘린더 모달
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent:    { width: '90%', backgroundColor: '#fff', borderRadius: 20, padding: 20 },
  // 시간
  timeRow:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 16, borderWidth: 1, borderColor: '#ddd', paddingVertical: 8, paddingHorizontal: 10 },
  timePickerSide:  { flexDirection: 'row', alignItems: 'center', flex: 1 },
  timeDivider:     { width: 1, height: PICK_H * 3, backgroundColor: '#ddd', marginHorizontal: 10 },
  timeStepper:     { flex: 1, alignItems: 'center' },
  timeColon:       { fontSize: 28, fontWeight: '900', color: '#000', marginHorizontal: 8 },
  // 소리+진동
  sndVibSide:      { gap: 6, alignItems: 'stretch', minWidth: 80 },
  sndVibBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#ccc', backgroundColor: '#fff' },
  sndVibActive:    { backgroundColor: '#333', borderColor: '#333' },
  sndVibIconFixed: { fontSize: 13 },
  sndVibIconWrap:  { flexDirection: 'row', alignItems: 'center', gap: 3, width: 34 },
  sndVibLabel:     { fontSize: 12, fontWeight: '800', color: '#444', textAlign: 'center' },
  sndVibPlus:      { fontSize: 9,  fontWeight: '900', color: '#aaa', textAlign: 'center', lineHeight: 11 },
  sndVibLabelActive: { color: '#fff' },
  // 라벨
  input:           { borderWidth: 1.5, borderColor: '#aaa', borderRadius: 13, padding: 13, fontSize: 17, fontWeight: '700', color: '#000', backgroundColor: '#fff' },
  // 반복
  pill:            { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: '#ccc', backgroundColor: '#f5f5f5' },
  pillActive:      { backgroundColor: '#444', borderColor: '#444' },
  pillText:        { fontSize: 13, fontWeight: '800', color: '#333' },
  // 구분선
  optDivider:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  optDividerLine:  { flex: 1, height: 1, backgroundColor: '#ddd' },
  optDividerLabel: { fontSize: 11, fontWeight: '800', color: '#aaa', letterSpacing: 0.8 },
  // 요일
  quickRow:        { flexDirection: 'row', gap: 8 },
  quickBtn:        { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: '#ccc', backgroundColor: '#f5f5f5', alignItems: 'center' },
  quickBtnText:    { fontSize: 13, fontWeight: '800', color: '#333' },
  dayRow:          { flexDirection: 'row', gap: 6 },
  dayBtn:          { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: '#ccc', backgroundColor: '#f5f5f5' },
  dayBtnActive:    { backgroundColor: '#444', borderColor: '#444' },
  dayText:         { fontSize: 13, fontWeight: '800' },
  // N일 주기
  cycleBox:        { backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#ccc', borderRadius: 16, padding: 16, marginTop: 10 },
  cycleLabel:      { fontSize: 12, fontWeight: '900', color: '#555', marginBottom: 8 },
  stepper:         { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn:         { width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: '#888', backgroundColor: '#e8e8e8', alignItems: 'center', justifyContent: 'center' },
  stepBtnText:     { fontSize: 22, fontWeight: '900', color: '#444' },
  stepVal:         { flex: 1, textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 38, fontWeight: '900', color: '#333' },
  stepUnit:        { fontSize: 14, fontWeight: '400', color: '#666' },
  presetRow:       { flexDirection: 'row', gap: 7, marginTop: 12 },
  preset:          { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, borderColor: '#ccc', backgroundColor: 'transparent' },
  presetActive:    { backgroundColor: '#444', borderColor: '#444' },
  presetText:      { fontSize: 13, fontWeight: '700', color: '#333' },
  cycleInfoBox:    { backgroundColor: '#e0e0e0', borderRadius: 10, padding: 10, marginTop: 12 },
  cycleInfo:       { textAlign: 'center', fontSize: 13, fontWeight: '800', color: '#333' },
  // 매월/매년 요약
  repeatInfoBox:   { backgroundColor: '#f0f0f0', borderRadius: 12, padding: 12, marginTop: 10 },
  repeatInfoText:  { fontSize: 13, fontWeight: '800', color: '#333', textAlign: 'center' },
  // 버튼
  btnRow:          { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn:       { flex: 1, padding: 16, borderRadius: 16, borderWidth: 1.5, borderColor: '#aaa', backgroundColor: '#f0f0f0', alignItems: 'center' },
  cancelBtnText:   { fontSize: 17, fontWeight: '800', color: '#333' },
  submitBtn:       { flex: 2, padding: 16, borderRadius: 16, backgroundColor: '#444', alignItems: 'center' },
  submitBtnText:   { fontSize: 17, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
});
