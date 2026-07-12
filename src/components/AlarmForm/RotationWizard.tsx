import React, { useState } from 'react';
import { View, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Text } from '../common/AppText';
import { SHIFTS, ShiftPeriod, WorkSegment } from '../../constants';
import { useColors } from '../../hooks/useTheme';
import { workPatternPreviewLabel, newBlockId } from '../../utils/workPattern';
import { makeStyles } from './styles';
import { BlockTimeModal } from './BlockTimeModal';

const BLOCK_SHIFTS = SHIFTS.filter(s => s.id !== 'none');
const pad = (n: number) => String(n).padStart(2, '0');

function freshDraft(seed?: Partial<WorkSegment>): WorkSegment {
  return {
    blockId: newBlockId(),
    shift: (seed?.shift ?? 'early') as ShiftPeriod,
    days: 1,
    isRest: false,
    commuteTime: seed?.commuteTime ?? { hour: 8, min: 0 },
    hasOffwork: true,
    offworkTime: seed?.offworkTime ?? { hour: 17, min: 0 },
  };
}

type Step = 'start' | 'shift' | 'customName' | 'days' | 'daysCustom' | 'commute' | 'offwork' | 'summary';

interface Props {
  sd: string;
  setShowCal: (v: boolean) => void;
  initialShift: ShiftPeriod;
  onComplete: (blocks: WorkSegment[]) => void;
  onCancel: () => void;
}

