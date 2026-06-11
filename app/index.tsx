import React, { useState, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  StyleSheet, StatusBar, Platform, Modal, KeyboardAvoidingView, PanResponder,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAlarms } from '../src/hooks/useAlarms';
import { useAlarmNotifications } from '../src/hooks/useAlarmNotifications';
import { useSelectMode } from '../src/hooks/useSelectMode';
import { ClockHeader } from '../src/components/Home/ClockHeader';
import { CalendarView } from '../src/components/Home/CalendarView';
import { AlarmsTab } from '../src/components/Home/AlarmsTab';
import { BottomNav, HomeTab } from '../src/components/Home/BottomNav';
import { homeStyles } from '../src/components/Home/styles';
import { AlarmForm, AlarmFormHandle } from '../src/components/AlarmForm';
import { AlarmRinging } from '../src/components/AlarmRinging';
import { nextAlarmText, getRepLimitedIds } from '../src/utils';
import { Alarm } from '../src/constants';
import { C } from '../src/constants/colors';

export default function App() {
  const insets = useSafeAreaInsets();
  const { alarms, loaded, addAlarm, updateAlarm, deleteAlarms, toggleAlarm, toggleAll } = useAlarms();
  const { notifGranted, requestPermission, tick, ringing, stopRinging, snoozeRinging } = useAlarmNotifications(alarms, updateAlarm);
  const { selectMode, selectedIds, toggleSelectMode, toggleSelect, selectAll, exitSelectMode } = useSelectMode();
  const [tab, setTab] = useState<HomeTab>('alarms');
  const [editAlarm, setEditAlarm] = useState<Alarm|null>(null);
  const [editTypeId, setEditTypeId] = useState<string>('commute');
  const editFormRef = useRef<AlarmFormHandle>(null);
  const handleEditCloseRef = useRef<() => void>(() => {});
  const editSwipePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 60 || g.vy > 0.5) handleEditCloseRef.current();
      },
    })
  ).current;
  const [highlightId, setHighlightId] = useState<number|null>(null);

  const handleDeleteSelected = () => {
    if (!selectedIds.size) return;
    Alert.alert('알람 삭제', `선택한 ${selectedIds.size}개를 삭제할까요?`, [
      { text:'취소', style:'cancel' },
      { text:'삭제', style:'destructive', onPress: async () => {
        await deleteAlarms(selectedIds);
        exitSelectMode();
      }},
    ]);
  };

  const handleEditClose = () => {
    if (!editFormRef.current?.isDirty()) {
      setEditAlarm(null);
      return;
    }
    Alert.alert(
      '저장하지 않을까요?',
      '',
      [
        { text: '계속하기', style: 'cancel' },
        { text: '저장 안 함', style: 'destructive', onPress: () => setEditAlarm(null) },
        { text: '저장', onPress: () => editFormRef.current?.submit() },
      ],
    );
  };
  handleEditCloseRef.current = handleEditClose;

  const sorted        = useMemo(() => [...alarms].sort((a,b) => a.hour*60+a.min-(b.hour*60+b.min)), [alarms]);
  const activeCount   = useMemo(() => alarms.filter(a=>a.active).length, [alarms]);
  const repLimitedIds = useMemo(() => getRepLimitedIds(alarms), [alarms]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nextText = useMemo(() => nextAlarmText(alarms), [alarms, tick]);

  if (!loaded)
    return <View style={s.loading}><Text style={s.loadingT}>⏰</Text></View>;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg}/>

      {/* 헤더 */}
      <View style={s.header}>
        <View style={{flex:1}}>
          <ClockHeader />
          <Text style={s.stat} numberOfLines={1}>
            활성 <Text style={s.statN}>{activeCount}</Text>개
            {nextText
              ? <Text style={s.nextT}>{`  ·  ${nextText}`}</Text>
              : `  ·  전체 ${alarms.length}개`}
          </Text>
        </View>
        <View style={s.hbtns}>
          {!notifGranted && (
            <TouchableOpacity style={s.hb} onPress={requestPermission}>
              <Text style={s.hbt}>🔔 알림</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.hb} onPress={()=>toggleAll(true)}>
            <Text style={s.hbt} numberOfLines={1} adjustsFontSizeToFit>전체 켜기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.hb,s.hbOff]} onPress={()=>toggleAll(false)}>
            <Text style={[s.hbt,{color:C.txt2}]} numberOfLines={1} adjustsFontSizeToFit>전체 끄기</Text>
          </TouchableOpacity>
          {tab==='alarms' && (
            <TouchableOpacity style={[s.hb,s.hbDel]} onPress={toggleSelectMode}>
              <Text style={[s.hbt,{color:'#e07070'}]} numberOfLines={1} adjustsFontSizeToFit>{selectMode?'취소':'선택'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 탭 콘텐츠 */}
      {tab==='alarms' && (
        <AlarmsTab
          alarms={alarms}
          sorted={sorted}
          selectMode={selectMode}
          selectedIds={selectedIds}
          repLimitedIds={repLimitedIds}
          highlightId={highlightId}
          onToggleSelect={toggleSelect}
          onSelectAll={() => selectAll(alarms.map(a=>a.id))}
          onDeleteSelected={handleDeleteSelected}
          onToggleAlarm={toggleAlarm}
          onEditAlarm={al => { setEditAlarm(al); setEditTypeId(al.typeId ?? 'commute'); }}
        />
      )}

      {tab==='calendar' && <CalendarView alarms={alarms} onEditAlarm={al => {
          setTab('alarms');
          setHighlightId(al.id);
          setTimeout(() => setHighlightId(null), 5000);
        }}/>}

      {tab==='add' && (
        <ScrollView style={homeStyles.scroll} contentContainerStyle={homeStyles.scrollC} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <AlarmForm
            initial={{typeId:'commute',hour:8,min:0,rm:'weekdays',days:[],cd:2,rd:1,vib:'pulse'}}
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

      {/* Android 알람 울림 모달 (포그라운드) */}
      {Platform.OS === 'android' && (
        <AlarmRinging
          visible={!!ringing}
          title={ringing?.title ?? ''}
          body={ringing?.body ?? ''}
          source={ringing?.source ?? 'expo'}
          onStop={stopRinging}
          onSnooze={snoozeRinging}
        />
      )}

      {/* 편집 모달 */}
      <Modal visible={!!editAlarm} transparent animationType="slide" onRequestClose={handleEditClose}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS==='ios'?'padding':'height'}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleEditClose} activeOpacity={1}/>
          <View style={[s.modal,{paddingBottom:Math.max(insets.bottom,20)}]}>
            <View style={s.handleWrap} {...editSwipePan.panHandlers}>
              <View style={s.handle}/>
            </View>
            {editAlarm && (
              <AlarmForm
                ref={editFormRef}
                initial={editAlarm}
                onSubmit={async data=>{
                  await updateAlarm(editAlarm.id, data);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  setEditAlarm(null);
                }}
                onCancel={handleEditClose}
                onTypeChange={setEditTypeId}
                submitLabel="✔ 저장"
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <BottomNav tab={tab} setTab={setTab} bottomInset={insets.bottom} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:      { flex:1, backgroundColor:C.bg },
  loading:   { flex:1, alignItems:'center', justifyContent:'center', backgroundColor:C.bg },
  loadingT:  { fontSize:60 },
  header:    { flexDirection:'row', alignItems:'flex-start', gap:10, paddingHorizontal:18, paddingTop:12, paddingBottom:14, backgroundColor:C.bg, borderBottomWidth:1, borderBottomColor:C.border },
  stat:      { fontSize:14, fontWeight:'800', color:C.txt3, marginTop:6 },
  statN:     { fontSize:15, fontWeight:'900', color:C.accent },
  nextT:     { fontSize:14, fontWeight:'800', color:C.txt2 },
  hbtns:     { flexDirection:'column', gap:5, alignItems:'flex-end', paddingTop:4 },
  hb:        { width:84, height:32, alignItems:'center', justifyContent:'center', paddingHorizontal:8, paddingVertical:6, borderRadius:20, backgroundColor:C.bg3, borderWidth:1, borderColor:C.border2 },
  hbOff:     { backgroundColor:C.bg2, borderColor:C.border2 },
  hbDel:     { backgroundColor:'rgba(224,112,112,0.12)', borderColor:'#503030' },
  hbt:       { fontSize:12, fontWeight:'700', color:C.txt },
  overlay:   { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.72)', justifyContent:'flex-end', zIndex:100 },
  modal:     { backgroundColor:C.bg2, borderTopLeftRadius:24, borderTopRightRadius:24, padding:20, maxHeight:'90%', borderTopWidth:1, borderColor:C.border },
  handleWrap: { alignSelf:'stretch', alignItems:'center', paddingVertical:12 },
  handle:    { width:36, height:4, borderRadius:2, backgroundColor:C.border2 },
});
