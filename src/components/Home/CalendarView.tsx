import React, { useState, useMemo, useRef, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, Modal, StyleSheet, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Text } from '../common/AppText';
import { Alarm, DAYS } from '../../constants';
import { Palette } from '../../constants/colors';
import { useColors } from '../../hooks/useTheme';
import { pad, todayStr, getType, alarmsForDate, isWorkAlarm, shiftForDate, isOffDay, shiftColorMap, lunarDateText, lunarShortText } from '../../utils';
import { getHoliday } from '../../constants/holidays';

// 달력 화면 — 근무 알람(주기+출근/퇴근)은 배경색으로 근무조를 표시하고,
// 그 외 알람만 칩으로 보여준다. 날짜를 누르면 하루 상세 팝업이 뜬다.
// 좌우로 스와이프하면 한 달씩(무한), 오른쪽 화살표 바로는 1년씩 점프한다.
interface Props {
  alarms: Alarm[];
  onEditAlarm: (a: Alarm) => void;
  onUpdateAlarm?: (id: number, data: Partial<Alarm>) => void;
}

// 항상 6주(42칸)로 맞춰서 매달 페이지 폭이 동일하게 — 가로 페이징에 필수
const ROWS = 6;
const TOTAL_CELLS = ROWS * 7;
const CELL_H = 72;
const CELL_MB = 3;
const ITEM_HEIGHT = ROWS * (CELL_H + CELL_MB);
// 앞뒤 20년치 — 실사용상 끝에 닿을 일이 없어 사실상 무한 스크롤처럼 느껴진다
const RANGE = 240;
const YEAR_JUMP = 12; // 오른쪽 화살표 바 한 번에 1년(=12개월)

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
  onSelectDate: (ds: string) => void;
}

