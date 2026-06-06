import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform, Modal } from 'react-native';
import { Alarm, TYPES, REPEAT, DAYS, SOUNDS, VIBS, CYCLE_PRESETS } from '../constants';
import { getType, pad, todayStr } from '../utils';

interface Props {
  initial: Partial<Alarm>;
  onSubmit: (data: Omit<Alarm,'id'|'active'>) => void;
  onCancel: () => void;
  submitLabel?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINS  = Array.from({ length: 12 }, (_, i) => i * 5);
const PICK_H = 56;
const LOOP_COUNT = 20; // 무한 루프용 반복 횟수 (시간 20×24=480개, 분 20×12=240개)

function ScrollPicker({ value, items, onChange }: {
  value: number; items: number[]; onChange: (v: number) => void;
}) {
  const scrollRef      = useRef<ScrollView>(null);
  const isScrolling    = useRef(false);
  const skipNextEffect = useRef(false); // 스크롤로 값이 바뀔 때 useEffect의 역방향 scrollTo 방지

  // 무한 루프: 아이템을 LOOP_COUNT번 반복
  const loopedItems = Array.from({ length: LOOP_COUNT }, () => items).flat();
  const totalCount  = loopedItems.length;
  const midOffset   = Math.floor(LOOP_COUNT / 2) * items.length;

  const getTargetY = (v: number) => {
    const localIdx = items.indexOf(v);
    return (midOffset + localIdx) * PICK_H;
  };

  // 초기 스크롤
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: getTargetY(value), animated: false });
    }, 80);
    return () => clearTimeout(timer);
  }, []);

  // 외부(화살표 버튼)에서 value 변경 시 스크롤 동기화 — 스크롤 자체로 인한 변경은 건너뜀
  useEffect(() => {
    if (skipNextEffect.current) { skipNextEffect.current = false; return; }
    if (isScrolling.current) return;
    scrollRef.current?.scrollTo({ y: getTargetY(value), animated: true });
  }, [value]);

  const handleEnd = (y: number) => {
    isScrolling.current = false;
    const rawIdx  = Math.round(y / PICK_H);
    const clipped = Math.max(0, Math.min(totalCount - 1, rawIdx));
    const newVal  = loopedItems[clipped];
    if (newVal !== value) {
      skipNextEffect.current = true; // 이 값 변경은 스크롤에서 비롯됐으므로 effect 생략
      onChange(newVal);
    }

    // 끝에 너무 가까워지면 가운데 블록으로 순간이동 (무한 루프 유지)
    const localIdx = items.indexOf(newVal);
    const targetY  = (midOffset + localIdx) * PICK_H;
    if (Math.abs(clipped - (midOffset + localIdx)) > items.length * 10) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: targetY, animated: false });
      }, 50);
    }
  };

  return (
    <View style={pick.wrap}>
      <View style={pick.highlight} pointerEvents="none"/>
      <ScrollView
        ref={scrollRef}
        style={pick.scroll}
        showsVerticalScrollIndicator={false}
        snapToInterval={PICK_H}
        decelerationRate="fast"
        nestedScrollEnabled
        onScrollBeginDrag={() => { isScrolling.current = true; }}
        onMomentumScrollEnd={(e: any) => handleEnd(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e: any) => {
          // velocity가 있으면 momentum snap이 이어지므로 onMomentumScrollEnd에 위임
          const vy = e.nativeEvent.velocity?.y ?? 0;
          if (Math.abs(vy) < 0.01) handleEnd(e.nativeEvent.contentOffset.y);
        }}
        contentContainerStyle={{ paddingVertical: PICK_H }}
      >
        {loopedItems.map((item, idx) => (
          <TouchableOpacity key={idx} style={pick.item} onPress={() => onChange(item)} activeOpacity={0.6}>
            <Text style={[pick.num, item === value ? pick.numSel : pick.numDim]}>
              {pad(item)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function fmtDisplayDate(s: string): string {
  const ds = s || todayStr();
  const parts = ds.split('-').map(Number);
  const date  = new Date(parts[0], parts[1] - 1, parts[2]);
  const dow   = (date.getDay() + 6) % 7;
  return `${parts[0]}.${pad(parts[1])}.${pad(parts[2])} ${DAYS[dow]}`;
}

function CalendarPicker({ value, onChange, onClose }: {
  value: string; onChange: (s: string) => void; onClose: () => void;
}) {
  const init = value ? new Date(value) : new Date();
  const [year, setYear]   = useState(init.getFullYear());
  const [month, setMonth] = useState(init.getMonth());
  const today = todayStr();

  const prevMonth = () => { if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const nextMonth = () => { if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };

  const firstDow    = new Date(year, month, 1).getDay();
  const offset      = (firstDow + 6) % 7;
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const cells: (number|null)[] = [];
  for (let i=0; i<offset; i++) cells.push(null);
  for (let d=1; d<=daysInMonth; d++) cells.push(d);

  return (
    <View style={cal.wrap}>
      <View style={cal.nav}>
        <TouchableOpacity onPress={prevMonth} style={cal.navBtn}><Text style={cal.navArrow}>‹</Text></TouchableOpacity>
        <Text style={cal.navTitle}>{year}년 {month+1}월</Text>
        <TouchableOpacity onPress={nextMonth} style={cal.navBtn}><Text style={cal.navArrow}>›</Text></TouchableOpacity>
      </View>
      <View style={cal.grid}>
        {DAYS.map((d,i) => (
          <View key={i} style={cal.headCell}>
            <Text style={[cal.headText, i>=5 && {color:'#e05555'}]}>{d}</Text>
          </View>
        ))}
        {cells.map((d,i) => {
          if (!d) return <View key={i} style={cal.cell}/>;
          const ds = `${year}-${pad(month+1)}-${pad(d)}`;
          const isPast = ds < today, isSel = ds===value, isToday = ds===today;
          const dow = (offset + d - 1) % 7;
          return (
            <TouchableOpacity
              key={i}
              style={[cal.cell, isSel && cal.cellSel, isToday && !isSel && cal.cellToday]}
              onPress={() => { if (!isPast) { onChange(ds); onClose(); } }}
              disabled={isPast}
            >
              <Text style={[
                cal.cellText,
                dow >= 5 && {color:'#e05555'},
                isPast && {color:'#ccc'},
                isSel && {color:'#fff', fontWeight:'900'},
                isToday && !isSel && {fontWeight:'900'},
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

export function AlarmForm({ initial, onSubmit, onCancel, submitLabel='⏰ 알람 추가' }: Props) {
  const [typeId, setTypeId] = useState(initial.typeId ?? 'commute');
  const [hour,   setHour]   = useState(initial.hour   ?? 7);
  const [min,    setMin]    = useState(initial.min     ?? 0);
  const [label,  setLabel]  = useState(initial.label   ?? '');
  const [rm,     setRm]     = useState<string>(() => {
    const r = initial.rm ?? 'wdcustom';
    return (r === 'daily' || r === 'weekdays' || r === 'weekends') ? 'wdcustom' : r;
  });
  const [days,   setDays]   = useState<number[]>(() => {
    if (initial.rm === 'daily')    return [0,1,2,3,4,5,6];
    if (initial.rm === 'weekdays') return [0,1,2,3,4];
    if (initial.rm === 'weekends') return [5,6];
    return initial.days ?? [0,1,2,3,4];
  });
  const [cd,     setCd]     = useState(initial.cd      ?? 2);
  const [rd,     setRd]     = useState(initial.rd      ?? 1);
  const [snd,    setSnd]    = useState(initial.snd     ?? 'default');
  const [vib,    setVib]    = useState(initial.vib     ?? 'pulse');
  const [sd,     setSd]     = useState(initial.sd      ?? todayStr());
  const [showCal, setShowCal] = useState(false);

  const type = getType(typeId);
  const toggleDay = (i: number) =>
    setDays(prev => prev.includes(i) ? prev.filter(x => x!==i) : [...prev, i]);
  const handleSubmit = () => {
    // 요일 미선택 시 오늘 요일로 기본값
    const effectiveDays = (rm === 'wdcustom' && days.length === 0)
      ? [(new Date().getDay() + 6) % 7]
      : days;
    onSubmit({ typeId, hour, min, label: label.trim()||type.label, rm, days: effectiveDays, cd, rd, snd, vib, sd });
  };
  const adjHour = (d: number) => setHour(h => (h+d+24)%24);
  const adjMin  = (d: number) => setMin(m  => (Math.round(m/5)*5+d*5+60)%60);
  const isToday  = sd === todayStr();
  const dateLabel = isToday ? `오늘 · ${fmtDisplayDate(sd)}` : `${fmtDisplayDate(sd)}부터`;

  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} nestedScrollEnabled>

      <Text style={s.sLabel}>알람 종류</Text>
      <View style={s.typeGrid}>
        {TYPES.map(t => (
          <TouchableOpacity key={t.id} style={[s.typeBtn, typeId===t.id && s.typeBtnActive]} onPress={() => setTypeId(t.id)}>
            <Text style={s.typeBtnIcon}>{t.icon}</Text>
            <Text style={[s.typeBtnLabel, typeId===t.id && {color:'#fff'}]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.sLabel}>시간</Text>
      <View style={s.timeRow}>
        <View style={s.timeStepper}>
          <TouchableOpacity style={s.adjBtn} onPress={() => adjHour(1)}><Text style={s.adjText}>▲</Text></TouchableOpacity>
          <ScrollPicker value={hour} items={HOURS} onChange={setHour}/>
          <TouchableOpacity style={s.adjBtn} onPress={() => adjHour(-1)}><Text style={s.adjText}>▼</Text></TouchableOpacity>
        </View>
        <Text style={s.timeColon}>:</Text>
        <View style={s.timeStepper}>
          <TouchableOpacity style={s.adjBtn} onPress={() => adjMin(1)}><Text style={s.adjText}>▲</Text></TouchableOpacity>
          <ScrollPicker value={min} items={MINS} onChange={setMin}/>
          <TouchableOpacity style={s.adjBtn} onPress={() => adjMin(-1)}><Text style={s.adjText}>▼</Text></TouchableOpacity>
        </View>
      </View>

      <Text style={s.sLabel}>시작 일자</Text>
      <TouchableOpacity style={s.dateBtn} onPress={() => setShowCal(true)}>
        <Text style={s.dateBtnIcon}>📅</Text>
        <Text style={s.dateBtnLabel}>{dateLabel}</Text>
        <Text style={s.dateBtnArrow}>▼</Text>
      </TouchableOpacity>
      <Modal visible={showCal} transparent animationType="fade">
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowCal(false)}>
          <TouchableOpacity activeOpacity={1} style={s.modalContent}>
            <CalendarPicker value={sd} onChange={setSd} onClose={() => setShowCal(false)}/>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Text style={s.sLabel}>라벨</Text>
      <TextInput
        style={s.input} value={label} onChangeText={setLabel}
        placeholder="알람 이름 (비우면 자동)" placeholderTextColor="#888"
        returnKeyType="done"
      />

      <Text style={s.sLabel}>반복 방식</Text>
      <View style={s.pillRow}>
        {REPEAT.map(r => (
          <TouchableOpacity key={r.id} style={[s.pill, rm===r.id && s.pillActive]} onPress={() => setRm(r.id)}>
            <Text style={[s.pillText, rm===r.id && {color:'#fff'}]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {rm === 'wdcustom' && (
        <View style={{marginTop:10, gap:8}}>
          {/* 빠른선택 */}
          <View style={s.quickRow}>
            {([
              { label:'매일', days:[0,1,2,3,4,5,6] },
              { label:'평일', days:[0,1,2,3,4] },
              { label:'주말', days:[5,6] },
            ] as const).map(p => {
              const active = p.days.length === days.length && p.days.every(d => days.includes(d));
              return (
                <TouchableOpacity key={p.label} style={[s.quickBtn, active && s.dayBtnActive]} onPress={() => setDays([...p.days])}>
                  <Text style={[s.quickBtnText, active && {color:'#fff'}]}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {/* 요일 개별 선택 */}
          <View style={s.dayRow}>
            {DAYS.map((d, i) => (
              <TouchableOpacity
                key={i}
                style={[s.dayBtn, days.includes(i) && s.dayBtnActive]}
                onPress={() => toggleDay(i)}
              >
                <Text style={[s.dayText, { color: days.includes(i) ? '#fff' : '#000' }]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {(rm === 'cycle' || rm === 'rest') && (
        <View style={s.cycleBox}>
          {rm === 'rest' && <Text style={s.cycleLabel}>알람 일수</Text>}
          <View style={s.stepper}>
            <TouchableOpacity style={s.stepBtn} onPress={() => setCd(Math.max(1,cd-1))}>
              <Text style={s.stepBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={s.stepVal}>{cd}<Text style={s.stepUnit}>{rm==='rest'?'일 알람':'일마다'}</Text></Text>
            <TouchableOpacity style={s.stepBtn} onPress={() => setCd(Math.min(365,cd+1))}>
              <Text style={s.stepBtnText}>＋</Text>
            </TouchableOpacity>
          </View>
          <View style={s.presetRow}>
            {(rm==='cycle' ? CYCLE_PRESETS : [1,2,3,4,5,6,7]).map(n => (
              <TouchableOpacity key={n} style={[s.preset, cd===n && s.presetActive]} onPress={() => setCd(n)}>
                <Text style={[s.presetText, cd===n && {color:'#fff'}]}>{n}일</Text>
              </TouchableOpacity>
            ))}
          </View>
          {rm === 'rest' && (
            <>
              <Text style={[s.cycleLabel, {marginTop:12}]}>휴식 일수</Text>
              <View style={s.stepper}>
                <TouchableOpacity style={s.stepBtn} onPress={() => setRd(Math.max(1,rd-1))}>
                  <Text style={s.stepBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={s.stepVal}>{rd}<Text style={s.stepUnit}>일 휴식</Text></Text>
                <TouchableOpacity style={s.stepBtn} onPress={() => setRd(Math.min(30,rd+1))}>
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

      <Text style={s.sLabel}>소리 / 진동</Text>
      <View style={s.vibGrid}>
        {SOUNDS.map(v => (
          <TouchableOpacity key={v.id} style={[s.vibBtn, snd===v.id && s.vibBtnActive]} onPress={() => setSnd(v.id)}>
            <Text style={s.vibIcon}>{v.icon}</Text>
            <Text style={[s.vibLabel, snd===v.id && {color:'#fff'}]}>{v.label}</Text>
          </TouchableOpacity>
        ))}
        <View style={s.vibDivider}/>
        {VIBS.map(v => (
          <TouchableOpacity key={v.id} style={[s.vibBtn, vib===v.id && s.vibBtnActive]} onPress={() => setVib(v.id)}>
            <Text style={s.vibIcon}>{v.icon}</Text>
            <Text style={[s.vibLabel, vib===v.id && {color:'#fff'}]}>{v.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.btnRow}>
        <TouchableOpacity style={s.cancelBtn} onPress={onCancel}>
          <Text style={s.cancelBtnText}>취소</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.submitBtn} onPress={handleSubmit}>
          <Text style={s.submitBtnText}>{submitLabel}</Text>
        </TouchableOpacity>
      </View>
      <View style={{height:40}}/>
    </ScrollView>
  );
}

const pick = StyleSheet.create({
  wrap:      { position:'relative', height: PICK_H * 3, overflow:'hidden' },
  highlight: { position:'absolute', top: PICK_H, left:8, right:8, height: PICK_H, backgroundColor:'#e8e8e8', borderRadius:12 },
  scroll:    { flex:1 },
  item:      { height: PICK_H, justifyContent:'center', alignItems:'center' },
  num:       { fontFamily: Platform.OS==='ios'?'Courier':'monospace', fontWeight:'900' },
  numSel:    { fontSize:44, color:'#000', opacity:1 },
  numDim:    { fontSize:28, color:'#000', opacity:0.22 },
});

const s = StyleSheet.create({
  sLabel:        { fontSize:14, fontWeight:'900', letterSpacing:1, color:'#000', marginTop:22, marginBottom:8 },
  typeGrid:      { flexDirection:'row', gap:8 },
  typeBtn:       { flex:1, alignItems:'center', padding:12, borderRadius:14, borderWidth:1.5, borderColor:'#ccc', backgroundColor:'#f5f5f5' },
  typeBtnActive: { backgroundColor:'#444', borderColor:'#444' },
  typeBtnIcon:   { fontSize:28, marginBottom:4 },
  typeBtnLabel:  { fontSize:12, fontWeight:'800', color:'#333' },
  timeRow:       { flexDirection:'row', alignItems:'center', backgroundColor:'#f5f5f5', borderRadius:16, borderWidth:1, borderColor:'#ccc', paddingVertical:8, paddingHorizontal:14 },
  timeStepper:   { flex:1, alignItems:'center' },
  adjBtn:        { paddingVertical:4, paddingHorizontal:16 },
  adjText:       { fontSize:18, color:'#555' },
  timeColon:     { fontSize:36, fontWeight:'900', color:'#000', marginHorizontal:8, marginBottom:4 },
  dateBtn:       { flexDirection:'row', alignItems:'center', backgroundColor:'#f5f5f5', borderWidth:1.5, borderColor:'#aaa', borderRadius:13, padding:14, gap:8 },
  dateBtnIcon:   { fontSize:20 },
  dateBtnLabel:  { flex:1, fontSize:15, fontWeight:'800', color:'#000' },
  dateBtnArrow:  { fontSize:12, color:'#888' },
  modalOverlay:  { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center' },
  modalContent:  { width:'90%', backgroundColor:'#fff', borderRadius:20, padding:20 },
  input:         { borderWidth:1.5, borderColor:'#aaa', borderRadius:13, padding:13, fontSize:17, fontWeight:'700', color:'#000', backgroundColor:'#fff' },
  pillRow:       { flexDirection:'row', flexWrap:'wrap', gap:8 },
  pill:          { paddingHorizontal:16, paddingVertical:9, borderRadius:99, borderWidth:2, borderColor:'#aaa', backgroundColor:'#f5f5f5' },
  pillActive:    { backgroundColor:'#444', borderColor:'#444' },
  pillText:      { fontSize:15, fontWeight:'800', color:'#000' },
  quickRow:      { flexDirection:'row', gap:8 },
  quickBtn:      { flex:1, paddingVertical:8, borderRadius:10, borderWidth:2, borderColor:'#aaa', backgroundColor:'#f0f0f0', alignItems:'center' },
  quickBtnText:  { fontSize:14, fontWeight:'800', color:'#333' },
  dayRow:        { flexDirection:'row', flexWrap:'wrap', gap:7 },
  dayBtn:        { paddingHorizontal:14, paddingVertical:9, borderRadius:10, borderWidth:2, borderColor:'#aaa', backgroundColor:'#f0f0f0' },
  dayBtnActive:  { backgroundColor:'#444', borderColor:'#444' },
  dayText:       { fontSize:15, fontWeight:'800' },
  cycleBox:      { backgroundColor:'#f5f5f5', borderWidth:1, borderColor:'#ccc', borderRadius:16, padding:16, marginTop:10 },
  cycleLabel:    { fontSize:12, fontWeight:'900', color:'#555', marginBottom:8 },
  stepper:       { flexDirection:'row', alignItems:'center', gap:14 },
  stepBtn:       { width:40, height:40, borderRadius:12, borderWidth:1, borderColor:'#888', backgroundColor:'#e8e8e8', alignItems:'center', justifyContent:'center' },
  stepBtnText:   { fontSize:22, fontWeight:'900', color:'#444' },
  stepVal:       { flex:1, textAlign:'center', fontFamily:Platform.OS==='ios'?'Courier':'monospace', fontSize:38, fontWeight:'900', color:'#333' },
  stepUnit:      { fontSize:14, fontWeight:'400', color:'#666' },
  presetRow:     { flexDirection:'row', flexWrap:'wrap', gap:7, marginTop:12 },
  preset:        { paddingHorizontal:12, paddingVertical:5, borderRadius:99, borderWidth:1.5, borderColor:'#ccc', backgroundColor:'transparent' },
  presetActive:  { backgroundColor:'#444', borderColor:'#444' },
  presetText:    { fontSize:13, fontWeight:'700', color:'#333' },
  cycleInfoBox:  { backgroundColor:'#e0e0e0', borderRadius:10, padding:10, marginTop:12 },
  cycleInfo:     { textAlign:'center', fontSize:13, fontWeight:'800', color:'#333' },
  vibGrid:       { flexDirection:'row', gap:7, alignItems:'stretch' },
  vibDivider:    { width:1, backgroundColor:'#ccc', marginVertical:4 },
  vibBtn:        { flex:1, alignItems:'center', padding:10, borderRadius:13, borderWidth:2, borderColor:'#d0d4e8', backgroundColor:'#f0f2fa' },
  vibBtnActive:  { backgroundColor:'#444', borderColor:'#444' },
  vibIcon:       { fontSize:24, marginBottom:4 },
  vibLabel:      { fontSize:11, fontWeight:'700', color:'#333' },
  btnRow:        { flexDirection:'row', gap:12, marginTop:24 },
  cancelBtn:     { flex:1, padding:16, borderRadius:16, borderWidth:1.5, borderColor:'#aaa', backgroundColor:'#f0f0f0', alignItems:'center' },
  cancelBtnText: { fontSize:17, fontWeight:'800', color:'#333' },
  submitBtn:     { flex:2, padding:16, borderRadius:16, backgroundColor:'#444', alignItems:'center' },
  submitBtnText: { fontSize:17, fontWeight:'900', color:'#fff', letterSpacing:0.5 },
});

const cal = StyleSheet.create({
  wrap:        { gap:8 },
  nav:         { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:8 },
  navBtn:      { padding:8 },
  navArrow:    { fontSize:24, color:'#444', fontWeight:'900' },
  navTitle:    { fontSize:16, fontWeight:'900', color:'#000' },
  grid:        { flexDirection:'row', flexWrap:'wrap' },
  headCell:    { width:'14.28%', alignItems:'center', paddingVertical:4 },
  headText:    { fontSize:12, fontWeight:'700', color:'#888' },
  cell:        { width:'14.28%', alignItems:'center', paddingVertical:6 },
  cellText:    { fontSize:14, color:'#000' },
  cellSel:     { backgroundColor:'#444', borderRadius:99 },
  cellToday:   { borderWidth:1.5, borderColor:'#444', borderRadius:99 },
  todayBtn:    { marginTop:12, padding:12, backgroundColor:'#f0f0f0', borderRadius:12, alignItems:'center' },
  todayBtnText:{ fontSize:14, fontWeight:'800', color:'#444' },
});
