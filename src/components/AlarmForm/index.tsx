import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Text } from '../common/AppText';
import { Alarm, ShiftPeriod, WorkSegment, SoundMode, VibMode } from '../../constants';
import { useColors } from '../../hooks/useTheme';
import { useAlarmFormState } from '../../hooks/useAlarmFormState';
import { TypeSelector } from './TypeSelector';
import { ShiftSelector } from './ShiftSelector';
import { WorkPatternBuilder } from './WorkPatternBuilder';
import { RotationWizard } from './RotationWizard';
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
  onCalendarClose?: () => void;
  typeRef?: React.Ref<View>;
  timeRef?: React.Ref<View>;
  labelRef?: React.Ref<TextInput>;
  cycleRef?: React.Ref<View>;
  presetRef?: React.Ref<View>;
  dateChipRef?: React.Ref<View>;
  infoBoxRef?: React.Ref<View>;
  addBtnRef?: React.Ref<View>;
  deleteBtnRef?: React.Ref<View>;
}

export const AlarmForm = forwardRef<AlarmFormHandle, Props>(
  function AlarmForm(
    { initial, onSubmit, onSubmitPattern, onCancel, onDelete, onTypeChange, onRmChange, onCalendarClose, typeRef, timeRef, labelRef, cycleRef, presetRef, dateChipRef, infoBoxRef, addBtnRef, deleteBtnRef },
    ref,
  ) {
    const form = useAlarmFormState(initial, onSubmit, onTypeChange, onRmChange, onCalendarClose, onSubmitPattern);
    const C = useColors();
    const s = makeStyles(C);
    const isCycleRest = form.rm === 'cycle' || form.rm === 'rest';
    const isEdit = initial.id != null;

    // 근무 시간대 게이트(해당없음 ↔ 선택함) 전환 — 폼이 더러워진 상태(뭔가 입력됨)일 때만 확인창을 띄우고,
    // 아니면 바로 초기화. 확인창은 여기(컴포넌트)에서 띄우고 실제 필드 리셋은 훅의 applyShiftGate가 담당.
    const requestShiftGate = (newShift: ShiftPeriod) => {
      const crossing = (form.shift === 'none') !== (newShift === 'none');
      if (crossing && form.isDirty()) {
        Alert.alert(
          '근무 시간대 전환',
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
          <TouchableOpacity ref={addBtnRef} style={s.topBarSaveBtn} onPress={form.handleSubmit}>
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
            {/* 근무 시간대 — 폼 전체를 가르는 게이트. 해당없음이면 아래는 기존 폼 그대로,
                실제 시간대를 고르면 블록 빌더(로테이션)로 전체가 바뀐다. */}
            <Text style={[s.sLabel, { marginTop: 4 }]}>근무 시간대</Text>
            {form.isPatternMode ? (
              <View style={s.wpGateBanner}>
                <Text style={s.wpGateBannerText}>근무 시간대 알람 · 아래 블록에서 조정</Text>
                <TouchableOpacity style={s.wpGateSwitchBtn} onPress={() => requestShiftGate('none')}>
                  <Text style={s.wpGateSwitchText}>일반 알람으로 전환</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ShiftSelector
                shift={form.shift}
                onChange={requestShiftGate}
                shiftCustom={form.shiftCustom}
                onCustomChange={form.handleShiftCustomChange}
              />
            )}

            {form.isPatternMode ? (
              <>
                <WorkPatternBuilder
                  blocks={form.blocks}
                  setBlocks={form.setBlocks}
                  sd={form.sd}
                  setShowCal={form.setShowCal}
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

                <RepeatModeSelector rm={form.rm} setRm={form.setRm} cycleRef={cycleRef} />

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

                {form.rm === 'wdcustom' && (
                  <DayOfWeekSelector days={form.days} setDays={form.setDays} toggleDay={form.toggleDay} />
                )}

                {isCycleRest && (
                  <CycleRestControls
                    rm={form.rm}
                    cd={form.cd}
                    setCd={form.setCd}
                    rd={form.rd}
                    setRd={form.setRd}
                    sd={form.sd}
                    setShowCal={form.setShowCal}
                    presetRef={presetRef}
                    dateChipRef={dateChipRef}
                    infoBoxRef={infoBoxRef}
                  />
                )}
              </>
            )}

            {!form.isPatternMode && (form.rm === 'monthly' || form.rm === 'yearly') && (
              <View style={s.repeatInfoBox}>
                <Text style={s.repeatInfoText}>{form.repeatSummary}</Text>
              </View>
            )}

            <View style={s.bottomActions}>
              <TouchableOpacity style={s.bottomCancelBtn} onPress={onCancel}>
                <Text style={s.bottomCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.bottomSaveBtn} onPress={form.handleSubmit}>
                <Text style={s.bottomSaveText}>{isEdit ? '저장' : '추가'}</Text>
              </TouchableOpacity>
            </View>

            {onDelete && (
              <TouchableOpacity ref={deleteBtnRef} style={s.deleteBtn} onPress={onDelete}>
                <Text style={s.deleteBtnText}>🗑 이 알람 삭제</Text>
              </TouchableOpacity>
            )}

            <DateModal
              sd={form.sd}
              setSd={form.setSd}
              visible={form.showCal}
              onClose={() => form.setShowCal(false)}
            />
          </View>
        </ScrollView>
      </View>
    );
  },
);