const MonthGrid = React.memo(function MonthGrid({ year, month, alarms, colorOf, today, showLunar, width, cv, onSelectDate }: MonthGridProps) {
  const cells = useMemo(() => buildCells(year, month), [year, month]);
  const dayMap = useMemo(() => buildDayMap(alarms, year, month), [alarms, year, month]);
  const offset = cells.findIndex(c => c !== null);

  return (
    <View style={[cv.grid, { height: ITEM_HEIGHT, width, paddingHorizontal: 14 }]}>
      {cells.map((d, i) => {
        if (!d) return <View key={i} style={cv.cell}/>;
        const ds = `${year}-${pad(month+1)}-${pad(d)}`;
        const isToday = ds === today;
        const dow = (offset + d - 1) % 7;
        const info = dayMap[ds];
        const chips = info.alarms.filter(a => !isWorkAlarm(a) && !a.skips?.includes(ds));
        const sc = info.shift ? colorOf[info.shift.id] : null;
        const holiday = getHoliday(ds);

        return (
          <TouchableOpacity
            key={i}
            activeOpacity={0.7}
            onPress={() => onSelectDate(ds)}
            style={[
              cv.cell,
              sc       != null && { backgroundColor: sc + '22' },
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
              <Text style={[cv.shiftLabel, {color: sc!}]} numberOfLines={1}>
                {getType(info.shift.typeId).label}
              </Text>
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
  const listRef = useRef<FlatList>(null);

  const indexToYearMonth = useCallback((idx: number) => {
    const total = anchorYear * 12 + anchorMonth + (idx - RANGE);
    return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
  }, [anchorYear, anchorMonth]);

  const { year, month } = indexToYearMonth(pageIndex);

  const goToIndex = (idx: number) => {
    const clamped = Math.max(0, Math.min(RANGE * 2, idx));
    setPageIndex(clamped);
    listRef.current?.scrollToIndex({ index: clamped, animated: true });
  };
  const prevMonth = () => goToIndex(pageIndex - 1);
  const nextMonth = () => goToIndex(pageIndex + 1);
  const prevYear  = () => goToIndex(pageIndex - YEAR_JUMP);
  const nextYear  = () => goToIndex(pageIndex + YEAR_JUMP);

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / winWidth);
    if (idx !== pageIndex) setPageIndex(idx);
  };

  // 현재 보이는 달 기준 범례/비번 여부 (칸 렌더링 자체는 MonthGrid가 각자 계산)
  const dayMap = useMemo(() => buildDayMap(alarms, year, month), [alarms, year, month]);
  const legendAlarms = useMemo(() => {
    const seen = new Map<number, Alarm>();
    Object.values(dayMap).forEach(info => {
      if (info.shift && !seen.has(info.shift.id)) seen.set(info.shift.id, info.shift);
    });
    return [...seen.values()].sort((a,b) => a.hour-b.hour || a.min-b.min);
  }, [dayMap]);
  const hasOff = useMemo(() => Object.values(dayMap).some(i => i.off), [dayMap]);
  const colorOf = useMemo(() => shiftColorMap(alarms), [alarms]);

  const selInfo = selDate ? dayMap[selDate] : null;
  const selDateObj = selDate ? new Date(selDate) : null;

  const pages = useMemo(() => Array.from({ length: RANGE * 2 + 1 }, (_, i) => i), []);

  return (
    <View style={{flex:1, backgroundColor:C.bg}}>
      <View style={{padding:14, paddingBottom:0}}>
        {/* 월 네비 */}
        <View style={cv.nav}>
          <TouchableOpacity onPress={prevMonth} style={cv.navBtn}>
            <Text style={cv.navArrow}>‹</Text>
          </TouchableOpacity>
          <View style={cv.navTitleRow}>
            <Text style={cv.navTitle}>{year}년 {month+1}월</Text>
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

      {/* 날짜 그리드 — 좌우로 계속 스와이프해서 달 이동 (20년 범위), 오른쪽 바로 1년씩 점프 */}
      <View style={{ height: ITEM_HEIGHT, position: 'relative' }}>
        <FlatList
          ref={listRef}
          data={pages}
          horizontal
          keyExtractor={(i) => String(i)}
          renderItem={({ item }) => {
            const { year: y, month: m } = indexToYearMonth(item);
            return <MonthGrid year={y} month={m} alarms={alarms} colorOf={colorOf} today={today} showLunar={showLunar} width={winWidth} cv={cv} onSelectDate={setSelDate} />;
          }}
          getItemLayout={(_, index) => ({ length: winWidth, offset: winWidth * index, index })}
          initialScrollIndex={RANGE}
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
          style={{ height: ITEM_HEIGHT }}
        />
        {/* 연도 이동 오버레이 — 그리드 폭에 영향 없이 위에 떠 있음 */}
        <View style={cv.yearBar} pointerEvents="box-none">
          <TouchableOpacity style={cv.yearBarBtn} onPress={prevYear}>
            <Text style={cv.yearBarArrow}>▲</Text>
          </TouchableOpacity>
          <Text style={cv.yearBarLabel}>년</Text>
          <TouchableOpacity style={cv.yearBarBtn} onPress={nextYear}>
            <Text style={cv.yearBarArrow}>▼</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{paddingHorizontal:14}}>
        {/* 범례 */}
        {(legendAlarms.length > 0 || hasOff) && (
          <View style={cv.legend}>
            {legendAlarms.map((a, i) => (
              <View key={i} style={cv.legendItem}>
                <View style={[cv.legendBox, {backgroundColor: colorOf[a.id]}]}/>
                <Text style={cv.legendText}>{a.label || getType(a.typeId).label} {pad(a.hour)}:{pad(a.min)}</Text>
              </View>
            ))}
            {hasOff && (
              <View style={cv.legendItem}>
                <View style={cv.legendBoxOff}/>
                <Text style={cv.legendTextOff}>비번</Text>
              </View>
            )}
          </View>
        )}
      </View>

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
    nav:         { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:10 },
    navBtn:      { padding:10 },
    navArrow:    { fontSize:28, color:C.txt, fontWeight:'900' },
    navTitle:    { fontSize:18, fontWeight:'900', color:C.txt },
    navTitleRow: { flexDirection:'row', alignItems:'center', gap:8 },
    lunarToggle:      { paddingHorizontal:9, paddingVertical:4, borderRadius:9, borderWidth:1, borderColor:C.border2 },
    lunarToggleActive:{ backgroundColor:'rgba(162,155,254,0.16)', borderColor:C.accent },
    lunarToggleText:      { fontSize:11, fontWeight:'700', color:C.txt3 },
    lunarToggleTextActive:{ color:C.accent },
    // 연도 이동 오버레이 — 그리드 위에 떠 있어 칸 폭에 영향 없음
    yearBar:      { position:'absolute', right:6, top:'50%', marginTop:-46, width:30, borderRadius:14, backgroundColor:'rgba(30,30,38,0.55)', alignItems:'center', paddingVertical:8, gap:6 },
    yearBarBtn:   { padding:4 },
    yearBarArrow: { fontSize:12, color:'#cfcbe8', fontWeight:'900' },
    yearBarLabel: { fontSize:9, color:'#cfcbe8', fontWeight:'700' },
    grid:        { flexDirection:'row', flexWrap:'wrap' },
    headCell:    { width:'14.28%', alignItems:'center', paddingVertical:6 },
    headText:    { fontSize:11, fontWeight:'700', color:C.txt3 },
    cell:        { width:'14.28%', height:CELL_H, marginBottom:CELL_MB, padding:3, borderRadius:8 },
    // 비번 = "달력의 빨간 날" — 진한 빨간 채움 + 굵은 빨간 점선으로 한눈에 띄게
    cellOff:     { borderWidth:3, borderStyle:'dashed', borderColor:'#f05555', backgroundColor:'rgba(224,82,82,0.26)' },
    cellToday:   { borderWidth:1.5, borderStyle:'solid', borderColor:C.accent },
    dayNum:      { fontSize:13, fontWeight:'700', color:C.txt, marginBottom:2, textAlign:'center' },
    dayNumToday: { color:C.accent, fontWeight:'900' },
    lunarLabel:  { fontSize:9, fontWeight:'600', color:C.txt3, textAlign:'center', marginTop:-2, marginBottom:1 },
    // 공휴일 이름표 — 비번(빨강)과 헷갈리지 않게 골드 계열로 구분
    holidayLabel:{ fontSize:9, fontWeight:'800', color:'#e0a44d', textAlign:'center', marginBottom:1 },
    shiftLabel:  { fontSize:13, fontWeight:'900', textAlign:'center', marginBottom:1 },
    // 비번은 빨간 글자 — "달력의 빨간 날 = 쉬는 날" 관습에 맞춰 직관적으로
    offLabel:    { fontSize:13, fontWeight:'900', color:'#f06565', textAlign:'center', marginBottom:1 },
    alarmChip:   { fontSize:9, fontWeight:'700', color:C.accent2, backgroundColor:'rgba(108,92,231,0.18)', borderRadius:4, paddingHorizontal:3, paddingVertical:1, marginBottom:1 },
    moreChip:    { fontSize:9, color:C.txt3, fontWeight:'700', textAlign:'center' },
    legend:      { flexDirection:'row', flexWrap:'wrap', gap:12, marginTop:12, paddingHorizontal:4, paddingTop:10, borderTopWidth:1, borderTopColor:C.border },
    legendItem:  { flexDirection:'row', alignItems:'center', gap:5 },
    legendBox:   { width:11, height:11, borderRadius:3 },
    legendBoxOff:{ width:11, height:11, borderRadius:3, borderWidth:1.8, borderStyle:'dashed', borderColor:'#e05252', backgroundColor:'rgba(224,82,82,0.26)' },
    legendText:  { fontSize:12, fontWeight:'600', color:C.txt2 },
    legendTextOff:{ fontSize:12, fontWeight:'800', color:'#e05252' },
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
