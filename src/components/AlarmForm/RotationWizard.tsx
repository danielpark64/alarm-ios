import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Text } from '../common/AppText';
import { SHIFTS, ShiftPeriod, WorkSegment } from '../../constants';
import { useColors } from '../../hooks/useTheme';
import { newBlockId, mergeOrAppendSegment } from '../../utils/workPattern';
import { makeStyles } from './styles';
import { BlockTimeModal } from './BlockTimeModal';

const BLOCK_SHIFTS = SHIFTS.filter(s => s.id !== 'none');
const pad = (n: number) => String(n).padStart(2, '0');

interface Props {
  sd: string;
  setShowCal: (v: boolean) => void;
  initialShift: ShiftPeriod;
  onComplete: (blocks: WorkSegment[]) => void;
  onCancel: () => void;
}

type FlowPhase = 'customName' | 'commute' | 'offworkYN' | 'offworkTime';
// target: 'new'면 이 시간대를 처음 써서 기본값(시각)을 정하는 중, number면 이미 쌓인 특정
// 구간(sequence[index])의 시각만 그 자리에서 고치는 중 — 둘 다 같은 폼(시각 물어보기)을 쓰되
// 끝났을 때 하는 일이 다르다(기본값 저장+구간 추가 vs 그 구간만 갱신).
interface Flow {
  target: 'new' | number;
  shift: ShiftPeriod;
  phase: FlowPhase;
  shiftCustom?: string;
  commuteTime: { hour: number; min: number };
  hasOffwork: boolean;
  offworkTime: { hour: number; min: number };
}

function defaultsKey(shift: ShiftPeriod): string {
  return shift; // 'custom'도 이름과 무관하게 하나의 기본값만 기억(재탭 시 그대로 재사용)
}

