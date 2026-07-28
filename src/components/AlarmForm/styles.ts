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
  // 교대근무(초번/중번/말번/기타/해당없음) 섹션 전체를 감싸는 카드 — 아래 알람내용/시간/반복방식과
  // 명확히 분리되도록 accent 테두리 + 그림자로 떠 보이게 강조하고, marginBottom으로 아래 섹션과의
  // 간격도 넉넉히 벌림.
  shiftSectionCard: {
    backgroundColor: C.bg3, borderWidth: 2, borderColor: C.accent2, borderRadius: 16,
    padding: 12, marginTop: 4, marginBottom: 22,
    shadowColor: C.accent2, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10,
    elevation: 6,
  },
  // 근무 시간대(초번/중번/말번/기타) — TypeSelector(typeBtn)와 동일한 flex:1 균등분할 방식으로
  // 화면 폭에 맞춰 4칸이 자동으로 늘어남(좁은 기기든 넓은 기기든 항상 꽉 채움, 오른쪽에 남는 공백 없음).
  // 항목별 고정색은 SHIFTS 상수 참조, active면 그 색으로 채우고 비active는 글자만 그 색.
  shiftGrid:       { flexDirection: 'row', gap: 6, marginTop: 4 },
  shiftBtn:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, paddingVertical: 9, borderRadius: 12, borderWidth: 1.3, borderColor: C.border2, backgroundColor: C.bg2 },
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
  repeatSecondaryRow:  { flexDirection: 'row', gap: 6, marginTop: 16, marginBottom: 8 },
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
  dayRow:          { flexDirection: 'row', gap: 5 },
  dayBtn:          { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: C.border2, backgroundColor: C.bg2 },
  dayBtnActive:    { backgroundColor: C.accent2, borderColor: C.accent2 },
  dayText:         { fontSize: 13, fontWeight: '700' },
  // N일 주기/휴식 팝업(진짜 Modal) 전용 헤더 — modalContent가 이미 카드 배경/패딩을 주므로
  // 그 안에서 제목 + 닫기(✕) 버튼만 한 줄로 배치
  cycleModalHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  cycleModalTitle:      { fontSize: 15, fontWeight: '800', color: C.txt },
  cycleModalCloseBtn:      { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg3 },
  cycleModalCloseBtnText:  { fontSize: 13, fontWeight: '800', color: C.txt3 },
  cycleDateRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  cycleDateLabel:  { fontSize: 12, fontWeight: '600', color: C.txt3 },
  cycleDateChip:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border2, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10, position: 'relative' },
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

  // 근무 시간대 게이트 배너 — 로테이션 모드로 들어가면 상단 ShiftSelector 대신 이걸 보여줌
  wpGateBanner:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.bg3, borderRadius: 14, padding: 12, marginTop: 4, gap: 10 },
  wpGateBannerText:  { fontSize: 12, fontWeight: '700', color: C.txt2, flex: 1 },
  wpEditHint:        { fontSize: 12, fontWeight: '700', color: C.accent, marginTop: 6, marginBottom: 2 },

  // 근무 패턴 블록 빌더
  wpStartRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 4 },
  wpStartLabel:      { fontSize: 12, fontWeight: '600', color: C.txt3 },
  wpStartHintGroup:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wpBlockCard:       { backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 12, marginTop: 8 },
  wpBlockHeaderRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  wpBlockIndex:      { fontSize: 11, fontWeight: '800', color: C.txt3 },
  wpRemoveBtn:        { padding: 4 },
  wpRemoveBtnText:    { fontSize: 15, fontWeight: '700', color: C.txt3 },
  wpShiftRow:        { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  wpShiftChip:       { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 1.3, borderColor: C.border2, backgroundColor: C.bg3 },
  wpShiftChipLabel:  { fontSize: 11.5, fontWeight: '700' },
  wpCustomInput:     { minHeight: 40, borderWidth: 1, borderColor: C.border2, borderRadius: 11, paddingHorizontal: 12, fontSize: 13, fontWeight: '600', color: C.txt, backgroundColor: C.bg3, marginTop: 8 },
  wpToggleRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
  wpToggleLabel:     { flex: 1, flexShrink: 1, fontSize: 12, fontWeight: '700', color: C.txt2 },
  wpTimeRow:         { flexDirection: 'row', gap: 8, marginTop: 10 },
  wpTimePill:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: 12, backgroundColor: C.bg3 },
  wpTimePillDim:     { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border, borderStyle: 'dashed' },
  wpTimePillText:    { fontSize: 14, fontWeight: '800', color: C.txt },
  wpTimePillSub:     { fontSize: 10, fontWeight: '700', color: C.txt3 },
  wpDayStepperRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 10 },
  wpDayVal:          { fontSize: 15, fontWeight: '800', color: C.txt, minWidth: 54, textAlign: 'center' },
  wpAddBlockBtn:     { alignItems: 'center', paddingVertical: 13, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.border2, marginTop: 10 },
  wpAddBlockText:    { fontSize: 13, fontWeight: '700', color: C.accent },
  // BlockTimeModal 확인 버튼 — bottomSaveBtn은 flex:1(가로 flex-row 안에서 쓰는 전제)이라
  // 세로 컬럼인 모달 안에 그대로 쓰면 높이가 찌그러져 텍스트가 안 보임. flex 없는 전용 스타일.
  wpModalConfirmBtn:  { alignSelf: 'stretch', padding: 15, borderRadius: 16, backgroundColor: C.accent2, alignItems: 'center' },
  wpModalConfirmText: { fontSize: 15, fontWeight: '800', color: C.txt },
  // 근무 순환표 칩을 탭하면 뜨는 액션 시트 — 시각 변경/일수 조정/전환/삭제를 세로로 나열
  wpMenuTitle:       { fontSize: 15, fontWeight: '800', color: C.txt, textAlign: 'center', marginBottom: 12 },
  wpMenuBtn:         { paddingVertical: 14, borderRadius: 14, backgroundColor: C.bg3, alignItems: 'center', marginBottom: 8 },
  wpMenuBtnText:     { fontSize: 14, fontWeight: '700', color: C.txt2 },
  wpMenuBtnDangerText: { color: '#E24B4A' },
  wpMenuCancelBtn:   { paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 4 },
  wpMenuCancelText:  { fontSize: 14, fontWeight: '700', color: C.txt3 },

  // RotationWizard — 한 조씩 순서대로 묻는 대화형 온보딩
  wzProgress:      { fontSize: 12, fontWeight: '700', color: C.txt3, marginBottom: 4 },
  wzQuestion:       { fontSize: 18, fontWeight: '900', color: C.txt, marginBottom: 16 },
  wzOptionRow:      { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 20 },
  wzOption:         { flex: 1, minWidth: 76, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 6, borderRadius: 14, borderWidth: 1.3, borderColor: C.border2, backgroundColor: C.bg3 },
  wzOptionText:     { fontSize: 14, fontWeight: '700', color: C.txt2 },
  wzSummary:        { fontSize: 13, color: C.txt3, marginBottom: 8 },
  wzSeqChip:        { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.3, backgroundColor: C.bg3 },
  wzSeqChipText:    { fontSize: 13, fontWeight: '800' },
  wzAddChip:        { minWidth: 72, paddingVertical: 8, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.txt3, alignItems: 'center', justifyContent: 'center' },
  wzAddChipText:    { fontSize: 15, fontWeight: '900', color: C.txt3 },
  wzActionRow:      { flexDirection: 'row', gap: 8, marginTop: 8 },
  wzPrimaryBtn:     { flex: 1, padding: 15, borderRadius: 16, backgroundColor: C.accent2, alignItems: 'center' },
  wzPrimaryText:    { fontSize: 14, fontWeight: '800', color: C.txt },
  wzSecondaryBtn:   { flex: 1, padding: 15, borderRadius: 16, borderWidth: 1, borderColor: C.border2, alignItems: 'center' },
  wzSecondaryText:  { fontSize: 14, fontWeight: '700', color: C.txt2 },
  wzTopRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  // 고령층 피드백 — 취소/이전이 작은 텍스트 링크라 안 보인다고 함. 테두리 있는 버튼 형태로
  // 키우고 글자도 크게 해서 눈에 확실히 띄고 손가락으로 누르기 쉽게 함
  wzCloseBtn:       { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1.3, borderColor: C.border2, backgroundColor: C.bg3 },
  wzCloseText:      { fontSize: 15, fontWeight: '800', color: C.txt2 },
  wzBackBtn:        { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1.3, borderColor: C.accent2, backgroundColor: C.bg3 },
  wzBackText:       { fontSize: 15, fontWeight: '800', color: C.accent },
  // 시작일을 안 보고 바로 근무 버튼부터 누르는 사용자가 많아, 확인 전까지 눈에 띄는 배지로 유도
  wzStartHint:      { fontSize: 12, fontWeight: '700', color: '#e07070' },
  wzStartBadge:     { position: 'absolute', top: -3, right: -3, width: 9, height: 9, borderRadius: 5, backgroundColor: '#e07070' },
});
}
