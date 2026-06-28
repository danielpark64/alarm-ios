import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet, Alert } from 'react-native';
import { Palette } from '../../constants/colors';
import { useColors } from '../../hooks/useTheme';
import { useScale, rf } from '../../utils/responsive';

const ROTATE_MS = 5000;

const SLIDES = [
  {
    key: 'susu',
    icon: '🎵',
    title: '수수뮤직과 기분좋은 하루',
    sub: '채널 바로가기',
    iconBg: 'rgba(162,155,254,0.18)',
    boxBg: 'rgba(162,155,254,0.08)',
    boxBorder: 'rgba(162,155,254,0.25)',
    onPress: () => Linking.openURL('https://www.youtube.com/@susumusic_ai'),
  },
  {
    key: 'coffee',
    icon: '☕',
    title: '개발자에게 커피 한 잔',
    sub: '작은 후원으로 응원해주세요',
    iconBg: 'rgba(250,199,117,0.18)',
    boxBg: 'rgba(250,199,117,0.08)',
    boxBorder: 'rgba(250,199,117,0.3)',
    onPress: () => Alert.alert('준비 중', '커피 후원 기능은 곧 추가될 예정이에요.'),
  },
] as const;

// 알람 탭 하단 배너 — 수수뮤직/커피후원 슬라이드를 자동 롤링 (모든 플랫폼)
export function PromoBanner() {
  const scale = useScale();
  const C = useColors();
  const s = makeStyles(C);
  const slides = SLIDES;
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setIdx(i => (i + 1) % slides.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [slides.length]);

  const slide = slides[idx];

  return (
    <View>
      <TouchableOpacity style={[s.promoBanner, { borderColor: slide.boxBorder, backgroundColor: slide.boxBg }]} activeOpacity={0.8} onPress={slide.onPress}>
        <View style={[s.promoIcon, { backgroundColor: slide.iconBg }]}><Text style={s.promoIconT}>{slide.icon}</Text></View>
        <View style={{flex:1, minWidth:0}}>
          <Text style={[s.promoTitle,{fontSize:rf(14,scale)}]} numberOfLines={1} ellipsizeMode="tail">{slide.title}</Text>
          <Text style={[s.promoSub,{fontSize:rf(11,scale)}]} numberOfLines={1} ellipsizeMode="tail">{slide.sub}</Text>
        </View>
        <Text style={s.promoArrow}>›</Text>
      </TouchableOpacity>
      {slides.length > 1 && (
        <View style={s.dots}>
          {slides.map((sl, i) => (
            <View key={sl.key} style={[s.dot, i === idx && s.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    promoBanner: { flexDirection:'row', alignItems:'center', marginTop:10, padding:12, borderRadius:14, borderWidth:1 },
    promoIcon:   { width:38, height:38, borderRadius:12, alignItems:'center', justifyContent:'center', marginRight:10 },
    promoIconT:  { fontSize:18 },
    promoTitle:  { fontSize:14, fontWeight:'800', color:C.txt, flexShrink:1 },
    promoSub:    { fontSize:11, fontWeight:'600', color:C.txt3, marginTop:2, flexShrink:1 },
    promoArrow:  { fontSize:20, fontWeight:'700', color:C.txt3, marginLeft:6 },
    dots:        { flexDirection:'row', justifyContent:'center', gap:5, marginTop:7 },
    dot:         { width:14, height:3, borderRadius:2, backgroundColor:C.border2 },
    dotActive:   { backgroundColor:C.accent },
  });
}
