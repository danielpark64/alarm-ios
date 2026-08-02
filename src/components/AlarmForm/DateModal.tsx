import React from 'react';
import { Modal, TouchableOpacity } from 'react-native';
import { CalendarPicker } from '../common/CalendarPicker';
import { useColors } from '../../hooks/useTheme';
import { makeStyles } from './styles';

interface Props {
  sd: string;
  setSd: (v: string) => void;
  visible: boolean;
  onClose: () => void;
}

// DateSection / CycleRestControls가 공유하는 시작 일자 선택 모달.
// CycleRest 팝업에서 쓸 때는 이 컴포넌트를 그 팝업 <Modal>의 자식으로 렌더해야 한다 —
// 형제로 두면 두 모달이 동시에 present되어 iOS에서 달력이 안 뜬다(CycleRestControls 주석 참고).
export function DateModal({ sd, setSd, visible, onClose }: Props) {
  const s = makeStyles(useColors());

  // 조건부 마운트 — 이 버그의 진짜 원인은 형제 모달 동시 present였고 이건 추가 안전장치일 뿐이다.
  // (상시 마운트 방식인 AddShiftModal/BlockTimeModal 등은 지금도 정상이니 따라 고칠 필요 없음)
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.modalContent}>
          <CalendarPicker value={sd} onChange={setSd} onClose={onClose} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
