import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Modal, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from '../common/AppText';
import { useColors } from '../../hooks/useTheme';
import { useT } from '../../i18n';
import { MONTH_KEYS, DAYS } from '../../constants';
import { Palette } from '../../constants/colors';
import { personName, type SharedPersonView } from '../../hooks/useShiftShare';
import { MY_COLOR, shiftOn } from '../../utils/shiftShareLink';
import { ColorPicker } from './ShareReceiveModal';

// 근무표 공유 창 줄(시안 ①②) — 전체 · 나 · 받은 사람들(받은 순서), 가로 스크롤 칩. 오른쪽 [보내기].
// 받은 사람 칩을 길게 누르면 이름·색 바꾸기, 지우기.
export type ShareWin = 'me' | 'all' | string; // string = 받은 사람 id

export const TOGETHER_GREEN = '#2ECC9A';

export function ShareBar({ win, onWin, people, onSend, onEdit, onRemove }: {
  win: ShareWin; onWin: (w: ShareWin) => void; people: SharedPersonView[]; onSend: () => void;
  onEdit: (id: string, patch: { name?: string; color?: string }) => void; onRemove: (id: string) => void;
}) {
  const C = useColors();
  const { t } = useT();
  const s = makeStyles(C);
  const [editing, setEditing] = useState<SharedPersonView | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const openEdit = (p: SharedPersonView) => { setEditing(p); setName(p.name); setColor(p.color); };
  const chip = (key: ShareWin, label: string, dot?: string, onLong?: () => void) => {
    const on = win === key;
    return (
      <TouchableOpacity key={key} style={[s.tab, on && s.tabOn]} onPress={() => onWin(key)} onLongPress={onLong} delayLongPress={400}
        accessibilityRole="tab" accessibilityState={{ selected: on }}>
        {!!dot && <View style={[s.dot, { backgroundColor: dot }]} />}
        <Text style={[s.tabText, on && s.tabTextOn]} numberOfLines={1}>{label}</Text>
      </TouchableOpacity>
    );
  };
  return (
    <View style={s.row}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs} style={{ flex: 1 }}>
        {people.length > 0 && chip('all', t('전체'))}
        {chip('me', t('나'), MY_COLOR)}
        {people.map(p => chip(p.id, personName(p, t), p.color, () => openEdit(p)))}
        <TouchableOpacity style={s.howBtn} onPress={() => Alert.alert(t('근무표 받는 법'),
          t('가족·친구가 교대알람에서 [보내기]로 보낸 링크를 누르면 여기에 그 사람 창이 생겨요. 받은 근무표는 보기만 하고 알람은 울리지 않아요.\n\n창을 길게 누르면 이름·색을 바꾸거나 지울 수 있어요.'))}>
          <Text style={s.howText}>{t('+ 받는 법')}</Text>
        </TouchableOpacity>
      </ScrollView>
      <TouchableOpacity style={s.send} onPress={onSend} accessibilityRole="button">
        <Text style={s.sendText}>{t('보내기')}</Text>
      </TouchableOpacity>

      <Modal visible={editing != null} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.back}>
            <View style={s.card}>
              <Text style={s.title}>{editing ? personName(editing, t) : ''}</Text>
              <Text style={s.lbl}>{t('이름')}</Text>
              <TextInput style={s.input} value={name} onChangeText={setName} maxLength={20}
                placeholder={editing ? t('공유{n}', { n: editing.seq }) : ''} placeholderTextColor={C.txt3} />
              <Text style={s.lbl}>{t('색')}</Text>
              <ColorPicker value={color} onChange={setColor} C={C} />
              <View style={s.acts}>
                <TouchableOpacity style={s.btn} onPress={() => setEditing(null)}><Text style={s.btnText}>{t('취소')}</Text></TouchableOpacity>
                <TouchableOpacity style={[s.btn, s.btnP]} onPress={() => { if (editing) onEdit(editing.id, { name, color }); setEditing(null); }}>
                  <Text style={[s.btnText, { color: '#fff' }]}>{t('저장')}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={s.del} onPress={() => {
                const p = editing; if (!p) return;
                Alert.alert(t('지우기'), t('{name}의 근무표를 지울까요?', { name: personName(p, t) }), [
                  { text: t('취소'), style: 'cancel' },
                  { text: t('지우기'), style: 'destructive', onPress: () => { setEditing(null); if (win === p.id) onWin('me'); onRemove(p.id); } },
                ]);
              }}>
                <Text style={s.delText}>{t('이 근무표 지우기')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

/** 사람 창 위 줄 "○○의 근무표 · 11월 22일 받음" / 전체 창 [다 같이 쉬는 날 보기] 켜고 끄기 */
export function ShareSubRow({ win, people, together, onTogether }: {
  win: ShareWin; people: SharedPersonView[]; together: boolean; onTogether: (v: boolean) => void;
}) {
  const C = useColors();
  const { t } = useT();
  const s = makeStyles(C);
  if (win === 'me') return null;
  if (win === 'all') {
    const n = 1 + people.filter(p => p.visible).length;
    return (
      <TouchableOpacity style={[s.toggle, together && s.toggleOn]} onPress={() => onTogether(!together)}
        accessibilityRole="switch" accessibilityState={{ checked: together }}>
        <View style={[s.sw, together && s.swOn]}><View style={[s.knob, together && s.knobOn]} /></View>
        <Text style={[s.toggleText, together && { color: TOGETHER_GREEN }]}>{t('다 같이 쉬는 날 보기')}</Text>
        <Text style={s.count}>{t('{n}명 보는 중', { n })}</Text>
      </TouchableOpacity>
    );
  }
  const p = people.find(x => x.id === win);
  if (!p) return null;
  const d = new Date(p.receivedAt);
  return (
    <View style={s.sub}>
      <View style={[s.dot, { backgroundColor: p.color }]} />
      <Text style={s.subText} numberOfLines={1}>
        {t('{name}의 근무표 · {date} 받음', { name: personName(p, t), date: t('{month} {d}일', { month: t(MONTH_KEYS[d.getMonth()]), d: d.getDate() }) })}
      </Text>
    </View>
  );
}

/** 전체·사람 창에서 날짜를 누르면 — 그날 각자 근무 목록. 전체 창은 받은 사람 옆 [보기]로 전체 창에 넣을지 고른다(시안 ③) */
export type SheetRow = { id: string; name: string; color: string; label: string | null; off: boolean; visible?: boolean };
export function ShareDaySheet({ date, rows, onClose, onToggle }: {
  date: string | null; rows: SheetRow[]; onClose: () => void; onToggle?: (id: string, v: boolean) => void;
}) {
  const C = useColors();
  const { t } = useT();
  const s = makeStyles(C);
  const d = date ? new Date(date) : null;
  return (
    <Modal visible={date != null} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.sheetBack} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.sheet} onPress={() => {}}>
          {d && <Text style={s.sheetTitle}>{t('{month} {d}일 ({dow})', { month: t(MONTH_KEYS[d.getMonth()]), d: d.getDate(), dow: t(DAYS[(d.getDay() + 6) % 7]) })}</Text>}
          {rows.map(r => (
            <View key={r.id} style={s.sheetRow}>
              <View style={[s.dot, { backgroundColor: r.color, width: 10, height: 10, borderRadius: 5 }]} />
              <Text style={s.sheetName} numberOfLines={1}>{r.name}</Text>
              <Text style={[s.sheetLabel, r.off && { color: C.offFg }, r.label == null && { color: C.txt3 }]} numberOfLines={1}>
                {r.label ?? t('근무표 없음')}
              </Text>
              {onToggle && r.visible != null && (
                <TouchableOpacity style={[s.viewBtn, r.visible && s.viewBtnOn]} onPress={() => onToggle(r.id, !r.visible)}
                  accessibilityRole="switch" accessibilityState={{ checked: r.visible }}>
                  <Text style={[s.viewBtnText, r.visible && { color: '#fff' }]}>{t('보기')}</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity style={s.close} onPress={onClose}><Text style={s.closeText}>{t('닫기')}</Text></TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

/** 받은 사람의 그날 근무 → 시트 한 줄 */
export function rowFor(p: SharedPersonView, ds: string, t: (k: string, v?: any) => string): SheetRow {
  const [y, m, d] = ds.split('-').map(Number);
  const sh = shiftOn(p.data, new Date(y, m - 1, d));
  return { id: p.id, name: personName(p, t), color: p.color, label: sh ? sh.label : null, off: !!sh?.off, visible: p.visible };
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    tabs: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingRight: 6 },
    tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border2, maxWidth: 140 },
    tabOn: { backgroundColor: C.txt, borderColor: C.txt },
    tabText: { fontSize: 13, fontWeight: '700', color: C.txt2 },
    tabTextOn: { color: C.bg },
    dot: { width: 8, height: 8, borderRadius: 4 },
    howBtn: { paddingHorizontal: 10, paddingVertical: 6 },
    howText: { fontSize: 12.5, fontWeight: '700', color: C.txt3 },
    send: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: C.accent2 },
    sendText: { fontSize: 13, fontWeight: '800', color: '#fff' },
    sub: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, marginBottom: 6 },
    subText: { fontSize: 12.5, fontWeight: '700', color: C.txt2, flexShrink: 1 },
    toggle: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1.5, borderColor: C.border2, backgroundColor: C.bg3, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 6 },
    toggleOn: { borderColor: TOGETHER_GREEN, backgroundColor: 'rgba(46,204,154,0.14)' },
    sw: { width: 32, height: 19, borderRadius: 10, backgroundColor: C.border2, justifyContent: 'center', paddingHorizontal: 2 },
    swOn: { backgroundColor: TOGETHER_GREEN },
    knob: { width: 15, height: 15, borderRadius: 8, backgroundColor: '#fff' },
    knobOn: { alignSelf: 'flex-end' },
    toggleText: { fontSize: 13, fontWeight: '800', color: C.txt2 },
    count: { marginLeft: 'auto', fontSize: 12, color: C.txt3, fontWeight: '600' },
    back: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
    card: { backgroundColor: C.bg2, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.border },
    title: { fontSize: 18, fontWeight: '800', color: C.txt, marginBottom: 10 },
    lbl: { fontSize: 12, fontWeight: '700', color: C.txt3, marginBottom: 6, marginTop: 4 },
    input: { borderRadius: 10, borderWidth: 1, borderColor: C.border2, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, color: C.txt, backgroundColor: C.bg3, marginBottom: 12 },
    acts: { flexDirection: 'row', gap: 8, marginTop: 18 },
    btn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: C.bg3 },
    btnP: { backgroundColor: C.accent2 },
    btnText: { fontSize: 15, fontWeight: '800', color: C.txt2 },
    del: { alignItems: 'center', paddingVertical: 12, marginTop: 6 },
    delText: { fontSize: 13.5, fontWeight: '700', color: '#e5534b' },
    sheetBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: C.bg2, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 34, borderTopWidth: 1, borderColor: C.border },
    sheetTitle: { fontSize: 17, fontWeight: '800', color: C.txt, marginBottom: 8 },
    sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.border },
    sheetName: { flex: 1, fontSize: 15, fontWeight: '700', color: C.txt },
    sheetLabel: { fontSize: 14.5, fontWeight: '800', color: C.txt2, maxWidth: 120 },
    viewBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1.3, borderColor: C.border2 },
    viewBtnOn: { backgroundColor: C.accent2, borderColor: C.accent2 },
    viewBtnText: { fontSize: 12.5, fontWeight: '800', color: C.txt3 },
    close: { marginTop: 14, paddingVertical: 12, borderRadius: 14, alignItems: 'center', backgroundColor: 'rgba(162,155,254,0.14)' },
    closeText: { fontSize: 15, fontWeight: '700', color: C.accent },
  });
}
