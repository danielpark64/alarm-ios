import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, TextInput, TouchableOpacity, Alert,
  StyleSheet, StatusBar, Platform,
} from 'react-native';
import { Text } from '../src/components/common/AppText';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useAlarms } from '../src/hooks/useAlarms';
import { useAlarmNotifications } from '../src/hooks/useAlarmNotifications';
import { useSelectMode } from '../src/hooks/useSelectMode';
import { useHolidaySync } from '../src/hooks/useHolidaySync';
import { ClockHeader } from '../src/components/Home/ClockHeader';
import { CalendarView } from '../src/components/Home/CalendarView';
import { AlarmsTab } from '../src/components/Home/AlarmsTab';
import { SettingsView } from '../src/components/Home/SettingsView';
import { HelpScreen } from '../src/components/Help/HelpScreen';
import { BottomNav, HomeTab } from '../src/components/Home/BottomNav';
import { AlarmForm, AlarmFormHandle } from '../src/components/AlarmForm';
import { AlarmRinging } from '../src/components/AlarmRinging';
import { CycleAlarmTutorial, SpotlightRect } from '../src/components/Tutorial/CycleAlarmTutorial';
import { nextAlarmText, getRepLimitedIds } from '../src/utils';
import { Alarm } from '../src/constants';
import { Palette } from '../src/constants/colors';
import { useColors, useThemeSetting } from '../src/hooks/useTheme';

