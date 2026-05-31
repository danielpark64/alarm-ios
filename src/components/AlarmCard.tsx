import React, { memo, useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Alarm } from '../constants';
import { getType, getSound, getVib, repeatLabel, pad, todayStr } from '../utils';

interface Props {
  alarm: Alarm; onToggle: ()=>void; onEdit: ()=>void;
  selectMode: boolean; selected: boolean; onSelect: ()=>void;
  highlighted?: boolean;
}

function fmtDisplayDate(s: string): string {
  const str = s || todayStr();
  const [y,m,d] = str.split('-');
  return String(y).slice(2) + '.' + m + '.' + d;
}

export const AlarmCard = memo(function AlarmCard({ alarm, onToggle, onEdit, selectMode, selected, onSelect, highlighted }: Props) {
  const type = getType(alarm.typeId);
  const snd  = getSound(alarm.snd ?? 'default');
  const vib  = getVib(alarm.vib);
  const sd   = alarm.sd || todayStr();
  const isToday = sd === todayStr();
  const blink = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (highlighted) {
      let count = 0;
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(blink, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(blink, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]),
        { iterations: 6 }
      );
      anim.start(() => { blink.setValue(1); });
    } else {
      blink.setValue(1);
    }
  }, [highlighted]);

  return (
    <Animated.View style={highlighted ? { opacity: blink } : undefined}>
    <TouchableOpacity
      style={[s.card, alarm.active ? s.cardOn : s.cardOff, highlighted && s.cardHL]}
      onPress={selectMode ? onSelect : onEdit}
      activeOpacity={0.85}
    >
      {selectMode && (
        <View style={[s.cb, selected && s.cbSel]}>
          {selected && <Text style={s.ck}>✓</Text>}
        </View>
      )}
      <View style={[s.icon, alarm.active && { backgroundColor: type.color+'22', borderColor: type.color+'66' }, !alarm.active && s.iconDim]}>
        <Text style={[s.iconT, !alarm.active && s.dim]}>{type.icon}</Text>
      </View>
      <View style={[s.info, !alarm.active && s.infoDim]}>
        <Text style={[s.time, !alarm.active && s.dim]}>{pad(alarm.hour)}:{pad(alarm.min)}</Text>
        <Text style={[s.label, !alarm.active && s.dim]}>{alarm.label || type.label}</Text>
        <Text style={s.dateText}>{fmtDisplayDate(sd)}{isToday ? ' (오늘)' : '부터'}</Text>
        <View style={s.badges}>
          <View style={s.badge}><Text style={s.badgeT}>{'🔄 ' + repeatLabel(alarm)}</Text></View>
          <View style={s.badge}><Text style={s.badgeT}>{snd.icon + ' ' + snd.label}</Text></View>
          <View style={s.badge}><Text style={s.badgeT}>{vib.icon + ' ' + vib.label}</Text></View>
        </View>
      </View>
      {!selectMode && (
        <View style={s.actions}>
          <TouchableOpacity style={[s.toggle, alarm.active ? s.toggleOn : s.toggleOff]} onPress={onToggle} activeOpacity={0.8}>
            <View style={[s.thumb, alarm.active ? s.thumbOn : s.thumbOff]}/>
          </TouchableOpacity>
          <TouchableOpacity style={s.editBtn} onPress={onEdit}>
            <Text style={s.editI}>✏️</Text>
            <Text style={s.editL}>수정</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
    </Animated.View>
  );
});

const s = StyleSheet.create({
  card: { flexDirection:"row", alignItems:"center", padding:14, borderRadius:16, marginBottom:10, backgroundColor:"#fff", shadowColor:"#000", shadowOffset:{width:0,height:2}, shadowOpacity:0.07, shadowRadius:6, elevation:2, borderWidth:1 },
  cardOn:   { borderColor:"#444", borderWidth:1.5 },
  cardOff:  { borderColor:"#ccc" },
  cb:       { width:26, height:26, borderRadius:13, borderWidth:2, borderColor:"#ccc", alignItems:"center", justifyContent:"center", marginRight:10 },
  cbSel:    { backgroundColor:"#9C27B0", borderColor:"#9C27B0" },
  ck:       { color:"#fff", fontWeight:"900", fontSize:14 },
  icon:     { width:56, height:56, borderRadius:14, alignItems:"center", justifyContent:"center", backgroundColor:"#f5f5f5", borderWidth:1.5, borderColor:"#ccc", marginRight:12 },
  iconDim:  { opacity:0.4 },
  iconT:    { fontSize:28 },
  info:     { flex:1, minWidth:0 },
  infoDim:  { opacity:0.45 },
  time:     { fontFamily:"monospace", fontSize:28, fontWeight:"900", letterSpacing:-1, color:"#000" },
  label:    { fontSize:17, fontWeight:"900", marginTop:2, color:"#000" },
  dim:      { color:"#aaa" },
  dateText: { fontSize:12, fontWeight:"700", color:"#7777aa", marginTop:3 },
  badges:   { flexDirection:"row", flexWrap:"wrap", gap:5, marginTop:5 },
  badge:    { paddingHorizontal:10, paddingVertical:3, borderRadius:99, borderWidth:1, borderColor:"#333", backgroundColor:"#f0f0f0" },
  badgeT:   { fontSize:12, fontWeight:"700", color:"#000" },
  actions:  { alignItems:"center", gap:6 },
  toggle:   { width:51, height:31, borderRadius:16, justifyContent:"center", paddingHorizontal:2 },
  toggleOn: { backgroundColor:"#333" },
  toggleOff:{ backgroundColor:"#aaa", borderWidth:1.5, borderColor:"#888" },
  thumb:    { width:27, height:27, borderRadius:14, backgroundColor:"#fff", shadowColor:"#000", shadowOffset:{width:0,height:1}, shadowOpacity:0.3, shadowRadius:2 },
  thumbOn:  { alignSelf:"flex-end" },
  thumbOff: { alignSelf:"flex-start" },
  editBtn:  { alignItems:"center", gap:2, borderWidth:1.5, borderColor:"#aaa", backgroundColor:"#f5f5f5", borderRadius:10, paddingHorizontal:10, paddingVertical:5 },
  editI:    { fontSize:20, lineHeight:24 },
  editL:    { fontSize:13, fontWeight:"900", color:"#111" },
});
