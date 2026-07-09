import React from 'react';
import { View, ScrollView, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { Text } from '../common/AppText';
import { Palette } from '../../constants/colors';
import { useColors } from '../../hooks/useTheme';

type HelpEntry =
  | { kind: 'section'; title: string }
  | { kind: 'item'; icon: string; title: string; body: string; showSwitchIcon?: boolean };

const ENTRIES: HelpEntry[] = [
  // ── 소개 ──────────────────────────────────────────────
  { kind: 'section', title: '소개' },
  { kind: 'item', icon: '⏰', title: '교대근무자도, 일반인도',
    body: '교대 근무가 아니어도 괜찮아요. 반복 알람, 이날만 끄기, 음력 생일·제사 알람까지 — 일상의 모든 알람을 이 앱 하나로 관리할 수 있어요.' },

  // ── 기본 사용법 ────────────────────────────────────────
  { kind: 'section', title: '기본 사용법' },
  { kind: 'item', icon: '➕', title: '새 알람 추가하기',
    body: '화면 오른쪽 위에 있는 ＋ 버튼을 누르면 새 알람을 만들 수 있어요.\n처음이라 헷갈리면 아래 "사용법 따라하기"를 눌러 화면을 보면서 그대로 따라 해보세요.' },
  { kind: 'item', icon: '✏️', title: '알람 수정하기',
    body: '알람을 손가락으로 한 번 누르면 시간이나 반복 방식을 바꿀 수 있어요.' },
  { kind: 'item', icon: '🔔', title: '알람 켜고 끄기',
    body: '알람 오른쪽에 있는 동그란 스위치를 손가락으로 누르면 켜지거나 꺼져요.', showSwitchIcon: true },
  { kind: 'item', icon: '🗑️', title: '여러 알람 한꺼번에 지우기',
    body: '알람을 손가락으로 길게(2초 정도) 누르고 있으면 여러 개를 한 번에 골라서 지울 수 있어요.' },

  // ── 반복 알람 ──────────────────────────────────────────
  { kind: 'section', title: '반복 알람' },
  { kind: 'item', icon: '🔁', title: '교대 로테이션 만들기',
    body: '"새벽 → 오후 → 비번"처럼 근무조가 도는 경우엔 "N일 주기" 알람을 근무조 개수만큼 만들어보세요.\n예를 들어 3일 주기로 도는 2교대라면, 새벽 알람과 오후 알람 둘 다 "3일 주기"로 만들고 시작일을 하루씩 다르게 잡으면 돼요.' },
  { kind: 'item', icon: '🌙', title: 'N일 후 휴식',
    body: '예를 들어 "4일 일하고 2일 쉬기"처럼 반복하고 싶다면, 알람 추가 화면의 반복 방식에서 "N일 후 휴식"을 골라보세요.\n근무일수 4일, 휴식일수 2일로 각각 정하면 그 패턴이 계속 반복돼요.' },
  { kind: 'item', icon: '🌕', title: '음력 생일·제사 알람',
    body: '알람 추가 화면에서 "매년"을 고르면 옆에 "음력" 버튼이 나와요. 이걸 누르고 날짜를 고르면, 매년 그 음력 날짜에 맞는 양력 날로 알아서 계산해서 알람이 울려요.' },

  // ── 달력 기능 ──────────────────────────────────────────
  { kind: 'section', title: '달력' },
  { kind: 'item', icon: '📅', title: '달력에 근무표가 저절로',
    body: '앱을 열면 바로 달력이 보여요. "출근" 알람을 만들어두면 그 알람이 울리는 날이 색칠되고, 알람이 안 울리는 날은 "비번"이라고 빨갛게 표시돼요.\n근무표를 따로 적을 필요 없이, 알람만 만들면 달력이 저절로 완성돼요.' },
  { kind: 'item', icon: '🎌', title: '공휴일이 자동으로 반영돼요',
    body: '달력에 공휴일과 대체공휴일이 자동으로 표시돼요. 정부에서 새 임시공휴일을 발표해도 앱이 알아서 확인하고 채워 넣어서, 따로 신경 쓰지 않아도 항상 최신이에요.' },
  { kind: 'item', icon: '↕️', title: '달·연도 넘기기',
    body: '달력 화면에서 좌우로 밀면 한 달씩, 위아래로 밀면 1년씩 넘어가요. 몇 년 전이나 몇 년 후 날짜도 계속 이동할 수 있어요.' },
  { kind: 'item', icon: '🗓️', title: '오늘만 알람 끄기',
    body: '갑자기 근무가 바뀐 날엔, 달력에서 그 날짜를 누르고 알람 옆의 "이날 끄기"를 누르면 그날 하루만 알람이 안 울려요. 알람 자체를 지우지 않아도 돼요.' },

  // ── 위젯 & 설정 ────────────────────────────────────────
  { kind: 'section', title: '위젯 & 설정' },
  { kind: 'item', icon: '📱', title: '홈 화면 위젯 (안드로이드)',
    body: '홈 화면 빈 곳을 길게 누르면 위젯 메뉴가 나와요. "나는교대자다"를 찾아서 원하는 크기의 위젯을 누르면 돼요.\n• 중간 위젯: 다음 알람 시간 · 오늘 근무조 · 다음 비번\n• 큰 위젯: 중간 위젯 내용 + 이번 주 일정 스크롤\n위젯을 누르면 앱이 바로 열려요.' },
  { kind: 'item', icon: '🔠', title: '글자 크게 보기',
    body: '설정 화면의 "글자크기"에서 작게·보통·크게 중 편한 크기를 고르면 앱 전체 글자가 그 크기로 바뀌어요.' },
  { kind: 'item', icon: '🌗', title: '화면 밝기 바꾸기',
    body: '설정 화면의 "테마"에서 밝은 화면(라이트)과 어두운 화면(다크) 중에 고를 수 있어요.' },
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

        {ENTRIES.map((entry, i) => {
          if (entry.kind === 'section') {
            return (
              <View key={i} style={s.sectionHeader}>
                <Text style={s.sectionTitle}>{entry.title}</Text>
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
                <Text style={s.cardTitle}>{entry.title}</Text>
              </View>
              <Text style={s.cardBody}>{entry.body}</Text>
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
