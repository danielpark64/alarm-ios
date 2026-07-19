import { useState, useRef, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { Alarm, ShiftPeriod, WorkSegment, SoundMode, VibMode } from '../constants';
import { getType, pad, todayStr, lunarToSolarInYear, shiftPrefixFor } from '../utils';
import { newBlockId } from '../utils/workPattern';
import { fmtDisplayDate } from '../components/common/CalendarPicker';

function defaultBlock(seed?: { shift?: ShiftPeriod; hour?: number; min?: number; days?: number }): WorkSegment {
  return {
    blockId: newBlockId(),
    shift: seed?.shift ?? 'early',
    days: seed?.days ?? 2,
    isRest: false,
    commuteTime: { hour: seed?.hour ?? 8, min: seed?.min ?? 0 },
    hasOffwork: true,
    offworkTime: { hour: ((seed?.hour ?? 8) + 9) % 24, min: seed?.min ?? 0 },
  };
}

// 레거시 단일 시간대 알람(pattern 없이 shift만 있던 기존 alarm)을 편집할 때, 블록 빌더에
// 그대로 이어서 편집할 수 있도록 근무+휴식 블록 2개로 변환
function legacyToBlocks(a: Partial<Alarm>): WorkSegment[] {
  const work: WorkSegment = {
    blockId: newBlockId(),
    shift: (a.shift ?? 'early') as ShiftPeriod,
    shiftCustom: a.shiftCustom,
    days: a.cd ?? 2,
    isRest: false,
    commuteTime: { hour: a.hour ?? 8, min: a.min ?? 0 },
    hasOffwork: false,
  };
  if (!a.rd) return [work];
  return [work, { blockId: newBlockId(), shift: 'none', days: a.rd, isRest: true, hasOffwork: false }];
}

// 초기 반복모드를 폼 내부 표현(wdcustom)으로 정규화
function normalizeRm(rm?: string): string {
  const r = rm ?? 'wdcustom';
  return (r === 'daily' || r === 'weekdays' || r === 'weekends') ? 'wdcustom' : r;
}

// 초기 반복모드에서 요일 배열 계산
function normalizeDays(rm: string | undefined, days: number[] | undefined): number[] {
  if (rm === 'daily')    return [0, 1, 2, 3, 4, 5, 6];
  if (rm === 'weekdays') return [0, 1, 2, 3, 4];
  if (rm === 'weekends') return [5, 6];
  return days ?? [0, 1, 2, 3, 4];
}

// AlarmForm의 상태/파생값/제출·dirty 체크 로직
export function useAlarmFormState(
  initial: Partial<Alarm>,
  onSubmit: (data: Omit<Alarm, 'id' | 'active'>) => void,
  onTypeChange?: (typeId: string) => void,
  onRmChange?: (rm: string) => void,
  onCalendarClose?: () => void,
  onSubmitPattern?: (groupId: number | undefined, pattern: WorkSegment[], sd: string, snd: SoundMode, vib: VibMode) => void,
) {
  const [typeId,   setTypeId]  = useState(initial.typeId  ?? 'commute');
  const [hour,     setHour]    = useState(initial.hour    ?? 7);
  const [min,      setMin]     = useState(initial.min     ?? 0);
  // 라벨: 저장된 값이 없으면 타입 이름으로 초기화 (기타는 비움)
  const [label,    setLabel]   = useState(
    () => (initial.label && initial.label.trim())
      ? initial.label
      : (initial.typeId === 'custom' ? '' : getType(initial.typeId ?? 'commute').label),
  );
  const [rm,       setRm]      = useState<string>(() => normalizeRm(initial.rm as string | undefined));
  const [days,     setDays]    = useState<number[]>(() => normalizeDays(initial.rm as string | undefined, initial.days));
  const [cd,       setCd]      = useState(initial.cd      ?? 2);
  const [rd,       setRd]      = useState(initial.rd      ?? 1);
  const [snd,      setSnd]     = useState(initial.snd     ?? 'default');
  const [vib,      setVib]     = useState(initial.vib     ?? 'pulse');
  const [sd,       setSd]      = useState(initial.sd      ?? todayStr());
  const [lastDay,  setLastDay] = useState(initial.lastDay ?? false);
  const [lunar,    setLunar]   = useState(initial.lunar   ?? false);
  const [shift,    setShift]   = useState<ShiftPeriod>(initial.shift ?? 'none');
  const [shiftCustom, setShiftCustom] = useState(initial.shiftCustom ?? '');
  const [showCal,  setShowCal] = useState(false);
  // 근무 시간대 로테이션 블록 — shift!=='none'일 때만 의미 있음(게이트 통과 시 사용)
  const [blocks, setBlocks] = useState<WorkSegment[]>(() => {
    if (initial.pattern?.length) return initial.pattern;
    if (initial.shift && initial.shift !== 'none') return legacyToBlocks(initial); // 기존 단일 시간대 알람 편집 진입
    return [defaultBlock()];
  });
  const initialBlocksRef = useRef(blocks); // dirty 비교 기준 — 최초 1회 값 고정(defaultBlock 등은 매번 새 blockId를 만들어서 재계산하면 안 됨)
  const isPatternMode = shift !== 'none';
  // 신규 알람 + 처음 패턴 진입일 때만 대화형 위저드를 띄운다. 기존 로테이션 그룹 편집은
  // 이미 짜인 패턴을 순차 질문으로 다시 훑는 게 오히려 번거로우므로 위저드를 건너뛴다.
  const isNewPatternEntry = initial.id == null && !initial.pattern?.length;
  const [showWizard, setShowWizard] = useState(false);
  // 게이트에서 이미 고른 시간대(초번 등)를 위저드 첫 블록에 그대로 넘겨서 "이번 근무는 뭐예요?"를
  // 또 묻지 않게 한다 — 게이트 탭과 위저드 첫 질문이 같은 걸 두 번 물어보는 문제 방지
  const [wizardInitialShift, setWizardInitialShift] = useState<ShiftPeriod>('early');

  useEffect(() => { onTypeChange?.(typeId); }, [typeId]);
  useEffect(() => { onRmChange?.(rm); }, [rm]);
  // cd/rd는 N일 주기·N일 후 휴식이 공유하는 값 — 새 알람에서 모드를 처음 전환할 때만 각 모드의 예시값으로 맞춰줌
  // (수정 중인 기존 알람은 저장된 값을 그대로 유지해야 하므로 제외)
  const prevRm = useRef(rm);
  useEffect(() => {
    if (initial.id == null && rm !== prevRm.current) {
      if (rm === 'rest' && prevRm.current !== 'rest') { setCd(4); setRd(2); }
      else if (rm === 'cycle' && prevRm.current !== 'cycle') { setCd(3); setRd(1); }
    }
    prevRm.current = rm;
  }, [rm]);
  // 캘린더 모달이 닫힐 때(날짜를 실제로 선택/확인) 알림 — 시작일자를 직접 선택했는지 감지하는 용도
  const prevShowCal = useRef(showCal);
  useEffect(() => {
    if (prevShowCal.current && !showCal) onCalendarClose?.();
    prevShowCal.current = showCal;
  }, [showCal]);

  const type = getType(typeId);

  // 타입 버튼 → 라벨 앞부분만 교체 (근무 시간대 접두어·뒤 커스텀 텍스트는 보존)
  const handleTypeChange = (newTypeId: Alarm['typeId']) => {
    const shiftPre = shiftPrefixFor(shift, shiftCustom);
    const oldName = getType(typeId).label;
    const newName = getType(newTypeId).label;
    setTypeId(newTypeId);
    setLabel(prevFull => {
      const prev = prevFull.startsWith(shiftPre) ? prevFull.slice(shiftPre.length) : prevFull;
      let rest: string;
      if (newTypeId === 'custom')             rest = '';                               // 기타 → 비움
      else if (!prev || prev === oldName)     rest = newName;                          // 비어있거나 타입명 그대로
      else if (oldName.startsWith(prev))      rest = newName;                          // 타입명 일부만 남은 경우 (예: "퇴" → "출근")
      else if (prev.startsWith(oldName))      rest = newName + prev.slice(oldName.length); // 타입명+추가텍스트
      else                                    rest = prev;                             // 완전 커스텀 → 유지
      return shiftPre + rest;
    });
  };

  // 근무 시간대 버튼 → 라벨 맨 앞의 접두어만 교체("초번 출근" 등, 뒷부분은 그대로 보존). 해당사항없음이면 접두어 제거(기존과 동일)
  const handleShiftChange = (newShift: ShiftPeriod) => {
    const oldPre = shiftPrefixFor(shift, shiftCustom);
    const newPre = shiftPrefixFor(newShift, shiftCustom);
    setShift(newShift);
    setLabel(prev => {
      const rest = prev.startsWith(oldPre) ? prev.slice(oldPre.length) : prev;
      return newPre + rest;
    });
  };

  // 기타 선택 시 직접 입력하는 근무 시간대 이름 → 라벨 접두어도 실시간으로 같이 교체
  const handleShiftCustomChange = (text: string) => {
    const oldPre = shiftPrefixFor(shift, shiftCustom);
    const newPre = shiftPrefixFor(shift, text);
    setShiftCustom(text);
    setLabel(prev => {
      const rest = prev.startsWith(oldPre) ? prev.slice(oldPre.length) : prev;
      return newPre + rest;
    });
  };

  // 라벨 입력 가드 — 근무 시간대 접두어("초번 " 등) + 기타가 아닌 타입은 타입 이름("출근" 등)을 지울 수 없다.
  // 접두어를 건드린 편집은 무시하고, 뒷부분만 자유롭게 수정 가능. 기타는 타입 이름 부분만 자유.
  const setLabelGuarded = (text: string) => {
    const shiftPre = shiftPrefixFor(shift, shiftCustom);
    const requiredPrefix = typeId === 'custom' ? shiftPre : shiftPre + getType(typeId).label;
    setLabel(prev => text.startsWith(requiredPrefix) ? text : prev);
  };

  const toggleDay = (i: number) =>
    setDays(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);

  // isDirty — 초기값과 현재값 비교
  const initialLabel = (initial.label && initial.label.trim())
    ? initial.label
    : (initial.typeId === 'custom' ? '' : getType(initial.typeId ?? 'commute').label);

  const checkDirty = (): boolean => {
    const initRm   = normalizeRm(initial.rm as string | undefined);
    const initDays = normalizeDays(initial.rm as string | undefined, initial.days);
    if (typeId  !== (initial.typeId  ?? 'commute'))       return true;
    if (hour    !== (initial.hour    ?? 7))               return true;
    if (min     !== (initial.min     ?? 0))               return true;
    if (label   !== initialLabel)                         return true;
    if (rm      !== initRm)                               return true;
    if (JSON.stringify([...days].sort((a,b)=>a-b)) !==
        JSON.stringify([...initDays].sort((a,b)=>a-b)))   return true;
    // cd/rd는 cycle/rest 모드에서만 의미 있는 값 — 다른 모드에서는 게이트 리셋 등으로 초기값과
    // 어긋나도(예: 2/1로 리셋 vs 화면 기본값 3/1) 무시해야 "일반 알람으로 전환" 후 영구 dirty로
    // 남아 확인창이 반복 뜨는 문제가 생기지 않는다.
    if (rm === 'cycle' || rm === 'rest') {
      if (cd !== (initial.cd ?? 2)) return true;
      if (rd !== (initial.rd ?? 1)) return true;
    }
    if (snd     !== (initial.snd     ?? 'default'))       return true;
    if (vib     !== (initial.vib     ?? 'pulse'))         return true;
    if (sd      !== (initial.sd      ?? todayStr()))      return true;
    if (lastDay !== (initial.lastDay ?? false))           return true;
    if (lunar   !== (initial.lunar   ?? false))           return true;
    if (shift   !== (initial.shift   ?? 'none'))          return true;
    if (shiftCustom !== (initial.shiftCustom ?? ''))      return true;
    if (JSON.stringify(blocks) !== JSON.stringify(initialBlocksRef.current)) return true;
    return false;
  };

  // 근무 시간대 게이트(해당없음 ↔ 선택함) 전환 — 확인이 필요한지는 컴포넌트가 isDirty()로 먼저
  // 판단해서 필요시 확인창을 띄운 뒤 이 함수를 호출한다. 여기서는 필드 초기화만 담당.
  // 유지: snd/vib/sd. 초기화: typeId/label/rm/days/cd/rd/lastDay/lunar/shiftCustom.
  const applyShiftGate = (newShift: ShiftPeriod) => {
    setShift(newShift);
    if (newShift !== 'none') {
      if (isNewPatternEntry) {
        setWizardInitialShift(newShift);
        setShowWizard(true); // 위저드가 완료되면 completeWizard가 blocks를 채운다
      } else {
        setBlocks([defaultBlock({ shift: newShift, hour, min })]);
      }
    } else {
      setShowWizard(false);
      setTypeId('commute');
      setLabel(getType('commute').label);
      setRm('wdcustom');
      setDays([0, 1, 2, 3, 4]);
      setCd(2); setRd(1);
      setLastDay(false); setLunar(false);
      setShiftCustom('');
      // blocks 자체는 리셋하지 않는다 — 매번 새 blockId가 생겨 dirty 비교 기준(initialBlocksRef)과
      // 어긋나 "추가" 버튼이 영구 활성화되는 회귀가 생김. 데이터 무결성은 handleSubmit에서
      // pattern/groupId/groupRole을 명시적으로 undefined로 제출하는 것만으로 충분히 보장된다.
    }
  };

  // 위저드에서 "여기서 반복" 완료 → 블록 확정 후 기존 블록카드 화면으로 전환
  const completeWizard = (result: WorkSegment[]) => {
    setBlocks(result);
    setShowWizard(false);
  };
  // 위저드 취소 → 게이트를 해당없음으로 되돌림(입력한 게 없으니 확인창 없이 바로)
  const cancelWizard = () => {
    setShowWizard(false);
    applyShiftGate('none');
  };

  const handleSubmit = () => {
    if (isPatternMode) {
      if (!blocks.some(b => !b.isRest)) {
        // 근무 블록이 하나도 없으면 알람이 안 생기니 저장 불가 — 조용히 무시하면 사용자가
        // 저장이 왜 안 되는지 알 수 없으므로 이유와 다음 행동을 안내한다
        Alert.alert(
          '근무 블록이 필요해요',
          initial.id != null
            ? '비번만으로는 알람이 울릴 수 없어요.\n근무 블록을 추가하거나, 이 근무표를 없애려면 아래 "이 알람 삭제"를 눌러주세요.'
            : '비번만으로는 알람이 울릴 수 없어요.\n＋ 버튼으로 근무 블록을 추가해주세요.',
        );
        return;
      }
      onSubmitPattern?.(initial.groupId, blocks, sd, snd, vib);
      return;
    }
    const effectiveDays = (rm === 'wdcustom' && days.length === 0)
      ? [(new Date().getDay() + 6) % 7]
      : days;
    onSubmit({
      typeId, hour, min,
      label: label.trim() || type.label,
      rm: rm as Alarm['rm'], days: effectiveDays, cd, rd, snd, vib, sd,
      lastDay: rm === 'monthly' ? lastDay : false,
      lunar: rm === 'yearly' ? lunar : false,
      shift, // isPatternMode(=shift!=='none') 분기에서 이미 return했으므로 여기선 항상 'none'
      shiftCustom: undefined,
      // 패턴 모드에서 전환된 경우 잔존 필드가 얕은 병합(updateAlarm)으로 되살아나지 않도록 명시적으로 제거
      pattern: undefined, groupId: undefined, groupRole: undefined,
    });
  };

  // ref가 항상 최신 상태를 가리키도록 — 외부에 노출되는 submit/isDirty는 식별자가 안정적
  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;
  const submit = useCallback(() => handleSubmitRef.current(), []);

  const checkDirtyRef = useRef(checkDirty);
  checkDirtyRef.current = checkDirty;
  const isDirty = useCallback(() => checkDirtyRef.current(), []);

  // ── 날짜 표시 ──
  const isToday    = sd === todayStr();
  const [, sdM, sdD] = sd.split('-').map(Number);
  // 매년+음력이면 달력에서 고른 월/일을 "음력 M월 D일"로 해석 — 연도는 무의미하므로 표시 안 함
  const dateLabel  = (rm === 'yearly' && lunar)
    ? `음력 ${sdM}월 ${sdD}일`
    : isToday ? `오늘 · ${fmtDisplayDate(sd)}` : `${fmtDisplayDate(sd)}부터`;
  const dateLocked = rm === 'monthly' && lastDay;
  const isLeapDay  = !lunar && sd.endsWith('-02-29');
  // 음력 기준일 때 올해(선택한 연도) 기준 실제 양력 날짜 미리보기
  const lunarSolarPreview = (rm === 'yearly' && lunar)
    ? lunarToSolarInYear(Number(sd.split('-')[0]), sdM, sdD)
    : null;

  // 매월/매년 반복 요약 텍스트
  const repeatSummary = rm === 'monthly'
    ? (lastDay
      ? `🗓️ 매월 말일 ${pad(hour)}:${pad(min)}`
      : `🗓️ 매월 ${sdD}일 ${pad(hour)}:${pad(min)}`)
    : rm === 'yearly'
      ? `🗓️ 매년 ${lunar ? '음력 ' : ''}${sdM}월 ${sdD}일 ${pad(hour)}:${pad(min)}`
      : '';

  // ── 소리+진동 3-way ──
  const sndVibMode = snd === 'default' && vib === 'pulse' ? 'both'
    : snd === 'default' ? 'snd' : 'vib';
  const setSndVibMode = (mode: 'both' | 'snd' | 'vib') => {
    if (mode === 'both') { setSnd('default'); setVib('pulse'); }
    else if (mode === 'snd') { setSnd('default'); setVib('none'); }
    else { setSnd('none'); setVib('pulse'); }
  };

  return {
    typeId, hour, setHour, min, setMin, label, setLabel: setLabelGuarded,
    rm, setRm, days, setDays, cd, setCd, rd, setRd,
    sd, setSd, lastDay, setLastDay, lunar, setLunar, shift, setShift, shiftCustom, showCal, setShowCal,
    handleTypeChange, handleShiftChange, handleShiftCustomChange, toggleDay, handleSubmit, submit, isDirty,
    type, isToday, dateLabel, dateLocked, isLeapDay, lunarSolarPreview, repeatSummary,
    sndVibMode, setSndVibMode,
    blocks, setBlocks, isPatternMode, applyShiftGate,
    showWizard, completeWizard, cancelWizard, wizardInitialShift,
  };
}
