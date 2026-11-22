import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Pressable, TouchableOpacity, StyleSheet, useWindowDimensions, ScrollView, Platform } from 'react-native';
import { Text } from '../common/AppText';
import { Alarm, DAYS_DISPLAY, MONTH_KEYS, DayOverrides } from '../../constants';
import { Palette } from '../../constants/colors';
import { useColors } from '../../hooks/useTheme';
import { useFontScale } from '../../hooks/useFontScale';
import { useWeekStart } from '../../hooks/useWeekStart';
import { useHolidayVersion } from '../../hooks/useHolidayVersion';
import { useT } from '../../i18n';
import { pad, todayStr, shiftForDate, effectiveShift, shiftPeriodLabel, isOffDay, dayOverrideDisplay } from '../../utils';
import { getHoliday, getHolidayShort } from '../../constants/holidays';
import { useShiftShare } from '../../hooks/useShiftShare';
import { dayStatus, isTogetherOff, dotsFor, shiftOn, MY_COLOR, type ShiftData } from '../../utils/shiftShareLink';
import { ShareBar, ShareSubRow, ShareDaySheet, rowFor, TOGETHER_GREEN, type ShareWin, type SheetRow } from './ShareBar';
import { CELL_MB, TITLE_H, BEFORE, buildCells, useGridCellH, useMonthScroll, MonthList } from './MonthScroll';

// [공유] 탭(1.6.0, 2026-11-22 사용자 "내 기존 달력과 섞이면 안 돼, 따로") — 받은 근무표는 이 화면에서만 본다.
// 연속 스크롤 부품(MonthScroll)만 내 달력과 같이 쓰고, 창·누른 날짜·스크롤 위치는 전부 이 화면 안 상태다.
// 내 근무(alarms·overrides)는 읽기만 한다 — 이 화면은 알람·하루 근무 변경을 바꾸지 않는다.
// ⚠️ 받은 근무는 알람 예약 경로로 넘기지 않는다(정적 체크 — test-alarm-suite.sh).

type MyDay = { label: string | null; off: boolean };
// 둥근 글자 배경의 잘라내기는 iOS만 — Android는 Text 배경을 이미 둥글게 그린다(CalendarView TEXT_CLIP과 같음)
const CLIP = Platform.OS === 'ios' ? 'hidden' : 'visible';

/** 그날 내 근무 — 하루 근무 변경 → 근무조 → 비번(내 달력 칸과 같은 판정) */
function myDay(alarms: Alarm[], overrides: DayOverrides, ds: string, t: (k: string) => string): MyDay {
  const ov = dayOverrideDisplay(overrides[ds]);
  if (ov) return { label: t(ov.label), off: ov.isOff };
  const sh = shiftForDate(alarms, ds);
  const r = sh ? effectiveShift(sh, ds) : null;
  if (sh && r) return { label: shiftPeriodLabel(sh, r), off: false };
  if (isOffDay(alarms, ds)) return { label: t('비번'), off: true };
  return { label: null, off: false };
}

type GridView =
  | { kind: 'me' }
  | { kind: 'person'; data: ShiftData | null }
  | { kind: 'all'; others: { color: string; data: ShiftData | null }[]; together: boolean };

interface GridProps {
  year: number; month: number; alarms: Alarm[]; overrides: DayOverrides; view: GridView;
  C: Palette; s: ReturnType<typeof makeStyles>; cellH: number; density: number; today: string; width: number;
  weekStart: number; title: string; holidayVersion: number; onSelectDate: (ds: string) => void;
}

