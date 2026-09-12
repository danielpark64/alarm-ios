import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../common/AppText';
import { ScrollPicker } from '../common/ScrollPicker';
import { Palette } from '../../constants/colors';
import { useColors } from '../../hooks/useTheme';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINS  = Array.from({ length: 12 }, (_, i) => i * 5);

// 대근·특근·반차·야근 등 "하루 근무 변경"에서 출근/퇴근 시각을 사용자가 직접 조정하는 오버레이.
// ⚠️ 자체 <Modal>을 갖지 않는다 — 이미 열려 있는 하루 상세 팝업(<Modal>) 위에 두 번째
// <Modal>을 형제로 띄우면 iOS가 먼저 present된 모달 위로 두 번째 present를 조용히 무시해서
// 아예 안 뜬다(이 프로젝트에서 이미 겪은 버그, CycleRestControls.tsx 참고 — 그 파일도 같은
// 이유로 "겹쳐 띄우는 모달"을 부모 <Modal>의 children으로 넣는다). 그래서 이 컴포넌트는 순수
// View만 반환하고, 부모(CalendarView)가 이미 열려 있는 <Modal> 안에 형제로 넣어서 쓴다.
interface Props {
  visible: boolean;
  title: string;
  start?: { hour: number; min: number };
  end?: { hour: number; min: number };
  onConfirm: (start: { hour: number; min: number }, end: { hour: number; min: number }) => void;
  onClose: () => void;
}

export function OverrideTimeModal({ visible, title, start, end, onConfirm, onClose }: Props) {
  const C = useColors();
  const s = makeStyles(C);
  const [sh, setSh] = useState(start?.hour ?? 9);
  const [sm, setSm] = useState(start?.min ?? 0);
  const [eh, setEh] = useState(end?.hour ?? 18);
  const [em, setEm] = useState(end?.min ?? 0);

  useEffect(() => {
    if (!visible) return;
    setSh(start?.hour ?? 9); setSm(start?.min ?? 0);
    setEh(end?.hour ?? 18); setEm(end?.min ?? 0);
  }, [visible, start?.hour, start?.min, end?.hour, end?.min]);

  if (!visible) return null;

  const confirm = () => { onConfirm({ hour: sh, min: sm }, { hour: eh, min: em }); onClose(); };

  return (
    <View style={s.overlay}>
      <View style={s.card}>
        <Text style={s.title}>{title}</Text>
        <Text style={s.rowLabel}>출근</Text>
        <View style={s.row}>
          <ScrollPicker value={sh} items={HOURS} onChange={setSh} />
          <Text style={s.colon}>:</Text>
          <ScrollPicker value={sm} items={MINS} onChange={setSm} />
        </View>
        <Text style={s.rowLabel}>퇴근</Text>
        <View style={s.row}>
          <ScrollPicker value={eh} items={HOURS} onChange={setEh} />
          <Text style={s.colon}>:</Text>
          <ScrollPicker value={em} items={MINS} onChange={setEm} />
        </View>
        <View style={s.btnRow}>
          <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
            <Text style={s.cancelBtnText}>취소</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.confirmBtn} onPress={confirm}>
            <Text style={s.confirmBtnText}>확인</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    // 이제 자체 Modal이 없으므로 화면 전체를 절대 위치로 덮어 부모 Modal의 카드 위에 겹쳐 보이게 한다.
    overlay:   { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.55)', justifyContent:'center', alignItems:'center', padding:28, zIndex:20, elevation:20 },
    card:      { backgroundColor:C.bg2, borderRadius:20, padding:20, borderWidth:1, borderColor:C.border, width:280 },
    title:     { fontSize:16, fontWeight:'800', color:C.txt, textAlign:'center', marginBottom:12 },
    rowLabel:  { fontSize:12.5, fontWeight:'700', color:C.txt3, marginTop:6, marginBottom:2 },
    row:       { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6 },
    colon:     { fontSize:18, fontWeight:'800', color:C.txt },
    btnRow:    { flexDirection:'row', gap:10, marginTop:16 },
    cancelBtn: { flex:1, paddingVertical:12, borderRadius:12, alignItems:'center', backgroundColor:C.bg3 },
    cancelBtnText:{ fontSize:14, fontWeight:'700', color:C.txt2 },
    confirmBtn:{ flex:1, paddingVertical:12, borderRadius:12, alignItems:'center', backgroundColor:C.accent2 },
    confirmBtnText:{ fontSize:14, fontWeight:'800', color:'#ffffff' },
  });
}
