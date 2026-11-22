import React, { useEffect, useState } from 'react';
import { Modal, View, TouchableOpacity, ScrollView, Switch, Platform } from 'react-native';
import { Text } from '../common/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../hooks/useTheme';
import { makeStyles } from './styles';
import { useT } from '../../i18n';
import { ALARM_TONES, ToneId, toneLabel } from '../../constants';
import { previewTone, stopTonePreview } from '../../utils/tonePreview';

interface Props {
  tone: ToneId;
  setTone: (t: ToneId) => void;
  crescendo: boolean;
  setCrescendo: (v: boolean) => void;
  disabled: boolean; // '진동만'이면 흐리게(누를 수 없게)
}

// 알람 소리 고르기(2026-11-23, 시안 docs/시안/알람소리-시안.html) — 폼에는 "🎵 알람 소리 · 이름 ›" 한 줄,
// 누르면 아래에서 올라오는 시트. 줄을 누르면 고르면서 3초 미리듣기(시트를 닫거나 다른 줄을 누르면 멈춘다).
// '점점 크게 울리기'는 Android만 — iOS는 시스템이 알람 음량을 정해서 앱이 조절할 수 없다.
export function ToneSelector({ tone, setTone, crescendo, setCrescendo, disabled }: Props) {
  const C = useColors();
  const s = makeStyles(C);
  const { t } = useT();
  const [open, setOpen] = useState(false);
  // 시트가 화면 맨 아래에 붙으므로 Android 내비게이션 바·iPhone 홈 막대에 [닫기]가 가리지 않게
  const insets = useSafeAreaInsets();

  const close = () => { stopTonePreview(); setOpen(false); };
  // 폼이 사라질 때(저장·취소) 미리듣기가 남아 울리지 않게
  useEffect(() => () => stopTonePreview(), []);

  const pick = (id: ToneId) => {
    setTone(id);
    previewTone(id);
  };

  return (
    <>
      <TouchableOpacity
        style={[s.toneRow, disabled && { opacity: 0.4 }]}
        disabled={disabled}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
      >
        <Text style={s.toneRowLabel}>🎵 {t('알람 소리')}</Text>
        <Text style={s.toneRowValue} numberOfLines={1}>{t(toneLabel(tone))} ›</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <View style={s.sheetOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={close} />
          <View style={[s.sheet, { paddingBottom: 16 + insets.bottom }]}>
            <View style={s.sheetGrab} />
            <Text style={s.wpMenuTitle}>{t('알람 소리')}</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {ALARM_TONES.map(x => {
                const sel = x.id === tone;
                return (
                  <TouchableOpacity key={x.id} style={[s.toneItem, sel && s.toneItemSel]} onPress={() => pick(x.id)}>
                    <Text style={[s.toneItemText, sel && s.toneItemTextSel]}>{t(x.label)}</Text>
                    <Text style={sel ? s.toneCheck : s.tonePlay}>{sel ? '✓' : '▶'}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Text style={s.toneHint}>{t('줄을 누르면 고르면서 3초 들려줘요.')}</Text>
            {Platform.OS === 'android' && (
              <View style={s.toneCresRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.toneItemText}>{t('점점 크게 울리기')}</Text>
                  <Text style={s.toneHint}>{t('작게 시작해 20초 동안 커져요.')}</Text>
                </View>
                <Switch
                  value={crescendo}
                  onValueChange={setCrescendo}
                  trackColor={{ false: C.border2, true: C.accent2 }}
                />
              </View>
            )}
            <TouchableOpacity style={s.wpMenuCancelBtn} onPress={close}>
              <Text style={s.wpMenuCancelText}>{t('닫기')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
