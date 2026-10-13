import React from 'react';
import { View, ScrollView, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { Text } from '../common/AppText';
import { Palette } from '../../constants/colors';
import { useColors } from '../../hooks/useTheme';
import { helpKo as ENTRIES } from '../../content/help.ko';
import { useT } from '../../i18n';

interface Props {
  onClose: () => void;
  onStartRotationTutorial: () => void;
}

export function HelpScreen({ onClose, onStartRotationTutorial }: Props) {
  const C = useColors();
  const s = makeStyles(C);
  const { t, lang } = useT();
  // 한국 전용 기능(음력·한국 공휴일) 설명은 한국어일 때만 보인다
  const entries = lang === 'ko' ? ENTRIES : ENTRIES.filter(e => e.kind !== 'item' || !e.krOnly);

  return (
    <View style={s.root}>
      <View style={s.topBar}>
        <Text style={s.topBarTitle}>{t('사용법 안내')}</Text>
        <TouchableOpacity style={s.closeBtn} onPress={onClose}>
          <Text style={s.closeBtnText}>{t('닫기')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={s.tutorialBanner} activeOpacity={0.8} onPress={onStartRotationTutorial}>
          <Text style={s.tutorialBannerIcon}>🗓️</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.tutorialBannerTitle}>{t('근무표 만들기 따라하기')}</Text>
            <Text style={s.tutorialBannerSub}>{t('초번·말번·비번 순환표를 직접 만들어봐요')}</Text>
          </View>
          <Text style={s.tutorialBannerArrow}>›</Text>
        </TouchableOpacity>

        {entries.map((entry, i) => {
          if (entry.kind === 'section') {
            return (
              <View key={i} style={s.sectionHeader}>
                <Text style={s.sectionTitle}>{t(entry.title)}</Text>
                <View style={s.sectionLine} />
              </View>
            );
          }
          return (
            <View key={i} style={s.card}>
              <View style={s.cardHead}>
                {entry.showSwitchIcon ? (
                  <Switch
                    value={true}
                    disabled
                    trackColor={{ false: C.border2, true: C.accent2 }}
                    thumbColor="#fff"
                    style={s.cardSwitchIcon}
                  />
                ) : (
                  <Text style={s.cardIcon}>{entry.icon}</Text>
                )}
                <Text style={s.cardTitle}>{t(entry.title)}</Text>
              </View>
              <Text style={s.cardBody}>{t(lang !== 'ko' && entry.bodyIntl ? entry.bodyIntl : entry.body)}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
    topBarTitle: { fontSize: 19, fontWeight: '800', color: C.txt },
    closeBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 14, borderWidth: 1.5, borderColor: C.border2 },
    closeBtnText: { fontSize: 15, fontWeight: '700', color: C.txt2 },
    scrollContent: { padding: 16, paddingBottom: 60, gap: 12 },
    tutorialBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 18, backgroundColor: 'rgba(162,155,254,0.14)', borderWidth: 1.5, borderColor: 'rgba(162,155,254,0.4)', marginBottom: 4 },
    tutorialBannerIcon: { fontSize: 26 },
    tutorialBannerTitle: { fontSize: 17, fontWeight: '800', color: C.txt },
    tutorialBannerSub: { fontSize: 13, color: C.txt3, marginTop: 3 },
    tutorialBannerArrow: { fontSize: 22, color: C.txt3 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, marginBottom: 2 },
    sectionTitle: { fontSize: 13, fontWeight: '800', color: C.accent, letterSpacing: 0.5 },
    sectionLine: { flex: 1, height: 1, backgroundColor: C.border },
    card: { backgroundColor: C.bg2, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16 },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    cardIcon: { fontSize: 24 },
    cardSwitchIcon: { transform: [{ scale: 0.85 }] },
    cardTitle: { fontSize: 17, fontWeight: '800', color: C.txt, flex: 1 },
    cardBody: { fontSize: 15, lineHeight: 23, color: C.txt2 },
  });
}