export default function App() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const { theme } = useThemeSetting();
  const s = makeStyles(C);
  const { alarms, loaded, addAlarm, updateAlarm, deleteAlarms, toggleAlarm } = useAlarms();
  useHolidaySync();
  const { notifGranted, requestPermission, overlayGranted, requestOverlayPermission, tick, ringing, stopRinging, snoozeRinging } = useAlarmNotifications(alarms, updateAlarm);
  const { selectMode, selectedIds, enterSelectMode, toggleSelect, selectAll, exitSelectMode } = useSelectMode();
  // 메인 화면은 달력 — 교대근무자는 약속 잡을 때 근무표(달력)부터 본다
  const [tab, setTab] = useState<HomeTab>('calendar');
  const [editAlarm, setEditAlarm] = useState<Alarm|null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [editTypeId, setEditTypeId] = useState<string>('commute');
  const editFormRef = useRef<AlarmFormHandle>(null);
  const [highlightId, setHighlightId] = useState<number|null>(null);
  const [tutorialStep, setTutorialStep] = useState<number|null>(null);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect|null>(null);
  const tutorialTypeRef = useRef<View>(null);
  const tutorialTimeRef = useRef<View>(null);
  const tutorialLabelRef = useRef<TextInput>(null);
  const tutorialCycleRef = useRef<View>(null);
  const tutorialPresetRef = useRef<View>(null);
  const tutorialDateChipRef = useRef<View>(null);
  const tutorialInfoBoxRef = useRef<View>(null);
  const tutorialAddBtnRef = useRef<View>(null);
  const tutorialDeleteBtnRef = useRef<View>(null);
  const addFormRef = useRef<AlarmFormHandle>(null);

  // 1~7: 추가 폼 스크롤 영역, 8: 추가 폼 상단바(스크롤 불필요), 9: 추가 직후 열리는 수정 화면의 삭제 버튼
  const TUTORIAL_TARGETS: Record<number, React.RefObject<any>> = {
    1: tutorialTypeRef, 2: tutorialTimeRef, 3: tutorialLabelRef, 4: tutorialCycleRef,
    5: tutorialPresetRef, 6: tutorialDateChipRef, 7: tutorialInfoBoxRef, 8: tutorialAddBtnRef,
    9: tutorialDeleteBtnRef,
  };
  const TUTORIAL_LAST_STEP = 10;

  const exitTutorial = () => {
    setTutorialStep(null);
    setSpotlightRect(null);
    setEditAlarm(null);
    setTab('alarms');
  };

  const handleTutorialAdvance = () => {
    if (tutorialStep === 0) { setTab('add'); setTutorialStep(1); return; }
    if (tutorialStep === TUTORIAL_LAST_STEP) { setTutorialStep(null); setEditAlarm(null); return; }
    if (tutorialStep !== null && tutorialStep < TUTORIAL_LAST_STEP) setTutorialStep(tutorialStep + 1);
  };

  // 4단계(반복방식)는 "다음"으로 건너뛸 수 없게 하고, 실제로 "N일 주기"를 선택해야만 다음 단계로 진행
  // — 건너뛰면 5~7단계가 가리켜야 할 일수/시작일자 UI가 아직 화면에 없어 멈춘 것처럼 보이는 문제 방지
  const handleTutorialRmChange = (rm: string) => {
    if (tutorialStep === 4 && rm === 'cycle') setTutorialStep(5);
  };

  // 6단계(시작일자)도 "다음"으로 건너뛸 수 없게 하고, 실제로 캘린더에서 날짜를 선택/확인해야 다음 단계로 진행
  const handleTutorialCalendarClose = () => {
    if (tutorialStep === 6) setTutorialStep(7);
  };

  // 단계가 바뀔 때마다 가리킬 실제 버튼의 화면상 위치를 측정 — 레이아웃이 막 바뀐 직후라 한 프레임 늦춰서 측정
  useEffect(() => {
    const targetRef = tutorialStep !== null ? TUTORIAL_TARGETS[tutorialStep] : undefined;
    if (!targetRef) { setSpotlightRect(null); return; }
    // 추가 버튼(8)은 스크롤 영역 밖 상단바에 고정돼 있어 스크롤이 필요 없음. 9단계는 수정 화면(editFormRef) 스크롤 영역
    const scrollFormRef = tutorialStep === 9 ? editFormRef : addFormRef;
    if (tutorialStep !== 8) scrollFormRef.current?.scrollTargetIntoView(targetRef);
    const measure = () => targetRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
      if (width > 0 && height > 0) setSpotlightRect({ x, y, width, height });
    });
    // 탭 전환/모드 전환/스크롤 직후라 네이티브 레이아웃이 아직 안 끝났을 수 있어 두 번 측정 (늦은 값으로 덮어씀)
    const t1 = setTimeout(measure, 150);
    const t2 = setTimeout(measure, 450);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [tutorialStep, tab]);

  const showOverlayPrompt = () => Alert.alert(
    '표시 권한 설정 방법',
    '알람이 울릴 때 화면에 바로 떠서 끄기 버튼을 누를 수 있게 하려면 권한이 필요해요.\n\n"설정으로 이동"을 누르면 "다른 앱 위에 표시"라는 제목의 화면이 열려요.\n\n1. 그 목록에서 "알람"을 찾아주세요\n2. "알람" 옆에 있는 스위치를 켜주세요\n3. 켠 다음에는 화면 왼쪽 위 ← 버튼을 눌러 앱으로 돌아와주세요',
    [
      { text: '취소', style: 'cancel' },
      { text: '설정으로 이동', onPress: requestOverlayPermission },
    ]
  );

  // 권한이 꺼져 있으면 앱을 켤 때마다 자동으로 한 번 안내 (배너만으로는 못 알아챌 수 있음)
  // overlayGranted === null은 "아직 확인 전"이라 여기선 무시 — false로 확정된 경우에만 안내
  useEffect(() => {
    if (overlayGranted === false) showOverlayPrompt();
  }, [overlayGranted]);

  // 알람이 하나도 없는 신규 사용자는 빈 달력 대신 알람 탭(빈 상태 안내)에서 시작
  useEffect(() => {
    if (loaded && alarms.length === 0) setTab('alarms');
  }, [loaded]);

  // 앱을 처음 설치하고 켰을 때만 한 번 튜토리얼을 권유 (설정 배너만으로는 발견하기 어려움)
  const TUTORIAL_PROMPT_KEY = '@tutorial_prompt_shown';
  useEffect(() => {
    if (!loaded) return;
    (async () => {
      const seen = await AsyncStorage.getItem(TUTORIAL_PROMPT_KEY);
      if (seen) return;
      await AsyncStorage.setItem(TUTORIAL_PROMPT_KEY, '1');
      Alert.alert(
        '처음이시군요!',
        '주기 알람 따라하기를 해볼까요?\n(설정에서 언제든 보실 수 있습니다)',
        [
          { text: '나중에', style: 'cancel' },
          { text: '네', onPress: () => setTutorialStep(0) },
        ],
      );
    })();
  }, [loaded]);

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
        if (tutorialStep !== null) exitTutorial();
        else setEditAlarm(null);
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
    <>
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

      {/* 표시 권한(다른 앱 위에 표시)은 안드로이드 전용 — iOS는 overlayGranted가 항상 null이라 Platform 체크 필수 */}
      {(!notifGranted || (Platform.OS === 'android' && !overlayGranted)) && (
        <View style={s.permRow}>
          {!notifGranted && (
            <TouchableOpacity style={s.permChip} onPress={requestPermission}>
              <Text style={s.permChipT}>🔔 알림 권한 허용</Text>
            </TouchableOpacity>
          )}
          {Platform.OS === 'android' && !overlayGranted && (
            <TouchableOpacity style={s.permChip} onPress={showOverlayPrompt}>
              <Text style={s.permChipT}>📱 표시 권한 허용</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 사용법 안내 — 전체화면 */}
      {showHelp ? (
        <HelpScreen
          onClose={() => setShowHelp(false)}
          onStartTutorial={() => { setShowHelp(false); setTutorialStep(0); }}
        />
      ) : editAlarm ? (
        <AlarmForm
          ref={editFormRef}
          initial={editAlarm}
          onSubmit={async data=>{
            await updateAlarm(editAlarm.id, data);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setEditAlarm(null);
          }}
          onCancel={tutorialStep !== null ? exitTutorial : handleEditClose}
          onDelete={() => handleDeleteOne(editAlarm.id)}
          onTypeChange={setEditTypeId}
          deleteBtnRef={tutorialStep !== null ? tutorialDeleteBtnRef : undefined}
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

          {tab==='calendar' && <CalendarView alarms={alarms} onUpdateAlarm={updateAlarm} onEditAlarm={al => {
              setTab('alarms');
              setHighlightId(al.id);
              setTimeout(() => setHighlightId(null), 5000);
            }}/>}

          {tab==='settings' && <SettingsView onStartTutorial={() => setTutorialStep(0)} onOpenHelp={() => setShowHelp(true)} />}

          {tab==='add' && (
            <AlarmForm
              ref={addFormRef}
              initial={{typeId:'commute',hour:8,min:0,rm:'weekdays',days:[],cd:3,rd:1,snd:'default',vib:'pulse'}}
              onSubmit={async data=>{
                const created = await addAlarm(data);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setTab('alarms');
                if (tutorialStep !== null) {
                  setEditAlarm(created);
                  setEditTypeId(created.typeId ?? 'commute');
                  setTutorialStep(9);
                }
              }}
              onCancel={() => tutorialStep !== null ? exitTutorial() : setTab('alarms')}
              onRmChange={tutorialStep !== null ? handleTutorialRmChange : undefined}
              onCalendarClose={tutorialStep !== null ? handleTutorialCalendarClose : undefined}
              typeRef={tutorialTypeRef}
              timeRef={tutorialTimeRef}
              labelRef={tutorialLabelRef}
              cycleRef={tutorialCycleRef}
              presetRef={tutorialPresetRef}
              dateChipRef={tutorialDateChipRef}
              infoBoxRef={tutorialInfoBoxRef}
              addBtnRef={tutorialAddBtnRef}
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

      <BottomNav tab={tab} setTab={t => { setShowHelp(false); setTab(t); }} bottomInset={insets.bottom} />
    </SafeAreaView>

    {tutorialStep !== null && (
      <CycleAlarmTutorial
        step={tutorialStep}
        rect={spotlightRect}
        onAdvance={handleTutorialAdvance}
        onSkip={exitTutorial}
      />
    )}
    </>
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
