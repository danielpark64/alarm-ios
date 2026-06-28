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

// DateSection / CycleRestControls가 공유하는 시작 일자 선택 모달
export function DateModal({ sd, setSd, visible, onClose }: Props) {
  const s = makeStyles(useColors());
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.modalContent}>
          <CalendarPicker value={sd} onChange={setSd} onClose={onClose} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
