import React, {
  useState, useRef, useEffect, useMemo, useCallback,
  forwardRef, useImperativeHandle,
} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  FlatList, StyleSheet, Platform, Modal,
} from 'react-native';
import { Alarm, TYPES, REPEAT, DAYS, CYCLE_PRESETS } from '../constants';
import { getType, pad, todayStr } from '../utils';
import { VibIcon } from './VibIcon';

// ─── forwardRef 핸들 ──────────────────────────────────────────────────────────
export interface AlarmFormHandle {
  submit: () => void;
  isDirty: () => boolean;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  initial: Partial<Alarm>;
  onSubmit: (data: Omit<Alarm, 'id' | 'active'>) => void;
  onCancel: () => void;
  submitLabel?: string;
  onTypeChange?: (typeId: string) => void;
}

// ─── ScrollPicker ─────────────────────────────────────────────────────────────
const HOURS      = Array.from({ length: 24 }, (_, i) => i);
const MINS       = Array.from({ length: 12 }, (_, i) => i * 5);
const PICK_H     = 44;
const LOOP_COUNT = 5;

function ScrollPicker({
  value, items, onChange,
}: { value: number; items: number[]; onChange: (v: number) => void }) {
  const flatRef        = useRef<FlatList>(null);
  const isScrolling    = useRef(false);
  const skipNextEffect = useRef(false);
  const [laid, setLaid] = useState(false);

  const loopedItems = useMemo(
    () => Array.from({ length: LOOP_COUNT }, () => items).flat(),
    [items],
  );
  const totalCount = loopedItems.length;
  const midOffset  = Math.floor(LOOP_COUNT / 2) * items.length;

  const getTargetY = useCallback(
    (v: number) => (midOffset + items.indexOf(v)) * PICK_H,
    [items, midOffset],
  );

  // initialScrollIndex: item n-1 을 뷰포트 상단에 → item n 이 중앙 하이라이트에 위치
  const initScrollIndex = Math.max(0, midOffset + items.indexOf(value) - 1);

  // 초기 스크롤 — onLayout 후 200ms + 500ms 2단계로 확실하게 실행
  // (중첩 ScrollView 환경에서 FlatList 준비 지연을 모두 커버)
  useEffect(() => {
    if (!laid) return;
    const t1 = setTimeout(() => {
      flatRef.current?.scrollToOffset({ offset: getTargetY(value), animated: false });
    }, 200);
    const t2 = setTimeout(() => {
      flatRef.current?.scrollToOffset({ offset: getTargetY(value), animated: false });
    }, 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laid]);

  // 외부 value 변경 시 스크롤 동기화
  useEffect(() => {
    if (!laid) return;
    if (skipNextEffect.current) { skipNextEffect.current = false; return; }
    if (isScrolling.current) return;
    flatRef.current?.scrollToOffset({ offset: getTargetY(value), animated: true });
  }, [value, laid, getTargetY]);

  const handleEnd = useCallback((y: number) => {
    isScrolling.current = false;
    const rawIdx  = Math.round(y / PICK_H);
    const clipped = Math.max(0, Math.min(totalCount - 1, rawIdx));
    const newVal  = loopedItems[clipped];
    if (newVal !== value) {
      skipNextEffect.current = true;
      onChange(newVal);
    }
    const localIdx = items.indexOf(newVal);
    const targetY  = (midOffset + localIdx) * PICK_H;
    if (Math.abs(clipped - (midOffset + localIdx)) > items.length * 2) {
      setTimeout(() => {
        flatRef.current?.scrollToOffset({ offset: targetY, animated: false });
      }, 50);
    }
  }, [value, loopedItems, totalCount, items, midOffset, onChange]);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: PICK_H, offset: PICK_H * (index + 1), index,
  }), []);

  const renderItem = useCallback(({ item }: { item: number }) => (
    <TouchableOpacity style={pick.item} onPress={() => onChange(item)} activeOpacity={0.6}>
      <Text style={[pick.num, item === value ? pick.numSel : pick.numDim]}>
        {pad(item)}
      </Text>
    </TouchableOpacity>
  ), [value, onChange]);

  return (
    <View style={pick.wrap} onLayout={() => setLaid(true)}>
      <View style={pick.highlight} pointerEvents="none" />
      <FlatList
        ref={flatRef}
        data={loopedItems}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        initialScrollIndex={initScrollIndex}
        showsVerticalScrollIndicator={false}
        snapToInterval={PICK_H}
        decelerationRate="fast"
        windowSize={3}
        nestedScrollEnabled
        contentContainerStyle={{ paddingVertical: PICK_H }}
        onScrollBeginDrag={() => { isScrolling.current = true; }}
        onMomentumScrollEnd={(e: any) => handleEnd(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e: any) => {
          const vy = e.nativeEvent.velocity?.y ?? 0;
          if (Math.abs(vy) < 0.01) handleEnd(e.nativeEvent.contentOffset.y);
        }}
      />
    </View>
  );
}

