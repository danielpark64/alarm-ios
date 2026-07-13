import React, { useState } from 'react';
import { View, TouchableOpacity, TextInput, Modal } from 'react-native';
import { Text } from '../common/AppText';
import { SHIFTS, ShiftPeriod, WorkSegment } from '../../constants';
import { useColors } from '../../hooks/useTheme';
import { newBlockId, mergeOrAppendSegment } from '../../utils/workPattern';
import { makeStyles } from './styles';
import { BlockTimeModal } from './BlockTimeModal';

const BLOCK_SHIFTS = SHIFTS.filter(s => s.id !== 'none');

interface Props {
  blocks: WorkSegment[];
  setBlocks: (updater: (prev: WorkSegment[]) => WorkSegment[]) => void;
  sd: string;
  setShowCal: (v: boolean) => void;
}

function segLabel(seg: WorkSegment): string {
  if (seg.isRest) return '비번';
  return seg.shift === 'custom' ? (seg.shiftCustom?.trim() || '기타') : SHIFTS.find(sh => sh.id === seg.shift)!.label;
}
function segColor(seg: WorkSegment, C: ReturnType<typeof useColors>): string {
  return seg.isRest ? C.txt3 : SHIFTS.find(sh => sh.id === seg.shift)!.color;
}

// 근무 시간대 로테이션을 "근무 순환표" 칩으로 보여주고 편집하는 화면 — RotationWizard(만들 때
// 하루씩 탭해서 쌓는 화면)와 같은 칩 인터랙션을 그대로 써서, 만들 때든 나중에 고칠 때든 항상
// 같은 방식(탭 → 시각변경/일수조정/전환/삭제)으로 조작한다. 뒤에 더 추가할 때도 위저드와
// 똑같이 초번/중번/말번/기타/비번 버튼을 탭하기만 하면 된다.
export function WorkPatternBuilder({ blocks, setBlocks, sd, setShowCal }: Props) {
  const C = useColors();
  const s = makeStyles(C);
  const [, m, d] = sd.split('-').map(Number);
  const [menuIndex, setMenuIndex] = useState<number | null>(null);
  const [timeEdit, setTimeEdit] = useState<{ index: number; phase: 'commute' | 'offwork' } | null>(null);
  const [dayEditIndex, setDayEditIndex] = useState<number | null>(null);
  const [tempDays, setTempDays] = useState(1);
  const [customPrompt, setCustomPrompt] = useState(false);
  const [customText, setCustomText] = useState('');

  const updateBlock = (i: number, patch: Partial<WorkSegment>) => {
    setBlocks(prev => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  };
  const removeBlock = (i: number) => {
    setMenuIndex(null);
    setBlocks(prev => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
  };

  const startTimeEdit = (i: number) => {
    setMenuIndex(null);
    setTimeEdit({ index: i, phase: 'commute' });
  };
  const openDayEdit = (i: number) => {
    setMenuIndex(null);
    setTempDays(blocks[i].days);
    setDayEditIndex(i);
  };
  const confirmDayEdit = () => {
    if (dayEditIndex != null) updateBlock(dayEditIndex, { days: Math.max(1, tempDays) });
    setDayEditIndex(null);
  };
  const convertToRest = (i: number) => {
    setMenuIndex(null);
    updateBlock(i, { isRest: true, shift: 'none', shiftCustom: undefined });
  };
  const convertToWork = (i: number) => {
    setMenuIndex(null);
    updateBlock(i, {
      isRest: false, shift: 'early',
      commuteTime: blocks[i].commuteTime ?? { hour: 8, min: 0 },
      hasOffwork: true,
      offworkTime: blocks[i].offworkTime ?? { hour: 17, min: 0 },
    });
  };

  // 새 시간대를 뒤에 추가할 때, 이 근무표 안에 그 시간대가 이미 있었으면 마지막으로 쓴 시각을
  // 그대로 재사용한다(위저드의 "처음만 물어보고 재사용" 규칙과 동일).
  const lastKnownTime = (shift: ShiftPeriod, shiftCustom?: string) => {
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      if (!b.isRest && b.shift === shift && (shift !== 'custom' || b.shiftCustom === shiftCustom)) {
        return { commuteTime: b.commuteTime ?? { hour: 8, min: 0 }, offworkTime: b.offworkTime ?? { hour: 17, min: 0 }, hasOffwork: b.hasOffwork };
      }
    }
    return { commuteTime: { hour: 8, min: 0 }, offworkTime: { hour: 17, min: 0 }, hasOffwork: true };
  };

  const appendShift = (shift: ShiftPeriod) => {
    if (shift === 'custom') {
      const existing = blocks.find(b => !b.isRest && b.shift === 'custom');
      if (!existing) { setCustomText(''); setCustomPrompt(true); return; }
      const t = lastKnownTime('custom', existing.shiftCustom);
      setBlocks(prev => mergeOrAppendSegment(prev, { blockId: newBlockId(), shift: 'custom', shiftCustom: existing.shiftCustom, days: 1, isRest: false, ...t }));
      return;
    }
    const t = lastKnownTime(shift);
    setBlocks(prev => mergeOrAppendSegment(prev, { blockId: newBlockId(), shift, days: 1, isRest: false, ...t }));
  };
  const confirmCustomPrompt = () => {
    setBlocks(prev => mergeOrAppendSegment(prev, {
      blockId: newBlockId(), shift: 'custom', shiftCustom: customText, days: 1, isRest: false,
      commuteTime: { hour: 8, min: 0 }, hasOffwork: true, offworkTime: { hour: 17, min: 0 },
    }));
    setCustomPrompt(false);
  };
  const appendRest = () => {
    setBlocks(prev => mergeOrAppendSegment(prev, { blockId: newBlockId(), shift: 'none', days: 1, isRest: true, hasOffwork: false }));
  };

  const menuSeg = menuIndex != null ? blocks[menuIndex] : null;
  const activeTimeSeg = timeEdit ? blocks[timeEdit.index] : null;
  const activeTime = timeEdit
    ? (timeEdit.phase === 'offwork' ? activeTimeSeg?.offworkTime : activeTimeSeg?.commuteTime)
    : null;

  return (
    <View>
      <View style={s.wpStartRow}>
        <Text style={s.wpStartLabel}>시작일</Text>
        <TouchableOpacity style={s.cycleDateChip} onPress={() => setShowCal(true)}>
          <Text>📅</Text>
          <Text style={s.cycleDateChipText}>{m}/{d} 시작</Text>
        </TouchableOpacity>
      </View>

      <Text style={[s.sLabel, { marginTop: 8 }]}>근무 순환표</Text>
      <View style={s.wzOptionRow}>
        {blocks.map((seg, i) => (
          <TouchableOpacity key={seg.blockId} style={[s.wzSeqChip, { borderColor: segColor(seg, C) }]} onPress={() => setMenuIndex(i)}>
            <Text style={[s.wzSeqChipText, { color: segColor(seg, C) }]}>{segLabel(seg)} {seg.days}일</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[s.sLabel, { marginTop: 4 }]}>뒤에 더 추가</Text>
      <View style={s.wzOptionRow}>
        {BLOCK_SHIFTS.map(sh => (
          <TouchableOpacity key={sh.id} style={s.wzOption} onPress={() => appendShift(sh.id as ShiftPeriod)}>
            <Text style={s.wzOptionText}>{sh.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={s.wzOption} onPress={appendRest}>
          <Text style={s.wzOptionText}>비번</Text>
        </TouchableOpacity>
      </View>

      {/* 칩 액션 시트 — 근무 구간은 시각변경도 있고, 비번 구간은 시각이 없어서 빠진다 */}
      <Modal visible={menuIndex != null} transparent animationType="fade" onRequestClose={() => setMenuIndex(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            {menuSeg && (
              <>
                <Text style={s.wpMenuTitle}>{segLabel(menuSeg)} {menuSeg.days}일</Text>
                {!menuSeg.isRest && (
                  <TouchableOpacity style={s.wpMenuBtn} onPress={() => startTimeEdit(menuIndex!)}>
                    <Text style={s.wpMenuBtnText}>🕐 시각 변경</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.wpMenuBtn} onPress={() => openDayEdit(menuIndex!)}>
                  <Text style={s.wpMenuBtnText}>일수 조정</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.wpMenuBtn} onPress={() => (menuSeg.isRest ? convertToWork(menuIndex!) : convertToRest(menuIndex!))}>
                  <Text style={s.wpMenuBtnText}>{menuSeg.isRest ? '근무로 전환' : '비번으로 전환'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.wpMenuBtn} onPress={() => removeBlock(menuIndex!)} disabled={blocks.length <= 1}>
                  <Text style={[s.wpMenuBtnText, s.wpMenuBtnDangerText, blocks.length <= 1 && { opacity: 0.4 }]}>삭제</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.wpMenuCancelBtn} onPress={() => setMenuIndex(null)}>
                  <Text style={s.wpMenuCancelText}>취소</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* 일수 조정 미니 모달 */}
      <Modal visible={dayEditIndex != null} transparent animationType="fade" onRequestClose={confirmDayEdit}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.wpMenuTitle}>며칠인가요?</Text>
            <View style={s.wpDayStepperRow}>
              <TouchableOpacity style={s.stepBtn} onPress={() => setTempDays(v => Math.max(1, v - 1))}>
                <Text style={s.stepBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={s.wpDayVal}>{tempDays}일</Text>
              <TouchableOpacity style={s.stepBtn} onPress={() => setTempDays(v => Math.min(365, v + 1))}>
                <Text style={s.stepBtnText}>＋</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[s.wpModalConfirmBtn, { marginTop: 14 }]} onPress={confirmDayEdit}>
              <Text style={s.wpModalConfirmText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 기타(커스텀) 시간대를 이 근무표에서 처음 추가할 때만 이름을 물어본다 */}
      <Modal visible={customPrompt} transparent animationType="fade" onRequestClose={() => setCustomPrompt(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.wpMenuTitle}>근무 이름이 뭐예요?</Text>
            <TextInput
              style={s.wpCustomInput}
              value={customText}
              onChangeText={setCustomText}
              placeholder="예: 새벽조"
              placeholderTextColor={C.txt3}
              returnKeyType="done"
              autoFocus
            />
            <TouchableOpacity style={[s.wpModalConfirmBtn, { marginTop: 14 }]} onPress={confirmCustomPrompt}>
              <Text style={s.wpModalConfirmText}>추가</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <BlockTimeModal
        visible={!!timeEdit}
        title={timeEdit?.phase === 'offwork' ? '퇴근 시각' : '출근 시각'}
        hour={activeTime?.hour ?? 9}
        min={activeTime?.min ?? 0}
        onChange={(h, mi) => {
          if (!timeEdit) return;
          updateBlock(timeEdit.index, timeEdit.phase === 'offwork' ? { offworkTime: { hour: h, min: mi } } : { commuteTime: { hour: h, min: mi } });
        }}
        onClose={() => {
          if (!timeEdit) return;
          const seg = blocks[timeEdit.index];
          if (timeEdit.phase === 'commute' && seg.hasOffwork) setTimeEdit({ index: timeEdit.index, phase: 'offwork' });
          else setTimeEdit(null);
        }}
      />
    </View>
  );
}
