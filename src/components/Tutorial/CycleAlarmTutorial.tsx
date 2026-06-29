import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Palette } from '../../constants/colors';
import { useColors } from '../../hooks/useTheme';

export interface SpotlightRect { x: number; y: number; width: number; height: number }

// step 0, 10은 특정 UI를 가리키지 않는 인트로/완료 화면 (rect 없음 → 화면 전체를 반투명하게 덮고 중앙에 카드)
// step 1~7, 9는 직접 따라 입력하는 단계로 "다음" 버튼으로 넘기고, step 8(추가 버튼)은 실제로 눌러야 다음으로 진행됨
const STEPS = [
  { icon: '👋', text: '간단한 실습으로 알람을 처음부터 끝까지 직접 만들어볼게요.', cta: '시작하기' },
  { icon: '🏷️', text: '먼저 알람 종류를 선택해보세요. (예: 출근)', cta: '다음' },
  { icon: '⏰', text: '시간을 맞춰보세요.', cta: '다음' },
  { icon: '✏️', text: '라벨에 내용을 적어보세요. (예: 기상)', cta: '다음' },
  { icon: '🔁', text: '반복 방식에서 "N일 주기"를 눌러보세요.', cta: null },
  { icon: '🔢', text: '며칠마다 울릴지 골라보세요. (예: 3일)', cta: '다음' },
  { icon: '📅', text: '시작일자를 선택해보세요.', cta: null },
  { icon: '👀', text: '다음 알람이 울릴 날짜들을 확인해보세요.', cta: '다음' },
  { icon: '➕', text: '"추가" 버튼을 눌러 알람을 완성해보세요!', cta: null },
  { icon: '🗑️', text: '이 알람을 삭제하시려면 이 버튼을 누르세요. 원하지 않으시면 다음을 누르세요.', cta: '다음' },
  { icon: '🎉', text: '정말 잘하셨어요! 이제부터는 직접 자유롭게 사용해보세요.', cta: '확인' },
] as const;

interface Props {
  step: number;
  rect: SpotlightRect | null;
  onAdvance: () => void;
  onSkip: () => void;
}

const PAD = 8;
const BUBBLE_WIDTH = 260;

