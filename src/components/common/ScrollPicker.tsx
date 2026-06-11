import React, {
  useState, useRef, useEffect, useMemo, useCallback,
} from 'react';
import { View, Text, FlatList, StyleSheet, Platform } from 'react-native';
import { pad } from '../../utils';

export const PICK_H = 44;
// 항목 수가 적은 picker(분 등)도 양방향 스크롤 버퍼가 충분하도록
// midOffset(중앙까지의 행 수)이 대략 같아지게 LOOP_COUNT를 동적으로 계산
const TARGET_MID_OFFSET = 48;

export function ScrollPicker({
  value, items, onChange,
}: { value: number; items: number[]; onChange: (v: number) => void }) {
  const flatRef        = useRef<FlatList>(null);
  const isScrolling    = useRef(false);
  const skipNextEffect = useRef(false);
  const [laid, setLaid] = useState(false);

  const loopCount = useMemo(
    () => 2 * Math.ceil(TARGET_MID_OFFSET / items.length) + 1,
    [items],
  );
  const loopedItems = useMemo(
    () => Array.from({ length: loopCount }, () => items).flat(),
    [items, loopCount],
  );
  const totalCount = loopedItems.length;
  const midOffset  = Math.floor(loopCount / 2) * items.length;

  const getTargetY = useCallback(
    (v: number) => (midOffset + items.indexOf(v)) * PICK_H,
    [items, midOffset],
  );

  // initialScrollIndex: item n-1 을 뷰포트 상단에 → item n 이 중앙 하이라이트에 위치
  const initScrollIndex = Math.max(0, midOffset + items.indexOf(value) - 1);

  // 초기 스크롤 — onLayout 후 200ms + 500ms 2단계로 확실하게 실행
  // (중첩 ScrollView 환경에서 FlatList 준비 지연을 모두 커버)
  useEffect(() => {
    if (!laid) return;
    const t1 = setTimeout(() => {
      flatRef.current?.scrollToOffset({ offset: getTargetY(value), animated: false });
    }, 200);
    const t2 = setTimeout(() => {
      flatRef.current?.scrollToOffset({ offset: getTargetY(value), animated: false });
    }, 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laid]);

  // 외부 value 변경 시 스크롤 동기화
  useEffect(() => {
    if (!laid) return;
    if (skipNextEffect.current) { skipNextEffect.current = false; return; }
    if (isScrolling.current) return;
    flatRef.current?.scrollToOffset({ offset: getTargetY(value), animated: true });
  }, [value, laid, getTargetY]);

  const handleEnd = useCallback((y: number) => {
    isScrolling.current = false;
    const rawIdx  = Math.round(y / PICK_H);
    const clipped = Math.max(0, Math.min(totalCount - 1, rawIdx));
    const newVal  = loopedItems[clipped];
    if (newVal !== value) {
      skipNextEffect.current = true;
      onChange(newVal);
    }
    const localIdx = items.indexOf(newVal);
    const targetY  = (midOffset + localIdx) * PICK_H;
    if (Math.abs(clipped - (midOffset + localIdx)) > items.length * 2) {
      setTimeout(() => {
        flatRef.current?.scrollToOffset({ offset: targetY, animated: false });
      }, 50);
    }
  }, [value, loopedItems, totalCount, items, midOffset, onChange]);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: PICK_H, offset: PICK_H * (index + 1), index,
  }), []);

  const renderItem = useCallback(({ item }: { item: number }) => (
    <View style={pick.item}>
      <Text style={[pick.num, item === value ? pick.numSel : pick.numDim]}>
        {pad(item)}
      </Text>
    </View>
  ), [value]);

  return (
    <View style={pick.wrap} onLayout={() => setLaid(true)}>
      <View style={pick.highlight} pointerEvents="none" />
      <FlatList
        ref={flatRef}
        data={loopedItems}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        initialScrollIndex={initScrollIndex}
        showsVerticalScrollIndicator={false}
        snapToInterval={PICK_H}
        decelerationRate="fast"
        windowSize={3}
        nestedScrollEnabled
        contentContainerStyle={{ paddingVertical: PICK_H }}
        onScrollBeginDrag={() => { isScrolling.current = true; }}
        onMomentumScrollEnd={(e: any) => {
          if (!isScrolling.current) return;
          handleEnd(e.nativeEvent.contentOffset.y);
        }}
        onScrollEndDrag={(e: any) => {
          if (!isScrolling.current) return;
          const vy = e.nativeEvent.velocity?.y ?? 0;
          if (Math.abs(vy) < 0.01) handleEnd(e.nativeEvent.contentOffset.y);
        }}
      />
    </View>
  );
}

const pick = StyleSheet.create({
  wrap:      { position: 'relative', width: 64, height: PICK_H * 3, overflow: 'hidden' },
  highlight: { position: 'absolute', top: PICK_H, left: 4, right: 4, height: PICK_H, backgroundColor: '#e8e8e8', borderRadius: 12 },
  item:      { width: 64, height: PICK_H, justifyContent: 'center', alignItems: 'center' },
  num:       { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: '900', includeFontPadding: false, textAlignVertical: 'center', width: '100%', height: PICK_H, textAlign: 'center' },
  numSel:    { fontSize: 36, lineHeight: PICK_H, color: '#000', opacity: 1 },
  numDim:    { fontSize: 20, lineHeight: PICK_H, color: '#000', opacity: 0.22 },
});
