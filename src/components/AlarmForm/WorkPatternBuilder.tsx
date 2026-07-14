import React, { useState } from 'react';
import { View, TouchableOpacity, TextInput, Modal } from 'react-native';
import { Text } from '../common/AppText';
import { SHIFTS, ShiftPeriod, WorkSegment, DEFAULT_SHIFT_TIMES, DEFAULT_SHIFT_TIME_FALLBACK, REST_COLOR } from '../../constants';
import { useColors } from '../../hooks/useTheme';
import { newBlockId, mergeOrAppendSegment, sameSegmentType } from '../../utils/workPattern';
import { makeStyles } from './styles';
import { BlockTimeModal } from './BlockTimeModal';

const BLOCK_SHIFTS = SHIFTS.filter(s => s.id !== 'none');
// RotationWizard와 동일한 순서(초·말·비·중·기타) — 대부분의 교대근무자가 이 순서로 근무하므로
const BUTTON_ORDER: (ShiftPeriod | 'REST')[] = ['early', 'late', 'REST', 'mid', 'custom'];

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
  return seg.isRest ? REST_COLOR : SHIFTS.find(sh => sh.id === seg.shift)!.color;
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
  const [timeEdit, setTimeEdit] = useState<{ index: number; phase: 'commute' | 'offwork'; askOffworkYN?: boolean } | null>(null);
  const [offworkYNIndex, setOffworkYNIndex] = useState<number | null>(null);
  const [dayEditIndex, setDayEditIndex] = useState<number | null>(null);
  const [tempDays, setTempDays] = useState(1);
  const [customPrompt, setCustomPrompt] = useState(false);
  const [customText, setCustomText] = useState('');
  const [renameIndex, setRenameIndex] = useState<number | null>(null);

  const updateBlock = (i: number, patch: Partial<WorkSegment>) => {
    setBlocks(prev => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  };
  // 기타 시간대는 저장 후엔 이름을 바꿀 방법이 없었음 — 이 근무표 안에서 같은 이름을 쓰던
  // 블록 전부를 한 번에 새 이름으로 바꾼다(같은 종류로 취급되던 블록들이므로)
  const openRename = (i: number) => {
    setMenuIndex(null);
    setCustomText(blocks[i].shiftCustom ?? '');
    setRenameIndex(i);
  };
  const confirmRename = () => {
    if (renameIndex == null) return;
    const oldName = blocks[renameIndex].shiftCustom;
    setBlocks(prev => prev.map(b =>
      (!b.isRest && b.shift === 'custom' && b.shiftCustom === oldName) ? { ...b, shiftCustom: customText } : b
    ));
    setRenameIndex(null);
  };
  const removeBlock = (i: number) => {
    setMenuIndex(null);
    setBlocks(prev => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
  };

  const startTimeEdit = (i: number, askOffworkYN?: boolean) => {
    setMenuIndex(null);
    setTimeEdit({ index: i, phase: 'commute', askOffworkYN });
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
  // 퇴근 알람 없이 만든 구간(hasOffwork:false)은 나중에 퇴근 시각을 고칠 진입점이 아예 없었음 —
  // 이 토글로 켜면 시각 입력까지 바로 이어서 물어본다
  const toggleOffwork = (i: number) => {
    setMenuIndex(null);
    const seg = blocks[i];
    if (seg.hasOffwork) {
      updateBlock(i, { hasOffwork: false });
      return;
    }
    const defaults = DEFAULT_SHIFT_TIMES[seg.shift] ?? DEFAULT_SHIFT_TIME_FALLBACK;
    updateBlock(i, { hasOffwork: true, offworkTime: seg.offworkTime ?? { ...defaults.offwork } });
    setTimeEdit({ index: i, phase: 'offwork' });
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
    const defaults = DEFAULT_SHIFT_TIMES[shift] ?? DEFAULT_SHIFT_TIME_FALLBACK;
    return { commuteTime: { ...defaults.commute }, offworkTime: { ...defaults.offwork }, hasOffwork: true };
  };

  const appendShift = (shift: ShiftPeriod) => {
    if (shift === 'custom') {
      const existing = blocks.find(b => !b.isRest && b.shift === 'custom');
      if (!existing) { setCustomText(''); setCustomPrompt(true); return; }
      const t = lastKnownTime('custom', existing.shiftCustom);
      setBlocks(prev => mergeOrAppendSegment(prev, { blockId: newBlockId(), shift: 'custom', shiftCustom: existing.shiftCustom, days: 1, isRest: false, ...t }));
      return;
    }
    // 이 근무표에서 처음 쓰는 시간대면 기본값으로 조용히 넣지 않고 바로 시각을 물어본다 —
    // 이전엔 항상 마지막값/기본값으로 조용히 추가되고 칩을 다시 눌러야만 고칠 수 있어서 혼란스러웠음
    const isFirstUse = !blocks.some(b => !b.isRest && b.shift === shift);
    const t = lastKnownTime(shift);
    const newIndex = blocks.length;
    setBlocks(prev => mergeOrAppendSegment(prev, { blockId: newBlockId(), shift, days: 1, isRest: false, ...t }));
    if (isFirstUse) startTimeEdit(newIndex, true);
  };
  const confirmCustomPrompt = () => {
    const defaults = DEFAULT_SHIFT_TIME_FALLBACK;
    const newSeg: WorkSegment = {
      blockId: newBlockId(), shift: 'custom', shiftCustom: customText, days: 1, isRest: false,
      commuteTime: { ...defaults.commute }, hasOffwork: true, offworkTime: { ...defaults.offwork },
    };
    // mergeOrAppendSegment가 실제로 새 블록을 append할지, 마지막 블록에 합칠지는 여기서 미리
    // 알 수 있다(같은 로직 재사용) — blocks.length를 새 인덱스로 무조건 가정하면 병합되는
    // 경우 없는 인덱스를 가리켜 방금 입력한 시각이 조용히 버려지는 버그가 생김
    const last = blocks[blocks.length - 1];
    const willMerge = !!last && sameSegmentType(last, newSeg);
    const newIndex = willMerge ? blocks.length - 1 : blocks.length;
    setBlocks(prev => mergeOrAppendSegment(prev, newSeg));
    setCustomPrompt(false);
    startTimeEdit(newIndex, true);
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
        {BUTTON_ORDER.map(id => id === 'REST' ? (
          <TouchableOpacity key="REST" style={[s.wzOption, { borderColor: REST_COLOR }]} onPress={appendRest}>
            <Text style={[s.wzOptionText, { color: REST_COLOR }]}>비번</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity key={id} style={s.wzOption} onPress={() => appendShift(id)}>
            <Text style={s.wzOptionText}>{BLOCK_SHIFTS.find(sh => sh.id === id)!.label}</Text>
          </TouchableOpacity>
        ))}
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
                {!menuSeg.isRest && (
                  <TouchableOpacity style={s.wpMenuBtn} onPress={() => toggleOffwork(menuIndex!)}>
                    <Text style={s.wpMenuBtnText}>{menuSeg.hasOffwork ? '퇴근 알람 끄기' : '🕐 퇴근 알람 켜기'}</Text>
                  </TouchableOpacity>
                )}
                {!menuSeg.isRest && menuSeg.shift === 'custom' && (
                  <TouchableOpacity style={s.wpMenuBtn} onPress={() => openRename(menuIndex!)}>
                    <Text style={s.wpMenuBtnText}>✏️ 이름 변경</Text>
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

      {/* 기타 시간대 이름 변경 — 같은 이름을 쓰던 블록 전부에 한 번에 반영 */}
      <Modal visible={renameIndex != null} transparent animationType="fade" onRequestClose={() => setRenameIndex(null)}>
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
            <TouchableOpacity style={[s.wpModalConfirmBtn, { marginTop: 14 }]} onPress={confirmRename}>
              <Text style={s.wpModalConfirmText}>변경</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 처음 추가하는 시간대 — 출근 시각 입력 직후, 위저드와 동일하게 퇴근 알람 필요 여부부터 물어봄 */}
      <Modal visible={offworkYNIndex != null} transparent animationType="fade" onRequestClose={() => setOffworkYNIndex(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.wpMenuTitle}>퇴근 알람도 필요해요?</Text>
            <View style={[s.wzActionRow, { marginTop: 4 }]}>
              <TouchableOpacity
                style={s.wzSecondaryBtn}
                onPress={() => {
                  if (offworkYNIndex == null) return;
                  updateBlock(offworkYNIndex, { hasOffwork: false });
                  setOffworkYNIndex(null);
                }}
              >
                <Text style={s.wzSecondaryText}>아니요</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.wzPrimaryBtn}
                onPress={() => {
                  if (offworkYNIndex == null) return;
                  setTimeEdit({ index: offworkYNIndex, phase: 'offwork' });
                  setOffworkYNIndex(null);
                }}
              >
                <Text style={s.wzPrimaryText}>네</Text>
              </TouchableOpacity>
            </View>
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
          // 처음 추가하는 시간대는 퇴근 알람 필요 여부를 먼저 물어본다(위저드와 동일) — 무조건
          // 퇴근 시각까지 잇지 않고, 필요 없다는 선택지를 준다
          if (timeEdit.phase === 'commute' && timeEdit.askOffworkYN) { setOffworkYNIndex(timeEdit.index); setTimeEdit(null); return; }
          if (timeEdit.phase === 'commute' && seg.hasOffwork) setTimeEdit({ index: timeEdit.index, phase: 'offwork' });
          else setTimeEdit(null);
        }}
      />
    </View>
  );
}
