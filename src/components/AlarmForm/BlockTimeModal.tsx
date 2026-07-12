import React, { useState, useEffect } from 'react';
import { Modal, View, TouchableOpacity } from 'react-native';
// 시간 휠(ScrollPicker)은 드래그 제스처가 필요한데, 배경을 감싸는 TouchableOpacity가
// 안쪽까지 이중으로 겹치면(DateModal 패턴을 그대로 가져다 씀) 드래그가 씹히는 문제가 있었다.
// 그래서 이 모달은 바깥 탭으로 닫는 기능을 포기하고 "확인" 버튼으로만 닫는다(순수 View로 감쌈).
import { Text } from '../common/AppText';
import { ScrollPicker } from '../common/ScrollPicker';
import { useColors } from '../../hooks/useTheme';
import { makeStyles } from './styles';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINS  = Array.from({ length: 12 }, (_, i) => i * 5);

interface Props {
  visible: boolean;
  hour: number;
  min: number;
  title: string;
  onChange: (hour: number, min: number) => void;
  onClose: () => void;
}

// WorkPatternBuilder의 출근/퇴근 시각 알약을 탭하면 뜨는 모달 — DateModal과 같은
// "칩 탭 → 모달로 정확히 고르기" 패턴을 시간에도 재사용(TimePickerSection의 ScrollPicker 그대로).
export function BlockTimeModal({ visible, hour, min, title, onChange, onClose }: Props) {
  const C = useColors();
  const s = makeStyles(C);
  const [h, setH] = useState(hour);
  const [m, setM] = useState(min);

  useEffect(() => {
    if (visible) { setH(hour); setM(min); }
  }, [visible, hour, min]);

  const confirm = () => { onChange(h, m); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={confirm}>
      <View style={s.modalOverlay}>
        <View style={s.modalContent}>
          <Text style={s.cycleDateLabel}>{title}</Text>
          <View style={[s.timeRow, { marginTop: 10 }]}>
            <View style={s.timePickerSide}>
              <View style={s.timeStepper}>
                <ScrollPicker value={h} items={HOURS} onChange={setH} />
              </View>
              <Text style={s.timeColon}>:</Text>
              <View style={s.timeStepper}>
                <ScrollPicker value={m} items={MINS} onChange={setM} />
              </View>
            </View>
          </View>
          <TouchableOpacity style={[s.wpModalConfirmBtn, { marginTop: 14 }]} onPress={confirm}>
            <Text style={s.wpModalConfirmText}>확인</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