const ShareMonthGrid = React.memo(function ShareMonthGrid({ year, month, alarms, overrides, view, C, s, cellH, density, today, width, weekStart, title, onSelectDate }: GridProps) {
  const { t } = useT();
  const cells = useMemo(() => buildCells(year, month, weekStart), [year, month, weekStart]);
  const offset = cells.findIndex(c => c !== null);
  // 내 근무는 나·전체 창에서만 필요하다 — 그 달만 한 번 계산
  const needMe = view.kind !== 'person';
  const mine = useMemo(() => {
    if (!needMe) return null;
    const m: Record<number, MyDay> = {};
    const n = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= n; d++) m[d] = myDay(alarms, overrides, `${year}-${pad(month + 1)}-${pad(d)}`, t);
    return m;
  }, [needMe, alarms, overrides, year, month, t]);

  return (
    <View style={{ width }}>
      <View style={[s.monthTitleRow, { height: TITLE_H }]}>
        <Text style={s.monthTitle} numberOfLines={1}>{title}</Text>
      </View>
      <View style={[s.grid, { width, paddingHorizontal: 14 }]}>
        {cells.map((d, i) => {
          if (!d) return <View key={`e${i}`} style={[s.cell, { height: cellH }]} />;
          const ds = `${year}-${pad(month + 1)}-${pad(d)}`;
          const dow = (offset + d - 1 + weekStart) % 7;
          const holiday = getHoliday(ds);
          const dayNum = (
            <Text style={[s.dayNum, { fontSize: 15.5 * density }, (dow === 0 || dow === 6 || holiday) && { color: C.weekendFg }, ds === today && s.dayNumToday]}>{d}</Text>
          );
          const hol = holiday ? <Text style={[s.holidayLabel, { fontSize: 9.5 * density }]} numberOfLines={1}>{getHolidayShort(ds)}</Text> : null;
          if (view.kind === 'all') {
            const me = mine![d];
            const meSt: 'work' | 'off' | null = me.off ? 'off' : me.label ? 'work' : null;
            const sts = view.others.map(o => dayStatus(o.data, ds));
            const working = [...(meSt === 'work' ? [MY_COLOR] : []), ...view.others.filter((_, k) => sts[k] === 'work').map(o => o.color)];
            const { dots, more } = dotsFor(working);
            const together = view.together && isTogetherOff([meSt, ...sts]);
            return (
              <Pressable key={`${ds}-a${together ? 1 : 0}`} onPress={() => onSelectDate(ds)}
                style={({ pressed }) => [s.cell, { height: cellH }, together && s.cellTogether, pressed && s.cellPressed]}>
                {dayNum}{hol}
                <View style={s.dotRow}>
                  {dots.map((c, k) => <View key={k} style={[s.personDot, { backgroundColor: c }]} />)}
                </View>
                {more > 0 && <Text style={s.moreChip}>+{more}</Text>}
              </Pressable>
            );
          }
          // 나·사람 창 — 그 사람 근무만(보기만)
          let sh: { label: string; color: string; off: boolean } | null;
          if (view.kind === 'person') sh = shiftOn(view.data, new Date(year, month, d));
          else { const me = mine![d]; sh = me.label ? { label: me.label, color: MY_COLOR, off: me.off } : null; }
          return (
            <Pressable key={`${ds}-p${sh?.off ? 1 : 0}`} onPress={() => onSelectDate(ds)}
              style={({ pressed }) => [s.cell, { height: cellH }, sh?.off && s.cellOff, pressed && s.cellPressed]}>
              {dayNum}{hol}
              {sh && (sh.off
                ? <Text style={[s.offLabel, { fontSize: 14 * density }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{sh.label}</Text>
                : <Text style={[s.shiftLabel, { color: C.txt, backgroundColor: `${sh.color}55`, fontSize: 11.5 * density }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{sh.label}</Text>)}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

export function ShareTab({ alarms, overrides }: { alarms: Alarm[]; overrides: DayOverrides }) {
  const C = useColors();
  const { t } = useT();
  const s = useMemo(() => makeStyles(C), [C]);
  const share = useShiftShare();
  const { width: winWidth } = useWindowDimensions();
  const { weekStart } = useWeekStart();
  const holidayVersion = useHolidayVersion();
  const { fontScale } = useFontScale();
  const cellScale = fontScale === 'large' ? 1.30 : fontScale === 'small' ? 0.9 : 1;
  const today = todayStr();
  const todayDate = new Date(today);
  const anchorYear = todayDate.getFullYear();
  const anchorMonth = todayDate.getMonth();

  // 이 탭만의 상태 — 처음엔 전체 창(받은 사람이 있으면)
  const [win, setWinState] = useState<ShareWin>('all');
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const people = share.people;
  const curWin: ShareWin = win === 'me' || win === 'all' || people.some(p => p.id === win) ? win : 'all';
  const setWin = useCallback((w: ShareWin) => { setWinState(w); setSheetDate(null); }, []);
  // 링크가 오면 날짜 시트를 먼저 닫는다 — 떠 있으면 iOS가 받기 팝업을 못 띄운다(정적 체크 ⑥)
  useEffect(() => { if (share.incomingSeq) setSheetDate(null); }, [share.incomingSeq]);
  const view: GridView = useMemo(() => {
    if (curWin === 'me') return { kind: 'me' };
    if (curWin === 'all') return { kind: 'all', together: share.together, others: people.filter(p => p.visible).map(p => ({ color: p.color, data: p.data })) };
    return { kind: 'person', data: people.find(p => p.id === curWin)?.data ?? null };
  }, [curWin, people, share.together]);

  const { gridAreaH, onGridAreaLayout, cellH } = useGridCellH(winWidth, cellScale);
  const density = Math.max(0.62, Math.min(1, cellH / ((15.5 + 14) * 1.7 * cellScale + 8)));
  const weekH = cellH + CELL_MB;
  const { visibleIdx, visibleIdxRef, listRef, indexToYearMonth, onScroll, getItemLayout, goToIndex } = useMonthScroll(anchorYear, anchorMonth, weekStart, weekH);
  const { year, month } = indexToYearMonth(visibleIdx);
  const monthTitle = useCallback((y: number, m: number) => `${t('{year}년', { year: y })} ${t(MONTH_KEYS[m])}`, [t]);

  const renderMonth = useCallback(({ item }: { item: number }) => {
    const { year: y, month: m } = indexToYearMonth(item);
    return <ShareMonthGrid year={y} month={m} alarms={alarms} overrides={overrides} view={view} C={C} s={s} cellH={cellH} density={density}
      today={today} width={winWidth} weekStart={weekStart} title={monthTitle(y, m)} holidayVersion={holidayVersion} onSelectDate={setSheetDate} />;
  }, [indexToYearMonth, alarms, overrides, view, C, s, cellH, density, today, winWidth, weekStart, monthTitle, holidayVersion]);

  const sheetRows: SheetRow[] = !sheetDate ? [] : curWin === 'all'
    ? [{ id: 'me', name: t('나'), color: MY_COLOR, ...myDay(alarms, overrides, sheetDate, t) }, ...people.map(p => rowFor(p, sheetDate, t))]
    : curWin === 'me'
      ? [{ id: 'me', name: t('나'), color: MY_COLOR, ...myDay(alarms, overrides, sheetDate, t) }]
      : people.filter(p => p.id === curWin).map(p => ({ ...rowFor(p, sheetDate, t), visible: undefined }));

  const onSend = () => share.sendShare(alarms, overrides);
  const header = (
    <View style={s.top}>
      <Text style={s.title} numberOfLines={1}>{t('공유 근무표')}</Text>
      <TouchableOpacity style={s.send} onPress={onSend} accessibilityRole="button">
        <Text style={s.sendText}>{t('↗ 보내기')}</Text>
      </TouchableOpacity>
    </View>
  );

  // 받은 사람이 없으면 — 보내는 법·받는 법 안내
  if (people.length === 0) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingBottom: 24 }}>
        {header}
        <View style={s.empty}>
          <Text style={s.emptyIcon}>👥</Text>
          <Text style={s.emptyTitle}>{t('받은 근무표가 아직 없어요')}</Text>
          <Text style={s.emptySub}>{t('가족·동료와 근무표를 주고받으면 여기서 함께 볼 수 있어요. 내 달력과는 따로 보여요.')}</Text>
        </View>
        <View style={s.howCard}>
          <Text style={s.howTitle}>{t('보내는 법')}</Text>
          <Text style={s.howBody}>{t('[보내기]를 누르고 카카오톡·문자로 링크를 보내요. 받은 사람은 링크를 누르면 교대알람 [공유] 탭에서 내 근무표를 봐요.')}</Text>
        </View>
        <View style={s.howCard}>
          <Text style={s.howTitle}>{t('받는 법')}</Text>
          <Text style={s.howBody}>{t('가족·친구가 교대알람에서 [보내기]로 보낸 링크를 누르면 여기에 그 사람 창이 생겨요. 받은 근무표는 보기만 하고 알람은 울리지 않아요.\n\n창을 길게 누르면 이름·색을 바꾸거나 지울 수 있어요.')}</Text>
        </View>
        <TouchableOpacity style={s.bigSend} onPress={onSend} accessibilityRole="button">
          <Text style={s.bigSendText}>{t('내 근무표 보내기')}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {header}
      {/* 창 줄 — 전체 · 나 · 받은 사람들 · + 받는 법(가로 스크롤, 잘리지 않음) */}
      <ShareBar win={curWin} onWin={setWin} people={people} onEdit={share.editPerson} onRemove={share.removePerson} />
      <View style={{ paddingHorizontal: 14 }}>
        <ShareSubRow win={curWin} people={people} together={share.together} onTogether={share.setTogether} />
        <View style={s.nav}>
          <TouchableOpacity onPress={() => goToIndex(visibleIdx - 1)} style={s.navBtn}><Text style={s.navArrow}>‹</Text></TouchableOpacity>
          <View style={s.navTitleRow}>
            <Text style={s.navTitle}>{monthTitle(year, month)}</Text>
            {visibleIdx !== BEFORE && (
              <TouchableOpacity style={s.pill} onPress={() => goToIndex(BEFORE)} accessibilityRole="button">
                <Text style={s.pillText}>{t('오늘')}</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={() => goToIndex(visibleIdx + 1)} style={s.navBtn}><Text style={s.navArrow}>›</Text></TouchableOpacity>
        </View>
        <View style={s.grid}>
          {DAYS_DISPLAY.map((_, i) => {
            const wd = (i + weekStart) % 7;
            return (
              <View key={i} style={s.headCell}>
                <Text style={[s.headText, (wd === 0 || wd === 6) && { color: C.weekendFg }]}>{t(DAYS_DISPLAY[wd])}</Text>
              </View>
            );
          })}
        </View>
      </View>
      <View style={{ flex: 1 }} onLayout={onGridAreaLayout}>
        {gridAreaH > 0 && (
          <MonthList listKey={`${winWidth}-${weekH}-${weekStart}`} listRef={listRef} renderItem={renderMonth}
            getItemLayout={getItemLayout} initialIndex={visibleIdxRef.current} onScroll={onScroll} />
        )}
      </View>
      {/* 날짜를 누르면 그날 각자 근무. 전체 창은 [보기]로 전체 창에 넣을 사람 고르기 */}
      <ShareDaySheet date={sheetDate} rows={sheetRows} onClose={() => setSheetDate(null)}
        onToggle={curWin === 'all' ? share.setVisible : undefined} />
    </View>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10 },
    title: { fontSize: 22, fontWeight: '900', color: C.txt, flexShrink: 1 },
    send: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: C.accent2 },
    sendText: { fontSize: 14, fontWeight: '800', color: '#fff' },
    empty: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 28, paddingBottom: 18 },
    emptyIcon: { fontSize: 44, marginBottom: 10 },
    emptyTitle: { fontSize: 18, fontWeight: '900', color: C.txt, marginBottom: 8, textAlign: 'center' },
    emptySub: { fontSize: 14, color: C.txt2, textAlign: 'center', lineHeight: 21 },
    howCard: { marginHorizontal: 18, marginTop: 12, padding: 16, borderRadius: 16, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border },
    howTitle: { fontSize: 15, fontWeight: '900', color: C.txt, marginBottom: 6 },
    howBody: { fontSize: 13.5, color: C.txt2, lineHeight: 20 },
    bigSend: { marginHorizontal: 18, marginTop: 18, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: C.accent2 },
    bigSendText: { fontSize: 16, fontWeight: '900', color: '#fff' },
    nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
    navBtn: { padding: 8 },
    navArrow: { fontSize: 26, color: C.txt, fontWeight: '900' },
    navTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
    navTitle: { fontSize: 18, fontWeight: '900', color: C.txt },
    pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9, borderWidth: 1, borderColor: C.border2 },
    pillText: { fontSize: 11, fontWeight: '700', color: C.txt3 },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    headCell: { width: '14.28%', alignItems: 'center', paddingVertical: 3 },
    headText: { fontSize: 12.5, fontWeight: '800', color: C.txt2 },
    monthTitleRow: { justifyContent: 'flex-end', paddingHorizontal: 18, paddingBottom: 3 },
    monthTitle: { fontSize: 13, fontWeight: '800', color: C.txt3 },
    cell: { width: '14.28%', marginBottom: CELL_MB, padding: 2, borderRadius: 8, overflow: 'hidden' },
    cellPressed: { opacity: 0.7 },
    cellOff: { backgroundColor: C.offCellBg, borderWidth: 2, borderColor: C.offBorder },
    // 다 같이 쉬는 날 — 두꺼운 초록 상자(비번 파란 2px 테두리와 확실히 구별)
    cellTogether: { borderWidth: 3.5, borderColor: TOGETHER_GREEN, backgroundColor: 'rgba(46,204,154,0.22)' },
    dayNum: { fontSize: 15.5, fontWeight: '800', color: C.txt, marginBottom: 1, textAlign: 'center' },
    dayNumToday: { color: C.todayFg, fontWeight: '900', backgroundColor: C.todayBg, borderRadius: 11, overflow: CLIP, paddingHorizontal: 5 },
    holidayLabel: { fontSize: 9.5, fontWeight: '700', color: C.holidayFg, textAlign: 'center' },
    shiftLabel: { fontSize: 11.5, fontWeight: '700', textAlign: 'center', borderRadius: 99, overflow: CLIP, paddingHorizontal: 6, marginBottom: 1, alignSelf: 'center' },
    offLabel: { fontSize: 14, fontWeight: '900', color: C.offFg, textAlign: 'center', marginBottom: 1, letterSpacing: 1 },
    dotRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 3, marginTop: 3, paddingHorizontal: 2 },
    personDot: { width: 7, height: 7, borderRadius: 4 },
    moreChip: { fontSize: 9.5, color: C.txt3, fontWeight: '700', textAlign: 'center' },
  });
}
