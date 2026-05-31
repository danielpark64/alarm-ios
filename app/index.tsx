import React, { useState, useEffect, useMemo, memo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  StyleSheet, StatusBar, Platform, Modal, KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { useAlarms } from '../src/hooks/useAlarms';
import { AlarmCard } from '../src/components/AlarmCard';
import { AlarmForm } from '../src/components/AlarmForm';
import { pad, nextAlarmText, todayStr } from '../src/utils';
import { requestNotificationPermission, registerNotificationCategories } from '../src/utils/notifications';
import { Alarm, DAYS } from '../src/constants';

const C = {
  bg:'#0b0b1c', bg2:'#141430', bg3:'#1c1c40',
  border:'#24244a', border2:'#30306a',
  txt:'#f0f0ff', txt2:'#e0e0f5', txt3:'#c8c8e0',
  accent:'#a29bfe', accent2:'#6c5ce7',
};

// 해당 날짜에 울리는 알람 목록 계산
function alarmsForDate(alarms: Alarm[], dateStr: string): Alarm[] {
  const date = new Date(dateStr);
  const dow  = (date.getDay() + 6) % 7; // 0=월 ~ 6=일
  return alarms.filter(a => {
    if (!a.active) return false;
    if (a.sd && dateStr < a.sd) return false;
    if (a.rm === 'daily')    return true;
    if (a.rm === 'weekdays') return dow < 5;
    if (a.rm === 'weekends') return dow >= 5;
    if (a.rm === 'once')     return dateStr === a.sd;
    if (a.rm === 'wdcustom') return a.days.includes(dow);
    if (a.rm === 'cycle') {
      const s = new Date(a.sd || dateStr); s.setHours(0,0,0,0);
      const d = Math.round((date.getTime()-s.getTime())/86400000);
      return d >= 0 && d % (a.cd||1) === 0;
    }
    if (a.rm === 'rest') {
      const s = new Date(a.sd || dateStr); s.setHours(0,0,0,0);
      const d = Math.round((date.getTime()-s.getTime())/86400000);
      const p = (a.cd||2) + (a.rd||1);
      return d >= 0 && (d % p) < (a.cd||2);
    }
    return false;
  });
}

// 시계 헤더 — 1초마다 리렌더되는 범위를 이 컴포넌트 안으로 격리
const ClockHeader = memo(function ClockHeader() {
  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      <Text style={s.date}>
        {clock.toLocaleDateString('ko-KR',{weekday:'long',month:'long',day:'numeric'})}
      </Text>
      <Text style={s.clock}>
        {pad(clock.getHours())}:{pad(clock.getMinutes())}
        <Text style={s.sec}>:{pad(clock.getSeconds())}</Text>
      </Text>
    </>
  );
});

