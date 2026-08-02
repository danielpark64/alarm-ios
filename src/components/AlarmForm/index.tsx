import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Text } from '../common/AppText';
import { Alarm, ShiftPeriod, WorkSegment, SoundMode, VibMode } from '../../constants';
import { useColors } from '../../hooks/useTheme';
import { useAlarmFormState } from '../../hooks/useAlarmFormState';
import { TypeSelector } from './TypeSelector';
import { ShiftSelector } from './ShiftSelector';
import { WorkPatternBuilder } from './WorkPatternBuilder';
import { RotationWizard, RotationTutorialEvent } from './RotationWizard';
import { SndVibSelector } from './SndVibSelector';
import { DateSection } from './DateSection';
import { DateModal } from './DateModal';
import { TimePickerSection } from './TimePickerSection';
import { RepeatModeSelector } from './RepeatModeSelector';
import { DayOfWeekSelector } from './DayOfWeekSelector';
import { CycleRestControls } from './CycleRestControls';
import { makeStyles } from './styles';

export interface AlarmFormHandle {
  submit: () => void;
  isDirty: () => boolean;
  isWizardActive: () => boolean;
  scrollTargetIntoView: (target: React.RefObject<any>) => void;
}

interface Props {
  initial: Partial<Alarm>;
  onSubmit: (data: Omit<Alarm, 'id' | 'active'>) => void;
  onSubmitPattern?: (groupId: number | undefined, pattern: WorkSegment[], sd: string, snd: SoundMode, vib: VibMode) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onTypeChange?: (typeId: string) => void;
  onRmChange?: (rm: string) => void;
  editTypeId?: string; // 알람 카드에서 "수정"으로 들어올 때 그 카드의 typeId — 패턴 모드에서 어떤 블록을 고치러 왔는지 안내하는 데 사용
  onCalendarClose?: () => void;
  onRepeatConfigClose?: () => void; // N일 주기/N일 후 휴식 팝업이 닫힐 때(튜토리얼 7단계 진행에 사용)
  onPresetPick?: () => void; // 팝업 안의 프리셋 버튼을 실제로 눌렀을 때(튜토리얼 5단계 진행에 사용)
  typeRef?: React.Ref<View>;
  timeRef?: React.Ref<View>;
  labelRef?: React.Ref<TextInput>;
  cycleRef?: React.Ref<View>;
  presetRef?: React.Ref<View>;
  dateChipRef?: React.Ref<View>;
  closeBtnRef?: React.Ref<View>; // N일 주기/N일 후 휴식 팝업의 닫기(확인) 버튼 — 튜토리얼 7단계 타겟
  addBtnRef?: React.Ref<View>;
  deleteBtnRef?: React.Ref<View>;
  // 근무표 만들기 튜토리얼 전용 — 평소엔 전부 undefined
  shiftGridRef?: React.Ref<View>;
  onShiftPick?: (shift: ShiftPeriod) => void;
  wizardNextBtnRef?: React.Ref<View>;
  wizardOffworkYesBtnRef?: React.Ref<View>;
  wizardAddChipRef?: React.Ref<View>;
  wizardFinishBtnRef?: React.Ref<View>;
  wizardAddModalLateBtnRef?: React.Ref<View>;
  wizardAddModalRestBtnRef?: React.Ref<View>;
  onWizardTutorialEvent?: (event: RotationTutorialEvent) => void;
}

