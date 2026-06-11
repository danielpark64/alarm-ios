import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { CalendarPicker } from '../common/CalendarPicker';
import { s } from './styles';

interface Props {
  rm: string;
  sd: string;
  setSd: (v: string) => void;
  lastDay: boolean;
  setLastDay: (fn: (v: boolean) => boolean) => void;
  showCal: boolean;
  setShowCal: (v: boolean) => void;
  dateLabel: string;
  dateLocked: boolean;
  isLeapDay: boolean;
}

export function DateSection({
  rm, sd, setSd, lastDay, setLastDay, showCal, setShowCal, dateLabel, dateLocked, isLeapDay,
}: Props) {
  return (
    <>
      <Text style={s.sLabel}>시작 일자</Text>
      <View style={s.dateRow}>
        <TouchableOpacity
          style={[s.dateBtn, dateLocked && s.dateBtnDim]}
          onPress={() => !dateLocked && setShowCal(true)}
          disabled={dateLocked}
        >
          <Text style={s.dateBtnIcon}>📅</Text>
          <Text style={s.dateBtnLabel}>
            {dateLocked ? '매월 말일' : dateLabel}
          </Text>
          {!dateLocked && <Text style={s.dateBtnArrow}>▼</Text>}
        </TouchableOpacity>
        {rm === 'monthly' && (
          <TouchableOpacity
            style={[s.lastDayBtn, lastDay && s.lastDayBtnActive]}
            onPress={() => setLastDay(v => !v)}
          >
            <Text style={[s.lastDayText, lastDay && { color: '#fff' }]}>말일</Text>
          </TouchableOpacity>
        )}
      </View>
      {rm === 'yearly' && isLeapDay && (
        <Text style={s.leapNotice}>⚠️ 윤년(4년마다)에만 울림</Text>
      )}
      <Modal visible={showCal} transparent animationType="fade">
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={s.modalContent}>
            <CalendarPicker
              value={sd}
              onChange={setSd}
              onClose={() => setShowCal(false)}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
