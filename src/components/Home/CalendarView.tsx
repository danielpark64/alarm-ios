import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { View, FlatList, TouchableOpacity, Modal, StyleSheet, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent, LayoutChangeEvent } from 'react-native';
import { Text } from '../common/AppText';
import { Alarm, DAYS } from '../../constants';
import { Palette } from '../../constants/colors';
import { useColors } from '../../hooks/useTheme';
import { pad, todayStr, getType, alarmsForDate, isWorkAlarm, shiftForDate, isOffDay, shiftColorMap, shiftPeriodLabel, shiftPeriodColor, lunarDateText, lunarShortText } from '../../utils';
import { getHoliday } from '../../constants/holidays';

// 달력 화면 — 근무 알람(주기+출근/퇴근)은 배경색으로 근무조를 표시하고,
// 그 외 알람만 칩으로 보여준다. 날짜를 누르면 하루 상세 팝업이 뜬다.
// 좌우로 스와이프하면 한 달씩(무한) 이동, 상단 연도 숫자를 누르면 연도 선택 팝업이 뜬다.
interface Props {
  alarms: Alarm[];
  onEditAlarm: (a: Alarm) => void;
  onUpdateAlarm?: (id: number, data: Partial<Alarm>) => void;
}

// 항상 6주(42칸)로 맞춰서 매달 페이지 폭이 동일하게 — 가로 페이징에 필수
const ROWS = 6;
const TOTAL_CELLS = ROWS * 7;
const CELL_MB = 2;
// 칸 높이는 고정값이 아니라 실제 할당된 화면 공간을 측정해서 계산한다(폰/태블릿 화면비가 달라도 한 달이 항상 한 화면에 들어오도록).
// 측정 전 첫 렌더용 대체값.
const FALLBACK_CELL_H = 58;
// 앞뒤 20년치 — 실사용상 끝에 닿을 일이 없어 사실상 무한 스크롤처럼 느껴진다
const RANGE = 240;
// 연도 선택 팝업 — 2열 세로 배치. 현재 연도가 1열 가운데(위에서 3번째)에 오도록 페이지를 잡아서
// 바로 앞뒤 연도가 같은 열 안에서 위/아래로 붙게 한다(다른 열로 떨어지면 "앞뒤"라는 인접감이 안 느껴짐).
const YEAR_ROWS = 4;
const YEARS_PER_PAGE = YEAR_ROWS * 2;
const YEAR_CENTER_OFFSET = 2; // 페이지 시작 연도 = 현재 연도 - 2 (1열의 3번째 자리에 오도록)

interface DayInfo { alarms: Alarm[]; shift: Alarm|null; off: boolean }

function buildDayMap(alarms: Alarm[], year: number, month: number): Record<string, DayInfo> {
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const map: Record<string, DayInfo> = {};
  for (let d=1; d<=daysInMonth; d++) {
    const ds = `${year}-${pad(month+1)}-${pad(d)}`;
    map[ds] = {
      // 팝업에서 "이날 꺼진 알람"도 보여줘야 하므로 skip 포함 목록을 쓰고, 칩에서는 걸러낸다
      alarms: alarmsForDate(alarms, ds, true),
      shift:  shiftForDate(alarms, ds),
      off:    isOffDay(alarms, ds),
    };
  }
  return map;
}

function buildCells(year: number, month: number): (number|null)[] {
  const firstDow = new Date(year, month, 1).getDay();
  const offset = (firstDow + 6) % 7;
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const cells: (number|null)[] = [];
  for (let i=0; i<offset; i++) cells.push(null);
  for (let d=1; d<=daysInMonth; d++) cells.push(d);
  while (cells.length < TOTAL_CELLS) cells.push(null);
  return cells;
}

interface MonthGridProps {
  year: number; month: number; alarms: Alarm[];
  colorOf: Record<number, string>; today: string; showLunar: boolean; width: number;
  cv: ReturnType<typeof makeStyles>;
  cellH: number; itemHeight: number;
  onSelectDate: (ds: string) => void;
}