// 달력 화면
function CalendarView({ alarms, onEditAlarm }: { alarms: Alarm[]; onEditAlarm: (a: Alarm) => void }) {
  const today = todayStr();
  const todayDate = new Date(today);
  const [year,  setYear]  = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth());

  const prevMonth = () => { if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const nextMonth = () => { if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };

  const firstDow    = new Date(year, month, 1).getDay();
  const offset      = (firstDow + 6) % 7;
  const daysInMonth = new Date(year, month+1, 0).getDate();

  const cells: (number|null)[] = [];
  for (let i=0; i<offset; i++) cells.push(null);
  for (let d=1; d<=daysInMonth; d++) cells.push(d);

  const alarmMap = useMemo(() => {
    const map: Record<string, Alarm[]> = {};
    for (let d=1; d<=daysInMonth; d++) {
      const ds = `${year}-${pad(month+1)}-${pad(d)}`;
      map[ds] = alarmsForDate(alarms, ds);
    }
    return map;
  }, [alarms, year, month, daysInMonth]);

  return (
    <ScrollView style={{flex:1, backgroundColor:C.bg}} contentContainerStyle={{padding:14, paddingBottom:100}}>
      {/* 월 네비 */}
      <View style={cv.nav}>
        <TouchableOpacity onPress={prevMonth} style={cv.navBtn}>
          <Text style={cv.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={cv.navTitle}>{year}년 {month+1}월</Text>
        <TouchableOpacity onPress={nextMonth} style={cv.navBtn}>
          <Text style={cv.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* 요일 헤더 */}
      <View style={cv.grid}>
        {DAYS.map((d,i) => (
          <View key={i} style={cv.headCell}>
            <Text style={[cv.headText, i>=5 && {color:'#e07070'}]}>{d}</Text>
          </View>
        ))}

        {/* 날짜 셀 */}
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={cv.cell}/>;
          const ds = `${year}-${pad(month+1)}-${pad(d)}`;
          const isToday = ds === today;
          const dow = (offset + d - 1) % 7;
          const dayAlarms = alarmMap[ds] || [];

          return (
            <View key={i} style={[cv.cell, isToday && cv.cellToday]}>
              <Text style={[
                cv.dayNum,
                dow >= 5 && {color:'#e07070'},
                isToday && cv.dayNumToday,
              ]}>{d}</Text>
              {dayAlarms.slice(0,3).map((al, ai) => (
                <TouchableOpacity key={ai} onPress={() => onEditAlarm(al)} activeOpacity={0.7}>
                  <Text style={cv.alarmChip} numberOfLines={1}>{al.label}</Text>
                </TouchableOpacity>
              ))}
              {dayAlarms.length > 3 && (
                <Text style={cv.moreChip}>+{dayAlarms.length-3}</Text>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

export default function App() {
  const insets = useSafeAreaInsets();
  const { alarms, loaded, addAlarm, updateAlarm, deleteAlarms, toggleAlarm, toggleAll } = useAlarms();
  const [tab, setTab] = useState<'alarms'|'calendar'|'add'>('alarms');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editAlarm, setEditAlarm] = useState<Alarm|null>(null);
  const [highlightId, setHighlightId] = useState<number|null>(null);
  const [notifGranted, setNotifGranted] = useState(false);

  useEffect(() => {
    (async () => {
      const ok = await requestNotificationPermission();
      setNotifGranted(ok);
      await registerNotificationCategories();
    })();
  }, []);

  useEffect(() => {
    const s1 = Notifications.addNotificationReceivedListener(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    );
    const s2 = Notifications.addNotificationResponseReceivedListener(r => {
      if (r.actionIdentifier === 'snooze')
        Notifications.scheduleNotificationAsync({
          content: { ...r.notification.request.content, title:'⏰ 스누즈' },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(Date.now()+5*60*1000) },
        });
    });
    return () => { s1.remove(); s2.remove(); };
  }, []);

  const toggleSelect = (id: number) =>
    setSelectedIds(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });

  const handleDeleteSelected = () => {
    if (!selectedIds.size) return;
    Alert.alert('알람 삭제', `선택한 ${selectedIds.size}개를 삭제할까요?`, [
      { text:'취소', style:'cancel' },
      { text:'삭제', style:'destructive', onPress: async () => {
        await deleteAlarms(selectedIds);
        setSelectMode(false); setSelectedIds(new Set());
      }},
    ]);
  };

  const sorted = useMemo(() => [...alarms].sort((a,b) => a.hour*60+a.min-(b.hour*60+b.min)), [alarms]);
  const activeCount = useMemo(() => alarms.filter(a=>a.active).length, [alarms]);
  const nextText = useMemo(() => nextAlarmText(alarms), [alarms]);

  if (!loaded)
    return <View style={s.loading}><Text style={s.loadingT}>⏰</Text></View>;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg}/>

      {/* 헤더 */}
      <View style={s.header}>
        <View style={{flex:1}}>
          <ClockHeader />
          <Text style={s.stat}>
            활성 <Text style={s.statN}>{activeCount}</Text>개
            {nextText ? `  ·  ${nextText}` : `  ·  전체 ${alarms.length}개`}
          </Text>
        </View>
        <View style={s.hbtns}>
          {!notifGranted && (
            <TouchableOpacity style={s.hb} onPress={async()=>{const ok=await requestNotificationPermission();setNotifGranted(ok);}}>
              <Text style={s.hbt}>🔔 알림</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.hb} onPress={()=>toggleAll(true)}>
            <Text style={s.hbt}>전체 ON</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.hb,s.hbOff]} onPress={()=>toggleAll(false)}>
            <Text style={[s.hbt,{color:C.txt2}]}>전체 OFF</Text>
          </TouchableOpacity>
          {tab==='alarms' && (
            <TouchableOpacity
              style={[s.hb,s.hbDel]}
              onPress={()=>selectMode?(setSelectMode(false),setSelectedIds(new Set())):setSelectMode(true)}
            >
              <Text style={[s.hbt,{color:'#e07070'}]}>{selectMode?'취소':'선택'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 탭 콘텐츠 */}
      {tab==='alarms' && (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollC} showsVerticalScrollIndicator={false}>
          {selectMode && (
            <View style={s.selBar}>
              <Text style={s.selCnt}>{selectedIds.size}개 선택됨</Text>
              <TouchableOpacity onPress={()=>setSelectedIds(new Set(alarms.map(a=>a.id)))} style={s.selB}>
                <Text style={s.selBT}>전체</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDeleteSelected} style={[s.selB,s.selBDel]}>
                <Text style={[s.selBT,{color:'#fff'}]}>삭제</Text>
              </TouchableOpacity>
            </View>
          )}
          {alarms.length===0 ? (
            <View style={s.empty}>
              <Text style={s.emptyI}>⏰</Text>
              <Text style={s.emptyT}>알람이 없습니다</Text>
              <Text style={s.emptySub}>＋ 버튼으로 추가하세요</Text>
            </View>
          ) : sorted.map(al => (
            <AlarmCard
              key={al.id} alarm={al}
              onToggle={()=>{Haptics.selectionAsync();toggleAlarm(al.id);}}
              onEdit={()=>setEditAlarm(al)}
              selectMode={selectMode} selected={selectedIds.has(al.id)}
              onSelect={()=>toggleSelect(al.id)}
                highlighted={highlightId === al.id}
            />
          ))}
        </ScrollView>
      )}

      {tab==='calendar' && <CalendarView alarms={alarms} onEditAlarm={al => {
          setTab('alarms');
          setHighlightId(al.id);
          setTimeout(() => setHighlightId(null), 5000);
        }}/>}

      {tab==='add' && (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollC} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={s.formTitle}>새 알람 추가</Text>
          <AlarmForm
            initial={{typeId:'commute',hour:8,min:0,rm:'weekdays',days:[],cd:2,rd:1,vib:'short'}}
            onSubmit={async data=>{
              await addAlarm(data);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setTab('alarms');
            }}
            onCancel={()=>setTab('alarms')}
            submitLabel="⏰ 알람 추가"
          />
        </ScrollView>
      )}

      {/* 편집 모달 */}
      <Modal visible={!!editAlarm} transparent animationType="slide" onRequestClose={()=>setEditAlarm(null)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS==='ios'?'padding':'height'}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={()=>setEditAlarm(null)} activeOpacity={1}/>
          <View style={[s.modal,{paddingBottom:Math.max(insets.bottom,20)}]}>
            <View style={s.handle}/>
            <Text style={s.modalTitle}>알람 편집</Text>
            {editAlarm && (
              <AlarmForm
                initial={editAlarm}
                onSubmit={async data=>{
                  await updateAlarm(editAlarm.id, data);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  setEditAlarm(null);
                }}
                onCancel={()=>setEditAlarm(null)}
                submitLabel="✔ 저장"
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 하단 네비 — 알람 / 달력 / 추가 */}
      <View style={[s.nav,{paddingBottom:Math.max(insets.bottom,14)}]}>
        <TouchableOpacity style={s.navBtn} onPress={()=>setTab('alarms')}>
          <View style={[s.navI, tab==='alarms' && s.navIA]}>
            <Text style={s.navIT}>⏰</Text>
          </View>
          <Text style={[s.navL, tab==='alarms' && s.navLA]}>알람</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.navBtn} onPress={()=>setTab('calendar')}>
          <View style={[s.navI, tab==='calendar' && s.navIA]}>
            <Text style={s.navIT}>📅</Text>
          </View>
          <Text style={[s.navL, tab==='calendar' && s.navLA]}>달력</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.navBtn} onPress={()=>setTab('add')}>
          <View style={[s.navIC, tab==='add' && s.navICA]}>
            <Text style={{fontSize:22,color:'#fff',fontWeight:'900'}}>＋</Text>
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const cv = StyleSheet.create({
  nav:         { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:14 },
  navBtn:      { padding:10 },
  navArrow:    { fontSize:28, color:C.txt, fontWeight:'900' },
  navTitle:    { fontSize:18, fontWeight:'900', color:C.txt },
  grid:        { flexDirection:'row', flexWrap:'wrap' },
  headCell:    { width:'14.28%', alignItems:'center', paddingVertical:6 },
  headText:    { fontSize:11, fontWeight:'700', color:C.txt3 },
  cell:        { width:'14.28%', minHeight:72, padding:3, borderRadius:8, marginBottom:3 },
  cellToday:   { backgroundColor:'rgba(162,155,254,0.12)', borderWidth:1, borderColor:C.accent },
  dayNum:      { fontSize:13, fontWeight:'700', color:C.txt, marginBottom:2, textAlign:'center' },
  dayNumToday: { color:C.accent, fontWeight:'900' },
  alarmChip:   { fontSize:9, fontWeight:'700', color:C.accent2, backgroundColor:'rgba(108,92,231,0.18)', borderRadius:4, paddingHorizontal:3, paddingVertical:1, marginBottom:1 },
  moreChip:    { fontSize:9, color:C.txt3, fontWeight:'700', textAlign:'center' },
});

