import React from 'react';
import { View, TouchableOpacity, Modal } from 'react-native';
import { Text } from '../common/AppText';
import { SHIFTS, ShiftPeriod, REST_COLOR } from '../../constants';
import { useColors } from '../../hooks/useTheme';
import { makeStyles } from './styles';

const BLOCK_SHIFTS = SHIFTS.filter(s => s.id !== 'none');
// RotationWizard/WorkPatternBuilder와 동일한 순서(초·말·비·중·기타) — 대부분의 교대근무자가
// 이 순서로 근무하므로 버튼도 이 순서로 배치
const BUTTON_ORDER: (ShiftPeriod | 'REST')[] = ['early', 'late', 'REST', 'mid', 'custom'];

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick: (id: ShiftPeriod | 'REST') => void;
}

// 근무 순환표 칩 줄 끝의 "+" 타일을 누르면 뜨는 팝업 — 어떤 근무를 추가할지 고른다.
// RotationWizard(신규 생성)와 WorkPatternBuilder(수정)가 공유한다.
export function AddShiftModal({ visible, onClose, onPick }: Props) {
  const C = useColors();
  const s = makeStyles(C);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalContent}>
          <Text style={s.wpMenuTitle}>어떤 근무를 추가할까요?</Text>
          {BUTTON_ORDER.map(id => id === 'REST' ? (
            <TouchableOpacity key="REST" style={s.wpMenuBtn} onPress={() => onPick('REST')}>
              <Text style={[s.wpMenuBtnText, { color: REST_COLOR }]}>비번</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity key={id} style={s.wpMenuBtn} onPress={() => onPick(id)}>
              <Text style={s.wpMenuBtnText}>{BLOCK_SHIFTS.find(sh => sh.id === id)!.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={s.wpMenuCancelBtn} onPress={onClose}>
            <Text style={s.wpMenuCancelText}>취소</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
