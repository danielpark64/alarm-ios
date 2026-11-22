import React, { useEffect, useState } from 'react';
import { Modal, View, TouchableOpacity, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from '../common/AppText';
import { useColors } from '../../hooks/useTheme';
import { useT } from '../../i18n';
import { MONTH_KEYS } from '../../constants';
import { Palette } from '../../constants/colors';
import { AUTO_COLORS, type SharedPerson, type ShiftData } from '../../utils/shiftShareLink';

// 근무표 받기 팝업(시안 ④) — 기간 · 이름(비우면 공유n) · 색(겹치지 않게 미리 골라 둠, 눌러서 바꾸기).
// 같은 사람이 더 새것을 보내면 "○○의 근무표를 새것으로 바꿀까요?"(이름·색은 그대로).
export type ReceiveDraft = {
  sender: string; body: string; data: ShiftData;
  update: SharedPerson | null; seq: number; color: string;
};

export function dateRangeText(data: ShiftData, t: (k: string, p?: any) => string): string {
  const [y, m, d] = data.from.split('-').map(Number);
  const a = new Date(y, m - 1, d);
  const b = new Date(y, m - 1, d + data.days.length - 1);
  const md = (x: Date) => t('{month} {d}일', { month: t(MONTH_KEYS[x.getMonth()]), d: x.getDate() });
  const right = b.getFullYear() !== a.getFullYear() ? `${t('{year}년', { year: b.getFullYear() })} ${md(b)}` : md(b);
  return `${md(a)} ~ ${right}`;
}

export function ColorPicker({ value, onChange, C }: { value: string; onChange: (c: string) => void; C: Palette }) {
  const { t } = useT();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {AUTO_COLORS.map(c => (
        <TouchableOpacity key={c} onPress={() => onChange(c)} accessibilityRole="button" accessibilityLabel={t('색')}
          accessibilityState={{ selected: c === value }}
          style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: c === value ? 3 : 0, borderColor: C.txt }} />
      ))}
    </View>
  );
}

export function ShareReceiveModal({ draft, onCancel, onAccept }: {
  draft: ReceiveDraft | null; onCancel: () => void; onAccept: (name: string, color: string) => void;
}) {
  const C = useColors();
  const { t } = useT();
  const s = makeStyles(C);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#F0A35E');
  useEffect(() => { if (draft) { setName(''); setColor(draft.color); } }, [draft]);
  if (!draft) return null;
  const old = draft.update;
  const oldName = old ? (old.name || t('공유{n}', { n: old.seq })) : '';
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.back}>
          <View style={s.card}>
            <Text style={s.title}>{old ? t('{name}의 근무표를 새것으로 바꿀까요?', { name: oldName }) : t('근무표를 받을까요?')}</Text>
            <Text style={s.sub}>{t('{range} · 보기만 하고 알람은 울리지 않아요', { range: dateRangeText(draft.data, t) })}</Text>
            {!old && (
              <>
                <Text style={s.lbl}>{t('이름 (비우면 공유{n})', { n: draft.seq })}</Text>
                <TextInput style={s.input} value={name} onChangeText={setName} maxLength={20}
                  placeholder={t('공유{n}', { n: draft.seq })} placeholderTextColor={C.txt3} returnKeyType="done" />
                <Text style={s.lbl}>{t('색 (자동으로 골랐어요 · 눌러서 바꾸기)')}</Text>
                <ColorPicker value={color} onChange={setColor} C={C} />
              </>
            )}
            <View style={s.acts}>
              <TouchableOpacity style={s.btn} onPress={onCancel}><Text style={s.btnText}>{t('취소')}</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.btnP]} onPress={() => onAccept(name, color)}>
                <Text style={[s.btnText, { color: '#fff' }]}>{old ? t('바꾸기') : t('받기')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    back: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
    card: { backgroundColor: C.bg2, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.border },
    title: { fontSize: 18, fontWeight: '800', color: C.txt, marginBottom: 6 },
    sub: { fontSize: 13, color: C.txt2, marginBottom: 14, lineHeight: 19 },
    lbl: { fontSize: 12, fontWeight: '700', color: C.txt3, marginBottom: 6, marginTop: 4 },
    input: { borderRadius: 10, borderWidth: 1, borderColor: C.border2, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, color: C.txt, backgroundColor: C.bg3, marginBottom: 12 },
    acts: { flexDirection: 'row', gap: 8, marginTop: 18 },
    btn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: C.bg3 },
    btnP: { backgroundColor: C.accent2 },
    btnText: { fontSize: 15, fontWeight: '800', color: C.txt2 },
  });
}