export const AlarmForm = forwardRef<AlarmFormHandle, Props>(
  function AlarmForm(
    {
      initial, onSubmit, onSubmitPattern, onCancel, onDelete, onTypeChange, onRmChange, onCalendarClose,
      onRepeatConfigClose, onPresetPick, editTypeId,
      typeRef, timeRef, labelRef, cycleRef, presetRef, dateChipRef, closeBtnRef, addBtnRef, deleteBtnRef,
      shiftGridRef, onShiftPick, wizardNextBtnRef, wizardOffworkYesBtnRef, wizardAddChipRef, wizardFinishBtnRef,
      wizardAddModalLateBtnRef, wizardAddModalRestBtnRef, onWizardTutorialEvent,
    },
    ref,
  ) {
    const form = useAlarmFormState(initial, onSubmit, onTypeChange, onRmChange, onCalendarClose, onSubmitPattern, onRepeatConfigClose);
    const C = useColors();
    const s = makeStyles(C);
    const isCycleRest = form.rm === 'cycle' || form.rm === 'rest';
    const isEdit = initial.id != null;

    // 근무 시간대 게이트(해당없음 → 시간대 선택) 전환 — 폼이 더러워진 상태(뭔가 입력됨)일 때만
    // 확인창을 띄우고, 아니면 바로 적용. 반대 방향(패턴 → 일반)은 UI 진입점이 없다 — 패턴 알람을
    // 일반 알람으로 되돌리고 싶으면 삭제 후 새로 만들도록 통일(그룹 데이터 잔존 버그 소지를
    // 원천 차단하기 위한 설계 결정, 2026-07-14).
    const requestShiftGate = (newShift: ShiftPeriod) => {
      const crossing = (form.shift === 'none') !== (newShift === 'none');
      if (crossing && form.isDirty()) {
        Alert.alert(
          '교대근무 전환',
          '입력한 반복/시간 설정이 초기화됩니다. 계속할까요?',
          [
            { text: '취소', style: 'cancel' },
            { text: '계속', style: 'destructive', onPress: () => form.applyShiftGate(newShift) },
          ],
        );
      } else {
        form.applyShiftGate(newShift);
      }
    };
    const scrollRef = useRef<ScrollView>(null);
    const contentRef = useRef<View>(null);

    useImperativeHandle(ref, () => ({
      submit: form.submit,
      isDirty: form.isDirty,
      isWizardActive: () => form.showWizard,
      scrollTargetIntoView: (target) => {
        target.current?.measureLayout(
          contentRef.current as any,
          (_x: number, y: number) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true }),
          () => {},
        );
      },
    }), [form.submit, form.isDirty, form.showWizard]);

    if (form.showWizard) {
      return (
        <View style={s.formRoot}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
            <RotationWizard
              sd={form.sd}
              setShowCal={form.setShowCal}
              initialShift={form.wizardInitialShift}
              onComplete={form.completeWizard}
              onCancel={form.cancelWizard}
              nextBtnRef={wizardNextBtnRef}
              offworkYesBtnRef={wizardOffworkYesBtnRef}
              addChipRef={wizardAddChipRef}
              finishBtnRef={wizardFinishBtnRef}
              addModalLateBtnRef={wizardAddModalLateBtnRef}
              addModalRestBtnRef={wizardAddModalRestBtnRef}
              onTutorialEvent={onWizardTutorialEvent}
            />
          </ScrollView>
          <DateModal
            sd={form.sd}
            setSd={form.setSd}
            visible={form.showCal}
            onClose={() => form.setShowCal(false)}
          />
        </View>
      );
    }

    return (
      <View style={s.formRoot}>
        {/* 상단 고정 바 — 폼이 길어도 스크롤 없이 바로 취소/저장 */}
        <View style={s.topBar}>
          <TouchableOpacity style={s.topBarCancelBtn} onPress={onCancel}>
            <Text style={s.topBarCancelText}>취소</Text>
          </TouchableOpacity>
          <Text style={s.topBarTitle} numberOfLines={1}>{isEdit ? '알람 수정' : '알람 추가'}</Text>
          <TouchableOpacity
            ref={addBtnRef}
            style={[s.topBarSaveBtn, !isEdit && !form.isDirty() && { opacity: 0.4 }]}
            disabled={!isEdit && !form.isDirty()}
            onPress={form.handleSubmit}
          >
            <Text style={s.topBarSaveText}>{isEdit ? '저장' : '추가'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          contentContainerStyle={s.scrollContent}
        >
          <View ref={contentRef}>
            {/* 교대근무 — 폼 전체를 가르는 게이트. 해당없음이면 아래는 기존 폼 그대로,
                실제 시간대를 고르면 블록 빌더(로테이션)로 전체가 바뀐다. 카드로 감싸서
                아래 알람내용/시간/반복방식 섹션과 시각적으로 분리. */}
            <View style={s.shiftSectionCard}>
              <Text style={[s.sLabel, { marginTop: 0 }]}>교대근무</Text>
              {form.isPatternMode ? (
                <View style={s.wpGateBanner}>
                  <Text style={s.wpGateBannerText}>교대근무 알람 · 아래 블록에서 조정</Text>
                </View>
              ) : (
                <ShiftSelector
                  shift={form.shift}
                  onChange={(newShift) => { requestShiftGate(newShift); onShiftPick?.(newShift); }}
                  shiftCustom={form.shiftCustom}
                  onCustomChange={form.handleShiftCustomChange}
                  gridRef={shiftGridRef}
                />
              )}
            </View>

            {form.isPatternMode ? (
              <>
                {isEdit && (
                  <Text style={s.wpEditHint}>
                    {editTypeId === 'offwork' ? '퇴근' : '출근'} 알람을 수정하러 오셨어요 —
                    아래 칩을 눌러 원하는 구간의 시각을 바꾸세요
                  </Text>
                )}
                <WorkPatternBuilder
                  blocks={form.blocks}
                  setBlocks={form.setBlocks}
                  sd={form.sd}
                  setShowCal={form.setShowCal}
                  // 마지막 블록까지 지우는 건 "근무표 자체를 없애겠다"는 뜻 — 편집 모드면 알람 세트
                  // 삭제 확인(onDelete)으로, 추가 모드면 근무 시간대 게이트를 해당없음으로 되돌린다.
                  onDeleteLastBlock={onDelete ?? (() => requestShiftGate('none'))}
                />
                <Text style={s.sLabel}>소리/진동</Text>
                <SndVibSelector layout="row" sndVibMode={form.sndVibMode} setSndVibMode={form.setSndVibMode} />
              </>
            ) : (
              <>
                <TypeSelector typeId={form.typeId} onChange={form.handleTypeChange} gridRef={typeRef} />

                {/* 라벨 */}
                <Text style={s.sLabel}>알람내용</Text>
                <TextInput
                  ref={labelRef}
                  style={s.input}
                  value={form.label}
                  onChangeText={form.setLabel}
                  placeholder="이름을 입력하세요"
                  placeholderTextColor={C.txt3}
                  returnKeyType="done"
                />

                <TimePickerSection
                  hour={form.hour}
                  setHour={form.setHour}
                  min={form.min}
                  setMin={form.setMin}
                  sndVibMode={form.sndVibMode}
                  setSndVibMode={form.setSndVibMode}
                  pickerRef={timeRef}
                />

                <RepeatModeSelector
                  rm={form.rm}
                  setRm={form.setRm}
                  showRepeatConfig={form.showRepeatConfig}
                  setShowRepeatConfig={form.setShowRepeatConfig}
                  cycleRef={cycleRef}
                >
                  {/* 알약(요일/매월/매년/한 번)을 고르면 그 설정의 후속 입력이 바로 아래 이어지도록
                      이 슬롯에 모아둔다 — 요일 버튼, 시작 일자, 그리고 매월/매년 요약까지. */}
                  {form.rm === 'wdcustom' && (
                    <DayOfWeekSelector days={form.days} toggleDay={form.toggleDay} />
                  )}

                  {!isCycleRest && (
                    <DateSection
                      rm={form.rm}
                      lastDay={form.lastDay}
                      setLastDay={form.setLastDay}
                      lunar={form.lunar}
                      setLunar={form.setLunar}
                      setShowCal={form.setShowCal}
                      dateLabel={form.dateLabel}
                      dateLocked={form.dateLocked}
                      isLeapDay={form.isLeapDay}
                      lunarSolarPreview={form.lunarSolarPreview}
                    />
                  )}

                  {(form.rm === 'monthly' || form.rm === 'yearly') && (
                    <View style={s.repeatInfoBox}>
                      <Text style={s.repeatInfoText}>{form.repeatSummary}</Text>
                    </View>
                  )}
                </RepeatModeSelector>

                {isCycleRest && (
                  <CycleRestControls
                    rm={form.rm}
                    cd={form.cd}
                    setCd={form.setCd}
                    rd={form.rd}
                    setRd={form.setRd}
                    sd={form.sd}
                    setShowCal={form.setShowCal}
                    visible={form.showRepeatConfig}
                    // 달력이 떠 있는 동안엔 이 팝업을 닫을 방법이 없어 실제로는 showCal이 남지 않지만,
                    // 나중에 팝업을 프로그램적으로 닫는 경로가 생겨도 달력 상태가 stale로 남지 않게 함께 내린다
                    onClose={() => { form.setShowCal(false); form.setShowRepeatConfig(false); }}
                    presetRef={presetRef}
                    dateChipRef={dateChipRef}
                    closeBtnRef={closeBtnRef}
                    onPresetPick={onPresetPick}
                  >
                    {/* 시작일 달력은 반드시 이 팝업 <Modal>의 자식이어야 한다 —
                        형제로 두면 모달 두 개가 동시에 present되어 달력이 안 뜬다 */}
                    <DateModal
                      sd={form.sd}
                      setSd={form.setSd}
                      visible={form.showCal}
                      onClose={() => form.setShowCal(false)}
                    />
                  </CycleRestControls>
                )}
              </>
            )}

            {/* N일 주기/휴식은 시작일을 팝업 안에서 정하므로 요약도 여기(카드 아래) 그대로 둔다.
                요일/매월/매년/한 번의 시작 일자·요약은 알약행 바로 아래 슬롯으로 옮겼다. */}
            {!form.isPatternMode && isCycleRest && !form.showRepeatConfig && (
              <View style={s.repeatInfoBox}>
                <Text style={s.repeatInfoText}>{form.repeatSummary}</Text>
              </View>
            )}

            <View style={s.bottomActions}>
              <TouchableOpacity style={s.bottomCancelBtn} onPress={onCancel}>
                <Text style={s.bottomCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.bottomSaveBtn, !isEdit && !form.isDirty() && { opacity: 0.4 }]}
                disabled={!isEdit && !form.isDirty()}
                onPress={form.handleSubmit}
              >
                <Text style={s.bottomSaveText}>{isEdit ? '저장' : '추가'}</Text>
              </TouchableOpacity>
            </View>

            {onDelete && (
              <TouchableOpacity ref={deleteBtnRef} style={s.deleteBtn} onPress={onDelete}>
                <Text style={s.deleteBtnText}>🗑 이 알람 삭제</Text>
              </TouchableOpacity>
            )}

            {/* N일 주기/휴식은 시작일을 팝업 안에서만 고르므로 달력도 그 팝업 안에서 렌더한다(위 참고).
                여기 것은 그 외 경로(요일/매월/매년/한 번, 근무표 빌더)용 — 인스턴스가 겹치지 않게 배타적으로 마운트. */}
            {(form.isPatternMode || !isCycleRest) && (
              <DateModal
                sd={form.sd}
                setSd={form.setSd}
                visible={form.showCal}
                onClose={() => form.setShowCal(false)}
              />
            )}
          </View>
        </ScrollView>
      </View>
    );
  },
);
