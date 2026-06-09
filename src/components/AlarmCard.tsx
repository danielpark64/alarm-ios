import React, { memo, useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Alarm } from '../constants';
import { getType, getSound, getVib, repeatLabel, pad, todayStr } from '../utils';
import { VibIcon } from './VibIcon';

interface Props {
  alarm: Alarm; onToggle: ()=>void; onEdit: ()=>void;
  selectMode: boolean; selected: boolean; onSelect: ()=>void;
  highlighted?: boolean; repLimited?: boolean;
}

function fmtDisplayDate(s: string): string {
  const str = s || todayStr();
  const [,m,d] = str.split('-');
  const date = new Date(str);
  const dow = ['일','월','화','수','목','금','토'][date.getDay()];
  return `${m}.${d} (${dow})`;
}

export const AlarmCard = memo(function AlarmCard({ alarm, onToggle, onEdit, selectMode, selected, onSelect, highlighted, repLimited }: Props) {
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
      style={[
        s.card,
        { borderColor: type.color, borderWidth: alarm.active ? 2.5 : 1.5 },
        !alarm.active && s.cardOff,
        highlighted && s.cardHL,
      ]}
      onPress={selectMode ? onSelect : onEdit}
      activeOpacity={0.85}
    >
      {selectMode && (
        <View style={[s.cb, selected && s.cbSel]}>
          {selected && <Text style={s.ck}>✓</Text>}
        </View>
      )}
      <Text style={[s.iconT, !alarm.active && s.dim]}>{type.icon}</Text>
      <View style={[s.info, !alarm.active && s.infoDim]}>
        <View style={s.row1}>
          <Text style={[s.time, !alarm.active && s.dim]}>{pad(alarm.hour)}:{pad(alarm.min)}</Text>
          <Text style={[s.label, { color: type.color }]} numberOfLines={1}>{alarm.label || type.label}</Text>
        </View>
        <Text style={s.metaT} numberOfLines={1}>{fmtDisplayDate(sd) + '부터'}</Text>
        <View style={s.row3}>
          <Text style={s.repeatT} numberOfLines={1}>{'🔄 ' + repeatLabel(alarm)}</Text>
          {repLimited && alarm.active && (
            <View style={s.badgeWarn}><Text style={s.badgeWarnT}>⚠ 1회만</Text></View>
          )}
          <View style={s.snVibRow}>
            <Text style={s.snVib}>{snd.icon}</Text>
            {alarm.vib !== 'none' && <VibIcon size={18} />}
          </View>
        </View>
      </View>
      {!selectMode && (
        <View style={s.actions}>
          <TouchableOpacity style={[s.toggle, alarm.active ? s.toggleOn : s.toggleOff]} onPress={onToggle} activeOpacity={0.8}>
            <View style={[s.thumb, alarm.active ? s.thumbOn : s.thumbOff]}/>
          </TouchableOpacity>
          <TouchableOpacity style={s.editBtn} onPress={onEdit}>
            <Text style={s.editI}>✏️</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
    </Animated.View>
  );
});

const s = StyleSheet.create({
  card: { flexDirection:"row", alignItems:"center", paddingVertical:10, paddingHorizontal:14, borderRadius:14, marginBottom:8, backgroundColor:"#fff", shadowColor:"#000", shadowOffset:{width:0,height:2}, shadowOpacity:0.07, shadowRadius:6, elevation:2, borderWidth:1 },
  cardOff:  { opacity: 0.5 },
  cb:       { width:26, height:26, borderRadius:13, borderWidth:2, borderColor:"#ccc", alignItems:"center", justifyContent:"center", marginRight:10 },
  cbSel:    { backgroundColor:"#9C27B0", borderColor:"#9C27B0" },
  ck:       { color:"#fff", fontWeight:"900", fontSize:14 },
  iconDim:  { opacity:0.4 },
  iconT:    { fontSize:22, marginRight:10, alignSelf:"center" },
  info:     { flex:1, minWidth:0 },
  infoDim:  { opacity:0.45 },
  row1:     { flexDirection:"row", alignItems:"baseline" },
  row3:     { flexDirection:"row", alignItems:"center", marginTop:3, gap:6 },
  time:     { fontFamily:"monospace", fontSize:24, fontWeight:"900", letterSpacing:-1, color:"#000", marginRight:8 },
  label:    { fontSize:15, fontWeight:"800", color:"#000", flexShrink:1 },
  dim:      { color:"#aaa" },
  repeatT:  { fontSize:13, fontWeight:"800", color:"#5555aa", flexShrink:1 },
  metaT:    { fontSize:11, fontWeight:"600", color:"#999", marginTop:2 },
  snVibRow: { flexDirection:'row', alignItems:'center', marginLeft:'auto', gap:6 },
  snVib:    { fontSize:13 },
  badgeWarn: { paddingHorizontal:8, paddingVertical:2, borderRadius:99, borderWidth:1, borderColor:"#e07030", backgroundColor:"#fff4ee" },
  badgeWarnT:{ fontSize:11, fontWeight:"700", color:"#e07030" },
  actions:  { alignItems:"center", gap:5, marginLeft:8 },
  toggle:   { width:46, height:28, borderRadius:14, justifyContent:"center", paddingHorizontal:2 },
  toggleOn: { backgroundColor:"#333" },
  toggleOff:{ backgroundColor:"#aaa", borderWidth:1.5, borderColor:"#888" },
  thumb:    { width:24, height:24, borderRadius:12, backgroundColor:"#fff", shadowColor:"#000", shadowOffset:{width:0,height:1}, shadowOpacity:0.3, shadowRadius:2 },
  thumbOn:  { alignSelf:"flex-end" },
  thumbOff: { alignSelf:"flex-start" },
  editBtn:  { alignItems:"center", justifyContent:"center", width:34, height:34, borderWidth:1.5, borderColor:"#aaa", backgroundColor:"#f5f5f5", borderRadius:9 },
  editI:    { fontSize:16 },
});
