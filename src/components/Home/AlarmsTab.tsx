import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AlarmCard } from '../AlarmCard';
import { PromoBanner } from './PromoBanner';
import { Alarm } from '../../constants';
import { Palette } from '../../constants/colors';
import { useColors } from '../../hooks/useTheme';
import { makeHomeStyles } from './styles';

export function AlarmsTab({
  alarms, sorted, selectMode, selectedIds, repLimitedIds, highlightId,
  onToggleSelect, onSelectAll, onDeleteSelected, onExitSelectMode, onEnterSelectMode, onToggleAlarm, onEditAlarm,
}: {
  alarms: Alarm[];
  sorted: Alarm[];
  selectMode: boolean;
  selectedIds: Set<number>;
  repLimitedIds: Set<number>;
  highlightId: number | null;
  onToggleSelect: (id: number) => void;
  onSelectAll: () => void;
  onDeleteSelected: () => void;
  onExitSelectMode: () => void;
  onEnterSelectMode: (id: number) => void;
  onToggleAlarm: (id: number) => void;
  onEditAlarm: (alarm: Alarm) => void;
}) {
  const C = useColors();
  const homeStyles = makeHomeStyles(C);
  const s = makeStyles(C);
  return (
    <ScrollView style={homeStyles.scroll} contentContainerStyle={homeStyles.scrollC} showsVerticalScrollIndicator={false}>
      {selectMode && (
        <View style={s.selBar}>
          <Text style={s.selCnt}>{selectedIds.size}개 선택됨</Text>
          <TouchableOpacity onPress={onExitSelectMode} style={s.selB}>
            <Text style={s.selBT}>취소</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onSelectAll} style={s.selB}>
            <Text style={s.selBT}>전체</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDeleteSelected} style={[s.selB,s.selBDel]}>
            <Text style={[s.selBT,{color:'#fff'}]}>삭제</Text>
          </TouchableOpacity>
        </View>
      )}
      {alarms.length===0 ? (
        <View style={s.empty}>
          <Text style={s.emptyI}>⏰</Text>
          <Text style={s.emptyT}>알람이 없습니다</Text>
          <Text style={s.emptySub}>＋ 버튼으로 추가하세요</Text>
        </View>
      ) : sorted.map(al => (
        <AlarmCard
          key={al.id} alarm={al}
          onToggle={()=>{Haptics.selectionAsync();onToggleAlarm(al.id);}}
          onEdit={()=>onEditAlarm(al)}
          selectMode={selectMode} selected={selectedIds.has(al.id)}
          onSelect={()=>onToggleSelect(al.id)}
          onLongPressSelect={()=>{Haptics.selectionAsync();onEnterSelectMode(al.id);}}
          highlighted={highlightId === al.id}
          repLimited={repLimitedIds.has(al.id)}
        />
      ))}
      <PromoBanner />
    </ScrollView>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    selBar:  { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'rgba(224,112,112,0.10)', borderWidth:1, borderColor:'#503030', borderRadius:14, padding:10, marginBottom:10 },
    selCnt:  { flex:1, fontSize:14, color:'#e07070', fontWeight:'900' },
    selB:    { paddingHorizontal:12, paddingVertical:5, borderRadius:20, borderWidth:1, borderColor:'#e07070' },
    selBDel: { backgroundColor:'#e07070' },
    selBT:   { fontSize:13, fontWeight:'700', color:'#e07070' },
    empty:    { alignItems:'center', paddingVertical:60 },
    emptyI:   { fontSize:56, marginBottom:14 },
    emptyT:   { fontSize:18, color:C.txt2, fontWeight:'700' },
    emptySub: { fontSize:14, color:C.txt3, marginTop:6 },
  });
}
