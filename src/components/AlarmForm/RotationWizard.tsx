import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Text } from '../common/AppText';
import { SHIFTS, ShiftPeriod, WorkSegment, DEFAULT_SHIFT_TIMES, DEFAULT_SHIFT_TIME_FALLBACK, REST_COLOR } from '../../constants';
import { useColors } from '../../hooks/useTheme';
import { newBlockId, mergeOrAppendSegment } from '../../utils/workPattern';
import { makeStyles } from './styles';
import { BlockTimeModal } from './BlockTimeModal';
import { AddShiftModal } from './AddShiftModal';

const pad = (n: number) => String(n).padStart(2, '0');

export type RotationTutorialEvent = 'commuteNext' | 'offworkYes' | 'offworkDone' | 'addOpen' | 'shiftPicked' | 'restPicked' | 'finish';

interface Props {
  sd: string;
  setShowCal: (v: boolean) => void;
  initialShift: ShiftPeriod;
  onComplete: (blocks: WorkSegment[]) => void;
  onCancel: () => void;
  // 근무표 만들기 튜토리얼 전용 — 평소엔 전부 undefined
  nextBtnRef?: React.Ref<View>;
  offworkYesBtnRef?: React.Ref<View>;
  addChipRef?: React.Ref<View>;
  finishBtnRef?: React.Ref<View>;
  addModalLateBtnRef?: React.Ref<View>;
  addModalRestBtnRef?: React.Ref<View>;
  onTutorialEvent?: (event: RotationTutorialEvent) => void;
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
export function RotationWizard({
  sd, setShowCal, initialShift, onComplete, onCancel,
  nextBtnRef, offworkYesBtnRef, addChipRef, finishBtnRef, addModalLateBtnRef, addModalRestBtnRef, onTutorialEvent,
}: Props) {
  const C = useColors();
  const s = makeStyles(C);
  const [, m, d] = sd.split('-').map(Number);
  const [sequence, setSequence] = useState<WorkSegment[]>([]);
  const [shiftDefaults, setShiftDefaults] = useState<Record<string, { commuteTime: { hour: number; min: number }; offworkTime: { hour: number; min: number }; hasOffwork: boolean; shiftCustom?: string }>>({});
  const [flow, setFlow] = useState<Flow | null>(null);
  const [customText, setCustomText] = useState('');
  const [timeModal, setTimeModal] = useState<'commute' | 'offwork' | null>(null);
  const [startDateSeen, setStartDateSeen] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const seeded = React.useRef(false);

  const mergeOrAppend = (seg: WorkSegment) => {
    setSequence(prev => mergeOrAppendSegment(prev, seg));
  };

  const startFlowForNew = (shift: ShiftPeriod) => {
    setCustomText('');
    const defaults = DEFAULT_SHIFT_TIMES[shift] ?? DEFAULT_SHIFT_TIME_FALLBACK;
    setFlow({
      target: 'new',
      shift,
      phase: shift === 'custom' ? 'customName' : 'commute',
      commuteTime: { ...defaults.commute },
      hasOffwork: true,
      offworkTime: { ...defaults.offwork },
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
      const next = last.days > 1
        ? [...prev.slice(0, -1), { ...last, days: last.days - 1 }]
        : prev.slice(0, -1);
      // 이 시간대가 남은 구간에서 완전히 사라졌으면 기억해둔 기본 시각도 같이 지워야
      // 다시 탭했을 때 시간설정 모달이 다시 뜬다(안 지우면 예전 값이 조용히 재사용됨)
      if (!last.isRest) {
        const key = defaultsKey(last.shift);
        const stillUsed = next.some(seg => !seg.isRest && defaultsKey(seg.shift) === key);
        if (!stillUsed) {
          setShiftDefaults(prevDefaults => {
            const { [key]: _removed, ...rest } = prevDefaults;
            return rest;
          });
        }
      }
      return next;
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
      // 기타는 이름도 같이 바꿀 수 있게 열어뒀으므로(editSegment), 같은 이름을 쓰던 다른 구간도
      // 함께 갱신 — 같은 종류로 취급되던 것들이라 이름만 따로 노는 상태가 되면 안 됨
      const oldName = sequence[idx].shiftCustom;
      setSequence(prev => prev.map((seg, i) => {
        if (i === idx) return { ...seg, shiftCustom: f.shiftCustom, commuteTime: f.commuteTime, hasOffwork: f.hasOffwork, offworkTime: f.offworkTime };
        if (f.shift === 'custom' && !seg.isRest && seg.shift === 'custom' && seg.shiftCustom === oldName) return { ...seg, shiftCustom: f.shiftCustom };
        return seg;
      }));
      if (f.shift === 'custom') {
        setShiftDefaults(prev => ({ ...prev, custom: { commuteTime: f.commuteTime, offworkTime: f.offworkTime, hasOffwork: f.hasOffwork, shiftCustom: f.shiftCustom } }));
      }
    }
    setFlow(null);
  };

  const editSegment = (i: number) => {
    if (flow) return;
    const seg = sequence[i];
    if (seg.isRest) return;
    if (seg.shift === 'custom') setCustomText(seg.shiftCustom ?? '');
    setFlow({
      target: i,
      shift: seg.shift,
      shiftCustom: seg.shiftCustom,
      // 기타는 시각 수정 전에 이름도 바꿀 수 있게 이름 단계부터 시작(이전엔 이름 수정 방법이 없었음)
      phase: seg.shift === 'custom' ? 'customName' : 'commute',
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
        <View style={s.wpStartHintGroup}>
          {!startDateSeen && <Text style={s.wzStartHint}>먼저 시작일을 넣으세요 →</Text>}
          <TouchableOpacity
            style={s.cycleDateChip}
            onPress={() => { setStartDateSeen(true); setShowCal(true); }}
          >
            <Text>📅</Text>
            <Text style={s.cycleDateChipText}>{m}/{d} 시작</Text>
            {!startDateSeen && <View style={s.wzStartBadge} />}
          </TouchableOpacity>
        </View>
      </View>

      {!flow && (
        <>
          <Text style={s.wzQuestion}>근무 순환표 <Text style={s.wzStartHint}>(비번도 넣으세요)</Text></Text>
          <View style={s.wzOptionRow}>
            {sequence.map((seg, i) => {
              const label = seg.isRest ? '비번' : (seg.shift === 'custom' ? (seg.shiftCustom?.trim() || '기타') : SHIFTS.find(sh => sh.id === seg.shift)!.label);
              const color = seg.isRest ? REST_COLOR : SHIFTS.find(sh => sh.id === seg.shift)!.color;
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
            <TouchableOpacity ref={addChipRef} style={s.wzAddChip} onPress={() => { setAddModalVisible(true); onTutorialEvent?.('addOpen'); }}>
              <Text style={s.wzAddChipText}>+</Text>
            </TouchableOpacity>
          </View>
          {sequence.length === 0 && <Text style={s.wzSummary}>+를 눌러 하루씩 쌓아보세요</Text>}

          {sequence.length > 0 && (
            <View style={s.wzActionRow}>
              <TouchableOpacity style={s.wzSecondaryBtn} onPress={undoLast}>
                <Text style={s.wzSecondaryText}>↩ 마지막 취소</Text>
              </TouchableOpacity>
              <TouchableOpacity ref={finishBtnRef} style={s.wzPrimaryBtn} onPress={() => { finish(); onTutorialEvent?.('finish'); }}>
                <Text style={s.wzPrimaryText}>여기서 반복</Text>
              </TouchableOpacity>
            </View>
          )}
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
            <TouchableOpacity ref={nextBtnRef} style={s.wzPrimaryBtn} onPress={() => { advanceFromCommute(); onTutorialEvent?.('commuteNext'); }}>
              <Text style={s.wzPrimaryText}>다음</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {flow?.phase === 'offworkYN' && (
        <>
          <Text style={s.wzQuestion}>퇴근 알람도 필요해요?</Text>
          <View style={s.wzOptionRow}>
            <TouchableOpacity ref={offworkYesBtnRef} style={s.wzOption} onPress={() => { pickOffworkYN(true); onTutorialEvent?.('offworkYes'); }}>
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
            <TouchableOpacity ref={nextBtnRef} style={s.wzPrimaryBtn} onPress={() => { finishFlow(flow); onTutorialEvent?.('offworkDone'); }}>
              <Text style={s.wzPrimaryText}>완료</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <AddShiftModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onPick={(id) => {
          setAddModalVisible(false);
          if (id === 'REST') { tapRest(); onTutorialEvent?.('restPicked'); }
          else { tapShift(id); onTutorialEvent?.('shiftPicked'); }
        }}
        itemRefs={{ late: addModalLateBtnRef, REST: addModalRestBtnRef }}
      />

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
