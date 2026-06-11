import { useState, useRef, useEffect, useCallback } from 'react';
import { Alarm } from '../constants';
import { getType, pad, todayStr } from '../utils';
import { fmtDisplayDate } from '../components/common/CalendarPicker';

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
  const [showCal,  setShowCal] = useState(false);

  useEffect(() => { onTypeChange?.(typeId); }, [typeId]);

  const type = getType(typeId);

  // 타입 버튼 → 라벨 앞부분만 교체 (뒤 커스텀 텍스트 보존)
  const handleTypeChange = (newTypeId: Alarm['typeId']) => {
    const oldName = getType(typeId).label;
    const newName = getType(newTypeId).label;
    setTypeId(newTypeId);
    setLabel(prev => {
      if (newTypeId === 'custom')             return '';                               // 기타 → 비움
      if (!prev || prev === oldName)          return newName;                         // 비어있거나 타입명 그대로
      if (oldName.startsWith(prev))           return newName;                         // 타입명 일부만 남은 경우 (예: "퇴" → "출근")
      if (prev.startsWith(oldName))           return newName + prev.slice(oldName.length); // 타입명+추가텍스트
      return prev;                                                                     // 완전 커스텀 → 유지
    });
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
    if (cd      !== (initial.cd      ?? 2))               return true;
    if (rd      !== (initial.rd      ?? 1))               return true;
    if (snd     !== (initial.snd     ?? 'default'))       return true;
    if (vib     !== (initial.vib     ?? 'pulse'))         return true;
    if (sd      !== (initial.sd      ?? todayStr()))      return true;
    if (lastDay !== (initial.lastDay ?? false))           return true;
    return false;
  };

  const handleSubmit = () => {
    const effectiveDays = (rm === 'wdcustom' && days.length === 0)
      ? [(new Date().getDay() + 6) % 7]
      : days;
    onSubmit({
      typeId, hour, min,
      label: label.trim() || type.label,
      rm: rm as Alarm['rm'], days: effectiveDays, cd, rd, snd, vib, sd,
      lastDay: rm === 'monthly' ? lastDay : false,
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
  const dateLabel  = isToday ? `오늘 · ${fmtDisplayDate(sd)}` : `${fmtDisplayDate(sd)}부터`;
  const dateLocked = rm === 'monthly' && lastDay;
  const isLeapDay  = sd.endsWith('-02-29');

  // 매월/매년 반복 요약 텍스트
  const [, sdM, sdD] = sd.split('-').map(Number);
  const repeatSummary = rm === 'monthly'
    ? (lastDay
      ? `🗓️ 매월 말일 ${pad(hour)}:${pad(min)}`
      : `🗓️ 매월 ${sdD}일 ${pad(hour)}:${pad(min)}`)
    : rm === 'yearly'
      ? `🗓️ 매년 ${sdM}월 ${sdD}일 ${pad(hour)}:${pad(min)}`
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
    typeId, hour, setHour, min, setMin, label, setLabel,
    rm, setRm, days, setDays, cd, setCd, rd, setRd,
    sd, setSd, lastDay, setLastDay, showCal, setShowCal,
    handleTypeChange, toggleDay, handleSubmit, submit, isDirty,
    type, isToday, dateLabel, dateLocked, isLeapDay, repeatSummary,
    sndVibMode, setSndVibMode,
  };
}
