import React, { useState, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Text } from '../common/AppText';
import { Alarm, DAYS } from '../../constants';
import { Palette } from '../../constants/colors';
import { useColors } from '../../hooks/useTheme';
import { pad, todayStr, getType, alarmsForDate, isWorkAlarm, shiftForDate, isOffDay, shiftColorMap } from '../../utils';

// 달력 화면 — 근무 알람(주기+출근/퇴근)은 배경색으로 근무조를 표시하고,
// 그 외 알람만 칩으로 보여준다. 날짜를 누르면 하루 상세 팝업이 뜬다.
export function CalendarView({ alarms, onEditAlarm }: { alarms: Alarm[]; onEditAlarm: (a: Alarm) => void }) {
  const C = useColors();
  const cv = makeStyles(C);
  const today = todayStr();
  const todayDate = new Date(today);
  const [year,  setYear]  = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth());
  const [selDate, setSelDate] = useState<string|null>(null);

  const prevMonth = () => { if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const nextMonth = () => { if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };

  const firstDow    = new Date(year, month, 1).getDay();
  const offset      = (firstDow + 6) % 7;
  const daysInMonth = new Date(year, month+1, 0).getDate();

  const cells: (number|null)[] = [];
  for (let i=0; i<offset; i++) cells.push(null);
  for (let d=1; d<=daysInMonth; d++) cells.push(d);

  const dayMap = useMemo(() => {
    const map: Record<string, { alarms: Alarm[]; shift: Alarm|null; off: boolean }> = {};
    for (let d=1; d<=daysInMonth; d++) {
      const ds = `${year}-${pad(month+1)}-${pad(d)}`;
      map[ds] = {
        alarms: alarmsForDate(alarms, ds),
        shift:  shiftForDate(alarms, ds),
        off:    isOffDay(alarms, ds),
      };
    }
    return map;
  }, [alarms, year, month, daysInMonth]);

  // 범례: 이번 달 칸을 실제로 칠하는 대표 알람만 (보조 알람은 하루 팝업에서 확인)
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

  // 달력 칸용 짧은 라벨 — 라벨이 타입 이름("출근" 등)으로 시작하면 그 접두어를 떼고
  // 구분되는 뒷부분만 크게 보여준다. (색이 이미 근무임을 나타내므로)
  const cellLabel = (a: Alarm) => {
    const typeName = getType(a.typeId).label;
    const l = a.label || typeName;
    if (l.startsWith(typeName)) {
      const rest = l.slice(typeName.length).trim();
      return rest || typeName;
    }
    return l;
  };

  return (
    <ScrollView style={{flex:1, backgroundColor:C.bg}} contentContainerStyle={{padding:14, paddingBottom:100}}>
      {/* 월 네비 */}
      <View style={cv.nav}>
        <TouchableOpacity onPress={prevMonth} style={cv.navBtn}>
          <Text style={cv.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={cv.navTitle}>{year}년 {month+1}월</Text>
        <TouchableOpacity onPress={nextMonth} style={cv.navBtn}>
          <Text style={cv.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* 요일 헤더 */}
      <View style={cv.grid}>
        {DAYS.map((d,i) => (
          <View key={i} style={cv.headCell}>
            <Text style={[cv.headText, i>=5 && {color:'#e07070'}]}>{d}</Text>
          </View>
        ))}

        {/* 날짜 셀 */}
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={cv.cell}/>;
          const ds = `${year}-${pad(month+1)}-${pad(d)}`;
          const isToday = ds === today;
          const dow = (offset + d - 1) % 7;
          const info = dayMap[ds];
          const chips = info.alarms.filter(a => !isWorkAlarm(a));
          const sc = info.shift ? colorOf[info.shift.id] : null;

          return (
            <TouchableOpacity
              key={i}
              activeOpacity={0.7}
              onPress={() => setSelDate(ds)}
              style={[
                cv.cell,
                sc       != null && { backgroundColor: sc + '22' },
                info.off          && cv.cellOff,
                isToday           && cv.cellToday,
              ]}
            >
              <Text style={[
                cv.dayNum,
                dow >= 5 && {color:'#e07070'},
                isToday && cv.dayNumToday,
              ]}>{d}</Text>
              {info.shift && (
                <Text style={[cv.shiftLabel, {color: sc!}]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
                  {cellLabel(info.shift)}
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

      {/* 하루 상세 팝업 */}
      <Modal visible={selDate != null} transparent animationType="fade" onRequestClose={() => setSelDate(null)}>
        <TouchableOpacity style={cv.modalBack} activeOpacity={1} onPress={() => setSelDate(null)}>
          <TouchableOpacity activeOpacity={1} style={cv.modalCard} onPress={() => {}}>
            {selDateObj && (
              <Text style={cv.modalTitle}>
                {selDateObj.getMonth()+1}월 {selDateObj.getDate()}일 ({DAYS[(selDateObj.getDay()+6)%7]})
              </Text>
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
                  return (
                    <TouchableOpacity
                      key={ai}
                      style={cv.modalAlarmRow}
                      activeOpacity={0.7}
                      onPress={() => { setSelDate(null); onEditAlarm(al); }}
                    >
                      <Text style={cv.modalAlarmIcon}>{alType.icon}</Text>
                      <View style={{flex:1, minWidth:0}}>
                        <Text style={cv.modalAlarmTime}>{pad(al.hour)}:{pad(al.min)}</Text>
                        <Text style={cv.modalAlarmLabel} numberOfLines={1}>{al.label || alType.label}</Text>
                      </View>
                      <Text style={cv.modalArrow}>›</Text>
                    </TouchableOpacity>
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
    </ScrollView>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    nav:         { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:14 },
    navBtn:      { padding:10 },
    navArrow:    { fontSize:28, color:C.txt, fontWeight:'900' },
    navTitle:    { fontSize:18, fontWeight:'900', color:C.txt },
    grid:        { flexDirection:'row', flexWrap:'wrap' },
    headCell:    { width:'14.28%', alignItems:'center', paddingVertical:6 },
    headText:    { fontSize:11, fontWeight:'700', color:C.txt3 },
    cell:        { width:'14.28%', minHeight:72, padding:3, borderRadius:8, marginBottom:3 },
    // 비번 = "달력의 빨간 날" — 옅은 빨간 채움 + 빨간 점선으로 한눈에 띄게
    cellOff:     { borderWidth:1.8, borderStyle:'dashed', borderColor:'#e05252', backgroundColor:'rgba(224,82,82,0.13)' },
    cellToday:   { borderWidth:1.5, borderStyle:'solid', borderColor:C.accent },
    dayNum:      { fontSize:13, fontWeight:'700', color:C.txt, marginBottom:2, textAlign:'center' },
    dayNumToday: { color:C.accent, fontWeight:'900' },
    shiftLabel:  { fontSize:13, fontWeight:'900', textAlign:'center', marginBottom:1 },
    // 비번은 빨간 글자 — "달력의 빨간 날 = 쉬는 날" 관습에 맞춰 직관적으로
    offLabel:    { fontSize:13, fontWeight:'900', color:'#f06565', textAlign:'center', marginBottom:1 },
    alarmChip:   { fontSize:9, fontWeight:'700', color:C.accent2, backgroundColor:'rgba(108,92,231,0.18)', borderRadius:4, paddingHorizontal:3, paddingVertical:1, marginBottom:1 },
    moreChip:    { fontSize:9, color:C.txt3, fontWeight:'700', textAlign:'center' },
    legend:      { flexDirection:'row', flexWrap:'wrap', gap:12, marginTop:12, paddingHorizontal:4, paddingTop:10, borderTopWidth:1, borderTopColor:C.border },
    legendItem:  { flexDirection:'row', alignItems:'center', gap:5 },
    legendBox:   { width:11, height:11, borderRadius:3 },
    legendBoxOff:{ width:11, height:11, borderRadius:3, borderWidth:1.8, borderStyle:'dashed', borderColor:'#e05252', backgroundColor:'rgba(224,82,82,0.13)' },
    legendText:  { fontSize:12, fontWeight:'600', color:C.txt2 },
    legendTextOff:{ fontSize:12, fontWeight:'800', color:'#e05252' },
    modalBack:   { flex:1, backgroundColor:'rgba(0,0,0,0.55)', justifyContent:'center', padding:28 },
    modalCard:   { backgroundColor:C.bg2, borderRadius:20, padding:20, borderWidth:1, borderColor:C.border },
    modalTitle:  { fontSize:19, fontWeight:'800', color:C.txt, marginBottom:12, textAlign:'center' },
    modalShiftRow:{ borderRadius:12, paddingVertical:8, paddingHorizontal:12, marginBottom:10, alignItems:'center' },
    modalShiftText:{ fontSize:15, fontWeight:'800' },
    modalOffRow: { borderRadius:12, paddingVertical:8, paddingHorizontal:12, marginBottom:10, alignItems:'center', borderWidth:1.8, borderStyle:'dashed', borderColor:'#e05252', backgroundColor:'rgba(224,82,82,0.13)' },
    modalOffText:{ fontSize:15, fontWeight:'800', color:'#e05252' },
    modalAlarmRow:{ flexDirection:'row', alignItems:'center', gap:12, paddingVertical:12, borderBottomWidth:1, borderBottomColor:C.border },
    modalAlarmIcon:{ fontSize:22 },
    modalAlarmTime:{ fontSize:18, fontWeight:'800', color:C.txt },
    modalAlarmLabel:{ fontSize:13, color:C.txt2, marginTop:1 },
    modalArrow:  { fontSize:22, color:C.txt3 },
    modalEmpty:  { fontSize:14, color:C.txt3, textAlign:'center', paddingVertical:18 },
    modalClose:  { marginTop:14, paddingVertical:12, borderRadius:14, alignItems:'center', backgroundColor:'rgba(162,155,254,0.14)', borderWidth:1, borderColor:'rgba(162,155,254,0.35)' },
    modalCloseText:{ fontSize:15, fontWeight:'700', color:C.accent },
  });
}
