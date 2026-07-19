import React from 'react';
import { View, ScrollView, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { Text } from '../common/AppText';
import Slider from '@react-native-community/slider';
import Constants from 'expo-constants';
import { Palette } from '../../constants/colors';
import { useColors, useThemeSetting, ThemeName } from '../../hooks/useTheme';
import { useAlarmDefaults } from '../../hooks/useAlarmDefaults';
import { useFontScale, FontScaleName } from '../../hooks/useFontScale';

const FONT_SCALES: { id: FontScaleName; label: string }[] = [
  { id: 'small',  label: '작게' },
  { id: 'medium', label: '보통' },
  { id: 'large',  label: '크게' },
];

interface Props {
  onStartTutorial?: () => void;
  onStartRotationTutorial?: () => void;
  onOpenHelp?: () => void;
}

export function SettingsView({ onStartTutorial, onStartRotationTutorial, onOpenHelp }: Props) {
  const C = useColors();
  const s = makeStyles(C);
  const { theme, setTheme } = useThemeSetting();
  const { fontScale, setFontScale } = useFontScale();
  const { defaults, setDefaults } = useAlarmDefaults();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={s.scrollC} showsVerticalScrollIndicator={false}>
      <Text style={s.sectionLabel}>화면</Text>
      <View style={s.card}>
        <View style={s.row}>
          <Text style={s.rowLabel}>글자크기</Text>
          <View style={s.segment}>
            {FONT_SCALES.map(f => (
              <TouchableOpacity
                key={f.id}
                style={[s.segBtn, fontScale === f.id && s.segBtnActive]}
                onPress={() => setFontScale(f.id)}
              >
                <Text style={[s.segBtnText, fontScale === f.id && s.segBtnTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={s.divider} />
        <View style={s.row}>
          <Text style={s.rowLabel}>테마</Text>
          <View style={s.segment}>
            {(['dark', 'light'] as ThemeName[]).map(t => (
              <TouchableOpacity
                key={t}
                style={[s.segBtn, theme === t && s.segBtnActive]}
                onPress={() => setTheme(t)}
              >
                <Text style={[s.segBtnText, theme === t && s.segBtnTextActive]}>{t === 'dark' ? '다크' : '라이트'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {Platform.OS === 'android' && (
        <>
          <Text style={s.sectionLabel}>알람 기본값</Text>
          <View style={s.card}>
            <View style={{ paddingVertical: 13, paddingHorizontal: 14 }}>
              <View style={s.volumeHeadRow}>
                <Text style={s.rowLabel}>알람 볼륨</Text>
                <View style={s.androidBadge}><Text style={s.androidBadgeText}>Android</Text></View>
              </View>
              <View style={s.volumeRow}>
                <Text style={s.volumeIcon}>🔈</Text>
                <Slider
                  style={{ flex: 1 }}
                  minimumValue={0.1}
                  maximumValue={1}
                  step={0.05}
                  value={defaults.volume}
                  minimumTrackTintColor={C.accent2}
                  maximumTrackTintColor={C.bg3}
                  thumbTintColor={C.accent}
                  onSlidingComplete={v => setDefaults({ volume: v })}
                />
                <Text style={s.volumeIcon}>🔊</Text>
              </View>
            </View>
          </View>
        </>
      )}

      <TouchableOpacity
        style={s.helpBanner}
        activeOpacity={0.8}
        onPress={onOpenHelp}
      >
        <View style={s.tutorialIcon}><Text style={s.tutorialIconT}>📖</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.tutorialTitle}>사용법 안내</Text>
          <Text style={s.tutorialSub}>기본 사용법과 잘 안 보이는 기능까지 알려드려요</Text>
        </View>
        <Text style={s.tutorialArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={s.tutorialBanner}
        activeOpacity={0.8}
        onPress={onStartRotationTutorial}
      >
        <View style={s.tutorialIcon}><Text style={s.tutorialIconT}>🗓️</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.tutorialTitle}>근무표 만들기 따라하기</Text>
          <Text style={s.tutorialSub}>초번·말번·비번 순환표를 직접 만들어봐요</Text>
        </View>
        <Text style={s.tutorialArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.tutorialBanner, { marginTop: 8 }]}
        activeOpacity={0.8}
        onPress={onStartTutorial}
      >
        <View style={s.tutorialIcon}><Text style={s.tutorialIconT}>🔁</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.tutorialTitle}>N일 주기 알람 추가 따라하기</Text>
          <Text style={s.tutorialSub}>화면을 직접 보며 따라 만들어요</Text>
        </View>
        <Text style={s.tutorialArrow}>›</Text>
      </TouchableOpacity>

      <Text style={s.sectionLabel}>정보</Text>
      <View style={s.card}>
        <View style={s.row}>
          <Text style={s.rowLabel}>앱 버전</Text>
          <Text style={s.rowValue}>{Constants.expoConfig?.version ?? '1.0.0'}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    scrollC: { padding: 14, paddingBottom: 100 },
    sectionLabel: { fontSize: 11, fontWeight: '700', color: C.txt3, marginTop: 14, marginBottom: 6, marginLeft: 4, letterSpacing: 0.3 },
    card: { backgroundColor: C.bg2, borderRadius: 14, borderWidth: 1, borderColor: C.border },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 14 },
    rowLabel: { fontSize: 14, fontWeight: '600', color: C.txt },
    rowValue: { fontSize: 13, color: C.txt3 },
    divider: { height: 1, backgroundColor: C.border, marginHorizontal: 14 },
    segment: { flexDirection: 'row', gap: 4, backgroundColor: C.bg3, borderRadius: 10, padding: 3 },
    segBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    segBtnActive: { backgroundColor: C.accent2 },
    segBtnText: { fontSize: 12, color: C.txt3, fontWeight: '700' },
    segBtnTextActive: { color: '#fff' },
    androidBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(162,155,254,0.15)' },
    androidBadgeText: { fontSize: 11, fontWeight: '700', color: C.accent },
    volumeHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    volumeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    volumeIcon: { fontSize: 13 },
    helpBanner: { flexDirection: 'row', alignItems: 'center', marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,180,80,0.10)', borderWidth: 1, borderColor: 'rgba(255,180,80,0.3)' },
    tutorialBanner: { flexDirection: 'row', alignItems: 'center', marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: 'rgba(162,155,254,0.10)', borderWidth: 1, borderColor: 'rgba(162,155,254,0.3)' },
    tutorialIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(162,155,254,0.18)', marginRight: 12 },
    tutorialIconT: { fontSize: 17 },
    tutorialTitle: { fontSize: 14, fontWeight: '700', color: C.txt },
    tutorialSub: { fontSize: 11, color: C.txt3, marginTop: 2 },
    tutorialArrow: { fontSize: 16, color: C.txt3 },
  });
}