export function CycleAlarmTutorial({ step, rect, onAdvance, onSkip }: Props) {
  const C = useColors();
  const s = makeStyles(C);
  const { width: sw, height: sh } = useWindowDimensions();
  const current = STEPS[step];
  if (!current) return null;

  // rect가 없는 인트로/완료 단계 — 화면 전체를 덮고 중앙에 카드
  if (!rect) {
    return (
      <View style={s.fullDim}>
        <View style={s.centerCard}>
          <TouchableOpacity style={s.closeBtn} onPress={onSkip} hitSlop={8}>
            <Text style={s.closeBtnT}>✕</Text>
          </TouchableOpacity>
          <Text style={s.icon}>{current.icon}</Text>
          <Text style={[s.text, { flex: 0, textAlign: 'center', marginTop: 10 }]}>{current.text}</Text>
          {current.cta && (
            <TouchableOpacity style={[s.ctaBtn, { marginTop: 14 }]} onPress={onAdvance}>
              <Text style={s.ctaBtnT}>{current.cta}</Text>
            </TouchableOpacity>
          )}
          <Dots step={step} s={s} />
        </View>
      </View>
    );
  }

  const hole = {
    x: Math.max(0, rect.x - PAD),
    y: Math.max(0, rect.y - PAD),
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };

  const placeBelow = hole.y + hole.height < sh - 170;
  const bubbleLeft = Math.min(Math.max(hole.x + hole.width / 2 - BUBBLE_WIDTH / 2, 12), sw - 12 - BUBBLE_WIDTH);
  const arrowLeft = Math.min(Math.max(hole.x + hole.width / 2 - bubbleLeft - 7, 10), BUBBLE_WIDTH - 24);

  return (
    <View style={s.overlayRoot} pointerEvents="box-none">
      {/* 구멍 주위 4면을 어둡게 — 구멍(실제 버튼) 부분은 비워둬서 그대로 탭 가능 */}
      <View style={[s.dimRect, { left: 0, top: 0, width: sw, height: hole.y }]} pointerEvents="auto" />
      <View style={[s.dimRect, { left: 0, top: hole.y + hole.height, width: sw, height: sh - (hole.y + hole.height) }]} pointerEvents="auto" />
      <View style={[s.dimRect, { left: 0, top: hole.y, width: hole.x, height: hole.height }]} pointerEvents="auto" />
      <View style={[s.dimRect, { left: hole.x + hole.width, top: hole.y, width: sw - (hole.x + hole.width), height: hole.height }]} pointerEvents="auto" />
      <View style={[s.highlightBorder, { left: hole.x, top: hole.y, width: hole.width, height: hole.height }]} pointerEvents="none" />

      <View
        style={[
          s.bubble,
          { left: bubbleLeft, width: BUBBLE_WIDTH },
          placeBelow ? { top: hole.y + hole.height + 14 } : { top: hole.y - 14 - 120 },
        ]}
        pointerEvents="box-none"
      >
        {placeBelow && <View style={[s.arrowUp, { left: arrowLeft }]} />}
        <TouchableOpacity style={s.closeBtn} onPress={onSkip} hitSlop={8}>
          <Text style={s.closeBtnT}>✕</Text>
        </TouchableOpacity>
        <View style={s.bubbleRow}>
          <Text style={s.icon}>{current.icon}</Text>
          <Text style={s.text}>{current.text}</Text>
        </View>
        <View style={s.bubbleBottomRow}>
          <Dots step={step} s={s} />
          {current.cta && (
            <TouchableOpacity style={s.ctaBtn} onPress={onAdvance}>
              <Text style={s.ctaBtnT}>{current.cta}</Text>
            </TouchableOpacity>
          )}
        </View>
        {!placeBelow && <View style={[s.arrowDown, { left: arrowLeft }]} />}
      </View>
    </View>
  );
}

function Dots({ step, s }: { step: number; s: ReturnType<typeof makeStyles> }) {
  return (
    <View style={s.dots}>
      {STEPS.map((_, i) => (
        <View key={i} style={[s.dot, i === step && s.dotActive]} />
      ))}
    </View>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    overlayRoot: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 50 },
    dimRect: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.6)' },
    highlightBorder: { position: 'absolute', borderRadius: 14, borderWidth: 2, borderColor: C.accent },
    fullDim: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
    centerCard: { width: '100%', maxWidth: 300, backgroundColor: C.bg2, borderRadius: 20, borderWidth: 1, borderColor: C.accent2, padding: 22, alignItems: 'center' },
    bubble: { position: 'absolute', backgroundColor: C.bg2, borderRadius: 16, borderWidth: 1, borderColor: C.accent2, padding: 14, paddingTop: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 10 },
    bubbleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    bubbleBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
    arrowUp: { position: 'absolute', top: -8, width: 14, height: 8, backgroundColor: C.bg2, borderLeftWidth: 1, borderTopWidth: 1, borderColor: C.accent2, transform: [{ rotate: '45deg' }] },
    arrowDown: { position: 'absolute', bottom: -8, width: 14, height: 8, backgroundColor: C.bg2, borderRightWidth: 1, borderBottomWidth: 1, borderColor: C.accent2, transform: [{ rotate: '45deg' }] },
    closeBtn: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
    closeBtnT: { fontSize: 12, color: C.txt3, fontWeight: '700' },
    icon: { fontSize: 20 },
    text: { flex: 1, fontSize: 13, fontWeight: '700', color: C.txt, lineHeight: 19 },
    dots: { flexDirection: 'row', gap: 5 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.border2 },
    dotActive: { backgroundColor: C.accent },
    ctaBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: C.accent2 },
    ctaBtnT: { fontSize: 13, fontWeight: '800', color: '#fff' },
  });
}
