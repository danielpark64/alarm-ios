import React, { forwardRef, useImperativeHandle } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Alarm } from '../../constants';
import { useAlarmFormState } from '../../hooks/useAlarmFormState';
import { TypeSelector } from './TypeSelector';
import { DateSection } from './DateSection';
import { TimePickerSection } from './TimePickerSection';
import { RepeatModeSelector } from './RepeatModeSelector';
import { DayOfWeekSelector } from './DayOfWeekSelector';
import { CycleRestControls } from './CycleRestControls';
import { s } from './styles';

export interface AlarmFormHandle {
  submit: () => void;
  isDirty: () => boolean;
}

interface Props {
  initial: Partial<Alarm>;
  onSubmit: (data: Omit<Alarm, 'id' | 'active'>) => void;
  onCancel: () => void;
  submitLabel?: string;
  onTypeChange?: (typeId: string) => void;
}

export const AlarmForm = forwardRef<AlarmFormHandle, Props>(
  function AlarmForm(
    { initial, onSubmit, onCancel, submitLabel = '⏰ 알람 추가', onTypeChange },
    ref,
  ) {
    const form = useAlarmFormState(initial, onSubmit, onTypeChange);

    useImperativeHandle(ref, () => ({
      submit: form.submit,
      isDirty: form.isDirty,
    }), [form.submit, form.isDirty]);

    return (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <TypeSelector typeId={form.typeId} onChange={form.handleTypeChange} />

        <DateSection
          rm={form.rm}
          sd={form.sd}
          setSd={form.setSd}
          lastDay={form.lastDay}
          setLastDay={form.setLastDay}
          showCal={form.showCal}
          setShowCal={form.setShowCal}
          dateLabel={form.dateLabel}
          dateLocked={form.dateLocked}
          isLeapDay={form.isLeapDay}
        />

        <TimePickerSection
          hour={form.hour}
          setHour={form.setHour}
          min={form.min}
          setMin={form.setMin}
          sndVibMode={form.sndVibMode}
          setSndVibMode={form.setSndVibMode}
        />

        {/* 라벨 */}
        <Text style={s.sLabel}>라벨</Text>
        <TextInput
          style={s.input}
          value={form.label}
          onChangeText={form.setLabel}
          placeholder="이름을 입력하세요"
          placeholderTextColor="#888"
          returnKeyType="done"
        />

        <RepeatModeSelector rm={form.rm} setRm={form.setRm} />

        {form.rm === 'wdcustom' && (
          <DayOfWeekSelector days={form.days} setDays={form.setDays} toggleDay={form.toggleDay} />
        )}

        {(form.rm === 'cycle' || form.rm === 'rest') && (
          <CycleRestControls rm={form.rm} cd={form.cd} setCd={form.setCd} rd={form.rd} setRd={form.setRd} />
        )}

        {(form.rm === 'monthly' || form.rm === 'yearly') && (
          <View style={s.repeatInfoBox}>
            <Text style={s.repeatInfoText}>{form.repeatSummary}</Text>
          </View>
        )}

        {/* 저장/취소 */}
        <View style={s.btnRow}>
          <TouchableOpacity style={s.cancelBtn} onPress={onCancel}>
            <Text style={s.cancelBtnText}>취소</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.submitBtn} onPress={form.handleSubmit}>
            <Text style={s.submitBtnText}>{submitLabel}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  },
);
