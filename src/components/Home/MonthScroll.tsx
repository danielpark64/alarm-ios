import React, { useState, useMemo, useRef, useCallback } from 'react';
import { FlatList, Platform, NativeSyntheticEvent, NativeScrollEvent, LayoutChangeEvent } from 'react-native';
import { buildMonthLayout, monthAt, monthIndexAt } from '../../utils/monthScroll';

// 달력 위아래 연속 스크롤 부품(2026-11-22) — 내 달력(CalendarView)과 [공유] 탭(ShareTab)이 같이 쓴다.
// 여기에는 "어느 달을 어디에 그리는가"만 있고 데이터·선택 상태는 없다 — 두 화면의 상태는 각자 따로 둔다.

// 칸 높이는 "6주가 한 화면"에 맞춘다. 달은 실제 주 수(4~6주)만 그린다.
export const ROWS = 6;
export const CELL_MB = 2;
// 달 사이 작은 제목 줄 높이(그 달이 시작되는 곳 표시)
export const TITLE_H = 26;
// 측정 전 첫 렌더용 대체값
export const FALLBACK_CELL_H = 58;
// 앞뒤 10년치 — 높이표는 계산만이라 가볍다(그리는 건 보이는 달뿐)
export const BEFORE = 120;
export const AFTER = 120;
export const MONTH_COUNT = BEFORE + AFTER + 1;

// ws: 주 시작 요일(0=일요일, 1=월요일). 첫 칸 앞의 빈 칸 수만 달라진다.
export function buildCells(year: number, month: number, ws: number = 0): (number|null)[] {
  const offset = (new Date(year, month, 1).getDay() - ws + 7) % 7;
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const cells: (number|null)[] = [];
  for (let i=0; i<offset; i++) cells.push(null);
  for (let d=1; d<=daysInMonth; d++) cells.push(d);
  while (cells.length % 7) cells.push(null); // 실제 주 수만(monthScroll.monthWeeksCount와 같은 계산)
  return cells;
}

/** 그리드 영역의 실측 높이로 칸 높이를 역산(폰/태블릿 화면비가 달라도 6주가 한 화면) */
export function useGridCellH(winWidth: number, cellScale: number) {
  const [gridAreaH, setGridAreaH] = useState(0);
  const onGridAreaLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setGridAreaH(prev => (Math.abs(prev - h) > 1 ? h : prev));
  }, []);
  // 상한 90은 폰 기준 — 태블릿처럼 칸이 넓으면 칸 폭에 맞춰 키운다. 글자크기 배율만큼 상한을 푼다.
  const cellCap = Math.max(90, Math.round(winWidth / 7 * 1.5));
  const cellH = gridAreaH > 0
    ? Math.max(40, Math.min(Math.round(cellCap * cellScale), Math.floor((gridAreaH - TITLE_H) / ROWS) - CELL_MB))
    : FALLBACK_CELL_H;
  return { gridAreaH, onGridAreaLayout, cellH };
}

/** 연속 스크롤 상태 — 위 제목이 따라갈 달(화면 위쪽 1/4 지점), 그 달로 이동, getItemLayout */
export function useMonthScroll(anchorYear: number, anchorMonth: number, weekStart: number, weekH: number) {
  const [visibleIdx, setVisibleIdx] = useState(BEFORE);
  const visibleIdxRef = useRef(BEFORE);
  visibleIdxRef.current = visibleIdx;
  const listRef = useRef<FlatList<number>>(null);
  const indexToYearMonth = useMemo(() => monthAt(anchorYear, anchorMonth, BEFORE), [anchorYear, anchorMonth]);
  // 달마다 높이(4~6주)가 달라 누적 위치표를 미리 만든다 — 측정 없이 그 달로 바로 뛴다
  const layout = useMemo(
    () => buildMonthLayout(anchorYear, anchorMonth, BEFORE, MONTH_COUNT, weekStart, weekH, TITLE_H),
    [anchorYear, anchorMonth, weekStart, weekH],
  );
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  // 같은 달이면 상태를 바꾸지 않는다(스크롤 중 다시 그리기 최소 — 32)
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const L = layoutRef.current;
    const atEnd = contentOffset.y + layoutMeasurement.height >= contentSize.height - 1;
    const y = atEnd ? L.total : contentOffset.y + layoutMeasurement.height / 4;
    const idx = monthIndexAt(L.offsets, y);
    if (idx !== visibleIdxRef.current) setVisibleIdx(idx);
  }, []);
  const getItemLayout = useCallback((_: unknown, index: number) => ({ length: layout.heights[index], offset: layout.offsets[index], index }), [layout]);
  const goToIndex = useCallback((idx: number, animated = true) => {
    const clamped = Math.max(0, Math.min(MONTH_COUNT - 1, idx));
    setVisibleIdx(clamped);
    // 목록이 새로 만들어질 수 있어(확대 풀기 등) 다음 프레임에 스크롤한다
    requestAnimationFrame(() => { try { listRef.current?.scrollToIndex({ index: clamped, animated }); } catch {} });
  }, []);
  return { visibleIdx, visibleIdxRef, listRef, indexToYearMonth, layout, onScroll, getItemLayout, goToIndex };
}

const PAGES = Array.from({ length: MONTH_COUNT }, (_, i) => i);

/** 달 목록 — 32(저사양) 기준 설정을 한곳에 둔다 */
export function MonthList({ listKey, listRef, renderItem, getItemLayout, initialIndex, onScroll, scrollEnabled = true }: {
  listKey: string;
  listRef: React.RefObject<FlatList<number> | null>;
  renderItem: ({ item }: { item: number }) => React.ReactElement;
  getItemLayout: (data: unknown, index: number) => { length: number; offset: number; index: number };
  initialIndex: number;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEnabled?: boolean;
}) {
  return (
    <FlatList
      // 칸 높이·폭·주 시작이 바뀌면 높이표가 달라져 같은 스크롤 위치가 엉뚱한 달이 된다 — 새로 만들어 보던 달에서 다시 시작
      key={listKey}
      ref={listRef as any}
      data={PAGES}
      keyExtractor={String}
      renderItem={renderItem}
      getItemLayout={getItemLayout as any}
      initialScrollIndex={initialIndex}
      onScroll={onScroll}
      onMomentumScrollEnd={onScroll}
      scrollEventThrottle={100}
      showsVerticalScrollIndicator={false}
      // 한 달이 거의 한 화면이라 앞뒤 한 화면씩만 그려 둔다
      windowSize={3}
      maxToRenderPerBatch={1}
      initialNumToRender={2}
      updateCellsBatchingPeriod={50}
      removeClippedSubviews={Platform.OS === 'android'}
      scrollEnabled={scrollEnabled}
    />
  );
}
