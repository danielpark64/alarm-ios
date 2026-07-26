import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, Linking, StyleSheet, Alert, ScrollView, NativeSyntheticEvent, NativeScrollEvent, LayoutChangeEvent } from 'react-native';
import { Text } from '../common/AppText';
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
    title: '개발자 응원하기',
    sub: '작은 후원으로 응원해주세요',
    iconBg: 'rgba(250,199,117,0.18)',
    boxBg: 'rgba(250,199,117,0.08)',
    boxBorder: 'rgba(250,199,117,0.3)',
    onPress: () => Alert.alert('준비 중', '커피 후원 기능은 곧 추가될 예정이에요.'),
  },
] as const;

// 알람 탭 하단 배너 — 수수뮤직/커피후원 슬라이드를 자동 롤링 + 사용자가 직접 밀어서도 전환 가능 (모든 플랫폼)
// 양쪽 끝에 첫/마지막 슬라이드의 복제본을 추가해 두고, 경계에 닿으면 애니메이션 없이
// 반대쪽 실제 슬라이드로 순간 이동시켜서 어느 방향으로 밀어도 끊김 없이 무한 순환되도록 함.
// 슬라이드가 나중에 늘어나도 그대로 동작하는 일반적인 구현.
export function PromoBanner() {
  const scale = useScale();
  const C = useColors();
  const s = makeStyles(C);
  const slides = SLIDES;
  const count = slides.length;
  const extended = count > 1 ? [slides[count - 1], ...slides, slides[0]] : slides;
  const [width, setWidth] = useState(0);
  const [dotIdx, setDotIdx] = useState(0);
  const posRef = useRef(1); // extended 배열 기준 위치, 실제 슬라이드는 1..count
  const scrollRef = useRef<ScrollView>(null);

  const handleLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  // 레이아웃 측정 직후, 실제 첫 슬라이드(복제본 다음 위치)로 애니메이션 없이 이동
  useEffect(() => {
    if (width > 0 && count > 1) {
      scrollRef.current?.scrollTo({ x: width * posRef.current, animated: false });
    }
  }, [width, count]);

  // 5초마다 자동 롤링 — 사용자가 직접 밀어서 dotIdx가 바뀌어도 이 effect가 재시작되며 타이머가 리셋됨
  useEffect(() => {
    if (count < 2 || !width) return;
    const t = setInterval(() => {
      posRef.current += 1;
      scrollRef.current?.scrollTo({ x: width * posRef.current, animated: true });
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, [count, width, dotIdx]);

  // 경계의 복제 슬라이드에 도착하면 반대쪽 실제 슬라이드로 즉시(애니메이션 없이) 점프
  const settleAt = (rawPos: number) => {
    let pos = rawPos;
    if (pos <= 0) {
      pos = count;
      scrollRef.current?.scrollTo({ x: width * pos, animated: false });
    } else if (pos >= count + 1) {
      pos = 1;
      scrollRef.current?.scrollTo({ x: width * pos, animated: false });
    }
    posRef.current = pos;
    setDotIdx(pos - 1);
  };

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    settleAt(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <View onLayout={handleLayout}>
      {width > 0 && (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={count > 1}
          onMomentumScrollEnd={handleMomentumEnd}
        >
          {extended.map((slide, i) => (
            <TouchableOpacity
              key={`${slide.key}-${i}`}
              style={[s.promoBanner, { width, borderColor: slide.boxBorder, backgroundColor: slide.boxBg }]}
              activeOpacity={0.8}
              onPress={slide.onPress}
            >
              <View style={[s.promoIcon, { backgroundColor: slide.iconBg }]}><Text style={s.promoIconT}>{slide.icon}</Text></View>
              <View style={{flex:1, minWidth:0}}>
                <Text style={[s.promoTitle,{fontSize:rf(14,scale)}]} numberOfLines={1} ellipsizeMode="tail">{slide.title}</Text>
                <Text style={[s.promoSub,{fontSize:rf(11,scale)}]} numberOfLines={1} ellipsizeMode="tail">{slide.sub}</Text>
              </View>
              <Text style={s.promoArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      {count > 1 && (
        <View style={s.dots}>
          {slides.map((sl, i) => (
            <View key={sl.key} style={[s.dot, i === dotIdx && s.dotActive]} />
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
