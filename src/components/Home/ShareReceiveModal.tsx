import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, TouchableOpacity, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from '../common/AppText';
import { useColors } from '../../hooks/useTheme';
import { useT } from '../../i18n';
import { MONTH_KEYS } from '../../constants';
import { Palette } from '../../constants/colors';
import { AUTO_COLORS, SENDER_NAME_MAX, dateRangeText, type SharedPerson, type ShiftData } from '../../utils/shiftShareLink';

// 근무표 받기 팝업(시안 ④) — 기간 · 이름(비우면 공유n) · 색(겹치지 않게 미리 골라 둠, 눌러서 바꾸기).
// 같은 사람이 더 새것을 보내면 "○○의 근무표를 새것으로 바꿀까요?"(이름·색은 그대로).
export type ReceiveDraft = {
  sender: string; body: string; data: ShiftData;
  senderName: string; // 보낸 사람이 링크에 넣은 이름('' = 없음) — 이름 칸 기본값
  update: SharedPerson | null; seq: number; color: string;
};

export { dateRangeText }; // 기간 글은 utils/shiftShareLink(보내기 글과 공용)

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
  useEffect(() => { if (draft) { setName(draft.senderName || ''); setColor(draft.color); } }, [draft]);
  // ⚠️ iOS는 이미 떠 있는 창(공유 탭 편집 창·지우기 확인 Alert·저장할지 묻는 Alert 등) 위로 두 번째 Modal을 조용히 무시한다.
  //    visible을 true로 고정하면 그 뒤로 다시 띄울 기회가 없어 앱을 다시 켤 때까지 안 뜬다(2026-11-22 시뮬 재현).
  //    그래서 잠깐 기다렸다 열고(앞 창이 닫히는 시간), onShow가 안 오면 닫았다 다시 연다 — 실제로 뜰 때까지.
  const [open, setOpen] = useState(false);
  const shownRef = useRef(false);
  useEffect(() => {
    shownRef.current = false;
    setOpen(false);
    if (!draft) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tryOpen = () => {
      if (!alive || shownRef.current) return;
      setOpen(true);
      if (Platform.OS !== 'ios') return; // Android는 Dialog로 쌓여 항상 뜬다
      timer = setTimeout(() => {
        if (!alive || shownRef.current) return;
        setOpen(false);                       // 못 떴다 — 닫고 다시
        timer = setTimeout(tryOpen, 300);
      }, 1200);
    };
    timer = setTimeout(tryOpen, 450);
    return () => { alive = false; clearTimeout(timer); };
  }, [draft]);
  if (!draft) return null;
  const old = draft.update;
  const oldName = old ? (old.name || t('공유{n}', { n: old.seq })) : '';
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onCancel} onShow={() => { shownRef.current = true; }}>
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

/** 처음 보낼 때 한 번만 묻는 "내 이름"(1.6.1~) — 받은 사람 페이지·앱에 "○○님의 근무표"로 보인다. 건너뛰면 이름 없이 보낸다.
 *  바꾸기는 설정 [근무표 공유]에서. 공유 창은 이 창이 닫힌 뒤 훅(useShiftShare)이 연다. */
export function ShareNameModal({ visible, onDone, onCancel }: { visible: boolean; onDone: (name: string) => void; onCancel: () => void }) {
  const C = useColors();
  const { t } = useT();
  const s = makeStyles(C);
  const [name, setName] = useState('');
  useEffect(() => { if (visible) setName(''); }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.back}>
          <View style={s.card}>
            <Text style={s.title}>{t('보낼 때 내 이름')}</Text>
            <Text style={s.sub}>{t('받은 사람에게 "{name}님의 근무표"로 보여요. 처음 한 번만 물어요 — 설정에서 바꿀 수 있어요.', { name: name.trim() || t('나') })}</Text>
            <TextInput style={s.input} value={name} onChangeText={setName} maxLength={SENDER_NAME_MAX} autoFocus
              placeholder={t('예: 민수')} placeholderTextColor={C.txt3} returnKeyType="done"
              onSubmitEditing={() => onDone(name)} accessibilityLabel={t('보낼 때 내 이름')} />
            <View style={s.acts}>
              <TouchableOpacity style={s.btn} onPress={() => onDone('')}><Text style={s.btnText}>{t('건너뛰기')}</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.btnP]} onPress={() => onDone(name)}>
                <Text style={[s.btnText, { color: '#fff' }]}>{t('보내기')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