// 근무 형태가 몇 가지든(초번-말번-비번처럼 조 개수가 달라도) "며칠마다 바뀌나요?" 한 질문으로
// 뭉뚱그리지 않고, 조 하나씩 순서대로 물어서 쌓는 대화형 온보딩 — 고령층도 한 화면에 한 질문만
// 보게 하는 게 목표. 완료되면 기존 WorkPatternBuilder 블록카드 화면으로 넘어가 최종 확인/저장.
// 시작일을 맨 먼저 묻는다 — 이게 없으면 "오늘부터"로 조용히 깔려서 나중에 블록카드 화면에서야
// 알아채는 문제가 있었음(사용자 요청으로 최우선 처리).
export function RotationWizard({ sd, setShowCal, initialShift, onComplete, onCancel }: Props) {
  const C = useColors();
  const s = makeStyles(C);
  const [committed, setCommitted] = useState<WorkSegment[]>([]);
  // 첫 블록의 시간대는 폼 상단 게이트(초번 등)에서 이미 골랐으므로 그대로 물려받는다 —
  // 위저드 첫 질문에서 같은 걸 또 물어보면 "방금 골랐는데 왜 또 물어봐" 하는 중복 질문이 됨
  const [draft, setDraft] = useState<WorkSegment>(() => freshDraft({ shift: initialShift }));
  const [step, setStep] = useState<Step>('start');
  // 뒤로가기 — 스텝을 옮길 때마다 직전 스텝을 쌓아뒀다가 "이전" 누르면 하나씩 되돌린다.
  // 블록이 하나 완성돼서 다음 블록으로 넘어갈 때(addAnother)는 스택을 비운다 — 이전 블록으로
  // 되돌아가는 건 지원하지 않고(이미 완성된 블록은 요약 화면으로 확인 가능), 현재 블록 안에서만 되돌림.
  const [history, setHistory] = useState<Step[]>([]);
  const [customText, setCustomText] = useState('');
  const [daysText, setDaysText] = useState('');
  const [timeModal, setTimeModal] = useState<'commute' | 'offwork' | null>(null);

  const blockNo = committed.length + 1;
  const preview = workPatternPreviewLabel(committed.length ? committed : []);

  const goTo = (next: Step) => {
    setHistory(h => [...h, step]);
    setStep(next);
  };
  const goBack = () => {
    setHistory(h => {
      if (!h.length) return h;
      setStep(h[h.length - 1]);
      return h.slice(0, -1);
    });
  };

  const pickShift = (id: ShiftPeriod) => {
    if (id === 'custom') { setCustomText(draft.shiftCustom ?? ''); goTo('customName'); return; }
    setDraft(d => ({ ...d, shift: id, isRest: false }));
    goTo('days');
  };
  const pickRest = () => {
    setDraft(d => ({ ...d, shift: 'none', isRest: true }));
    goTo('days');
  };
  const confirmCustomName = () => {
    setDraft(d => ({ ...d, shift: 'custom', shiftCustom: customText, isRest: false }));
    goTo('days');
  };
  const pickDays = (n: number) => {
    setDraft(d => ({ ...d, days: n }));
    goTo(draft.isRest ? 'summary' : 'commute');
  };
  const confirmDaysCustom = () => {
    const n = Math.max(1, parseInt(daysText, 10) || 1);
    setDraft(d => ({ ...d, days: n }));
    goTo(draft.isRest ? 'summary' : 'commute');
  };
  const pickOffwork = (yes: boolean) => {
    if (yes) { setDraft(d => ({ ...d, hasOffwork: true })); setTimeModal('offwork'); }
    else { setDraft(d => ({ ...d, hasOffwork: false })); goTo('summary'); }
  };
  const addAnother = () => {
    const done = { ...draft };
    const next = [...committed, done];
    setCommitted(next);
    setDraft(freshDraft({ shift: done.shift, commuteTime: done.commuteTime, offworkTime: done.offworkTime }));
    setDaysText(''); setCustomText('');
    setHistory([]);
    setStep('shift');
  };
  const finish = () => {
    const all = [...committed, draft];
    if (!all.some(b => !b.isRest)) {
      Alert.alert('근무 블록 필요', '휴식만으로는 알람을 만들 수 없어요. 근무 조를 하나 이상 추가해주세요.');
      return;
    }
    onComplete(all);
  };

  return (
    <View>
      <View style={s.wzTopRow}>
        {history.length > 0 ? (
          <TouchableOpacity style={s.wzBackBtn} onPress={goBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.wzBackText}>‹ 이전</Text>
          </TouchableOpacity>
        ) : <View />}
        <TouchableOpacity style={s.wzCloseBtn} onPress={onCancel}>
          <Text style={s.wzCloseText}>✕ 취소</Text>
        </TouchableOpacity>
      </View>

      {step === 'start' && (
        <>
          <Text style={s.wzQuestion}>언제부터 시작할까요?</Text>
          <TouchableOpacity style={s.cycleDateChip} onPress={() => setShowCal(true)}>
            <Text>📅</Text>
            <Text style={s.cycleDateChipText}>{sd.slice(5, 7)}/{sd.slice(8, 10)} 시작</Text>
          </TouchableOpacity>
          <View style={[s.wzActionRow, { marginTop: 20 }]}>
            <TouchableOpacity
              style={s.wzPrimaryBtn}
              onPress={() => {
                // 첫 블록은 게이트에서 고른 시간대를 그대로 쓰고 넘어간다(기타는 이름을 아직
                // 안 받았으니 이름 입력 단계로) — 두 번째 블록부터는 다시 물어봐야 하므로 그대로 'shift'
                if (committed.length === 0) {
                  goTo(initialShift === 'custom' ? 'customName' : 'days');
                } else {
                  goTo('shift');
                }
              }}
            >
              <Text style={s.wzPrimaryText}>다음</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {step !== 'start' && <Text style={s.wzProgress}>근무 {blockNo}</Text>}

      {step === 'shift' && (
        <>
          <Text style={s.wzQuestion}>이번 근무는 뭐예요?</Text>
          <View style={s.wzOptionRow}>
            {BLOCK_SHIFTS.map(sh => (
              <TouchableOpacity key={sh.id} style={s.wzOption} onPress={() => pickShift(sh.id as ShiftPeriod)}>
                <Text style={s.wzOptionText}>{sh.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.wzOption} onPress={pickRest}>
              <Text style={s.wzOptionText}>휴식</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {step === 'customName' && (
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
            <TouchableOpacity style={s.wzPrimaryBtn} onPress={confirmCustomName}>
              <Text style={s.wzPrimaryText}>다음</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {step === 'days' && (
        <>
          <Text style={s.wzQuestion}>며칠 {draft.isRest ? '쉬나요' : '하나요'}?</Text>
          <View style={s.wzOptionRow}>
            {[1, 2, 3].map(n => (
              <TouchableOpacity key={n} style={s.wzOption} onPress={() => pickDays(n)}>
                <Text style={s.wzOptionText}>{n}일</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.wzOption} onPress={() => goTo('daysCustom')}>
              <Text style={s.wzOptionText}>직접</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {step === 'daysCustom' && (
        <>
          <Text style={s.wzQuestion}>며칠 {draft.isRest ? '쉬나요' : '하나요'}?</Text>
          <TextInput
            style={s.wpCustomInput}
            value={daysText}
            onChangeText={setDaysText}
            placeholder="숫자만 입력"
            placeholderTextColor={C.txt3}
            keyboardType="number-pad"
            returnKeyType="done"
            autoFocus
          />
          <View style={[s.wzActionRow, { marginTop: 16 }]}>
            <TouchableOpacity style={s.wzPrimaryBtn} onPress={confirmDaysCustom}>
              <Text style={s.wzPrimaryText}>다음</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {step === 'commute' && (
        <>
          <Text style={s.wzQuestion}>출근 시각은?</Text>
          <TouchableOpacity style={s.wpTimePill} onPress={() => setTimeModal('commute')}>
            <Text style={s.wpTimePillText}>{pad(draft.commuteTime?.hour ?? 8)}:{pad(draft.commuteTime?.min ?? 0)}</Text>
            <Text style={s.wpTimePillSub}>탭해서 변경</Text>
          </TouchableOpacity>
          <View style={[s.wzActionRow, { marginTop: 20 }]}>
            <TouchableOpacity style={s.wzPrimaryBtn} onPress={() => goTo('offwork')}>
              <Text style={s.wzPrimaryText}>다음</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {step === 'offwork' && (
        <>
          <Text style={s.wzQuestion}>퇴근 알람도 필요해요?</Text>
          <View style={s.wzOptionRow}>
            <TouchableOpacity style={s.wzOption} onPress={() => pickOffwork(true)}>
              <Text style={s.wzOptionText}>네</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.wzOption} onPress={() => pickOffwork(false)}>
              <Text style={s.wzOptionText}>아니요</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {step === 'summary' && (
        <>
          <Text style={s.wzQuestion}>이 근무를 확인해주세요</Text>
          <View style={s.cycleInfoBox}>
            <Text style={s.cycleInfo}>🔁 {workPatternPreviewLabel([...committed, draft])}</Text>
          </View>
          <View style={s.wzActionRow}>
            <TouchableOpacity style={s.wzSecondaryBtn} onPress={addAnother}>
              <Text style={s.wzSecondaryText}>다음 근무 추가</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.wzPrimaryBtn} onPress={finish}>
              <Text style={s.wzPrimaryText}>여기서 반복</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {committed.length > 0 && step !== 'summary' && (
        <Text style={s.wzSummary}>지금까지: {preview}</Text>
      )}

      <BlockTimeModal
        visible={!!timeModal}
        title={timeModal === 'offwork' ? '퇴근 시각' : '출근 시각'}
        hour={(timeModal === 'offwork' ? draft.offworkTime?.hour : draft.commuteTime?.hour) ?? 9}
        min={(timeModal === 'offwork' ? draft.offworkTime?.min : draft.commuteTime?.min) ?? 0}
        onChange={(h, m) => {
          if (timeModal === 'offwork') setDraft(d => ({ ...d, offworkTime: { hour: h, min: m } }));
          else setDraft(d => ({ ...d, commuteTime: { hour: h, min: m } }));
        }}
        onClose={() => {
          const wasOffwork = timeModal === 'offwork';
          setTimeModal(null);
          goTo(wasOffwork ? 'summary' : 'offwork');
        }}
      />
    </View>
  );
}
