import React, { useState } from 'react';
import { View, TouchableOpacity, TextInput, Switch } from 'react-native';
import { Text } from '../common/AppText';
import { SHIFTS, ShiftPeriod, WorkSegment } from '../../constants';
import { useColors } from '../../hooks/useTheme';
import { workPatternPreviewLabel, newBlockId } from '../../utils/workPattern';
import { makeStyles } from './styles';
import { BlockTimeModal } from './BlockTimeModal';

const BLOCK_SHIFTS = SHIFTS.filter(s => s.id !== 'none');
const pad = (n: number) => String(n).padStart(2, '0');

interface Props {
  blocks: WorkSegment[];
  setBlocks: (updater: (prev: WorkSegment[]) => WorkSegment[]) => void;
  sd: string;
  setShowCal: (v: boolean) => void;
}

// 근무 시간대 로테이션 블록 빌더 — "초번 2일 → 말번 2일 → 비번 1일"처럼 블록을 쌓아
// 반복 패턴 하나를 구성한다. N일 주기/N일 후 휴식은 이 블록 2개짜리 특수 케이스와 동치라
// 별도 "단일 모드"를 안 두고 이 빌더 하나로 통일한다.
export function WorkPatternBuilder({ blocks, setBlocks, sd, setShowCal }: Props) {
  const C = useColors();
  const s = makeStyles(C);
  const [, m, d] = sd.split('-').map(Number);
  const [timeModal, setTimeModal] = useState<{ index: number; role: 'commute' | 'offwork' } | null>(null);

  const updateBlock = (i: number, patch: Partial<WorkSegment>) => {
    setBlocks(prev => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  };
  const removeBlock = (i: number) => {
    setBlocks(prev => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
  };
  const addBlock = () => {
    setBlocks(prev => {
      const last = prev[prev.length - 1];
      return [...prev, {
        blockId: newBlockId(),
        shift: (last?.shift ?? 'early') as ShiftPeriod, days: 1, isRest: false,
        commuteTime: last?.commuteTime ?? { hour: 8, min: 0 },
        hasOffwork: last?.hasOffwork ?? true,
        offworkTime: last?.offworkTime ?? { hour: 17, min: 0 },
      }];
    });
  };

  const activeTimeModal = timeModal
    ? (timeModal.role === 'commute' ? blocks[timeModal.index]?.commuteTime : blocks[timeModal.index]?.offworkTime)
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

      {blocks.map((b, i) => (
        <View key={b.blockId} style={s.wpBlockCard}>
          <View style={s.wpBlockHeaderRow}>
            <Text style={s.wpBlockIndex}>{i + 1}</Text>
            {blocks.length > 1 && (
              <TouchableOpacity style={s.wpRemoveBtn} onPress={() => removeBlock(i)}>
                <Text style={s.wpRemoveBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {!b.isRest && (
            <>
              <View style={s.wpShiftRow}>
                {BLOCK_SHIFTS.map(sh => {
                  const active = b.shift === sh.id;
                  return (
                    <TouchableOpacity
                      key={sh.id}
                      style={[s.wpShiftChip, active && { backgroundColor: sh.color, borderColor: sh.color }]}
                      onPress={() => updateBlock(i, { shift: sh.id as ShiftPeriod })}
                    >
                      <Text style={[s.wpShiftChipLabel, { color: active ? '#fff' : sh.color }]}>{sh.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {b.shift === 'custom' && (
                <TextInput
                  style={s.wpCustomInput}
                  value={b.shiftCustom ?? ''}
                  onChangeText={t => updateBlock(i, { shiftCustom: t })}
                  placeholder="근무 시간대 이름 (예: 새벽조)"
                  placeholderTextColor={C.txt3}
                  returnKeyType="done"
                />
              )}

              <View style={s.wpTimeRow}>
                <TouchableOpacity style={s.wpTimePill} onPress={() => setTimeModal({ index: i, role: 'commute' })}>
                  <Text style={s.wpTimePillText}>{pad(b.commuteTime?.hour ?? 9)}:{pad(b.commuteTime?.min ?? 0)}</Text>
                  <Text style={s.wpTimePillSub}>출근</Text>
                </TouchableOpacity>
                {b.hasOffwork ? (
                  <TouchableOpacity style={s.wpTimePill} onPress={() => setTimeModal({ index: i, role: 'offwork' })}>
                    <Text style={s.wpTimePillText}>{pad(b.offworkTime?.hour ?? 18)}:{pad(b.offworkTime?.min ?? 0)}</Text>
                    <Text style={s.wpTimePillSub}>퇴근</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[s.wpTimePill, s.wpTimePillDim]}>
                    <Text style={s.wpTimePillSub}>퇴근 알람 없음</Text>
                  </View>
                )}
              </View>

              <View style={s.wpToggleRow}>
                <Text style={s.wpToggleLabel} numberOfLines={1}>퇴근 알람</Text>
                <Switch
                  value={b.hasOffwork}
                  onValueChange={v => updateBlock(i, {
                    hasOffwork: v,
                    offworkTime: v ? (b.offworkTime ?? { hour: 18, min: 0 }) : b.offworkTime,
                  })}
                  trackColor={{ true: C.accent2, false: C.border2 }}
                />
              </View>
            </>
          )}

          <View style={s.wpDayStepperRow}>
            <TouchableOpacity style={s.stepBtn} onPress={() => updateBlock(i, { days: Math.max(1, b.days - 1) })}>
              <Text style={s.stepBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={s.wpDayVal}>{b.days}일{b.isRest ? ' 비번' : ''}</Text>
            <TouchableOpacity style={s.stepBtn} onPress={() => updateBlock(i, { days: Math.min(365, b.days + 1) })}>
              <Text style={s.stepBtnText}>＋</Text>
            </TouchableOpacity>
          </View>

          <View style={[s.wpToggleRow, !b.isRest ? null : { borderTopWidth: 0, paddingTop: 0, marginTop: 10 }]}>
            <Text style={s.wpToggleLabel}>비번 블록</Text>
            <Switch
              value={!!b.isRest}
              onValueChange={v => updateBlock(i, { isRest: v })}
              trackColor={{ true: C.accent2, false: C.border2 }}
            />
          </View>
        </View>
      ))}

      <TouchableOpacity style={s.wpAddBlockBtn} onPress={addBlock}>
        <Text style={s.wpAddBlockText}>+ 시간대 추가</Text>
      </TouchableOpacity>

      <View style={s.cycleInfoBox}>
        <Text style={s.cycleInfo}>🔁 {workPatternPreviewLabel(blocks)}</Text>
      </View>

      <BlockTimeModal
        visible={!!timeModal}
        title={timeModal?.role === 'offwork' ? '퇴근 시각' : '출근 시각'}
        hour={activeTimeModal?.hour ?? 9}
        min={activeTimeModal?.min ?? 0}
        onChange={(h, mn) => {
          if (!timeModal) return;
          updateBlock(
            timeModal.index,
            timeModal.role === 'commute' ? { commuteTime: { hour: h, min: mn } } : { offworkTime: { hour: h, min: mn } },
          );
        }}
        onClose={() => setTimeModal(null)}
      />
    </View>
  );
}
