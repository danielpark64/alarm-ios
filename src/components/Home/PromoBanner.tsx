import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, TouchableOpacity, Linking, StyleSheet, Modal, ScrollView, NativeSyntheticEvent, NativeScrollEvent, LayoutChangeEvent, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../common/AppText';
import { Palette } from '../../constants/colors';
import { useColors } from '../../hooks/useTheme';
import { useScale, rf } from '../../utils/responsive';
import { CoffeeTipScreen } from '../Support/CoffeeTipScreen';
import { useT } from '../../i18n';
import { N } from '../../i18n/lang';
import { promoSlideKeys, SAYRAM_PLAY_URL } from '../../utils/promoSlides';
import { sayramInstalled } from '../../utils/sayramShareNative';

const ROTATE_MS = 5000;

// onPress에 openTip이 넘어오는 슬라이드는 계좌 후원 화면을 연다(아래 makeSlides 참고).
// 어떤 슬라이드를 보일지는 promoSlideKeys가 정한다 — 세이람 소개는 Android에서, 세이람이 아직 안 깔려 있을 때만.
const ALL_SLIDES = (openTip: () => void) => ({
  susu: {
    key: 'susu',
    icon: '🎵',
    title: N('수수뮤직과 기분좋은 하루'),
    sub: N('채널 바로가기'),
    iconBg: 'rgba(162,155,254,0.18)',
    boxBg: 'rgba(162,155,254,0.08)',
    boxBorder: 'rgba(162,155,254,0.25)',
    onPress: () => Linking.openURL('https://www.youtube.com/@music_susu'),
  },
  sayram: {
    key: 'sayram',
    icon: '🎙️',
    title: N('말로 하는 일정·알람, 세이람'),
    sub: N('말하면 일정이 되는 앱 보러 가기'),
    iconBg: 'rgba(229,83,83,0.16)',
    boxBg: 'rgba(229,83,83,0.07)',
    boxBorder: 'rgba(229,83,83,0.28)',
    onPress: () => Linking.openURL(SAYRAM_PLAY_URL),
  },
  coffee: {
    key: 'coffee',
    icon: '☕',
    title: N('개발자 응원하기'),
    sub: N('작은 후원으로 응원해주세요'),
    iconBg: 'rgba(250,199,117,0.18)',
    boxBg: 'rgba(250,199,117,0.08)',
    boxBorder: 'rgba(250,199,117,0.3)',
    onPress: openTip,
  },
});
const makeSlides = (openTip: () => void, hasSayram: boolean) => {
  const all = ALL_SLIDES(openTip);
  return promoSlideKeys({ platform: Platform.OS, hasSayram }).map(k => all[k]);
};

// 알람 탭 하단 배너 — 수수뮤직/커피후원 슬라이드를 자동 롤링 + 사용자가 직접 밀어서도 전환 가능 (모든 플랫폼)
// 양쪽 끝에 첫/마지막 슬라이드의 복제본을 추가해 두고, 경계에 닿으면 애니메이션 없이
// 반대쪽 실제 슬라이드로 순간 이동시켜서 어느 방향으로 밀어도 끊김 없이 무한 순환되도록 함.
// 슬라이드가 나중에 늘어나도 그대로 동작하는 일반적인 구현.
export function PromoBanner() {
  const scale = useScale();
  const C = useColors();
  const s = makeStyles(C);
  const insets = useSafeAreaInsets();
  const { t } = useT();
  // 후원 화면은 이 배너에서만 열리므로 상태를 여기서 들고 있는다 — 상위로 prop을 끌어올릴 이유가 없다.
  const [showTip, setShowTip] = useState(false);
  // 세이람 설치 여부는 실행 때 한 번만 확인한다(sayramInstalled가 결과를 기억) — 배너가 돌 때·앞으로 올 때마다 확인하지 않는다.
  // 새로 깔거나 지운 건 다음 실행 때 반영된다.
  const slides = useMemo(() => makeSlides(() => setShowTip(true), sayramInstalled()), []);
  const count = slides.length;
  const extended = count > 1 ? [slides[count - 1], ...slides, slides[0]] : slides;
  const [width, setWidth] = useState(0);
  const [dotIdx, setDotIdx] = useState(0);
  const posRef = useRef(1); // extended 배열 기준 위치, 실제 슬라이드는 1..count
  const scrollRef = useRef<ScrollView>(null);

  const handleLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  // 레이아웃 측정 직후, 그리고 슬라이드 수가 바뀌면(세이람 소개가 생기거나 빠짐) 실제 첫 슬라이드(복제본 다음 위치)로
  // 애니메이션 없이 이동 — 2장↔3장이 바뀌면 예전 위치가 복제본이나 범위 밖을 가리킬 수 있다.
  useEffect(() => {
    posRef.current = 1;
    setDotIdx(0);
    if (width > 0 && count > 1) {
      scrollRef.current?.scrollTo({ x: width * posRef.current, animated: false });
    }
  }, [width, count]);

  // 5초마다 자동 롤링 — 사용자가 직접 밀어서 dotIdx가 바뀌어도 이 effect가 재시작되며 타이머가 리셋됨
  useEffect(() => {
    if (count < 2 || !width) return;
    const timer = setInterval(() => {
      posRef.current += 1;
      scrollRef.current?.scrollTo({ x: width * posRef.current, animated: true });
    }, ROTATE_MS);
    return () => clearInterval(timer);
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
                <Text style={[s.promoTitle,{fontSize:rf(14,scale)}]} numberOfLines={1} ellipsizeMode="tail">{t(slide.title)}</Text>
                <Text style={[s.promoSub,{fontSize:rf(11,scale)}]} numberOfLines={1} ellipsizeMode="tail">{t(slide.sub)}</Text>
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

      <Modal visible={showTip} animationType="slide" onRequestClose={() => setShowTip(false)}>
        {/* react-native 코어의 SafeAreaView는 iOS 전용이라 Android에선 여백을 주지 않아
            "닫기" 버튼이 상태바를 파고들었다. insets는 Modal 바깥(메인 윈도우)에서 읽어야
            정확하다 — Modal은 별도 네이티브 윈도우라 안쪽에서 재측정하면 0이 나올 수 있다. */}
        <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
          <CoffeeTipScreen onClose={() => setShowTip(false)} />
        </View>
      </Modal>
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