// ─── 날짜 포맷 ────────────────────────────────────────────────────────────────
function fmtDisplayDate(s: string): string {
  const ds    = s || todayStr();
  const parts = ds.split('-').map(Number);
  const date  = new Date(parts[0], parts[1] - 1, parts[2]);
  const dow   = (date.getDay() + 6) % 7;
  return `${pad(parts[1])}.${pad(parts[2])} (${DAYS[dow]})`;
}

// ─── 달력 피커 ────────────────────────────────────────────────────────────────
function CalendarPicker({
  value, onChange, onClose,
}: { value: string; onChange: (s: string) => void; onClose: () => void }) {
  const init = value ? new Date(value) : new Date();
  const [year,  setYear]  = useState(init.getFullYear());
  const [month, setMonth] = useState(init.getMonth());
  const today = todayStr();

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1);
  };

  const firstDow    = new Date(year, month, 1).getDay();
  const offset      = (firstDow + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <View style={cal.wrap}>
      <View style={cal.nav}>
        <TouchableOpacity onPress={prevMonth} style={cal.navBtn}>
          <Text style={cal.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={cal.navTitle}>{year}년 {month + 1}월</Text>
        <TouchableOpacity onPress={nextMonth} style={cal.navBtn}>
          <Text style={cal.navArrow}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={cal.grid}>
        {DAYS.map((d, i) => (
          <View key={i} style={cal.headCell}>
            <Text style={[cal.headText, i >= 5 && { color: '#e05555' }]}>{d}</Text>
          </View>
        ))}
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={cal.cell} />;
          const ds      = `${year}-${pad(month + 1)}-${pad(d)}`;
          const isPast  = ds < today;
          const isSel   = ds === value;
          const isToday = ds === today;
          const dow     = (offset + d - 1) % 7;
          return (
            <TouchableOpacity
              key={i}
              style={[cal.cell, isSel && cal.cellSel, isToday && !isSel && cal.cellToday]}
              onPress={() => { if (!isPast) { onChange(ds); onClose(); } }}
              disabled={isPast}
            >
              <Text style={[
                cal.cellText,
                dow >= 5 && { color: '#e05555' },
                isPast && { color: '#ccc' },
                isSel && { color: '#fff', fontWeight: '900' },
                isToday && !isSel && { fontWeight: '900' },
              ]}>{d}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity style={cal.todayBtn} onPress={() => { onChange(today); onClose(); }}>
        <Text style={cal.todayBtnText}>오늘로 설정</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── AlarmForm (forwardRef) ───────────────────────────────────────────────────
export const AlarmForm = forwardRef<AlarmFormHandle, Props>(
  function AlarmForm(
    { initial, onSubmit, onCancel, submitLabel = '⏰ 알람 추가', onTypeChange },
    ref,
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
    const [rm,       setRm]      = useState<string>(() => {
      const r = (initial.rm ?? 'wdcustom') as string;
      return (r === 'daily' || r === 'weekdays' || r === 'weekends') ? 'wdcustom' : r;
    });
    const [days,     setDays]    = useState<number[]>(() => {
      const r = initial.rm as string | undefined;
      if (r === 'daily')    return [0, 1, 2, 3, 4, 5, 6];
      if (r === 'weekdays') return [0, 1, 2, 3, 4];
      if (r === 'weekends') return [5, 6];
      return initial.days ?? [0, 1, 2, 3, 4];
    });
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
        if (newTypeId === 'custom')             return '';                 // 기타 → 비움 (직접 입력)
        if (!prev || prev === oldName)          return newName;           // 비어있거나 타입명만 → 교체
        if (prev.startsWith(oldName))           return newName + prev.slice(oldName.length); // 앞부분만 교체
        return prev;                                                       // 완전 커스텀 → 유지
      });
    };

    const toggleDay = (i: number) =>
      setDays(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);

    // isDirty — 초기값과 현재값 비교
    const initialLabel = (initial.label && initial.label.trim())
      ? initial.label
      : (initial.typeId === 'custom' ? '' : getType(initial.typeId ?? 'commute').label);

    const isDirtyRef = useRef<() => boolean>(() => false);
    const checkDirty = (): boolean => {
      const initRm = (() => {
        const r = (initial.rm ?? 'wdcustom') as string;
        return (r === 'daily' || r === 'weekdays' || r === 'weekends') ? 'wdcustom' : r;
      })();
      const initDays = (() => {
        const r = initial.rm as string | undefined;
        if (r === 'daily')    return [0,1,2,3,4,5,6];
        if (r === 'weekdays') return [0,1,2,3,4];
        if (r === 'weekends') return [5,6];
        return initial.days ?? [0,1,2,3,4];
      })();
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
    isDirtyRef.current = checkDirty;

    // handleSubmit — ref가 항상 최신 상태를 가리키도록
    const handleSubmitRef = useRef<() => void>(() => {});
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
    handleSubmitRef.current = handleSubmit;

    useImperativeHandle(ref, () => ({
      submit:   () => handleSubmitRef.current(),
      isDirty:  () => isDirtyRef.current(),
    }), []);

    // ── 날짜 표시 ──
    const isToday   = sd === todayStr();
    const dateLabel = isToday ? `오늘 · ${fmtDisplayDate(sd)}` : `${fmtDisplayDate(sd)}부터`;
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
    const SND_VIB_OPTS: { mode: 'both'|'snd'|'vib'; label: string; renderIcon: () => React.ReactNode }[] = [
      { mode: 'both', label: '소리+진동', renderIcon: () => <><Text style={s.sndVibIconFixed}>🔔</Text><VibIcon size={16} color={sndVibMode === 'both' ? '#fff' : '#7B1FA2'}/></> },
      { mode: 'snd',  label: '소리만',   renderIcon: () => <Text style={s.sndVibIconFixed}>🔔</Text> },
      { mode: 'vib',  label: '진동만',   renderIcon: () => <VibIcon size={16} color={sndVibMode === 'vib' ? '#fff' : '#7B1FA2'}/> },
    ];

    return (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {/* 알람 종류 */}
        <View style={[s.typeGrid, { marginTop: 4 }]}>
          {TYPES.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[
                s.typeBtn,
                { borderColor: t.color },
                typeId === t.id && { backgroundColor: t.color, borderColor: t.color },
              ]}
              onPress={() => handleTypeChange(t.id)}
            >
              <Text style={[s.typeBtnLabel, { color: t.color }, typeId === t.id && { color: '#fff' }]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 시작 일자 */}
        <Text style={s.sLabel}>시작 일자</Text>
        <View style={s.dateRow}>
          <TouchableOpacity
            style={[s.dateBtn, dateLocked && s.dateBtnDim]}
            onPress={() => !dateLocked && setShowCal(true)}
            disabled={dateLocked}
          >
            <Text style={s.dateBtnIcon}>📅</Text>
            <Text style={s.dateBtnLabel}>
              {dateLocked ? '매월 말일' : dateLabel}
            </Text>
            {!dateLocked && <Text style={s.dateBtnArrow}>▼</Text>}
          </TouchableOpacity>
          {rm === 'monthly' && (
            <TouchableOpacity
              style={[s.lastDayBtn, lastDay && s.lastDayBtnActive]}
              onPress={() => setLastDay(v => !v)}
            >
              <Text style={[s.lastDayText, lastDay && { color: '#fff' }]}>말일</Text>
            </TouchableOpacity>
          )}
        </View>
        {rm === 'yearly' && isLeapDay && (
          <Text style={s.leapNotice}>⚠️ 윤년(4년마다)에만 울림</Text>
        )}
        <Modal visible={showCal} transparent animationType="fade">
          <TouchableOpacity
            style={s.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowCal(false)}
          >
            <TouchableOpacity activeOpacity={1} style={s.modalContent}>
              <CalendarPicker
                value={sd}
                onChange={setSd}
                onClose={() => setShowCal(false)}
              />
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* 시간 */}
        <Text style={s.sLabel}>시간</Text>
        <View style={s.timeRow}>
          <View style={s.timePickerSide}>
            <View style={s.timeStepper}>
              <ScrollPicker value={hour} items={HOURS} onChange={setHour} />
            </View>
            <Text style={s.timeColon}>:</Text>
            <View style={s.timeStepper}>
              <ScrollPicker value={min} items={MINS} onChange={setMin} />
            </View>
          </View>
          <View style={s.timeDivider} />
          <View style={s.sndVibSide}>
            {SND_VIB_OPTS.map(({ mode, label, renderIcon }) => (
              <TouchableOpacity
                key={mode}
                style={[s.sndVibBtn, sndVibMode === mode && s.sndVibActive]}
                onPress={() => setSndVibMode(mode)}
              >
                <View style={s.sndVibIconWrap}>{renderIcon()}</View>
                {mode === 'both' ? (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={[s.sndVibLabel, sndVibMode === mode && s.sndVibLabelActive]}>소리</Text>
                    <Text style={[s.sndVibPlus,  sndVibMode === mode && s.sndVibLabelActive]}>+</Text>
                    <Text style={[s.sndVibLabel, sndVibMode === mode && s.sndVibLabelActive]}>진동</Text>
                  </View>
                ) : (
                  <Text style={[s.sndVibLabel, sndVibMode === mode && s.sndVibLabelActive]}>
                    {label}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 라벨 */}
        <Text style={s.sLabel}>라벨</Text>
        <TextInput
          style={s.input}
          value={label}
          onChangeText={setLabel}
          placeholder="이름을 입력하세요"
          placeholderTextColor="#888"
          returnKeyType="done"
        />

        {/* 반복 방식 */}
        <Text style={s.sLabel}>반복 방식</Text>
        <View style={{ gap: 8 }}>
          {([0, 3] as const).map(start => (
            <View key={start} style={{ flexDirection: 'row', gap: 8 }}>
              {REPEAT.slice(start, start + 3).map(r => (
                <TouchableOpacity
                  key={r.id}
                  style={[s.pill, rm === r.id && s.pillActive]}
                  onPress={() => setRm(r.id)}
                >
                  <Text style={[s.pillText, rm === r.id && { color: '#fff' }]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>

        {/* 요일 선택 (wdcustom) */}
        {rm === 'wdcustom' && (
          <View style={{ marginTop: 18, gap: 8 }}>
            <View style={s.optDivider}>
              <View style={s.optDividerLine} />
              <Text style={s.optDividerLabel}>요일 선택</Text>
              <View style={s.optDividerLine} />
            </View>
            <View style={s.quickRow}>
              {([
                { label: '매일', days: [0, 1, 2, 3, 4, 5, 6] },
                { label: '평일', days: [0, 1, 2, 3, 4] },
                { label: '주말', days: [5, 6] },
              ] as const).map(p => {
                const active = p.days.length === days.length && p.days.every(d => days.includes(d));
                return (
                  <TouchableOpacity
                    key={p.label}
                    style={[s.quickBtn, active && s.dayBtnActive]}
                    onPress={() => setDays([...p.days])}
                  >
                    <Text style={[s.quickBtnText, active && { color: '#fff' }]}>{p.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={s.dayRow}>
              {DAYS.map((d, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.dayBtn, days.includes(i) && s.dayBtnActive]}
                  onPress={() => toggleDay(i)}
                >
                  <Text style={[s.dayText, { color: days.includes(i) ? '#fff' : '#555' }]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* N일 주기 / N일 후 휴식 */}
        {(rm === 'cycle' || rm === 'rest') && (
          <View style={s.cycleBox}>
            {rm === 'rest' && <Text style={s.cycleLabel}>알람 일수</Text>}
            <View style={s.stepper}>
              <TouchableOpacity style={s.stepBtn} onPress={() => setCd(Math.max(1, cd - 1))}>
                <Text style={s.stepBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={s.stepVal}>
                {cd}<Text style={s.stepUnit}>{rm === 'rest' ? '일 알람' : '일마다'}</Text>
              </Text>
              <TouchableOpacity style={s.stepBtn} onPress={() => setCd(Math.min(365, cd + 1))}>
                <Text style={s.stepBtnText}>＋</Text>
              </TouchableOpacity>
            </View>
            <View style={s.presetRow}>
              {(rm === 'cycle' ? CYCLE_PRESETS : [1, 2, 3, 4, 5, 6, 7]).map(n => (
                <TouchableOpacity
                  key={n}
                  style={[s.preset, cd === n && s.presetActive]}
                  onPress={() => setCd(n)}
                >
                  <Text style={[s.presetText, cd === n && { color: '#fff' }]}>{n}일</Text>
                </TouchableOpacity>
              ))}
            </View>
            {rm === 'rest' && (
              <>
                <Text style={[s.cycleLabel, { marginTop: 12 }]}>휴식 일수</Text>
                <View style={s.stepper}>
                  <TouchableOpacity style={s.stepBtn} onPress={() => setRd(Math.max(1, rd - 1))}>
                    <Text style={s.stepBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={s.stepVal}>
                    {rd}<Text style={s.stepUnit}>일 휴식</Text>
                  </Text>
                  <TouchableOpacity style={s.stepBtn} onPress={() => setRd(Math.min(30, rd + 1))}>
                    <Text style={s.stepBtnText}>＋</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.cycleInfoBox}>
                  <Text style={s.cycleInfo}>🔁 {cd}일 알람 → {rd}일 휴식 반복</Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* 매월/매년 요약 박스 */}
        {(rm === 'monthly' || rm === 'yearly') && (
          <View style={s.repeatInfoBox}>
            <Text style={s.repeatInfoText}>{repeatSummary}</Text>
          </View>
        )}

        {/* 저장/취소 */}
        <View style={s.btnRow}>
          <TouchableOpacity style={s.cancelBtn} onPress={onCancel}>
            <Text style={s.cancelBtnText}>취소</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.submitBtn} onPress={handleSubmit}>
            <Text style={s.submitBtnText}>{submitLabel}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  },
);

// ─── 스타일 ───────────────────────────────────────────────────────────────────
const pick = StyleSheet.create({
  wrap:      { position: 'relative', height: PICK_H * 3, overflow: 'hidden' },
  highlight: { position: 'absolute', top: PICK_H, left: 4, right: 4, height: PICK_H, backgroundColor: '#e8e8e8', borderRadius: 12 },
  item:      { height: PICK_H, justifyContent: 'center', alignItems: 'center' },
  num:       { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: '900' },
  numSel:    { fontSize: 36, color: '#000', opacity: 1 },
  numDim:    { fontSize: 20, color: '#000', opacity: 0.22 },
});

const s = StyleSheet.create({
  sLabel:          { fontSize: 13, fontWeight: '900', letterSpacing: 0.5, color: '#555', marginTop: 14, marginBottom: 6 },
  // 종류
  typeGrid:        { flexDirection: 'row', gap: 6 },
  typeBtn:         { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, backgroundColor: '#f5f5f5' },
  typeBtnLabel:    { fontSize: 13, fontWeight: '800' },
  // 날짜
  dateRow:         { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  dateBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', borderWidth: 1.5, borderColor: '#aaa', borderRadius: 13, padding: 14, gap: 8 },
  dateBtnDim:      { opacity: 0.5 },
  dateBtnIcon:     { fontSize: 20 },
  dateBtnLabel:    { flex: 1, fontSize: 15, fontWeight: '800', color: '#000' },
  dateBtnArrow:    { fontSize: 12, color: '#888' },
  lastDayBtn:      { paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', borderRadius: 13, borderWidth: 1.5, borderColor: '#aaa', backgroundColor: '#f0f0f0' },
  lastDayBtnActive:{ backgroundColor: '#444', borderColor: '#444' },
  lastDayText:     { fontSize: 14, fontWeight: '900', color: '#333' },
  leapNotice:      { fontSize: 12, fontWeight: '700', color: '#e05555', marginTop: 6, paddingLeft: 4 },
  // 캘린더 모달
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent:    { width: '90%', backgroundColor: '#fff', borderRadius: 20, padding: 20 },
  // 시간
  timeRow:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 16, borderWidth: 1, borderColor: '#ddd', paddingVertical: 8, paddingHorizontal: 10 },
  timePickerSide:  { flexDirection: 'row', alignItems: 'center', flex: 1 },
  timeDivider:     { width: 1, height: PICK_H * 3, backgroundColor: '#ddd', marginHorizontal: 10 },
  timeStepper:     { flex: 1, alignItems: 'center' },
  timeColon:       { fontSize: 28, fontWeight: '900', color: '#000', marginHorizontal: 8 },
  // 소리+진동
  sndVibSide:      { gap: 6, alignItems: 'stretch', minWidth: 80 },
  sndVibBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#ccc', backgroundColor: '#fff' },
  sndVibActive:    { backgroundColor: '#333', borderColor: '#333' },
  sndVibIconFixed: { fontSize: 13 },
  sndVibIconWrap:  { flexDirection: 'row', alignItems: 'center', gap: 3, width: 34 },
  sndVibLabel:     { fontSize: 12, fontWeight: '800', color: '#444', textAlign: 'center' },
  sndVibPlus:      { fontSize: 9,  fontWeight: '900', color: '#aaa', textAlign: 'center', lineHeight: 11 },
  sndVibLabelActive: { color: '#fff' },
  // 라벨
  input:           { borderWidth: 1.5, borderColor: '#aaa', borderRadius: 13, padding: 13, fontSize: 17, fontWeight: '700', color: '#000', backgroundColor: '#fff' },
  // 반복
  pill:            { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: '#ccc', backgroundColor: '#f5f5f5' },
  pillActive:      { backgroundColor: '#444', borderColor: '#444' },
  pillText:        { fontSize: 13, fontWeight: '800', color: '#333' },
  // 구분선
  optDivider:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  optDividerLine:  { flex: 1, height: 1, backgroundColor: '#ddd' },
  optDividerLabel: { fontSize: 11, fontWeight: '800', color: '#aaa', letterSpacing: 0.8 },
  // 요일
  quickRow:        { flexDirection: 'row', gap: 8 },
  quickBtn:        { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: '#ccc', backgroundColor: '#f5f5f5', alignItems: 'center' },
  quickBtnText:    { fontSize: 13, fontWeight: '800', color: '#333' },
  dayRow:          { flexDirection: 'row', gap: 6 },
  dayBtn:          { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: '#ccc', backgroundColor: '#f5f5f5' },
  dayBtnActive:    { backgroundColor: '#444', borderColor: '#444' },
  dayText:         { fontSize: 13, fontWeight: '800' },
  // N일 주기
  cycleBox:        { backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#ccc', borderRadius: 16, padding: 16, marginTop: 10 },
  cycleLabel:      { fontSize: 12, fontWeight: '900', color: '#555', marginBottom: 8 },
  stepper:         { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn:         { width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: '#888', backgroundColor: '#e8e8e8', alignItems: 'center', justifyContent: 'center' },
  stepBtnText:     { fontSize: 22, fontWeight: '900', color: '#444' },
  stepVal:         { flex: 1, textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 38, fontWeight: '900', color: '#333' },
  stepUnit:        { fontSize: 14, fontWeight: '400', color: '#666' },
  presetRow:       { flexDirection: 'row', gap: 7, marginTop: 12 },
  preset:          { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, borderColor: '#ccc', backgroundColor: 'transparent' },
  presetActive:    { backgroundColor: '#444', borderColor: '#444' },
  presetText:      { fontSize: 13, fontWeight: '700', color: '#333' },
  cycleInfoBox:    { backgroundColor: '#e0e0e0', borderRadius: 10, padding: 10, marginTop: 12 },
  cycleInfo:       { textAlign: 'center', fontSize: 13, fontWeight: '800', color: '#333' },
  // 매월/매년 요약
  repeatInfoBox:   { backgroundColor: '#f0f0f0', borderRadius: 12, padding: 12, marginTop: 10 },
  repeatInfoText:  { fontSize: 13, fontWeight: '800', color: '#333', textAlign: 'center' },
  // 버튼
  btnRow:          { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn:       { flex: 1, padding: 16, borderRadius: 16, borderWidth: 1.5, borderColor: '#aaa', backgroundColor: '#f0f0f0', alignItems: 'center' },
  cancelBtnText:   { fontSize: 17, fontWeight: '800', color: '#333' },
  submitBtn:       { flex: 2, padding: 16, borderRadius: 16, backgroundColor: '#444', alignItems: 'center' },
  submitBtnText:   { fontSize: 17, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
});

const cal = StyleSheet.create({
  wrap:         { gap: 8 },
  nav:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  navBtn:       { padding: 8 },
  navArrow:     { fontSize: 24, color: '#444', fontWeight: '900' },
  navTitle:     { fontSize: 16, fontWeight: '900', color: '#000' },
  grid:         { flexDirection: 'row', flexWrap: 'wrap' },
  headCell:     { width: '14.28%', alignItems: 'center', paddingVertical: 4 },
  headText:     { fontSize: 12, fontWeight: '700', color: '#888' },
  cell:         { width: '14.28%', alignItems: 'center', paddingVertical: 6 },
  cellText:     { fontSize: 14, color: '#000' },
  cellSel:      { backgroundColor: '#444', borderRadius: 99 },
  cellToday:    { borderWidth: 1.5, borderColor: '#444', borderRadius: 99 },
  todayBtn:     { marginTop: 12, padding: 12, backgroundColor: '#f0f0f0', borderRadius: 12, alignItems: 'center' },
  todayBtnText: { fontSize: 14, fontWeight: '800', color: '#444' },
});
