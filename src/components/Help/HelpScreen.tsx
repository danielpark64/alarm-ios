import React from 'react';
import { View, ScrollView, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { Text } from '../common/AppText';
import { Palette } from '../../constants/colors';
import { useColors } from '../../hooks/useTheme';

interface HelpItem {
  icon: string;
  title: string;
  body: string;
  hidden?: boolean; // 잘 안 보여서 모르고 지나치기 쉬운 기능 표시용
  showSwitchIcon?: boolean; // 글자 아이콘 대신 실제 토글 스위치 모양을 보여줄 때
}

// 고령층 사용자도 쉽게 읽을 수 있도록 쉬운 말과 짧은 문장으로 작성
const ITEMS: HelpItem[] = [
  { icon: '🔔', title: '알람 켜고 끄기', body: '알람 오른쪽에 있는 동그란 스위치를 손가락으로 누르면 켜지거나 꺼져요.', showSwitchIcon: true },
  { icon: '➕', title: '새 알람 추가하기', body: '화면 오른쪽 위에 있는 ＋ 버튼을 누르면 새 알람을 만들 수 있어요.\n처음이라 헷갈리면 아래 "사용법 따라하기"를 눌러 화면을 보면서 그대로 따라 해보세요.' },
  { icon: '✏️', title: '알람 내용 수정', body: '알람을 손가락으로 한 번 누르면 시간이나 반복 방식을 바꿀 수 있어요.' },
  { icon: '🌙', title: 'N일 후 휴식', body: '예를 들어 "4일 일하고 2일 쉬기"처럼 반복하고 싶다면, 알람 추가 화면의 반복 방식에서 "N일 후 휴식"을 골라보세요.\n근무일수 4일, 휴식일수 2일로 각각 정하면 그 패턴이 계속 반복돼요.' },
  { icon: '🗑️', title: '여러 알람 한꺼번에 지우기', body: '알람을 손가락으로 길게(2초 정도) 누르고 있으면 여러 개를 한 번에 골라서 지울 수 있어요.', hidden: true },
  { icon: '📅', title: '날짜별로 알람 보기', body: '화면 맨 아래 "달력" 버튼을 누르면 어떤 날에 어떤 알람이 울리는지 한눈에 볼 수 있어요.\n달력에서 알람을 누르면 "알람" 화면으로 돌아가서 그 알람이 깜빡거리며 나타나요.', hidden: true },
  { icon: '🔠', title: '글자 크게 보기', body: '설정 화면의 "글자크기"에서 작게·보통·크게 중 편한 크기를 고르면 앱 전체 글자가 그 크기로 바뀌어요.' },
  { icon: '🌗', title: '화면 밝기 바꾸기', body: '설정 화면의 "테마"에서 밝은 화면(라이트)과 어두운 화면(다크) 중에 고를 수 있어요.' },
];

interface Props {
  onClose: () => void;
  onStartTutorial: () => void;
}

export function HelpScreen({ onClose, onStartTutorial }: Props) {
  const C = useColors();
  const s = makeStyles(C);

  return (
    <View style={s.root}>
      <View style={s.topBar}>
        <Text style={s.topBarTitle}>사용법 안내</Text>
        <TouchableOpacity style={s.closeBtn} onPress={onClose}>
          <Text style={s.closeBtnText}>닫기</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={s.tutorialBanner} activeOpacity={0.8} onPress={onStartTutorial}>
          <Text style={s.tutorialBannerIcon}>🔁</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.tutorialBannerTitle}>N일 주기 알람 추가 따라하기</Text>
            <Text style={s.tutorialBannerSub}>화면을 직접 보며 따라 만들어요</Text>
          </View>
          <Text style={s.tutorialBannerArrow}>›</Text>
        </TouchableOpacity>

        {ITEMS.map((item, i) => (
          <View key={i} style={s.card}>
            <View style={s.cardHead}>
              {item.showSwitchIcon ? (
                <Switch
                  value={true}
                  disabled
                  trackColor={{ false: C.border2, true: C.accent2 }}
                  thumbColor="#fff"
                  style={s.cardSwitchIcon}
                />
              ) : (
                <Text style={s.cardIcon}>{item.icon}</Text>
              )}
              <Text style={s.cardTitle}>{item.title}</Text>
              {item.hidden && (
                <View style={s.hiddenBadge}>
                  <Text style={s.hiddenBadgeText}>잘 안 보이는 기능</Text>
                </View>
              )}
            </View>
            <Text style={s.cardBody}>{item.body}</Text>
          </View>
        ))}
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
    scrollContent: { padding: 16, paddingBottom: 60, gap: 14 },
    tutorialBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 18, backgroundColor: 'rgba(162,155,254,0.14)', borderWidth: 1.5, borderColor: 'rgba(162,155,254,0.4)', marginBottom: 4 },
    tutorialBannerIcon: { fontSize: 26 },
    tutorialBannerTitle: { fontSize: 17, fontWeight: '800', color: C.txt },
    tutorialBannerSub: { fontSize: 13, color: C.txt3, marginTop: 3 },
    tutorialBannerArrow: { fontSize: 22, color: C.txt3 },
    card: { backgroundColor: C.bg2, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16 },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' },
    cardIcon: { fontSize: 24 },
    cardSwitchIcon: { transform: [{ scale: 0.85 }] },
    cardTitle: { fontSize: 17, fontWeight: '800', color: C.txt },
    cardBody: { fontSize: 15, lineHeight: 23, color: C.txt2 },
    hiddenBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(255,180,80,0.15)' },
    hiddenBadgeText: { fontSize: 11, fontWeight: '800', color: '#e0a44d' },
  });
}
