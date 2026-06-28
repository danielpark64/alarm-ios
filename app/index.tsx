import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Alert,
  StyleSheet, StatusBar, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAlarms } from '../src/hooks/useAlarms';
import { useAlarmNotifications } from '../src/hooks/useAlarmNotifications';
import { useSelectMode } from '../src/hooks/useSelectMode';
import { ClockHeader } from '../src/components/Home/ClockHeader';
import { CalendarView } from '../src/components/Home/CalendarView';
import { AlarmsTab } from '../src/components/Home/AlarmsTab';
import { SettingsView } from '../src/components/Home/SettingsView';
import { BottomNav, HomeTab } from '../src/components/Home/BottomNav';
import { AlarmForm, AlarmFormHandle } from '../src/components/AlarmForm';
import { AlarmRinging } from '../src/components/AlarmRinging';
import { nextAlarmText, getRepLimitedIds } from '../src/utils';
import { Alarm } from '../src/constants';
import { Palette } from '../src/constants/colors';
import { useColors, useThemeSetting } from '../src/hooks/useTheme';
import { useAlarmDefaults } from '../src/hooks/useAlarmDefaults';

export default function App() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const { theme } = useThemeSetting();
  const { defaults: alarmDefaults } = useAlarmDefaults();
  const s = makeStyles(C);
  const { alarms, loaded, addAlarm, updateAlarm, deleteAlarms, toggleAlarm } = useAlarms();
  const { notifGranted, requestPermission, overlayGranted, requestOverlayPermission, tick, ringing, stopRinging, snoozeRinging } = useAlarmNotifications(alarms, updateAlarm);
  const { selectMode, selectedIds, enterSelectMode, toggleSelect, selectAll, exitSelectMode } = useSelectMode();
  const [tab, setTab] = useState<HomeTab>('alarms');
  const [editAlarm, setEditAlarm] = useState<Alarm|null>(null);
  const [editTypeId, setEditTypeId] = useState<string>('commute');
  const editFormRef = useRef<AlarmFormHandle>(null);
  const [highlightId, setHighlightId] = useState<number|null>(null);

  const showOverlayPrompt = () => Alert.alert(
    '표시 권한 설정 방법',
    '알람이 울릴 때 화면에 바로 떠서 끄기 버튼을 누를 수 있게 하려면 권한이 필요해요.\n\n"설정으로 이동"을 누르면 "다른 앱 위에 표시"라는 제목의 화면이 열려요.\n\n1. 그 목록에서 "알람"을 찾아주세요\n2. "알람" 옆에 있는 스위치를 켜주세요\n3. 켠 다음에는 화면 왼쪽 위 ← 버튼을 눌러 앱으로 돌아와주세요',
    [
      { text: '취소', style: 'cancel' },
      { text: '설정으로 이동', onPress: requestOverlayPermission },
    ]
  );

  // 권한이 꺼져 있으면 앱을 켤 때마다 자동으로 한 번 안내 (배너만으로는 못 알아챌 수 있음)
  useEffect(() => {
    if (!overlayGranted) showOverlayPrompt();
  }, [overlayGranted]);

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

  const handleDeleteOne = (id: number) => {
    Alert.alert('알람 삭제', '이 알람을 삭제할까요?', [
      { text:'취소', style:'cancel' },
      { text:'삭제', style:'destructive', onPress: async () => {
        await deleteAlarms(new Set([id]));
        setEditAlarm(null);
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

  const sorted        = useMemo(() => [...alarms].sort((a,b) => a.hour*60+a.min-(b.hour*60+b.min)), [alarms]);
  const repLimitedIds = useMemo(() => getRepLimitedIds(alarms), [alarms]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nextText = useMemo(() => nextAlarmText(alarms), [alarms, tick]);

  if (!loaded)
    return <View style={s.loading}><Text style={s.loadingT}>⏰</Text></View>;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar barStyle={theme === 'light' ? 'dark-content' : 'light-content'} backgroundColor={C.bg}/>

      {/* 헤더 */}
      <View style={s.header}>
        <View style={{flex:1}}>
          <ClockHeader />
          <Text style={s.nextT} numberOfLines={1}>
            {nextText || '예정된 알람 없음'}
          </Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => setTab('add')}>
          <Text style={s.addBtnT}>＋</Text>
        </TouchableOpacity>
      </View>

      {(!notifGranted || !overlayGranted) && (
        <View style={s.permRow}>
          {!notifGranted && (
            <TouchableOpacity style={s.permChip} onPress={requestPermission}>
              <Text style={s.permChipT}>🔔 알림 권한 허용</Text>
            </TouchableOpacity>
          )}
          {!overlayGranted && (
            <TouchableOpacity style={s.permChip} onPress={showOverlayPrompt}>
              <Text style={s.permChipT}>📱 표시 권한 허용</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 수정 화면 — 추가와 동일하게 전체화면으로 통일 (바텀시트 모달 제거) */}
      {editAlarm ? (
        <AlarmForm
          ref={editFormRef}
          initial={editAlarm}
          onSubmit={async data=>{
            await updateAlarm(editAlarm.id, data);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setEditAlarm(null);
          }}
          onCancel={handleEditClose}
          onDelete={() => handleDeleteOne(editAlarm.id)}
          onTypeChange={setEditTypeId}
        />
      ) : (
        <>
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
              onExitSelectMode={exitSelectMode}
              onEnterSelectMode={enterSelectMode}
              onToggleAlarm={toggleAlarm}
              onEditAlarm={al => { setEditAlarm(al); setEditTypeId(al.typeId ?? 'commute'); }}
            />
          )}

          {tab==='calendar' && <CalendarView alarms={alarms} onEditAlarm={al => {
              setTab('alarms');
              setHighlightId(al.id);
              setTimeout(() => setHighlightId(null), 5000);
            }}/>}

          {tab==='settings' && <SettingsView />}

          {tab==='add' && (
            <AlarmForm
              initial={{typeId:'commute',hour:8,min:0,rm:'weekdays',days:[],cd:2,rd:1,snd:alarmDefaults.snd,vib:alarmDefaults.vib}}
              onSubmit={async data=>{
                await addAlarm(data);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setTab('alarms');
              }}
              onCancel={()=>setTab('alarms')}
            />
          )}
        </>
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

      <BottomNav tab={tab} setTab={setTab} bottomInset={insets.bottom} />
    </SafeAreaView>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    root:      { flex:1, backgroundColor:C.bg },
    loading:   { flex:1, alignItems:'center', justifyContent:'center', backgroundColor:C.bg },
    loadingT:  { fontSize:60 },
    header:    { flexDirection:'row', alignItems:'center', gap:14, paddingHorizontal:18, paddingTop:12, paddingBottom:14, backgroundColor:C.bg, borderBottomWidth:1, borderBottomColor:C.border },
    nextT:     { fontSize:15, fontWeight:'800', color:C.txt2, marginTop:8, textAlign:'left' },
    addBtn:    { width:64, height:64, borderRadius:20, backgroundColor:C.accent2, alignItems:'center', justifyContent:'center', shadowColor:C.accent, shadowOffset:{width:0,height:4}, shadowOpacity:0.4, shadowRadius:10, elevation:6 },
    addBtnT:   { fontSize:32, color:'#fff', fontWeight:'900' },
    permRow:   { flexDirection:'row', gap:8, paddingHorizontal:18, paddingVertical:10, backgroundColor:C.bg, borderBottomWidth:1, borderBottomColor:C.border },
    permChip:  { flexDirection:'row', alignItems:'center', paddingHorizontal:12, paddingVertical:7, borderRadius:20, backgroundColor:C.bg3, borderWidth:1, borderColor:C.border2 },
    permChipT: { fontSize:12, fontWeight:'700', color:C.txt2 },
  });
}
