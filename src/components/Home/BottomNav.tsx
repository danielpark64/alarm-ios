import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C } from '../../constants/colors';

export type HomeTab = 'alarms' | 'calendar' | 'add';

// 하단 네비 — 알람 / 달력 / 추가
export function BottomNav({ tab, setTab, bottomInset }: { tab: HomeTab; setTab: (t: HomeTab) => void; bottomInset: number }) {
  return (
    <View style={[s.nav, { paddingBottom: Math.max(bottomInset, 14) }]}>
      <TouchableOpacity style={s.navBtn} onPress={()=>setTab('alarms')}>
        <View style={[s.navI, tab==='alarms' && s.navIA]}>
          <Text style={s.navIT}>⏰</Text>
        </View>
        <Text style={[s.navL, tab==='alarms' && s.navLA]}>알람</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.navBtn} onPress={()=>setTab('calendar')}>
        <View style={[s.navI, tab==='calendar' && s.navIA]}>
          <Text style={s.navIT}>📅</Text>
        </View>
        <Text style={[s.navL, tab==='calendar' && s.navLA]}>달력</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.navBtn} onPress={()=>setTab('add')}>
        <View style={[s.navIC, tab==='add' && s.navICA]}>
          <Text style={{fontSize:22,color:'#fff',fontWeight:'900'}}>＋</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  nav:    { flexDirection:'row', justifyContent:'space-around', alignItems:'center', paddingTop:10, backgroundColor:'rgba(11,11,28,0.96)', borderTopWidth:1, borderTopColor:C.border },
  navBtn: { alignItems:'center', gap:3, paddingHorizontal:20, paddingVertical:4 },
  navI:   { width:34, height:34, borderRadius:17, alignItems:'center', justifyContent:'center' },
  navIA:  { backgroundColor:'rgba(162,155,254,0.18)' },
  navIT:  { fontSize:18 },
  navIC:  { width:50, height:50, borderRadius:15, backgroundColor:C.bg3, borderWidth:1, borderColor:C.border2, alignItems:'center', justifyContent:'center' },
  navICA: { backgroundColor:C.accent2, borderColor:'transparent', shadowColor:C.accent, shadowOffset:{width:0,height:4}, shadowOpacity:0.45, shadowRadius:12, elevation:8 },
  navL:   { fontSize:10, fontWeight:'700', color:C.txt3 },
  navLA:  { color:C.accent },
});