const s = StyleSheet.create({
  root:      { flex:1, backgroundColor:C.bg },
  loading:   { flex:1, alignItems:'center', justifyContent:'center', backgroundColor:C.bg },
  loadingT:  { fontSize:60 },
  header:    { flexDirection:'row', alignItems:'flex-start', gap:10, paddingHorizontal:18, paddingTop:12, paddingBottom:14, backgroundColor:C.bg, borderBottomWidth:1, borderBottomColor:C.border },
  date:      { fontSize:11, fontWeight:'700', color:C.txt3, letterSpacing:2, marginBottom:2, textTransform:'uppercase' },
  clock:     { fontFamily:Platform.OS==='ios'?'Courier':'monospace', fontSize:52, fontWeight:'700', letterSpacing:-2, lineHeight:58, color:C.txt },
  sec:       { fontSize:18, opacity:0.28, color:C.txt },
  stat:      { fontSize:12, fontWeight:'700', color:C.txt3, marginTop:6 },
  statN:     { fontSize:15, fontWeight:'900', color:C.accent },
  hbtns:     { flexDirection:'column', gap:5, alignItems:'flex-end', paddingTop:4 },
  hb:        { paddingHorizontal:12, paddingVertical:6, borderRadius:20, backgroundColor:C.bg3, borderWidth:1, borderColor:C.border2 },
  hbOff:     { backgroundColor:C.bg2, borderColor:C.border2 },
  hbDel:     { backgroundColor:'rgba(224,112,112,0.12)', borderColor:'#503030' },
  hbt:       { fontSize:12, fontWeight:'700', color:C.txt },
  scroll:    { flex:1, backgroundColor:C.bg },
  scrollC:   { padding:14, paddingBottom:100 },
  formTitle: { fontSize:20, fontWeight:'900', marginBottom:6, color:C.txt },
  selBar:    { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'rgba(224,112,112,0.10)', borderWidth:1, borderColor:'#503030', borderRadius:14, padding:10, marginBottom:10 },
  selCnt:    { flex:1, fontSize:14, color:'#e07070', fontWeight:'900' },
  selB:      { paddingHorizontal:12, paddingVertical:5, borderRadius:20, borderWidth:1, borderColor:'#e07070' },
  selBDel:   { backgroundColor:'#e07070' },
  selBT:     { fontSize:13, fontWeight:'700', color:'#e07070' },
  empty:     { alignItems:'center', paddingVertical:60 },
  emptyI:    { fontSize:56, marginBottom:14 },
  emptyT:    { fontSize:18, color:C.txt2, fontWeight:'700' },
  emptySub:  { fontSize:14, color:C.txt3, marginTop:6 },
  nav:       { flexDirection:'row', justifyContent:'space-around', alignItems:'center', paddingTop:10, backgroundColor:'rgba(11,11,28,0.96)', borderTopWidth:1, borderTopColor:C.border },
  navBtn:    { alignItems:'center', gap:3, paddingHorizontal:20, paddingVertical:4 },
  navI:      { width:34, height:34, borderRadius:17, alignItems:'center', justifyContent:'center' },
  navIA:     { backgroundColor:'rgba(162,155,254,0.18)' },
  navOverModal: { position:'absolute', bottom:0, left:0, right:0, zIndex:10 },
  navIT:     { fontSize:18 },
  navIC:     { width:50, height:50, borderRadius:15, backgroundColor:C.bg3, borderWidth:1, borderColor:C.border2, alignItems:'center', justifyContent:'center' },
  navICA:    { backgroundColor:C.accent2, borderColor:'transparent', shadowColor:C.accent, shadowOffset:{width:0,height:4}, shadowOpacity:0.45, shadowRadius:12, elevation:8 },
  navL:      { fontSize:10, fontWeight:'700', color:C.txt3 },
  navLA:     { color:C.accent },
  overlay:   { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.72)', justifyContent:'flex-end', zIndex:100 },
  modal:     { backgroundColor:C.bg2, borderTopLeftRadius:24, borderTopRightRadius:24, padding:20, maxHeight:'90%', borderTopWidth:1, borderColor:C.border },
  handle:    { width:36, height:4, borderRadius:2, backgroundColor:C.border2, alignSelf:'center', marginBottom:16 },
  modalTitle:{ fontSize:20, fontWeight:'900', marginBottom:8, color:C.txt },
});
