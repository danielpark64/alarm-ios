import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { View, FlatList, TouchableOpacity, Modal, StyleSheet, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent, LayoutChangeEvent, TextInput, ScrollView, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from '../common/AppText';
import { Alarm, DAYS, DAYS_DISPLAY, DayOverride, DayOverrides, OverrideKind, OVERRIDE_KINDS, SHIFTS, DEFAULT_SHIFT_TIMES, DEFAULT_SHIFT_TIME_FALLBACK, ShiftPeriod } from '../../constants';
import { Palette } from '../../constants/colors';
import { useColors } from '../../hooks/useTheme';
import { useFontScale } from '../../hooks/useFontScale';
import { pad, todayStr, getType, alarmsForDate, isWorkAlarm, isOverridableAlarm, isHolidayOffWithOverride, shiftForDate, isOffDay, shiftToneIndexMap, shiftPeriodLabel, shiftPeriodId, effectiveShift, effectiveTime, dayWorkFor, lunarDateText, lunarShortText, dayOverrideDisplay, overrideLabel } from '../../utils';
import { roleLabel } from '../../utils/workPattern';
import { getHoliday, getHolidayShort } from '../../constants/holidays';
import { getSolarTerm } from '../../constants/solarTerms';
import { OverrideTimeModal } from './OverrideTimeModal';

// 달력 화면 — 근무 알람(주기+출근/퇴근)은 배경색으로 근무조를 표시하고,
// 그 외 알람만 칩으로 보여준다. 날짜를 누르면 하루 상세 팝업이 뜬다.
// 좌우로 스와이프하면 한 달씩(무한) 이동, 상단 연도 숫자를 누르면 연도 선택 팝업이 뜬다.
interface Props {
  alarms: Alarm[];
  overrides: DayOverrides;
  onSetOverride: (dateStr: string, ov: DayOverride | null) => void;
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
  // getDay()가 이미 0=일이라 그대로 offset으로 쓴다 — 일요일이 첫 칸.
  const offset = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const cells: (number|null)[] = [];
  for (let i=0; i<offset; i++) cells.push(null);
  for (let d=1; d<=daysInMonth; d++) cells.push(d);
  while (cells.length < TOTAL_CELLS) cells.push(null);
  return cells;
}

interface MonthGridProps {
  year: number; month: number; alarms: Alarm[];
  // 배지 톤을 고르는 데 필요 — 색을 스타일시트에 못 박으면 테마 분기가 안 되기 때문에
  // 팔레트와 자동배색 인덱스를 그대로 내려받아 셀에서 고른다.
  C: Palette; toneIdxOf: Record<number, number>; density: number; cellScale: number;
  today: string; showLunar: boolean; width: number;
  cv: ReturnType<typeof makeStyles>;
  cellH: number; itemHeight: number;
  overrides: DayOverrides;
  onSelectDate: (ds: string) => void;
}

const MonthGrid = React.memo(function MonthGrid({ year, month, alarms, C, toneIdxOf, density, cellScale, today, showLunar, width, cv, cellH, itemHeight, overrides, onSelectDate }: MonthGridProps) {
  const cells = useMemo(() => buildCells(year, month), [year, month]);
  const dayMap = useMemo(() => buildDayMap(alarms, year, month), [alarms, year, month]);
  const offset = cells.findIndex(c => c !== null);

  return (
    <View style={[cv.grid, { height: itemHeight, width, paddingHorizontal: 14 }]}>
      {cells.map((d, i) => {
        if (!d) return <View key={i} style={[cv.cell, { height: cellH }]}/>;
        const ds = `${year}-${pad(month+1)}-${pad(d)}`;
        const isToday = ds === today;
        const dow = (offset + d - 1) % 7; // 0=일 … 6=토 (표시 체계)
        const info = dayMap[ds];
        // 공휴일에 안 울리는 알람은 칩도 빼야 한다 — 안 그러면 추석 칸에 울리지도 않을 출근 칩이 뜬다.
        // 단 특근/대근을 걸어둔 공휴일은 실제로 울리므로 칩이 남아야 한다(isHolidayOffWithOverride).
        const chips = info.alarms.filter(a => !isWorkAlarm(a) && !a.skips?.includes(ds) && !isHolidayOffWithOverride(a, ds, overrides[ds]));
        // 하루 근무 변경(연차·대근 등)이 있으면 그걸로 확정 — 없으면(ov===null) 기존 경로 그대로.
        const ov = dayOverrideDisplay(overrides[ds]);
        // 사용자가 근무 시간대(초/중/말/기타)를 직접 지정했으면 고정색으로 눈에 띄게, 아니면 기존 시간순 자동 배색.
        // 로테이션(rm==='pattern') 알람은 날짜마다 시간대가 달라서 effectiveShift로 그날 세그먼트를 직접 조회.
        const resolvedShift = (!ov && info.shift) ? effectiveShift(info.shift, ds) : null;
        // 색 하나가 아니라 배지 톤(배경+글자) 한 쌍을 고른다 — 명시 시간대가 있으면 고정 톤,
        // 없으면 시각순 자동 배색 톤. 둘 다 테마별 값이라 라이트에서도 대비가 유지된다.
        const explicitId = resolvedShift ? shiftPeriodId(info.shift!, resolvedShift) : null;
        const tone = explicitId
          ? C.shift[explicitId]
          : (info.shift ? C.shiftAuto[(toneIdxOf[info.shift.id] ?? 0) % C.shiftAuto.length] : null);
        // override 배지 — 대근·특근처럼 work가 있으면 근무조 배지 자리를 대신 차지한다(줄이 안 늘어남).
        const ovWorkTone = (ov && !ov.isOff) ? (ov.shift ? C.shift[ov.shift] : C.shiftAuto[0]) : null;
        // override로 근무 알람이 꺼진 날(연차 등)은 기존 비번과 같은 취급 — 파란 테두리 박스 + 하단 라벨.
        const effOff = ov ? ov.isOff : info.off;
        const holiday = getHoliday(ds);
        // 칸마다 들어가는 줄 수가 다르다(공휴일은 한 달에 한두 날뿐). 전체를 일괄로 줄이면
        // 대부분의 여유 있는 칸까지 손해를 보므로, **그 칸에 실제로 그려질 요소만** 세서
        // 날짜 아래 남는 높이에 맞춘다. 날짜 숫자는 칸마다 크기가 달라지면 어색하므로 제외.
        const nChips = Math.min(chips.length, 2) + (chips.length > 2 ? 1 : 0);
        // ⚠️ AppText가 style.fontSize에 설정 배율(작게 0.88 / 크게 1.30)을 한 번 더 곱한다.
        //    여기서 그걸 빼먹으면 "크게"에서 실제 글자가 30% 크게 렌더돼 칸을 넘긴다.
        const eff = density * cellScale;
        const subNeed = ((showLunar ? 9.5 : 0) + (holiday ? 9.5 : 0)
                         + ((info.shift && resolvedShift) || ovWorkTone ? 11.5 : 0)
                         + (effOff ? 14 : 0) + nChips * 9.5) * 1.7 * eff;
        const availH = cellH - 8 - 15.5 * eff * 1.55;
        const sd = subNeed > 0 ? Math.max(0.55, Math.min(1, availH / subNeed)) : 1;
        // 절기는 공휴일과 같은 슬롯을 재사용 — 겹치는 날엔 공휴일을 우선 보여주고 그 아래 절기를 덧붙인다.
        const solarTerm = showLunar ? getSolarTerm(ds) : undefined;

        return (
          <TouchableOpacity
            key={i}
            activeOpacity={0.7}
            onPress={() => onSelectDate(ds)}
            style={[
              cv.cell,
              { height: cellH },
              // 비번 점선과 "오늘" 표시가 서로 덮지 않도록, 오늘은 셀 테두리가 아니라
              // 날짜 숫자의 원형 배지로 표시한다(아래 dayNumToday).
              effOff && cv.cellOff,
            ]}
          >
            <Text style={[
              cv.dayNum,
              { fontSize: 15.5 * density },
              (dow === 0 || dow === 6 || holiday) && { color: C.weekendFg },
              // 비번(또는 연차 등)은 파란 라인 박스 — 주말·공휴일이면 그쪽 색(빨강/골드)이 우선한다.
              effOff && !(dow === 0 || dow === 6 || holiday) && { color: C.offFg },
              isToday && cv.dayNumToday,
            ]}>{d}</Text>
            {showLunar && (
              // 절기/삼복이 있는 날은 칸이 좁으니 음력 날짜 대신 그 자리에 절기를 보여준다.
              <Text style={[cv.lunarLabel, { fontSize: 9.5 * density * sd }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{solarTerm ?? lunarShortText(ds)}</Text>
            )}
            {holiday && (
              <Text style={[cv.holidayLabel, { fontSize: 9.5 * density * sd }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{getHolidayShort(ds)}</Text>
            )}
            {ovWorkTone ? (
              // 대근·특근 등 — 근무조 배지 자리를 대신 차지한다(줄이 안 늘어남).
              <Text
                style={[cv.shiftLabel, { color: ovWorkTone.fg, backgroundColor: ovWorkTone.bg, fontSize: 11.5 * density * sd }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {ov!.label}
              </Text>
            ) : (info.shift && resolvedShift && tone && (
              // 7px 점 + 컬러 글자였던 것을 배지로 바꿨다. "면"이 생기면 같은 글자 크기라도
              // 노안에서 인지가 훨씬 쉽고, 배지 안에서 7:1 대비를 확보할 수 있다.
              <Text
                style={[cv.shiftLabel, { color: tone.fg, backgroundColor: tone.bg, fontSize: 11.5 * density * sd }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {shiftPeriodLabel(info.shift, resolvedShift)}
              </Text>
            ))}
            {effOff && (
              // numberOfLines가 없으면 "크게" 설정에서 두 줄로 쪼개져 셀 밖으로 넘친다.
              // 세로 스크롤을 넣지 않는 이상 칸은 화면 높이에 묶이므로, 넘칠 때는 글자가
              // 스스로 줄어들게 해서 레이아웃이 깨지지 않도록 한다.
              <Text style={[cv.offLabel, { fontSize: 14 * density * sd }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{ov ? ov.label : '비번'}</Text>
            )}
            {chips.slice(0,2).map((al, ai) => {
              const alType = getType(al.typeId);
              const chipTone = C.chip[al.typeId] ?? C.chip.custom;
              return (
                <Text
                  key={ai}
                  style={[cv.alarmChip, { fontSize: 9.5 * density * sd },
                          // 비교대 사용자에게는 칩이 달력의 유일한 정보라 종류별로 구분돼야 한다
                          chipTone && { color: chipTone.fg, backgroundColor: chipTone.bg }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >{al.label}</Text>
              );
            })}
            {chips.length > 2 && (
              <Text style={cv.moreChip}>+{chips.length-2}</Text>
            )}
            {/* 경조사 메모 — 근무 상태 배지와 무관하게 항상 작은 점으로만 표시(자리 차지 안 함,
                subNeed 높이 계산에도 안 들어감 — absolute라 흐름 레이아웃 밖). */}
            {!!overrides[ds]?.family && (
              <View style={cv.familyDot} pointerEvents="none" />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

export function CalendarView({ alarms, overrides, onSetOverride, onEditAlarm, onUpdateAlarm }: Props) {
  const C = useColors();
  // cv는 MonthGrid(React.memo)에 prop으로 내려간다 — 렌더마다 새 객체를 만들면 memo가
  // 절대 bail-out 못 해 스와이프/팝업마다 3개 그리드 × 42셀이 전부 재렌더된다
  const cv = useMemo(() => makeStyles(C), [C]);
  const { width: winWidth } = useWindowDimensions();
  const today = todayStr();
  const todayDate = new Date(today);
  const anchorYear  = todayDate.getFullYear();
  const anchorMonth = todayDate.getMonth();

  const [pageIndex, setPageIndex] = useState(RANGE);
  const [selDate, setSelDate] = useState<string|null>(null);
  // 하루 근무 변경 팝업 안 로컬 상태 — 종류 선택 그리드 → (대근/특근이면 근무조 선택 →) 시각
  // 편집 모달의 단계를 오간다. selDate가 바뀔 때마다 전부 초기화한다.
  const [ovPicking, setOvPicking] = useState(false);
  const [ovPickingShiftFor, setOvPickingShiftFor] = useState<OverrideKind | null>(null);
  const [ovTimeEditFor, setOvTimeEditFor] = useState<{ kind: OverrideKind; shift?: ShiftPeriod; start?: { hour: number; min: number }; end?: { hour: number; min: number } } | null>(null);
  const [ovFamilyDraft, setOvFamilyDraft] = useState('');
  const [showLunar, setShowLunar] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const listRef = useRef<FlatList>(null);
  // AppText와 같은 배율표 — 칸 높이를 글자 배율에 맞춰 키우기 위해 읽는다
  const { fontScale } = useFontScale();
  const cellScale = fontScale === 'large' ? 1.30 : fontScale === 'small' ? 0.9 : 1;

  // 달력 칸 영역에 실제로 할당된 높이를 측정해서 칸 크기를 역산 — 폰/태블릿 등 화면비가 달라도
  // 한 달(6주)이 항상 한 화면 안에 들어오게 한다. 측정 전에는 대체값으로 렌더링.
  const [gridAreaH, setGridAreaH] = useState(0);
  const onGridAreaLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setGridAreaH(prev => (Math.abs(prev - h) > 1 ? h : prev));
  }, []);
  // 글자크기 설정을 칸 높이에도 반영한다. 예전엔 상한이 90으로 고정이라 "크게"로 바꿔도
  // 칸은 1px도 안 커져서 내용이 칸 밖으로 넘쳐 잘렸다(Android는 removeClippedSubviews 때문에
  // 아예 안 그려짐). 상한만 배율만큼 풀어 "화면에 남는 여백을 먼저 쓰게" 한다 — 세로 스크롤은
  // 넣지 않으므로 gridAreaH를 넘지는 않는다.
  const cellH = gridAreaH > 0
    ? Math.max(40, Math.min(Math.round(90 * cellScale), Math.floor(gridAreaH / ROWS) - CELL_MB))
    : FALLBACK_CELL_H;
  // 칸에 실제로 들어가야 하는 높이를 추정해 넘치면 그 비율만큼 글자를 줄인다.
  // 음력을 켜면 줄이 하나 더 늘어 바로 넘치는데, 스크롤도 정보 삭제도 못 하므로
  // "들어갈 만큼만 키운다"가 유일한 해법이다. 여유가 있으면 1(=설정한 크기 그대로).
  const density = useMemo(() => {
    const lineH = 1.7;                     // 폰트 대비 실제 차지하는 줄 높이 비율(여백 포함)
    const need = (15.5 + 14 + (showLunar ? 9.5 : 0)) * lineH * cellScale + 8; // +패딩
    return Math.max(0.62, Math.min(1, cellH / need));
  }, [cellH, showLunar, cellScale]);
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
  // 자동 배색은 색이 아니라 인덱스로 받아, 셀에서 테마별 배지 톤(C.shiftAuto)을 꺼내 쓴다
  const toneIdxOf = useMemo(() => shiftToneIndexMap(alarms), [alarms]);

  const selInfo = selDate ? dayMap[selDate] : null;
  const selDateObj = selDate ? new Date(selDate) : null;
  // 로테이션 알람은 selInfo.shift.label(정적 문구, 패턴 알람은 빈 문자열)이 아니라 그날의
  // 세그먼트를 다시 조회해야 정확한 시간대 이름/색이 나온다 — 셀 렌더링과 동일한 방식 재사용.
  const selResolvedShift = (selInfo?.shift && selDate) ? effectiveShift(selInfo.shift, selDate) : null;
  const selShiftLabel = selInfo?.shift
    ? (selResolvedShift ? shiftPeriodLabel(selInfo.shift, selResolvedShift) : (selInfo.shift.label || getType(selInfo.shift.typeId).label))
    : '';
  // 팝업도 셀과 같은 배지 톤을 쓴다 — 달력에서 보던 색과 팝업 색이 다르면 같은 근무조로 안 읽힌다
  const selShiftTone = selInfo?.shift
    ? (() => {
        const id = selResolvedShift ? shiftPeriodId(selInfo.shift, selResolvedShift) : null;
        return id ? C.shift[id] : C.shiftAuto[(toneIdxOf[selInfo.shift.id] ?? 0) % C.shiftAuto.length];
      })()
    : null;
  const selOverride = selDate ? overrides[selDate] : undefined;
  const selOv = dayOverrideDisplay(selOverride);

  // 팝업이 새 날짜로 열릴 때마다 선택 중이던 종류/메모 초안을 리셋 — 어제 고르던 게 남아 보이면 안 된다.
  useEffect(() => {
    setOvPicking(false);
    setOvPickingShiftFor(null);
    setOvTimeEditFor(null);
    setOvFamilyDraft(selOverride?.family ?? '');
  }, [selDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // 대근·특근 — 원래 비번인 날이라 "복사할 오늘 스케줄"이 없다. 근무조를 먼저 고르게 해서
  // 표준 시각(DEFAULT_SHIFT_TIMES)을 초안으로 채우고, 그 다음 시간 편집 모달에서 사용자가
  // 직접 출퇴근 시각을 조정할 수 있게 한다(대근·특근도 실제 근무 시간이 표준과 다를 수 있음).
  const isWorkKind = (k: OverrideKind) => k === 'substitute' || k === 'special';
  const presetShiftTimes = (shift: ShiftPeriod) => DEFAULT_SHIFT_TIMES[shift] ?? DEFAULT_SHIFT_TIME_FALLBACK;

  // 반차·반반차·야근·연장 — 이미 근무가 정해진 날이라 근무조를 새로 고를 필요는 없지만,
  // 출근/퇴근 중 어느 쪽이 바뀔지는 사람마다 다르다(반차가 오전 반차일 수도, 오후 반차일 수도).
  // 그래서 오늘 실제 시각을 초안으로 채운 뒤 시간 편집 모달을 띄워 사용자가 직접 조정하게 한다.
  const isCopyKind = (k: OverrideKind) => k === 'half' || k === 'quarter' || k === 'night' || k === 'extend';
  const copyTodaysWork = (): DayOverride['work'] | undefined => {
    if (!selDate) return undefined;
    // shiftForDate/effectiveShift는 isWorkAlarm(교대근무 로테이션) 기준이라 일반 출근/퇴근
    // 버튼(요일 반복 등)만 쓰는 사용자는 항상 null이 나온다 — 그래도 시각 자체는 알람에서
    // 그대로 가져올 수 있으니, "근무조 색" 조회 실패로 전체를 막지 않는다.
    const a = shiftForDate(alarms, selDate);
    const resolved = a ? effectiveShift(a, selDate) : null;
    // isWorkAlarm이 아니라 isOverridableAlarm — 교대근무 마법사 없이 출근/퇴근 버튼만으로
    // 만든 알람(요일 반복 등)도 하루 근무 변경의 기준(시각 초안)이 될 수 있어야 한다.
    // alarms.find로 그냥 첫 알람을 집으면 출근/퇴근 알람이 여러 개(평일용/주말용 등)일 때
    // selDate의 요일과 무관한 알람이 잘못 뽑힐 수 있어, alarmsForDate로 실제 그 날짜에
    // 관여하는 알람만 후보로 좁힌다(shiftForDate와 같은 방식).
    const overridableToday = alarmsForDate(alarms.filter(isOverridableAlarm), selDate, true);
    const commuteAlarm = overridableToday.find(x => x.typeId === 'commute');
    const offworkAlarm = overridableToday.find(x => x.typeId === 'offwork');
    // ⚠️ 로테이션(rm==='pattern') 알람은 effectiveTime이 null을 반환하면 "이 세그먼트엔 이
    // 역할이 없다"(hasOffwork:false 등)는 뜻이다 — 알람 최상위 hour/min으로 폴백하면 없어야
    // 할 퇴근 알람이 유령으로 생긴다. 그 폴백은 비로테이션 알람에서만 의미가 있는데, 비로테이션
    // 알람은 effectiveTime이 애초에 null을 안 돌려주므로 폴백 자체가 필요 없다 — 그냥 뺀다.
    const ct = commuteAlarm ? (effectiveTime(commuteAlarm, selDate) ?? undefined) : undefined;
    const ot = offworkAlarm ? (effectiveTime(offworkAlarm, selDate) ?? undefined) : undefined;
    const id = resolved ? shiftPeriodId(a!, resolved) : null;
    return { shift: id ?? undefined, start: ct, end: ot };
  };

  // 종류 선택 — off형(work 없음, 연차·병가·기타)은 즉시 확정, 그 외(대근·특근·반차·반반차·
  // 야근·연장)는 초안 시각을 채운 뒤 시간 편집 모달로 넘어간다. 어느 쪽이든 이미 있던
  // family 메모는 그대로 들고 간다 — kind를 바꾼다고 경조사 메모가 날아가면 안 된다.
  const pickKind = (k: OverrideKind) => {
    if (!selDate) return;
    if (isWorkKind(k)) { setOvPickingShiftFor(k); return; }
    if (isCopyKind(k)) {
      const w = copyTodaysWork();
      setOvTimeEditFor({ kind: k, shift: w?.shift, start: w?.start, end: w?.end });
      return;
    }
    onSetOverride(selDate, { kind: k, family: selOverride?.family });
    setOvPicking(false);
  };
  const pickShiftForWork = (shift: ShiftPeriod) => {
    if (!ovPickingShiftFor) return;
    const t = presetShiftTimes(shift);
    setOvTimeEditFor({ kind: ovPickingShiftFor, shift, start: t.commute, end: t.offwork });
    setOvPickingShiftFor(null);
  };
  const confirmTimeEdit = (start: { hour: number; min: number }, end: { hour: number; min: number }) => {
    if (!selDate || !ovTimeEditFor) return;
    onSetOverride(selDate, {
      kind: ovTimeEditFor.kind,
      family: selOverride?.family,
      work: { shift: ovTimeEditFor.shift, start, end },
    });
    setOvTimeEditFor(null);
    setOvPicking(false);
  };
  // "하루 근무 변경 해제"는 kind/work만 되돌린다 — family 메모는 근무 상태와 무관하므로
  // 같이 지우면 "메모만 남기고 싶었는데 근무 변경을 해제했더니 메모까지 날아갔다"가 된다.
  const clearOverride = () => {
    if (!selDate) return;
    onSetOverride(selDate, selOverride?.family ? { family: selOverride.family } : null);
  };
  // 경조사 메모 — kind/work와 완전히 독립적으로 항상 편집 가능하다. 메모를 지워서 빈
  // 문자열이 되고 kind도 없으면 override 자체가 더 이상 필요 없으므로 통째로 지운다.
  const commitFamilyMemo = () => {
    if (!selDate) return;
    const text = ovFamilyDraft.trim();
    if (!text && !selOverride?.kind) {
      if (selOverride) onSetOverride(selDate, null);
    } else {
      onSetOverride(selDate, { ...(selOverride ?? {}), family: text || undefined });
    }
    Keyboard.dismiss();
  };

  // 달력 아래 집계 줄 — 이번 달/올해 각각 종류별 개수. 0개인 종류는 표시하지 않는다.
  const tally = useMemo(() => {
    const ymPrefix = `${year}-${pad(month + 1)}-`;
    const yPrefix = `${year}-`;
    const byKind = new Map<string, { label: string; month: number; year: number }>();
    const bump = (label: string, ds: string) => {
      const cur = byKind.get(label) ?? { label, month: 0, year: 0 };
      cur.year++;
      if (ds.startsWith(ymPrefix)) cur.month++;
      byKind.set(label, cur);
    };
    for (const [ds, o] of Object.entries(overrides)) {
      if (!ds.startsWith(yPrefix)) continue;
      // family는 kind와 독립적인 메모라 근무 상태 집계(연차·대근 등)와 별도로,
      // kind 없이 family만 있는 날도 놓치지 않고 "경조사"로 센다.
      // overrideLabel은 지금 OVERRIDE_KINDS에 없는 kind(예: 예전에 있다가 빠진 "기타")면
      // 빈 문자열을 반환하므로, 그런 레거시 데이터가 라벨 없는 항목으로 집계되지 않게 거른다.
      const label = o.kind ? overrideLabel(o) : '';
      if (label) bump(label, ds);
      if (o.family) bump('경조사', ds);
    }
    return Array.from(byKind.values()).filter(x => x.month > 0 || x.year > 0);
  }, [overrides, year, month]);

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
          {DAYS_DISPLAY.map((d,i) => (
            <View key={i} style={cv.headCell}>
              <Text style={[cv.headText, (i === 0 || i === 6) && { color: C.weekendFg }]}>{d}</Text>
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
            return <MonthGrid year={y} month={m} alarms={alarms} C={C} toneIdxOf={toneIdxOf} density={density} cellScale={cellScale} today={today} showLunar={showLunar} width={winWidth} cv={cv} cellH={cellH} itemHeight={itemHeight} overrides={overrides} onSelectDate={setSelDate} />;
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

      {/* 하루 근무 변경 집계 — 이번 달/올해 종류별 개수. 이 줄이 생긴 만큼 위 그리드가
          flex:1로 자동으로 줄어들어(onGridAreaLayout이 그 남은 공간을 다시 측정) 칸 높이가
          알아서 반영된다. 0개인 종류는 애초에 tally에 안 들어간다. */}
      {tally.length > 0 && (
        <View style={cv.tallyWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={cv.tallyRow}>
            {tally.map(t => (
              <Text key={t.label} style={cv.tallyItem}>{t.label} {t.month} (년 {t.year})</Text>
            ))}
          </ScrollView>
        </View>
      )}

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
        {/* 경조사 메모 입력칸이 키보드에 가려 저장 버튼이 안 보이던 문제 — KeyboardAvoidingView로
            카드 전체를 키보드 위로 밀어 올린다. Android는 windowSoftInputMode가 이미 처리해줘서
            보통 'height'/생략 쪽이 자연스럽고, iOS는 'padding'이 표준. */}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
            {selDate && getSolarTerm(selDate) && (
              <View style={cv.modalHolidayRow}>
                <Text style={cv.modalHolidayText}>{getSolarTerm(selDate)}</Text>
              </View>
            )}
            {selOv ? (
              // 하루 근무 변경이 있으면 원래 근무/비번 표시 대신 이걸로 확정해서 보여준다.
              (() => {
                const tone = selOv.isOff ? null : (selOv.shift ? C.shift[selOv.shift] : C.shiftAuto[0]);
                return (
                  <View style={tone ? [cv.modalShiftRow, {backgroundColor: tone.bg}] : cv.modalOffRow}>
                    <Text style={tone ? [cv.modalShiftText, {color: tone.fg}] : cv.modalOffText}>
                      {selOv.label}{tone ? ' 근무' : ''}
                    </Text>
                  </View>
                );
              })()
            ) : (
              <>
                {selInfo?.shift && selShiftTone && (
                  <View style={[cv.modalShiftRow, {backgroundColor: selShiftTone.bg}]}>
                    <Text style={[cv.modalShiftText, {color: selShiftTone.fg}]}>
                      {selShiftLabel} 근무
                    </Text>
                  </View>
                )}
                {selInfo?.off && (
                  <View style={cv.modalOffRow}>
                    <Text style={cv.modalOffText}>비번 (쉬는 날)</Text>
                  </View>
                )}
              </>
            )}

            {/* 하루 근무 변경(메인) — 연차·병가 / 대근·특근·야근·연장·반차·반반차(시각 직접 지정).
                경조사(메모, 보조)보다 먼저 둔다. 오늘 이후만 바꿀 수 있다("이날 끄기"와 같은 제약). */}
            {selDate && selDate >= today && (
              <View style={cv.ovSection}>
                {selOv ? (
                  <TouchableOpacity style={cv.ovClearBtn} onPress={clearOverride}>
                    <Text style={cv.ovClearBtnText}>하루 근무 변경 해제</Text>
                  </TouchableOpacity>
                ) : ovPickingShiftFor ? (
                  <>
                    <Text style={cv.ovSectionLabel}>
                      {OVERRIDE_KINDS.find(k => k.id === ovPickingShiftFor)?.label} — 근무조 선택
                    </Text>
                    <View style={cv.ovChipRow}>
                      {SHIFTS.filter(s => s.id !== 'none').map(s => (
                        <TouchableOpacity key={s.id} style={cv.ovChip} onPress={() => pickShiftForWork(s.id)}>
                          <Text style={cv.ovChipText}>{s.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity onPress={() => setOvPickingShiftFor(null)}>
                      <Text style={cv.ovBackText}>‹ 종류 다시 선택</Text>
                    </TouchableOpacity>
                  </>
                ) : ovPicking ? (
                  <>
                    <Text style={cv.ovSectionLabel}>하루 근무 변경</Text>
                    <View style={cv.ovChipRow}>
                      {OVERRIDE_KINDS.map(k => (
                        <TouchableOpacity key={k.id} style={cv.ovChip} onPress={() => pickKind(k.id)}>
                          <Text style={cv.ovChipText}>{k.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                ) : (
                  <TouchableOpacity style={cv.ovOpenBtn} onPress={() => setOvPicking(true)}>
                    <Text style={cv.ovOpenBtnText}>하루 근무 변경 (연차·대근 등)</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* 경조사 메모 저장 확인(보조) — 아래 입력칸은 값이 그대로 남아있는 편집 상태라
                저장 전후로 화면이 똑같아 보여서 "저장이 안 됐다"고 오해하기 쉬웠다(실사용
                피드백). 저장된 메모를 여기 별도 줄로 눈에 띄게 보여줘서 확실히 확인시킨다. */}
            {selOverride?.family && (
              <View style={cv.familyMemoRow}>
                <Text style={cv.familyMemoRowText} numberOfLines={2}>📌 경조사: {selOverride.family}</Text>
              </View>
            )}

            {/* 경조사 메모(보조) — 근무 상태(kind/work)와 완전히 독립적으로 항상 노출된다.
                남의 결혼식·장례식은 연차를 쓰든 근무 끝나고 가든 상관없이 몇 시·누구 건지만
                남기면 되는 것이라, "하루 근무 변경" 종류 선택과는 별개의 자리를 둔다. 메인
                기능인 하루 근무 변경보다 아래에 둬서 우선순위를 명확히 한다. */}
            {selDate && selDate >= today && (
              <View style={cv.ovMemoRow}>
                <TextInput
                  style={cv.ovMemoInput}
                  placeholder="경조사 메모 (예: 김과장 결혼식 15시)"
                  placeholderTextColor={C.txt3}
                  value={ovFamilyDraft}
                  onChangeText={setOvFamilyDraft}
                  onSubmitEditing={commitFamilyMemo}
                  returnKeyType="done"
                />
                {/* onBlur만 믿으면 키보드에 가려 버튼이 안 보일 때 저장이 안 됐다고
                    오해하기 쉽다 — 항상 보이는 명시적 저장 버튼을 따로 둔다. */}
                <TouchableOpacity style={cv.ovMemoSaveBtn} onPress={commitFamilyMemo}>
                  <Text style={cv.ovMemoSaveBtnText}>저장</Text>
                </TouchableOpacity>
              </View>
            )}
            {(() => {
              // 알람 목록은 buildDayMap/alarmsForDate 기준이라 override를 모른다 — override가
              // 근무 알람을 끄거나(연차 등) 새로 켰는데(대근 등) 이 목록이 그대로면 위에 보이는
              // override 요약과 모순된 정보를 보여주게 된다. 여기서 표시만 override에 맞춰 보정한다.
              // isWorkAlarm이 아니라 isOverridableAlarm — 요일 반복 등으로 만든 일반 출근/퇴근
              // 알람도 override로 꺼지면 여기서 dim 처리+라벨이 붙어야 한다.
              const workIds = new Set(alarms.filter(isOverridableAlarm).map(a => a.id));
              // 합성 행은 "원래 알람이 없던 날에 새로 생긴 근무"(대근·특근)에서만 필요하다.
              // 반차·야근·연장(copy-kind)은 그날 실제 알람이 이미 selInfo.alarms에 들어있으므로
              // 여기서 또 합성하면 같은 시각이 두 줄로 중복 표시된다.
              const isSubstituteKind = selOverride?.kind === 'substitute' || selOverride?.kind === 'special';
              const ovWork = (selOv && !selOv.isOff && isSubstituteKind) ? selOverride?.work : undefined;
              const hasAny = (selInfo && selInfo.alarms.length > 0) || !!ovWork;
              // 종류·근무조·시각을 고르는 중이라면 "알람 없음"을 띄우지 않는다 — 비번날에
              // 대근을 넣으려고 근무조를 고르는 중인데 바로 아래에 "이날 울리는 알람이
              // 없어요"가 같이 떠 있으면 방금 넣으려는 근무가 무시된 것처럼 읽힌다(실사용
              // 피드백). 선택을 끝내면 아래 합성 행으로 새 근무 시각이 바로 나타난다.
              const pickingOverride = ovPicking || ovPickingShiftFor != null || ovTimeEditFor != null;
              if (!hasAny) return pickingOverride ? null : <Text style={cv.modalEmpty}>이날 울리는 알람이 없어요</Text>;
              return (
                <>
                  {/* 대근·특근 등으로 새로 생긴 근무 — 실제 Alarm 객체가 아니라 정보 표시만(편집·끄기 불가) */}
                  {ovWork?.start && (
                    <View style={cv.modalAlarmRow}>
                      <View style={cv.modalAlarmMain}>
                        <Text style={cv.modalAlarmIcon}>🚇</Text>
                        <View style={{flex:1, minWidth:0}}>
                          <Text style={cv.modalAlarmTime}>{pad(ovWork.start.hour)}:{pad(ovWork.start.min)}</Text>
                          <Text style={cv.modalAlarmLabel} numberOfLines={1}>
                            {roleLabel({ shift: ovWork.shift ?? 'none' }, 'commute')} · {selOv!.label}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                  {ovWork?.end && (
                    <View style={cv.modalAlarmRow}>
                      <View style={cv.modalAlarmMain}>
                        <Text style={cv.modalAlarmIcon}>🏠</Text>
                        <View style={{flex:1, minWidth:0}}>
                          <Text style={cv.modalAlarmTime}>{pad(ovWork.end.hour)}:{pad(ovWork.end.min)}</Text>
                          <Text style={cv.modalAlarmLabel} numberOfLines={1}>
                            {roleLabel({ shift: ovWork.shift ?? 'none' }, 'offwork')} · {selOv!.label}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                  {selInfo && selInfo.alarms
                    .slice()
                    .sort((a,b) => {
                      const ta = (selOverride && dayWorkFor(a, selOverride)?.time) ?? (a.rm === 'pattern' && selDate ? effectiveTime(a, selDate) : null) ?? { hour: a.hour, min: a.min };
                      const tb = (selOverride && dayWorkFor(b, selOverride)?.time) ?? (b.rm === 'pattern' && selDate ? effectiveTime(b, selDate) : null) ?? { hour: b.hour, min: b.min };
                      return ta.hour - tb.hour || ta.min - tb.min;
                    })
                    .map((al, ai) => {
                      const alType = getType(al.typeId);
                      const skipped = !!(selDate && al.skips?.includes(selDate));
                      // override로 이미 꺼진 근무 알람은 "이날 끄기" 토글을 더 보여줄 필요가 없다 —
                      // 하루 전체가 override로 결정된 상태라 개별 스킵은 의미가 없다.
                      const overriddenOff = !!selOv && selOv.isOff && workIds.has(al.id);
                      // "이날만 끄기"는 오늘 이후 + 반복 알람만 (한 번 알람은 스위치로 끄면 됨).
                      // 근무 알람(출근/퇴근, isOverridableAlarm)은 여기서 아예 뺀다 — "하루 근무
                      // 변경"과 용도가 겹쳐서, 출근만 끄고 퇴근은 그대로 두는 식으로 절반만
                      // 눌러도 의도(오늘 하루 근무 안 함)와 다르게 동작하는 혼란이 있었다.
                      // 근무 알람의 개별 조정은 이제 하루 근무 변경(연차 등) 하나로만 유도한다.
                      const canSkip = !!onUpdateAlarm && !!selDate && selDate >= today && al.rm !== 'once' && !overriddenOff && !isOverridableAlarm(al);
                      const toggleSkip = () => {
                        if (!selDate || !onUpdateAlarm) return;
                        const next = skipped
                          ? (al.skips ?? []).filter(s => s !== selDate)
                          : [...(al.skips ?? []), selDate];
                        onUpdateAlarm(al.id, { skips: next.length ? next : undefined });
                      };
                      // 로테이션 알람은 al.hour/min/label이 첫 세그먼트 기준 레거시 값이라, 이 날짜의
                      // 실제 시각/라벨을 다시 조회해야 한다(알림에서 실제로 뜨는 문구와 동일하게).
                      const isPattern = al.rm === 'pattern';
                      const patternTime = isPattern && selDate ? effectiveTime(al, selDate) : null;
                      const patternShift = isPattern && selDate ? effectiveShift(al, selDate) : null;
                      // 반차·야근·연장처럼 시각만 바뀌는 override는 실제 Alarm 객체(al.hour/min)를
                      // 건드리지 않으므로, 이 목록도 dayWorkFor로 그날 조정된 시각을 우선 반영해야
                      // 한다 — 안 그러면 예약(core.ts)은 조정된 시각으로 울리는데 목록엔 원래
                      // 시각이 보이는 불일치가 생긴다(실제 겪은 버그).
                      const ovTime = selOverride ? dayWorkFor(al, selOverride)?.time : undefined;
                      // 법정공휴일이라 안 울리는 날. 단 특근·대근을 걸어둔 날은 실제로 울리므로
                      // 꺼진 것처럼 보이면 안 된다.
                      const holidayOff = !!selDate && isHolidayOffWithOverride(al, selDate, selOverride);
                      const dispHour = ovTime?.hour ?? patternTime?.hour ?? al.hour;
                      const dispMin  = ovTime?.min  ?? patternTime?.min  ?? al.min;
                      const dispLabel = patternShift
                        ? roleLabel(patternShift, (al.groupRole ?? 'commute'))
                        : (al.label || alType.label);
                      return (
                        <View key={ai} style={cv.modalAlarmRow}>
                          <TouchableOpacity
                            style={[cv.modalAlarmMain, (skipped || overriddenOff || holidayOff) && {opacity:0.45}]}
                            activeOpacity={0.7}
                            onPress={() => { setSelDate(null); onEditAlarm(al); }}
                          >
                            <Text style={cv.modalAlarmIcon}>{alType.icon}</Text>
                            <View style={{flex:1, minWidth:0}}>
                              <Text style={cv.modalAlarmTime}>{pad(dispHour)}:{pad(dispMin)}</Text>
                              <Text style={cv.modalAlarmLabel} numberOfLines={1}>
                                {dispLabel}{overriddenOff ? ` · ${selOv!.label}로 꺼짐` : (skipped ? ' · 이날 꺼짐' : (holidayOff ? ' · 공휴일이라 꺼짐' : ''))}
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
                    })}
                </>
              );
            })()}
            <TouchableOpacity style={cv.modalClose} onPress={() => setSelDate(null)}>
              <Text style={cv.modalCloseText}>닫기</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
        {/* 대근·특근·반차·야근 등 — 출퇴근 시각을 직접 조정하는 오버레이. 반드시 같은 <Modal>
            안, 배경 TouchableOpacity의 형제 위치에 둔다 — 별도 <Modal>로 빼서 이미 열려 있는
            이 하루 상세 팝업 위에 겹쳐 띄우면 iOS가 두 번째 present를 조용히 무시해서 안 뜬다
            (CycleRestControls.tsx가 겪은 것과 같은 문제, {"{children}"} 패턴과 동일한 이유). */}
        <OverrideTimeModal
          visible={ovTimeEditFor != null}
          title={ovTimeEditFor ? `${OVERRIDE_KINDS.find(k => k.id === ovTimeEditFor.kind)?.label} 시각` : ''}
          start={ovTimeEditFor?.start}
          end={ovTimeEditFor?.end}
          onConfirm={confirmTimeEdit}
          onClose={() => setOvTimeEditFor(null)}
        />
        </KeyboardAvoidingView>
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
    headText:    { fontSize:12.5, fontWeight:'800', color:C.txt2 },
    // overflow:hidden이 없으면 칸 내용이 아래 행 날짜 위로 올라탄다(음력 켜면 바로 재현됨).
    // 세로 스크롤을 넣지 않는 이상 칸 높이는 화면에 묶이므로, 넘치는 경우를 구조적으로 막아둔다.
    cell:        { width:'14.28%', marginBottom:CELL_MB, padding:2, borderRadius:8, overflow:'hidden' },
    // 경조사 메모 표시 — 근무 배지와 겹치지 않는 우상단 구석에 작은 점만, 흐름 레이아웃 밖(absolute).
    familyDot:   { position:'absolute', top:3, right:3, width:6, height:6, borderRadius:3, backgroundColor:C.accent2 },
    // 비번 = 파란 2px 라인 박스(시안 4b/4d). 다른 셀은 전부 테두리가 없으니 이 테두리 하나로
    // "쉬는 날"이 한눈에 구분된다. 배경은 옅은 파란 틴트로 면도 살짝 보이게.
    cellOff:     { backgroundColor:C.offCellBg, borderWidth:2, borderColor:C.offBorder },
    dayNum:      { fontSize:15.5, fontWeight:'800', color:C.txt, marginBottom:1, textAlign:'center' },
    // 오늘 = 날짜 숫자만 원형으로 채운다. 셀 테두리로 표시하면 비번 점선을 덮어버려
    // "오늘이면서 비번인 날"에 비번 표시가 사라지는 문제가 있었다.
    dayNumToday: { color:C.todayFg, fontWeight:'900', backgroundColor:C.todayBg,
                   borderRadius:11, overflow:'hidden', paddingHorizontal:5 },
    lunarLabel:  { fontSize:10, fontWeight:'600', color:C.txt3, textAlign:'center', marginTop:-1, marginBottom:1 },
    // 공휴일 이름표 — 비번(빨강)과 헷갈리지 않게 골드 계열. 라이트에서 1.78:1까지 떨어지던 것을
    // 배지로 바꿔 6.4:1 확보.
    // 공휴일은 위계상 가장 낮다 — 배지를 빼고 작은 글자로. 셀 폭을 채우지 않아 "글자 벽" 느낌이 줄어든다.
    holidayLabel:{ fontSize:9.5, fontWeight:'700', color:C.holidayFg,
                   textAlign:'center', marginBottom:0 },
    // 근무 시간대 — 색 글자에서 배지로. 색만이 유일한 단서였던 것을 "면 + 글자"로 바꿔
    // 노안·색약에서도 훑어보기가 가능해졌다. 배경/글자색은 셀에서 테마별 톤을 인라인으로 주입.
    // 세로 공간이 늘지 않도록 paddingVertical은 0으로 두고 marginBottom만 유지한다.
    // 근무조는 셀 폭을 다 채우는 띠가 아니라 **글자 폭에 맞는 알약**. 셀마다 폭이 달라지면서
    // 리듬이 생겨, 전부 같은 크기 배지가 늘어서던 "글자 벽"이 풀린다.
    shiftLabel:  { fontSize:11.5, fontWeight:'700', textAlign:'center', borderRadius:99,
                   overflow:'hidden', paddingHorizontal:6, marginBottom:1, alignSelf:'center' },
    // 비번 라벨은 셀 테두리와 같은 파란색(C.offFg) — 별도 배경 없이 글자만.
    offLabel:    { fontSize:14, fontWeight:'900', color:C.offFg,
                   textAlign:'center', marginBottom:1, letterSpacing:1 },
    // 알람 칩 — 알람 종류별 원색 + 13% 알파 배경이었으나, 그 알파가 양 극단 배경에서
    // 렌더되지 않아 9px 글자만 남았다. 테마 토큰(중성 회색)으로 바꿔 대비를 8:1대로 올림.
    // 알람 칩은 위계 최하단 — 근무조 알약보다 작고 옅게, 폭도 글자에 맞춰서
    alarmChip:   { fontSize:9.5, fontWeight:'600', color:C.chipFg, backgroundColor:C.chipBg,
                   borderRadius:99, paddingHorizontal:5, marginBottom:1,
                   overflow:'hidden', textAlign:'center', alignSelf:'center' },
    moreChip:    { fontSize:9.5, color:C.txt3, fontWeight:'700', textAlign:'center' },
    modalBack:   { flex:1, backgroundColor:'rgba(0,0,0,0.55)', justifyContent:'center', padding:28 },
    modalCard:   { backgroundColor:C.bg2, borderRadius:20, padding:20, borderWidth:1, borderColor:C.border },
    modalTitle:  { fontSize:19, fontWeight:'800', color:C.txt, textAlign:'center' },
    modalLunar:  { fontSize:12, fontWeight:'600', color:C.txt3, textAlign:'center', marginBottom:12 },
    modalHolidayRow:{ borderRadius:12, paddingVertical:6, paddingHorizontal:12, marginBottom:8, alignItems:'center', backgroundColor:C.holidayBg },
    modalHolidayText:{ fontSize:13.5, fontWeight:'800', color:C.holidayFg },
    // 경조사 메모 저장 확인 줄 — "저장" 버튼과 같은 accent2 계열로 눈에 띄게, 입력칸과는
    // 시각적으로 분리된 별도 확인 표시라는 걸 알 수 있게 한다.
    familyMemoRow:{ borderRadius:12, paddingVertical:7, paddingHorizontal:12, marginBottom:8, backgroundColor:`${C.accent2}26` },
    familyMemoRowText:{ fontSize:13, fontWeight:'700', color:C.accent2, textAlign:'center' },
    modalShiftRow:{ borderRadius:12, paddingVertical:8, paddingHorizontal:12, marginBottom:10, alignItems:'center' },
    modalShiftText:{ fontSize:15, fontWeight:'800' },
    modalOffRow: { borderRadius:12, paddingVertical:8, paddingHorizontal:12, marginBottom:10, alignItems:'center', borderWidth:2, borderColor:C.offBorder, backgroundColor:C.offBg },
    modalOffText:{ fontSize:15.5, fontWeight:'800', color:C.offFg },
    // 하루 근무 변경 섹션 — 상세 팝업 안, 알람 목록 위에 자리한다.
    ovSection:    { marginBottom:12, gap:8 },
    ovSectionLabel:{ fontSize:13, fontWeight:'700', color:C.txt3 },
    ovChipRow:    { flexDirection:'row', flexWrap:'wrap', gap:8 },
    ovChip:       { paddingHorizontal:12, paddingVertical:8, borderRadius:99, backgroundColor:C.bg3, borderWidth:1, borderColor:C.border2 },
    ovChipText:   { fontSize:13.5, fontWeight:'700', color:C.txt2 },
    ovBackText:   { fontSize:12.5, fontWeight:'700', color:C.txt3, marginTop:2 },
    // 메인 액션(하루 근무 변경 진입 버튼) — 예전엔 옅은 점선 테두리 + txt3 회색 글자였는데,
    // 다크에서는 txt3가 밝은 라벤더라 눈에 띄지만 라이트에서는 txt3가 중간 회색이라 배경에
    // 묻혀서 잘 안 보인다는 실사용 피드백. accent2는 라이트/다크 둘 다 고정된 선명한 보라라
    // 테마 상관없이 항상 눈에 띈다 — 실선 테두리 + 옅은 틴트 배경으로 톤을 올렸다.
    ovOpenBtn:    { paddingVertical:10, borderRadius:12, alignItems:'center', borderWidth:1.5, borderColor:C.accent2, backgroundColor:`${C.accent2}1a` },
    ovOpenBtnText:{ fontSize:13.5, fontWeight:'800', color:C.accent2 },
    ovClearBtn:   { paddingVertical:9, borderRadius:12, alignItems:'center', backgroundColor:C.bg3 },
    ovClearBtnText:{ fontSize:13, fontWeight:'700', color:C.txt2 },
    ovMemoRow:    { flexDirection:'row', alignItems:'center', gap:8 },
    ovMemoInput:  { flex:1, borderRadius:10, borderWidth:1, borderColor:C.border2, paddingHorizontal:10, paddingVertical:8, fontSize:13.5, color:C.txt, backgroundColor:C.bg3 },
    ovMemoSaveBtn:{ paddingHorizontal:14, paddingVertical:9, borderRadius:10, backgroundColor:C.accent2 },
    ovMemoSaveBtnText:{ fontSize:13, fontWeight:'800', color:'#ffffff' },
    // 달력 아래 집계 줄 — 종류별 이번 달/올해 개수를 한 줄로, 다 못 들어가면 가로 스크롤.
    tallyWrap:    { paddingHorizontal:14, paddingVertical:6, borderTopWidth:1, borderTopColor:C.border },
    tallyRow:     { flexDirection:'row', gap:14 },
    tallyItem:    { fontSize:12, fontWeight:'700', color:C.txt3 },
    modalAlarmRow:{ flexDirection:'row', alignItems:'center', gap:10, paddingVertical:12, borderBottomWidth:1, borderBottomColor:C.border },
    modalAlarmMain:{ flex:1, minWidth:0, flexDirection:'row', alignItems:'center', gap:12 },
    skipBtn:     { paddingHorizontal:12, paddingVertical:10, borderRadius:12, borderWidth:1.3, borderColor:C.offBorder },
    skipBtnText: { fontSize:13.5, fontWeight:'700', color:C.offFg },
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