// 근무 형태가 몇 가지든(초번-말번-비번처럼 조 개수가 달라도) 실제 근무표처럼 하루씩 순서대로
// 탭해서 쌓는 방식 — "이번 근무 며칠이에요?" 같은 숫자 질문 없이, 같은 버튼을 연달아 누르면
// 그 구간이 자동으로 늘어나고 다른 버튼을 누르면 새 구간이 시작된다. 시간대는 처음 쓸 때만
// 출근/퇴근 시각을 물어보고 그다음부턴 자동 재사용 — 이번만 다르면 방금 쌓인 칩을 탭해서
// 그 자리에서 바로 고친다(확인 화면으로 미루지 않음). 완료되면 기존 WorkPatternBuilder
// 블록카드 화면으로 넘어가 최종 확인/저장.
export function RotationWizard({ sd, setShowCal, initialShift, onComplete, onCancel }: Props) {
  const C = useColors();
  const s = makeStyles(C);
  const [, m, d] = sd.split('-').map(Number);
  const [sequence, setSequence] = useState<WorkSegment[]>([]);
  const [shiftDefaults, setShiftDefaults] = useState<Record<string, { commuteTime: { hour: number; min: number }; offworkTime: { hour: number; min: number }; hasOffwork: boolean; shiftCustom?: string }>>({});
  const [flow, setFlow] = useState<Flow | null>(null);
  const [customText, setCustomText] = useState('');
  const [timeModal, setTimeModal] = useState<'commute' | 'offwork' | null>(null);
  const seeded = React.useRef(false);

  const mergeOrAppend = (seg: WorkSegment) => {
    setSequence(prev => mergeOrAppendSegment(prev, seg));
  };

  const startFlowForNew = (shift: ShiftPeriod) => {
    setCustomText('');
    setFlow({
      target: 'new',
      shift,
      phase: shift === 'custom' ? 'customName' : 'commute',
      commuteTime: { hour: 8, min: 0 },
      hasOffwork: true,
      offworkTime: { hour: 17, min: 0 },
    });
  };

  const tapShift = (shift: ShiftPeriod) => {
    if (flow) return; // 진행 중인 플로우가 있으면 무시(중복 탭 방지)
    const key = defaultsKey(shift);
    const known = shiftDefaults[key];
    if (known) {
      mergeOrAppend({
        blockId: newBlockId(),
        shift, shiftCustom: known.shiftCustom, days: 1, isRest: false,
        commuteTime: known.commuteTime, hasOffwork: known.hasOffwork, offworkTime: known.offworkTime,
      });
      return;
    }
    startFlowForNew(shift);
  };

  const tapRest = () => {
    if (flow) return;
    mergeOrAppend({ blockId: newBlockId(), shift: 'none', days: 1, isRest: true, hasOffwork: false });
  };

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    if (initialShift !== 'none') tapShift(initialShift);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const undoLast = () => {
    setSequence(prev => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      if (last.days > 1) return [...prev.slice(0, -1), { ...last, days: last.days - 1 }];
      return prev.slice(0, -1);
    });
  };

  const confirmCustomName = () => {
    if (!flow) return;
    setFlow({ ...flow, shiftCustom: customText, phase: 'commute' });
  };

  const advanceFromCommute = () => {
    if (!flow) return;
    if (flow.target === 'new') setFlow({ ...flow, phase: 'offworkYN' });
    // 편집 중(기존 구간 시각 수정)이면 퇴근 알람 여부는 이미 정해져 있으니 다시 안 묻고,
    // 퇴근 알람이 있는 구간이면 그 시각도 고칠 수 있게 이어서 보여준다.
    else if (flow.hasOffwork) setFlow({ ...flow, phase: 'offworkTime' });
    else finishFlow(flow);
  };

  const pickOffworkYN = (yes: boolean) => {
    if (!flow) return;
    if (yes) setFlow({ ...flow, hasOffwork: true, phase: 'offworkTime' });
    else finishFlow({ ...flow, hasOffwork: false });
  };

  const finishFlow = (f: Flow) => {
    if (f.target === 'new') {
      const key = defaultsKey(f.shift);
      setShiftDefaults(prev => ({ ...prev, [key]: { commuteTime: f.commuteTime, offworkTime: f.offworkTime, hasOffwork: f.hasOffwork, shiftCustom: f.shiftCustom } }));
      mergeOrAppend({
        blockId: newBlockId(),
        shift: f.shift, shiftCustom: f.shiftCustom, days: 1, isRest: false,
        commuteTime: f.commuteTime, hasOffwork: f.hasOffwork, offworkTime: f.offworkTime,
      });
    } else {
      const idx = f.target as number;
      setSequence(prev => prev.map((seg, i) => (i === idx ? { ...seg, commuteTime: f.commuteTime, hasOffwork: f.hasOffwork, offworkTime: f.offworkTime } : seg)));
    }
    setFlow(null);
  };

  const editSegment = (i: number) => {
    if (flow) return;
    const seg = sequence[i];
    if (seg.isRest) return;
    setFlow({
      target: i,
      shift: seg.shift,
      shiftCustom: seg.shiftCustom,
      phase: 'commute',
      commuteTime: seg.commuteTime ?? { hour: 8, min: 0 },
      hasOffwork: seg.hasOffwork,
      offworkTime: seg.offworkTime ?? { hour: 17, min: 0 },
    });
  };

  const finish = () => {
    if (!sequence.some(b => !b.isRest)) {
      Alert.alert('근무 블록 필요', '비번만으로는 알람을 만들 수 없어요. 근무 조를 하나 이상 추가해주세요.');
      return;
    }
    onComplete(sequence);
  };

  const totalDays = sequence.reduce((n, seg) => n + seg.days, 0);

  return (
    <View>
      <View style={s.wzTopRow}>
        <View />
        <TouchableOpacity style={s.wzCloseBtn} onPress={onCancel}>
          <Text style={s.wzCloseText}>✕ 취소</Text>
        </TouchableOpacity>
      </View>

      <View style={s.wpStartRow}>
        <Text style={s.wpStartLabel}>시작일</Text>
        <TouchableOpacity style={s.cycleDateChip} onPress={() => setShowCal(true)}>
          <Text>📅</Text>
          <Text style={s.cycleDateChipText}>{m}/{d} 시작</Text>
        </TouchableOpacity>
      </View>

      {!flow && (
        <>
          <Text style={s.wzQuestion}>근무 순환표</Text>
          {sequence.length > 0 ? (
            <>
              <View style={s.wzOptionRow}>
                {sequence.map((seg, i) => {
                  const label = seg.isRest ? '비번' : (seg.shift === 'custom' ? (seg.shiftCustom?.trim() || '기타') : SHIFTS.find(sh => sh.id === seg.shift)!.label);
                  const color = seg.isRest ? C.txt3 : SHIFTS.find(sh => sh.id === seg.shift)!.color;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[s.wzSeqChip, { borderColor: color }]}
                      onPress={() => editSegment(i)}
                      disabled={seg.isRest}
                    >
                      <Text style={[s.wzSeqChipText, { color }]}>{label} {seg.days}일</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={s.wzSummary}>총 {totalDays}일 · {totalDays + 1}일째부터 다시 반복</Text>
            </>
          ) : (
            <Text style={s.wzSummary}>버튼을 탭해서 하루씩 쌓아보세요</Text>
          )}

          <View style={[s.wzOptionRow, { marginTop: 12 }]}>
            {BLOCK_SHIFTS.map(sh => (
              <TouchableOpacity key={sh.id} style={s.wzOption} onPress={() => tapShift(sh.id as ShiftPeriod)}>
                <Text style={s.wzOptionText}>{sh.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.wzOption} onPress={tapRest}>
              <Text style={s.wzOptionText}>비번</Text>
            </TouchableOpacity>
          </View>

          <View style={s.wzActionRow}>
            <TouchableOpacity style={s.wzSecondaryBtn} onPress={undoLast} disabled={!sequence.length}>
              <Text style={s.wzSecondaryText}>↩ 마지막 취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.wzPrimaryBtn} onPress={finish}>
              <Text style={s.wzPrimaryText}>여기서 반복</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {flow?.phase === 'customName' && (
        <>
          <Text style={s.wzQuestion}>근무 이름이 뭐예요?</Text>
          <TextInput
            style={s.wpCustomInput}
            value={customText}
            onChangeText={setCustomText}
            placeholder="예: 새벽조"
            placeholderTextColor={C.txt3}
            returnKeyType="done"
            autoFocus
          />
          <View style={[s.wzActionRow, { marginTop: 16 }]}>
            <TouchableOpacity style={s.wzSecondaryBtn} onPress={() => setFlow(null)}>
              <Text style={s.wzSecondaryText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.wzPrimaryBtn} onPress={confirmCustomName}>
              <Text style={s.wzPrimaryText}>다음</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {flow?.phase === 'commute' && (
        <>
          <Text style={s.wzQuestion}>출근 시각은?</Text>
          <TouchableOpacity style={s.wpTimePill} onPress={() => setTimeModal('commute')}>
            <Text style={s.wpTimePillText}>{pad(flow.commuteTime.hour)}:{pad(flow.commuteTime.min)}</Text>
            <Text style={s.wpTimePillSub}>탭해서 변경</Text>
          </TouchableOpacity>
          <View style={[s.wzActionRow, { marginTop: 20 }]}>
            <TouchableOpacity style={s.wzSecondaryBtn} onPress={() => setFlow(null)}>
              <Text style={s.wzSecondaryText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.wzPrimaryBtn} onPress={advanceFromCommute}>
              <Text style={s.wzPrimaryText}>다음</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {flow?.phase === 'offworkYN' && (
        <>
          <Text style={s.wzQuestion}>퇴근 알람도 필요해요?</Text>
          <View style={s.wzOptionRow}>
            <TouchableOpacity style={s.wzOption} onPress={() => pickOffworkYN(true)}>
              <Text style={s.wzOptionText}>네</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.wzOption} onPress={() => pickOffworkYN(false)}>
              <Text style={s.wzOptionText}>아니요</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {flow?.phase === 'offworkTime' && (
        <>
          <Text style={s.wzQuestion}>퇴근 시각은?</Text>
          <TouchableOpacity style={s.wpTimePill} onPress={() => setTimeModal('offwork')}>
            <Text style={s.wpTimePillText}>{pad(flow.offworkTime.hour)}:{pad(flow.offworkTime.min)}</Text>
            <Text style={s.wpTimePillSub}>탭해서 변경</Text>
          </TouchableOpacity>
          <View style={[s.wzActionRow, { marginTop: 20 }]}>
            <TouchableOpacity style={s.wzPrimaryBtn} onPress={() => finishFlow(flow)}>
              <Text style={s.wzPrimaryText}>완료</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <BlockTimeModal
        visible={!!timeModal}
        title={timeModal === 'offwork' ? '퇴근 시각' : '출근 시각'}
        hour={(timeModal === 'offwork' ? flow?.offworkTime.hour : flow?.commuteTime.hour) ?? 9}
        min={(timeModal === 'offwork' ? flow?.offworkTime.min : flow?.commuteTime.min) ?? 0}
        onChange={(h, mi) => {
          if (!flow) return;
          if (timeModal === 'offwork') setFlow({ ...flow, offworkTime: { hour: h, min: mi } });
          else setFlow({ ...flow, commuteTime: { hour: h, min: mi } });
        }}
        onClose={() => setTimeModal(null)}
      />
    </View>
  );
}