const MonthGrid = React.memo(function MonthGrid({ year, month, alarms, colorOf, today, showLunar, width, cv, cellH, itemHeight, onSelectDate }: MonthGridProps) {
  const cells = useMemo(() => buildCells(year, month), [year, month]);
  const dayMap = useMemo(() => buildDayMap(alarms, year, month), [alarms, year, month]);
  const offset = cells.findIndex(c => c !== null);

  return (
    <View style={[cv.grid, { height: itemHeight, width, paddingHorizontal: 14 }]}>
      {cells.map((d, i) => {
        if (!d) return <View key={i} style={[cv.cell, { height: cellH }]}/>;
        const ds = `${year}-${pad(month+1)}-${pad(d)}`;
        const isToday = ds === today;
        const dow = (offset + d - 1) % 7;
        const info = dayMap[ds];
        const chips = info.alarms.filter(a => !isWorkAlarm(a) && !a.skips?.includes(ds));
        // 사용자가 근무 시간대(초/중/말/기타)를 직접 지정했으면 고정색으로 눈에 띄게, 아니면 기존 시간순 자동 배색
        const explicitShiftColor = info.shift ? shiftPeriodColor(info.shift) : null;
        const sc = explicitShiftColor ?? (info.shift ? colorOf[info.shift.id] : null);
        const holiday = getHoliday(ds);

        return (
          <TouchableOpacity
            key={i}
            activeOpacity={0.7}
            onPress={() => onSelectDate(ds)}
            style={[
              cv.cell,
              { height: cellH },
              info.off          && cv.cellOff,
              isToday           && cv.cellToday,
            ]}
          >
            <Text style={[
              cv.dayNum,
              (dow >= 5 || holiday) && {color:'#e07070'},
              isToday && cv.dayNumToday,
            ]}>{d}</Text>
            {showLunar && (
              <Text style={cv.lunarLabel} numberOfLines={1}>{lunarShortText(ds)}</Text>
            )}
            {holiday && (
              <Text style={cv.holidayLabel} numberOfLines={1}>{holiday}</Text>
            )}
            {info.shift && (
              <View style={cv.shiftTagRow}>
                <View style={[cv.shiftDot, { backgroundColor: sc! }]} />
                <Text style={[cv.shiftLabel, {color: sc!}]} numberOfLines={1}>
                  {shiftPeriodLabel(info.shift)}
                </Text>
              </View>
            )}
            {info.off && (
              <Text style={cv.offLabel}>비번</Text>
            )}
            {chips.slice(0,2).map((al, ai) => {
              const alType = getType(al.typeId);
              return (
                <Text
                  key={ai}
                  style={[cv.alarmChip, { color: alType.color, backgroundColor: alType.color + '22', borderColor: alType.color + '55', borderWidth: 0.5 }]}
                  numberOfLines={1}
                >{al.label}</Text>
              );
            })}
            {chips.length > 2 && (
              <Text style={cv.moreChip}>+{chips.length-2}</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

export function CalendarView({ alarms, onEditAlarm, onUpdateAlarm }: Props) {
  const C = useColors();
  const cv = makeStyles(C);
  const { width: winWidth } = useWindowDimensions();
  const today = todayStr();
  const todayDate = new Date(today);
  const anchorYear  = todayDate.getFullYear();
  const anchorMonth = todayDate.getMonth();

  const [pageIndex, setPageIndex] = useState(RANGE);
  const [selDate, setSelDate] = useState<string|null>(null);
  const [showLunar, setShowLunar] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const listRef = useRef<FlatList>(null);

  // 달력 칸 영역에 실제로 할당된 높이를 측정해서 칸 크기를 역산 — 폰/태블릿 등 화면비가 달라도
  // 한 달(6주)이 항상 한 화면 안에 들어오게 한다. 측정 전에는 대체값으로 렌더링.
  const [gridAreaH, setGridAreaH] = useState(0);
  const onGridAreaLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setGridAreaH(prev => (Math.abs(prev - h) > 1 ? h : prev));
  }, []);
  const cellH = gridAreaH > 0
    ? Math.max(40, Math.min(90, Math.floor(gridAreaH / ROWS) - CELL_MB))
    : FALLBACK_CELL_H;
  const itemHeight = gridAreaH > 0 ? gridAreaH : ROWS * (FALLBACK_CELL_H + CELL_MB);

  const indexToYearMonth = useCallback((idx: number) => {
    const total = anchorYear * 12 + anchorMonth + (idx - RANGE);
    return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
  }, [anchorYear, anchorMonth]);

  const { year, month } = indexToYearMonth(pageIndex);

  const goToIndex = (idx: number, animated = true) => {
    const clamped = Math.max(0, Math.min(RANGE * 2, idx));
    setPageIndex(clamped);
    listRef.current?.scrollToIndex({ index: clamped, animated });
  };
  const prevMonth = () => goToIndex(pageIndex - 1);
  const nextMonth = () => goToIndex(pageIndex + 1);
  // 연도 선택 팝업에서 고른 연도로 이동 — 같은 달을 유지한 채 해당 연도로 즉시 이동
  const selectYear = (newYear: number) => {
    goToIndex(RANGE + (newYear - anchorYear) * 12 + (month - anchorMonth), false);
  };
  // 현재 페이지 시작 연도 — 팝업을 열 때마다 현재 연도가 1열 가운데 자리에 오도록 재설정
  const [yearPageStart, setYearPageStart] = useState(anchorYear - YEAR_CENTER_OFFSET);
  useEffect(() => {
    if (showYearPicker) setYearPageStart(year - YEAR_CENTER_OFFSET);
  }, [showYearPicker, year]);
  // 순서대로 채운 배열을 반으로 나누면 앞 4개가 1열, 뒤 4개가 2열 — 현재 연도와 바로 앞뒤 연도가 1열 안에서 위아래로 붙는다
  const yearOptions = useMemo(
    () => Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearPageStart + i),
    [yearPageStart],
  );
  const yearCol1 = yearOptions.slice(0, YEAR_ROWS);
  const yearCol2 = yearOptions.slice(YEAR_ROWS);
  const prevYearPage = () => setYearPageStart(v => v - YEARS_PER_PAGE);
  const nextYearPage = () => setYearPageStart(v => v + YEARS_PER_PAGE);

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / winWidth);
    if (idx !== pageIndex) setPageIndex(idx);
  };

  const dayMap = useMemo(() => buildDayMap(alarms, year, month), [alarms, year, month]);
  const colorOf = useMemo(() => shiftColorMap(alarms), [alarms]);

  const selInfo = selDate ? dayMap[selDate] : null;
  const selDateObj = selDate ? new Date(selDate) : null;

  const pages = useMemo(() => Array.from({ length: RANGE * 2 + 1 }, (_, i) => i), []);

  return (
    <View style={{flex:1, backgroundColor:C.bg}}>
      <View style={{paddingHorizontal:14, paddingTop:6}}>
        {/* 월 네비 */}
        <View style={cv.nav}>
          <TouchableOpacity onPress={prevMonth} style={cv.navBtn}>
            <Text style={cv.navArrow}>‹</Text>
          </TouchableOpacity>
          <View style={cv.navTitleRow}>
            <TouchableOpacity style={cv.yearTapBtn} activeOpacity={0.6} onPress={() => setShowYearPicker(true)}>
              <Text style={cv.navTitle}>{year}년</Text>
              <Text style={cv.yearChevron}>▾</Text>
            </TouchableOpacity>
            <Text style={cv.navTitle}> {month+1}월</Text>
            <TouchableOpacity
              style={[cv.lunarToggle, showLunar && cv.lunarToggleActive]}
              onPress={() => setShowLunar(v => !v)}
            >
              <Text style={[cv.lunarToggleText, showLunar && cv.lunarToggleTextActive]}>음력</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={nextMonth} style={cv.navBtn}>
            <Text style={cv.navArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 요일 헤더 — 달이 바뀌어도 고정 */}
        <View style={cv.grid}>
          {DAYS.map((d,i) => (
            <View key={i} style={cv.headCell}>
              <Text style={[cv.headText, i>=5 && {color:'#e07070'}]}>{d}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 날짜 그리드 — 좌우로 계속 스와이프해서 달 이동 (무한) */}
      {/* flex:1로 남는 공간을 다 차지하게 하고 그 실측 높이로 칸 크기를 역산 (폰/태블릿 화면비 대응) */}
      <View style={{ flex: 1, position: 'relative' }} onLayout={onGridAreaLayout}>
        <FlatList
          ref={listRef}
          data={pages}
          horizontal
          keyExtractor={(i) => String(i)}
          renderItem={({ item }) => {
            const { year: y, month: m } = indexToYearMonth(item);
            return <MonthGrid year={y} month={m} alarms={alarms} colorOf={colorOf} today={today} showLunar={showLunar} width={winWidth} cv={cv} cellH={cellH} itemHeight={itemHeight} onSelectDate={setSelDate} />;
          }}
          getItemLayout={(_, index) => ({ length: winWidth, offset: winWidth * index, index })}
          initialScrollIndex={RANGE}
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
          style={{ height: itemHeight }}
          windowSize={3}
          maxToRenderPerBatch={2}
          initialNumToRender={1}
          updateCellsBatchingPeriod={30}
          removeClippedSubviews
        />
      </View>

      {/* 연도 선택 팝업 */}
      <Modal visible={showYearPicker} transparent animationType="fade" onRequestClose={() => setShowYearPicker(false)}>
        <TouchableOpacity style={cv.modalBack} activeOpacity={1} onPress={() => setShowYearPicker(false)}>
          <TouchableOpacity activeOpacity={1} style={cv.yearModalCard} onPress={() => {}}>
            <View style={cv.yearNavRow}>
              <TouchableOpacity onPress={prevYearPage} style={cv.navBtn}>
                <Text style={cv.navArrow}>‹</Text>
              </TouchableOpacity>
              <Text style={cv.modalTitle}>연도 선택</Text>
              <TouchableOpacity onPress={nextYearPage} style={cv.navBtn}>
                <Text style={cv.navArrow}>›</Text>
              </TouchableOpacity>
            </View>
            <View style={cv.yearGrid}>
              {[yearCol1, yearCol2].map((col, ci) => (
                <View key={ci} style={cv.yearCol}>
                  {col.map((y) => {
                    const isActive = y === year;
                    const isNear = y === year - 1 || y === year + 1;
                    return (
                      <TouchableOpacity
                        key={y}
                        style={[cv.yearBtn, isNear && cv.yearBtnNear, isActive && cv.yearBtnActive]}
                        activeOpacity={0.7}
                        onPress={() => { selectYear(y); setShowYearPicker(false); }}
                      >
                        <Text style={[cv.yearBtnText, isNear && cv.yearBtnTextNear, isActive && cv.yearBtnTextActive]}>{y}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
            <TouchableOpacity style={cv.modalClose} onPress={() => setShowYearPicker(false)}>
              <Text style={cv.modalCloseText}>닫기</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 하루 상세 팝업 */}
      <Modal visible={selDate != null} transparent animationType="fade" onRequestClose={() => setSelDate(null)}>
        <TouchableOpacity style={cv.modalBack} activeOpacity={1} onPress={() => setSelDate(null)}>
          <TouchableOpacity activeOpacity={1} style={cv.modalCard} onPress={() => {}}>
            {selDateObj && (
              <Text style={cv.modalTitle}>
                {selDateObj.getMonth()+1}월 {selDateObj.getDate()}일 ({DAYS[(selDateObj.getDay()+6)%7]})
              </Text>
            )}
            {selDate && (
              <Text style={cv.modalLunar}>{lunarDateText(selDate)}</Text>
            )}
            {selDate && getHoliday(selDate) && (
              <View style={cv.modalHolidayRow}>
                <Text style={cv.modalHolidayText}>{getHoliday(selDate)}</Text>
              </View>
            )}
            {selInfo?.shift && (
              <View style={[cv.modalShiftRow, {backgroundColor: colorOf[selInfo.shift.id] + '22'}]}>
                <Text style={[cv.modalShiftText, {color: colorOf[selInfo.shift.id]}]}>
                  {selInfo.shift.label || getType(selInfo.shift.typeId).label} 근무
                </Text>
              </View>
            )}
            {selInfo?.off && (
              <View style={cv.modalOffRow}>
                <Text style={cv.modalOffText}>비번 (쉬는 날)</Text>
              </View>
            )}
            {selInfo && selInfo.alarms.length > 0 ? (
              selInfo.alarms
                .slice()
                .sort((a,b) => a.hour-b.hour || a.min-b.min)
                .map((al, ai) => {
                  const alType = getType(al.typeId);
                  const skipped = !!(selDate && al.skips?.includes(selDate));
                  // "이날만 끄기"는 오늘 이후 + 반복 알람만 (한 번 알람은 스위치로 끄면 됨)
                  const canSkip = !!onUpdateAlarm && !!selDate && selDate >= today && al.rm !== 'once';
                  const toggleSkip = () => {
                    if (!selDate || !onUpdateAlarm) return;
                    const next = skipped
                      ? (al.skips ?? []).filter(s => s !== selDate)
                      : [...(al.skips ?? []), selDate];
                    onUpdateAlarm(al.id, { skips: next.length ? next : undefined });
                  };
                  return (
                    <View key={ai} style={cv.modalAlarmRow}>
                      <TouchableOpacity
                        style={[cv.modalAlarmMain, skipped && {opacity:0.45}]}
                        activeOpacity={0.7}
                        onPress={() => { setSelDate(null); onEditAlarm(al); }}
                      >
                        <Text style={cv.modalAlarmIcon}>{alType.icon}</Text>
                        <View style={{flex:1, minWidth:0}}>
                          <Text style={cv.modalAlarmTime}>{pad(al.hour)}:{pad(al.min)}</Text>
                          <Text style={cv.modalAlarmLabel} numberOfLines={1}>
                            {al.label || alType.label}{skipped ? ' · 이날 꺼짐' : ''}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      {canSkip && (
                        <TouchableOpacity
                          style={skipped ? cv.skipBtnOn : cv.skipBtn}
                          activeOpacity={0.7}
                          onPress={toggleSkip}
                        >
                          <Text style={skipped ? cv.skipBtnOnText : cv.skipBtnText}>
                            {skipped ? '다시 켜기' : '이날 끄기'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
            ) : (
              <Text style={cv.modalEmpty}>이날 울리는 알람이 없어요</Text>
            )}
            <TouchableOpacity style={cv.modalClose} onPress={() => setSelDate(null)}>
              <Text style={cv.modalCloseText}>닫기</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    nav:         { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:4 },
    navBtn:      { padding:10 },
    navArrow:    { fontSize:28, color:C.txt, fontWeight:'900' },
    navTitle:    { fontSize:20, fontWeight:'900', color:C.txt },
    navTitleRow: { flexDirection:'row', alignItems:'center', gap:8 },
    lunarToggle:      { paddingHorizontal:9, paddingVertical:4, borderRadius:9, borderWidth:1, borderColor:C.border2 },
    lunarToggleActive:{ backgroundColor:'rgba(162,155,254,0.16)', borderColor:C.accent },
    lunarToggleText:      { fontSize:11, fontWeight:'700', color:C.txt3 },
    lunarToggleTextActive:{ color:C.accent },
    // 연도가 탭 가능한 버튼임을 알아보기 쉽게 배경 pill + 아래쪽 화살표로 강조
    // 연도 탭 영역 — 고령자도 "여기가 눌리는 곳"임을 한눈에 알 수 있게 큼직한 알약 버튼 + 진한 배경으로 강조
    yearTapBtn:  { flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:8, borderRadius:14, backgroundColor:C.bg3, borderWidth:1.5, borderColor:C.border2 },
    yearChevron: { fontSize:16, fontWeight:'900', color:C.txt3, marginLeft:4 },
    yearModalCard:{ backgroundColor:C.bg2, borderRadius:22, padding:16, borderWidth:1, borderColor:C.border, alignSelf:'center', width:320 },
    yearNavRow:  { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:4 },
    // 스크롤 없이 2열×4줄(8개), 좌우 화살표로 8년씩 이동. 순서대로 채운 배열을 반으로 나눠 1열/2열에 넣으므로
    // 현재 연도(가운데 자리)와 바로 앞뒤 연도가 같은 열 안에서 위아래로 붙어 보인다.
    yearGrid:    { flexDirection:'row', justifyContent:'center', gap:8, marginTop:16 },
    yearCol:     { flexDirection:'column', gap:8, flex:1 },
    yearBtn:     { height:56, borderRadius:16, alignItems:'center', justifyContent:'center', backgroundColor:C.bg3 },
    // 바로 앞뒤 연도는 옅은 테두리로 2단계 강조 — 현재 연도로 시선이 자연스럽게 이어지도록
    yearBtnNear: { borderWidth:2, borderColor:C.accent, backgroundColor:C.bg3 },
    yearBtnTextNear:{ color:C.accent, fontWeight:'900' },
    // 선택된 연도는 배경을 꽉 채운 단일 강조로만 표시 — 앱 전반의 활성 버튼 톤(accent2 채움 + 흰 글자)과 통일
    yearBtnActive:{ backgroundColor:C.accent2 },
    yearBtnText: { fontSize:19, fontWeight:'800', color:C.txt3 },
    yearBtnTextActive:{ color:'#fff', fontWeight:'900' },
    grid:        { flexDirection:'row', flexWrap:'wrap' },
    headCell:    { width:'14.28%', alignItems:'center', paddingVertical:3 },
    headText:    { fontSize:11, fontWeight:'700', color:C.txt3 },
    cell:        { width:'14.28%', marginBottom:CELL_MB, padding:2, borderRadius:8 },
    // 비번 = "달력의 빨간 날" — 다른 셀은 전부 테두리가 없으니, 비번만 유일한 점선 테두리 패턴으로 색 없이도 눈에 띔.
    // 배경은 아주 옅게(5%)만 남겨서 색으로 훑어볼 때도 살짝 도움이 되게.
    cellOff:     { borderWidth:2.5, borderStyle:'dashed', borderColor:'#e05252', backgroundColor:'rgba(224,82,82,0.05)' },
    cellToday:   { borderWidth:1.5, borderStyle:'solid', borderColor:C.accent },
    dayNum:      { fontSize:12, fontWeight:'700', color:C.txt, marginBottom:1, textAlign:'center' },
    dayNumToday: { color:C.accent, fontWeight:'900' },
    lunarLabel:  { fontSize:9, fontWeight:'600', color:C.txt3, textAlign:'center', marginTop:-2, marginBottom:1 },
    // 공휴일 이름표 — 비번(빨강)과 헷갈리지 않게 골드 계열로 구분
    holidayLabel:{ fontSize:9, fontWeight:'800', color:'#e0a44d', textAlign:'center', marginBottom:1 },
    // 근무 시간대는 셀 전체가 아니라 작은 점+글자 태그로만 — 비번과 시각적으로 경쟁하지 않도록 낮춰서 위계를 분리
    shiftTagRow: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:3, marginBottom:1 },
    shiftDot:    { width:7, height:7, borderRadius:3.5 },
    shiftLabel:  { fontSize:11.5, fontWeight:'800', textAlign:'center' },
    // 비번은 유일하게 점선 테두리인 패턴 자체로 눈에 띄게 — 배경은 아주 옅게(5%)만 남기고 글자를 굵고 진하게
    offLabel:    { fontSize:12, fontWeight:'900', color:'#e05252', textAlign:'center', marginBottom:1 },
    alarmChip:   { fontSize:9, fontWeight:'700', color:C.accent2, backgroundColor:'rgba(108,92,231,0.18)', borderRadius:4, paddingHorizontal:3, paddingVertical:1, marginBottom:1 },
    moreChip:    { fontSize:9, color:C.txt3, fontWeight:'700', textAlign:'center' },
    modalBack:   { flex:1, backgroundColor:'rgba(0,0,0,0.55)', justifyContent:'center', padding:28 },
    modalCard:   { backgroundColor:C.bg2, borderRadius:20, padding:20, borderWidth:1, borderColor:C.border },
    modalTitle:  { fontSize:19, fontWeight:'800', color:C.txt, textAlign:'center' },
    modalLunar:  { fontSize:12, fontWeight:'600', color:C.txt3, textAlign:'center', marginBottom:12 },
    modalHolidayRow:{ borderRadius:12, paddingVertical:6, paddingHorizontal:12, marginBottom:8, alignItems:'center', backgroundColor:'rgba(224,164,77,0.14)' },
    modalHolidayText:{ fontSize:13, fontWeight:'800', color:'#e0a44d' },
    modalShiftRow:{ borderRadius:12, paddingVertical:8, paddingHorizontal:12, marginBottom:10, alignItems:'center' },
    modalShiftText:{ fontSize:15, fontWeight:'800' },
    modalOffRow: { borderRadius:12, paddingVertical:8, paddingHorizontal:12, marginBottom:10, alignItems:'center', borderWidth:1.8, borderStyle:'dashed', borderColor:'#e05252', backgroundColor:'rgba(224,82,82,0.26)' },
    modalOffText:{ fontSize:15, fontWeight:'800', color:'#e05252' },
    modalAlarmRow:{ flexDirection:'row', alignItems:'center', gap:10, paddingVertical:12, borderBottomWidth:1, borderBottomColor:C.border },
    modalAlarmMain:{ flex:1, minWidth:0, flexDirection:'row', alignItems:'center', gap:12 },
    skipBtn:     { paddingHorizontal:12, paddingVertical:10, borderRadius:12, borderWidth:1.3, borderColor:'#e05252' },
    skipBtnText: { fontSize:13, fontWeight:'700', color:'#f06565' },
    skipBtnOn:   { paddingHorizontal:12, paddingVertical:10, borderRadius:12, borderWidth:1.3, borderColor:C.accent, backgroundColor:'rgba(162,155,254,0.12)' },
    skipBtnOnText:{ fontSize:13, fontWeight:'700', color:C.accent },
    modalAlarmIcon:{ fontSize:22 },
    modalAlarmTime:{ fontSize:18, fontWeight:'800', color:C.txt },
    modalAlarmLabel:{ fontSize:13, color:C.txt2, marginTop:1 },
    modalArrow:  { fontSize:22, color:C.txt3 },
    modalEmpty:  { fontSize:14, color:C.txt3, textAlign:'center', paddingVertical:18 },
    modalClose:  { marginTop:14, paddingVertical:12, borderRadius:14, alignItems:'center', backgroundColor:'rgba(162,155,254,0.14)', borderWidth:1, borderColor:'rgba(162,155,254,0.35)' },
    modalCloseText:{ fontSize:15, fontWeight:'700', color:C.accent },
  });
}
