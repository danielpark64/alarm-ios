import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AlarmCard } from '../AlarmCard';
import { Alarm } from '../../constants';
import { C } from '../../constants/colors';
import { homeStyles } from './styles';
import { useScale, rf } from '../../utils/responsive';

export function AlarmsTab({
  alarms, sorted, selectMode, selectedIds, repLimitedIds, highlightId,
  onToggleSelect, onSelectAll, onDeleteSelected, onToggleAlarm, onEditAlarm,
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
  onToggleAlarm: (id: number) => void;
  onEditAlarm: (alarm: Alarm) => void;
}) {
  const scale = useScale();
  return (
    <ScrollView style={homeStyles.scroll} contentContainerStyle={homeStyles.scrollC} showsVerticalScrollIndicator={false}>
      {selectMode && (
        <View style={s.selBar}>
          <Text style={s.selCnt}>{selectedIds.size}개 선택됨</Text>
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
          highlighted={highlightId === al.id}
          repLimited={repLimitedIds.has(al.id)}
        />
      ))}
      <TouchableOpacity
        style={s.promoBanner}
        activeOpacity={0.8}
        onPress={() => Linking.openURL('https://www.youtube.com/@susumusic_ai')}
      >
        <View style={s.promoIcon}><Text style={s.promoIconT}>🎵</Text></View>
        <View style={{flex:1, minWidth:0}}>
          <Text style={[s.promoTitle,{fontSize:rf(14,scale)}]} numberOfLines={1} ellipsizeMode="tail">수수뮤직과 기분좋은 하루</Text>
          <Text style={[s.promoSub,{fontSize:rf(11,scale)}]} numberOfLines={1} ellipsizeMode="tail">채널 바로가기</Text>
        </View>
        <Text style={s.promoArrow}>›</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  selBar:  { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'rgba(224,112,112,0.10)', borderWidth:1, borderColor:'#503030', borderRadius:14, padding:10, marginBottom:10 },
  selCnt:  { flex:1, fontSize:14, color:'#e07070', fontWeight:'900' },
  selB:    { paddingHorizontal:12, paddingVertical:5, borderRadius:20, borderWidth:1, borderColor:'#e07070' },
  selBDel: { backgroundColor:'#e07070' },
  selBT:   { fontSize:13, fontWeight:'700', color:'#e07070' },
  empty:    { alignItems:'center', paddingVertical:60 },
  emptyI:   { fontSize:56, marginBottom:14 },
  emptyT:   { fontSize:18, color:C.txt2, fontWeight:'700' },
  emptySub: { fontSize:14, color:C.txt3, marginTop:6 },
  promoBanner: { flexDirection:'row', alignItems:'center', marginTop:10, padding:12, borderRadius:14, backgroundColor:'rgba(162,155,254,0.08)', borderWidth:1, borderColor:'rgba(162,155,254,0.25)' },
  promoIcon:   { width:38, height:38, borderRadius:12, alignItems:'center', justifyContent:'center', backgroundColor:'rgba(162,155,254,0.18)', marginRight:10 },
  promoIconT:  { fontSize:18 },
  promoTitle:  { fontSize:14, fontWeight:'800', color:C.txt, flexShrink:1 },
  promoSub:    { fontSize:11, fontWeight:'600', color:C.txt3, marginTop:2, flexShrink:1 },
  promoArrow:  { fontSize:20, fontWeight:'700', color:C.txt3, marginLeft:6 },
});
