import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Alarm } from '../../constants';
import { useColors } from '../../hooks/useTheme';
import { useAlarmFormState } from '../../hooks/useAlarmFormState';
import { TypeSelector } from './TypeSelector';
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
  scrollTargetIntoView: (target: React.RefObject<any>) => void;
}

interface Props {
  initial: Partial<Alarm>;
  onSubmit: (data: Omit<Alarm, 'id' | 'active'>) => void;
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
    { initial, onSubmit, onCancel, onDelete, onTypeChange, onRmChange, onCalendarClose, typeRef, timeRef, labelRef, cycleRef, presetRef, dateChipRef, infoBoxRef, addBtnRef, deleteBtnRef },
    ref,
  ) {
    const form = useAlarmFormState(initial, onSubmit, onTypeChange, onRmChange, onCalendarClose);
    const C = useColors();
    const s = makeStyles(C);
    const isCycleRest = form.rm === 'cycle' || form.rm === 'rest';
    const isEdit = initial.id != null;
    const scrollRef = useRef<ScrollView>(null);
    const contentRef = useRef<View>(null);

    useImperativeHandle(ref, () => ({
      submit: form.submit,
      isDirty: form.isDirty,
      scrollTargetIntoView: (target) => {
        target.current?.measureLayout(
          contentRef.current as any,
          (_x: number, y: number) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true }),
          () => {},
        );
      },
    }), [form.submit, form.isDirty]);

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
            <TypeSelector typeId={form.typeId} onChange={form.handleTypeChange} gridRef={typeRef} />

            <TimePickerSection
              hour={form.hour}
              setHour={form.setHour}
              min={form.min}
              setMin={form.setMin}
              sndVibMode={form.sndVibMode}
              setSndVibMode={form.setSndVibMode}
              pickerRef={timeRef}
            />

            {/* 라벨 */}
            <Text style={s.sLabel}>라벨</Text>
            <TextInput
              ref={labelRef}
              style={s.input}
              value={form.label}
              onChangeText={form.setLabel}
              placeholder="이름을 입력하세요"
              placeholderTextColor={C.txt3}
              returnKeyType="done"
            />

            <RepeatModeSelector rm={form.rm} setRm={form.setRm} cycleRef={cycleRef} />

            {!isCycleRest && (
              <DateSection
                rm={form.rm}
                lastDay={form.lastDay}
                setLastDay={form.setLastDay}
                setShowCal={form.setShowCal}
                dateLabel={form.dateLabel}
                dateLocked={form.dateLocked}
                isLeapDay={form.isLeapDay}
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

            {(form.rm === 'monthly' || form.rm === 'yearly') && (
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
