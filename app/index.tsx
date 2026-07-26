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
import { RotationTutorialEvent } from '../src/components/AlarmForm/RotationWizard';
import { cycleTutorialStepsKo, rotationTutorialStepsKo } from '../src/content/tutorialSteps.ko';
import { nextAlarmText, getRepLimitedIds, getNextFireDate } from '../src/utils';
import { Alarm, ShiftPeriod } from '../src/constants';
import { Palette } from '../src/constants/colors';
import { useColors, useThemeSetting } from '../src/hooks/useTheme';

export default function App() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const { theme } = useThemeSetting();
  const s = makeStyles(C);
  const { alarms, loaded, addAlarm, updateAlarm, deleteAlarms, toggleAlarm, submitWorkPattern } = useAlarms();
  useHolidaySync();
  const { notifGranted, requestPermission, overlayGranted, requestOverlayPermission, tick, ringing, stopRinging, snoozeRinging } = useAlarmNotifications(alarms, updateAlarm);
  const { selectMode, selectedIds, enterSelectMode, toggleSelect, selectAll, exitSelectMode } = useSelectMode();
  // 메인 화면은 달력 — 교대근무자는 약속 잡을 때 근무표(달력)부터 본다
  const [tab, setTab] = useState<HomeTab>('calendar');
  const [editAlarm, setEditAlarm] = useState<Alarm|null>(null);
  // 저장 후 이동할 목적지 — 하단 내비 탭을 눌러서 저장한 경우, 저장 콜백이 기본으로
  // 가는 화면(알람 목록) 대신 사용자가 실제로 누른 탭으로 보내주기 위해 기억해둠
  const [pendingNav, setPendingNav] = useState<HomeTab | null>(null);
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
  const tutorialCloseBtnRef = useRef<View>(null); // N일 주기/N일 후 휴식 팝업의 닫기(확인) 버튼 — 7단계 타겟
  const tutorialAddBtnRef = useRef<View>(null);
  const tutorialDeleteBtnRef = useRef<View>(null);
  const addFormRef = useRef<AlarmFormHandle>(null);

  // 1~7: 추가 폼 스크롤 영역, 8: 추가 폼 상단바(스크롤 불필요), 9: 추가 직후 열리는 수정 화면의 삭제 버튼
  const TUTORIAL_TARGETS: Record<number, React.RefObject<any>> = {
    1: tutorialTypeRef, 2: tutorialTimeRef, 3: tutorialLabelRef, 4: tutorialCycleRef,
    5: tutorialPresetRef, 6: tutorialDateChipRef, 7: tutorialCloseBtnRef, 8: tutorialAddBtnRef,
    9: tutorialDeleteBtnRef,
  };
  const TUTORIAL_LAST_STEP = cycleTutorialStepsKo.length - 1;

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

  // 5단계(며칠마다) — N일 주기/N일 후 휴식 팝업이 진짜 <Modal>이라 튜토리얼 오버레이가 그 위로
  // 보이지 않는다(네이티브 모달이 항상 위에 뜸). 그래서 "다음" 버튼 대신 프리셋을 실제로 눌러야
  // 진행되게 하고(AddShiftModal의 말번/비번 버튼 선례와 동일한 패턴), 텍스트만 먼저 안내해둔다.
  const handleTutorialPresetPick = () => {
    if (tutorialStep === 5) setTutorialStep(6);
  };

  // 7단계(다음 알람 날짜 확인) — 같은 이유로 팝업의 닫기(확인) 버튼을 실제로 눌러야 진행됨
  const handleTutorialRepeatConfigClose = () => {
    if (tutorialStep === 7) setTutorialStep(8);
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

  // ── 근무표 만들기 튜토리얼 — 기본값 그대로 "초번 1일 → 말번 1일 → 비번 1일" 3일 주기를 따라 만든다.
  // "N일 주기" 튜토리얼과 별개 상태로 두어 서로 영향을 주지 않음(동시에 하나만 진입 가능).
  const [rotationTutorialStep, setRotationTutorialStep] = useState<number|null>(null);
  const [rotationSpotlightRect, setRotationSpotlightRect] = useState<SpotlightRect|null>(null);
  const rotationShiftGridRef = useRef<View>(null);
  const rotationNextBtnRef = useRef<View>(null);
  const rotationOffworkYesBtnRef = useRef<View>(null);
  const rotationAddChipRef = useRef<View>(null);
  const rotationFinishBtnRef = useRef<View>(null);
  const rotationLateBtnRef = useRef<View>(null);
  const rotationRestBtnRef = useRef<View>(null);

  const ROTATION_TUTORIAL_TARGETS: Record<number, React.RefObject<any>> = {
    1: rotationShiftGridRef, 2: rotationNextBtnRef, 3: rotationOffworkYesBtnRef, 4: rotationNextBtnRef,
    5: rotationAddChipRef, 6: rotationLateBtnRef, 7: rotationNextBtnRef, 8: rotationOffworkYesBtnRef,
    9: rotationNextBtnRef, 10: rotationAddChipRef, 11: rotationRestBtnRef, 12: rotationFinishBtnRef,
    13: tutorialAddBtnRef,
  };
  const ROTATION_TUTORIAL_LAST_STEP = rotationTutorialStepsKo.length - 1;

  const exitRotationTutorial = () => {
    setRotationTutorialStep(null);
    setRotationSpotlightRect(null);
    setTab('alarms');
  };

  // 인트로/완료 단계만 오버레이 자체 cta 버튼으로 넘어감 — 중간 단계는 전부 실제 조작(onShiftPick/onTutorialEvent)으로만 진행
  const handleRotationAdvance = () => {
    if (rotationTutorialStep === 0) { setTab('add'); setRotationTutorialStep(1); return; }
    if (rotationTutorialStep === ROTATION_TUTORIAL_LAST_STEP) { exitRotationTutorial(); return; }
  };

  // ShiftSelector에서 "초번"을 실제로 골라야 다음 단계로 — RotationWizard 진입 트리거이므로 여기서만 감지 가능
  const handleRotationShiftPick = (shift: ShiftPeriod) => {
    if (rotationTutorialStep === 1 && shift === 'early') setRotationTutorialStep(2);
  };

  // RotationWizard 안에서 벌어지는 각 실제 조작(다음/네/완료/+/말번/비번/여기서 반복) 이벤트 —
  // 지금 단계가 기대하는 이벤트와 일치할 때만 한 칸 전진(순서를 벗어난 조작은 무시)
  const ROTATION_STEP_EVENTS: Record<number, RotationTutorialEvent> = {
    2: 'commuteNext', 3: 'offworkYes', 4: 'offworkDone', 5: 'addOpen', 6: 'shiftPicked',
    7: 'commuteNext', 8: 'offworkYes', 9: 'offworkDone', 10: 'addOpen', 11: 'restPicked', 12: 'finish',
  };
  const handleRotationWizardEvent = (event: RotationTutorialEvent) => {
    if (rotationTutorialStep !== null && ROTATION_STEP_EVENTS[rotationTutorialStep] === event) {
      setRotationTutorialStep(rotationTutorialStep + 1);
    }
  };

  // 근무표 튜토리얼 화면은 짧아서(칩 줄 + 버튼 몇 개) 스크롤 없이 measureInWindow만으로 충분 —
  // RotationWizard는 AlarmForm의 wizard 분기(contentRef가 없는 별도 ScrollView)에서 렌더링되므로
  // scrollTargetIntoView는 여기서 쓰지 않는다(호출해도 contentRef가 없어 조용히 무시됨).
  useEffect(() => {
    const targetRef = rotationTutorialStep !== null ? ROTATION_TUTORIAL_TARGETS[rotationTutorialStep] : undefined;
    if (!targetRef) { setRotationSpotlightRect(null); return; }
    const measure = () => targetRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
      if (width > 0 && height > 0) setRotationSpotlightRect({ x, y, width, height });
    });
    const t1 = setTimeout(measure, 150);
    const t2 = setTimeout(measure, 450);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [rotationTutorialStep, tab]);

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

  // 근무 시간대 로테이션 그룹(출근+퇴근)은 항상 함께 삭제되므로(useAlarms.deleteAlarms가 자동 확장),
  // 확인창 문구도 그룹째로 지워진다는 걸 미리 알려준다.
  const groupDeleteNotice = (ids: Set<number>): string => {
    const groups = new Set(
      alarms.filter(a => ids.has(a.id) && a.groupId != null).map(a => a.groupId!)
    );
    if (!groups.size) return '';
    return '\n(근무 시간대 알람은 출근·퇴근 세트로 함께 삭제됩니다)';
  };

  const handleDeleteSelected = () => {
    if (!selectedIds.size) return;
    Alert.alert('알람 삭제', `선택한 ${selectedIds.size}개를 삭제할까요?${groupDeleteNotice(selectedIds)}`, [
      { text:'취소', style:'cancel' },
      { text:'삭제', style:'destructive', onPress: async () => {
        await deleteAlarms(selectedIds);
        exitSelectMode();
      }},
    ]);
  };

  const handleDeleteOne = (id: number) => {
    Alert.alert('알람 삭제', `이 알람을 삭제할까요?${groupDeleteNotice(new Set([id]))}`, [
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

  // 하단 내비(달력/알람/설정) 탭 — 알람 추가·수정 중에 누르면 무조건 그냥 나가버려서
  // 입력 중이던 내용이 조용히 날아가는 문제가 있었다. 폼이 열려 있고 뭔가 입력돼 있으면
  // 저장 확인 후 눌렀던 탭으로 바로 이동시킨다.
  const finishNav = (target: HomeTab) => {
    setEditAlarm(null);
    setShowHelp(false);
    setTab(target);
  };
  const handleNavPress = (target: HomeTab) => {
    if (tutorialStep !== null || rotationTutorialStep !== null) { setShowHelp(false); setTab(target); return; }
    const activeFormRef = editAlarm ? editFormRef : (tab === 'add' ? addFormRef : null);
    if (!activeFormRef?.current?.isDirty()) { finishNav(target); return; }
    // 위저드가 아직 진행 중이면(블록카드 화면까지 안 넘어감) 저장할 완성된 데이터가 없으므로
    // "저장" 선택지를 주지 않는다 — 계속하거나 그냥 나가는(저장 안 함) 것만 가능
    if (activeFormRef.current?.isWizardActive()) {
      Alert.alert(
        '설정을 그만둘까요?',
        '',
        [
          { text: '계속하기', style: 'cancel' },
          { text: '그만두기', style: 'destructive', onPress: () => finishNav(target) },
        ],
      );
      return;
    }
    Alert.alert(
      '저장하지 않을까요?',
      '',
      [
        { text: '계속하기', style: 'cancel' },
        { text: '저장 안 함', style: 'destructive', onPress: () => finishNav(target) },
        { text: '저장', onPress: () => { setPendingNav(target); activeFormRef.current?.submit(); } },
      ],
    );
  };

  // 다음에 울릴 알람이 맨 위로 오도록 정렬 — 꺼진 알람이나 다음 예정이 없는 알람은
  // 뒤로 밀리고, 그 안에서는 기존처럼 설정 시각순으로 둔다. tick마다 재계산돼 한
  // 알람이 지나가면 다음 알람이 자동으로 맨 위로 올라온다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sorted = useMemo(() => {
    const withNext = alarms.map(a => ({ a, next: a.active ? getNextFireDate(a) : null }));
    return withNext
      .sort((x, y) => {
        if (x.next && y.next) return x.next.getTime() - y.next.getTime();
        if (x.next) return -1;
        if (y.next) return 1;
        return x.a.hour*60+x.a.min-(y.a.hour*60+y.a.min);
      })
      .map(w => w.a);
  }, [alarms, tick]);
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
          onStartRotationTutorial={() => { setShowHelp(false); setRotationTutorialStep(0); }}
        />
      ) : editAlarm ? (
        <AlarmForm
          key={editAlarm.id}
          ref={editFormRef}
          initial={editAlarm}
          onSubmit={async data=>{
            await updateAlarm(editAlarm.id, data);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setEditAlarm(null);
            if (pendingNav) { setTab(pendingNav); setPendingNav(null); }
          }}
          onSubmitPattern={async (groupId, pattern, sd, snd, vib) => {
            // 비그룹 알람(일반/레거시)을 근무표로 전환 저장하는 경우 — 원본을 새 세트로
            // 대체하지 않으면 편집하던 알람이 목록에 그대로 남아 중복된다
            await submitWorkPattern(groupId, pattern, sd, snd, vib, groupId == null ? editAlarm.id : undefined);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setEditAlarm(null);
            if (pendingNav) { setTab(pendingNav); setPendingNav(null); }
          }}
          onCancel={tutorialStep !== null ? exitTutorial : handleEditClose}
          onDelete={() => handleDeleteOne(editAlarm.id)}
          onTypeChange={setEditTypeId}
          editTypeId={editAlarm.typeId}
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

          {tab==='settings' && (
            <SettingsView
              onStartRotationTutorial={() => setRotationTutorialStep(0)}
              onOpenHelp={() => setShowHelp(true)}
            />
          )}

          {tab==='add' && (
            <AlarmForm
              ref={addFormRef}
              initial={{typeId:'commute',hour:8,min:0,rm:'weekdays',days:[],cd:3,rd:1,snd:'default',vib:'pulse'}}
              onSubmit={async data=>{
                const created = await addAlarm(data);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setTab(pendingNav ?? 'alarms');
                setPendingNav(null);
                if (tutorialStep !== null) {
                  setEditAlarm(created);
                  setEditTypeId(created.typeId ?? 'commute');
                  setTutorialStep(9);
                }
              }}
              onSubmitPattern={async (groupId, pattern, sd, snd, vib) => {
                await submitWorkPattern(groupId, pattern, sd, snd, vib);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setTab(pendingNav ?? 'alarms');
                setPendingNav(null);
                if (rotationTutorialStep !== null) setRotationTutorialStep(ROTATION_TUTORIAL_LAST_STEP);
              }}
              onCancel={() => {
                if (tutorialStep !== null) { exitTutorial(); return; }
                if (rotationTutorialStep !== null) { exitRotationTutorial(); return; }
                setTab('alarms');
              }}
              onRmChange={tutorialStep !== null ? handleTutorialRmChange : undefined}
              onCalendarClose={tutorialStep !== null ? handleTutorialCalendarClose : undefined}
              onPresetPick={tutorialStep !== null ? handleTutorialPresetPick : undefined}
              onRepeatConfigClose={tutorialStep !== null ? handleTutorialRepeatConfigClose : undefined}
              typeRef={tutorialTypeRef}
              timeRef={tutorialTimeRef}
              labelRef={tutorialLabelRef}
              cycleRef={tutorialCycleRef}
              presetRef={tutorialPresetRef}
              dateChipRef={tutorialDateChipRef}
              closeBtnRef={tutorialCloseBtnRef}
              addBtnRef={tutorialAddBtnRef}
              shiftGridRef={rotationTutorialStep !== null ? rotationShiftGridRef : undefined}
              onShiftPick={rotationTutorialStep !== null ? handleRotationShiftPick : undefined}
              wizardNextBtnRef={rotationTutorialStep !== null ? rotationNextBtnRef : undefined}
              wizardOffworkYesBtnRef={rotationTutorialStep !== null ? rotationOffworkYesBtnRef : undefined}
              wizardAddChipRef={rotationTutorialStep !== null ? rotationAddChipRef : undefined}
              wizardFinishBtnRef={rotationTutorialStep !== null ? rotationFinishBtnRef : undefined}
              wizardAddModalLateBtnRef={rotationTutorialStep !== null ? rotationLateBtnRef : undefined}
              wizardAddModalRestBtnRef={rotationTutorialStep !== null ? rotationRestBtnRef : undefined}
              onWizardTutorialEvent={rotationTutorialStep !== null ? handleRotationWizardEvent : undefined}
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

      <BottomNav tab={tab} setTab={handleNavPress} bottomInset={insets.bottom} />
    </SafeAreaView>

    {tutorialStep !== null && (
      <CycleAlarmTutorial
        steps={cycleTutorialStepsKo}
        step={tutorialStep}
        rect={spotlightRect}
        onAdvance={handleTutorialAdvance}
        onSkip={exitTutorial}
      />
    )}
    {rotationTutorialStep !== null && (
      <CycleAlarmTutorial
        steps={rotationTutorialStepsKo}
        step={rotationTutorialStep}
        rect={rotationSpotlightRect}
        onAdvance={handleRotationAdvance}
        onSkip={exitRotationTutorial}
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
