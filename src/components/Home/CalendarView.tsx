import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Alarm, DAYS } from '../../constants';
import { Palette } from '../../constants/colors';
import { useColors } from '../../hooks/useTheme';
import { pad, todayStr, getType, alarmsForDate } from '../../utils';

// 달력 화면
export function CalendarView({ alarms, onEditAlarm }: { alarms: Alarm[]; onEditAlarm: (a: Alarm) => void }) {
  const C = useColors();
  const cv = makeStyles(C);
  const today = todayStr();
  const todayDate = new Date(today);
  const [year,  setYear]  = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth());

  const prevMonth = () => { if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const nextMonth = () => { if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };

  const firstDow    = new Date(year, month, 1).getDay();
  const offset      = (firstDow + 6) % 7;
  const daysInMonth = new Date(year, month+1, 0).getDate();

  const cells: (number|null)[] = [];
  for (let i=0; i<offset; i++) cells.push(null);
  for (let d=1; d<=daysInMonth; d++) cells.push(d);

  const alarmMap = useMemo(() => {
    const map: Record<string, Alarm[]> = {};
    for (let d=1; d<=daysInMonth; d++) {
      const ds = `${year}-${pad(month+1)}-${pad(d)}`;
      map[ds] = alarmsForDate(alarms, ds);
    }
    return map;
  }, [alarms, year, month, daysInMonth]);

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
          const dayAlarms = alarmMap[ds] || [];

          return (
            <View key={i} style={[cv.cell, isToday && cv.cellToday]}>
              <Text style={[
                cv.dayNum,
                dow >= 5 && {color:'#e07070'},
                isToday && cv.dayNumToday,
              ]}>{d}</Text>
              {dayAlarms.slice(0,3).map((al, ai) => {
                const alType = getType(al.typeId);
                return (
                  <TouchableOpacity key={ai} onPress={() => onEditAlarm(al)} activeOpacity={0.7}>
                    <Text
                      style={[cv.alarmChip, { color: alType.color, backgroundColor: alType.color + '22', borderColor: alType.color + '55', borderWidth: 0.5 }]}
                      numberOfLines={1}
                    >{al.label}</Text>
                  </TouchableOpacity>
                );
              })}
              {dayAlarms.length > 3 && (
                <Text style={cv.moreChip}>+{dayAlarms.length-3}</Text>
              )}
            </View>
          );
        })}
      </View>
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
    cellToday:   { backgroundColor:'rgba(162,155,254,0.12)', borderWidth:1, borderColor:C.accent },
    dayNum:      { fontSize:13, fontWeight:'700', color:C.txt, marginBottom:2, textAlign:'center' },
    dayNumToday: { color:C.accent, fontWeight:'900' },
    alarmChip:   { fontSize:9, fontWeight:'700', color:C.accent2, backgroundColor:'rgba(108,92,231,0.18)', borderRadius:4, paddingHorizontal:3, paddingVertical:1, marginBottom:1 },
    moreChip:    { fontSize:9, color:C.txt3, fontWeight:'700', textAlign:'center' },
  });
}
