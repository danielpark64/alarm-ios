import { useState, useRef, useEffect, useCallback } from 'react';
import { Alarm } from '../constants';
import { getType, pad, todayStr, lunarToSolarInYear } from '../utils';
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
  onRmChange?: (rm: string) => void,
  onCalendarClose?: () => void,
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
  const [showCal,  setShowCal] = useState(false);

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

  // 라벨 입력 가드 — 기타가 아닌 타입은 타입 이름 접두어("출근" 등)를 지울 수 없다.
  // 접두어를 건드린 편집은 무시하고, 뒷부분만 자유롭게 수정 가능. 기타는 전체 자유.
  const setLabelGuarded = (text: string) => {
    if (typeId === 'custom') { setLabel(text); return; }
    const typeName = getType(typeId).label;
    setLabel(prev => text.startsWith(typeName) ? text : prev);
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
    if (lunar   !== (initial.lunar   ?? false))           return true;
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
      lunar: rm === 'yearly' ? lunar : false,
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
    sd, setSd, lastDay, setLastDay, lunar, setLunar, showCal, setShowCal,
    handleTypeChange, toggleDay, handleSubmit, submit, isDirty,
    type, isToday, dateLabel, dateLocked, isLeapDay, lunarSolarPreview, repeatSummary,
    sndVibMode, setSndVibMode,
  };
}
