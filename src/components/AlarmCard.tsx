import React, { memo, useEffect, useRef } from 'react';
import { Animated, Platform } from 'react-native';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from './common/AppText';
import { Alarm } from '../constants';
import { Palette } from '../constants/colors';
import { useColors } from '../hooks/useTheme';
import { getType, getSound, getVib, repeatLabel, pad, todayStr } from '../utils';
import { VibIcon } from './VibIcon';

interface Props {
  alarm: Alarm; onToggle: ()=>void; onEdit: ()=>void;
  selectMode: boolean; selected: boolean; onSelect: ()=>void;
  onLongPressSelect: ()=>void;
  highlighted?: boolean; repLimited?: boolean;
}

function fmtDisplayDate(s: string): string {
  const str = s || todayStr();
  const [,m,d] = str.split('-');
  const date = new Date(str);
  const dow = ['일','월','화','수','목','금','토'][date.getDay()];
  return `${m}.${d} (${dow})`;
}

// N일 후 휴식 — 근무/휴식 패턴 점 표시 (최대 8개)
function RestDots({ cd, rd, s }: { cd: number; rd: number; s: ReturnType<typeof makeStyles> }) {
  const total = cd + rd;
  const showCount = Math.min(total, 8);
  const filledCount = Math.min(cd, showCount);
  const dots = Array.from({ length: showCount }, (_, i) => i < filledCount);
  return (
    <View style={s.dotsRow}>
      {dots.map((filled, i) => (
        <View key={i} style={filled ? s.dotFilled : s.dotHollow} />
      ))}
    </View>
  );
}

export const AlarmCard = memo(function AlarmCard({ alarm, onToggle, onEdit, selectMode, selected, onSelect, onLongPressSelect, highlighted, repLimited }: Props) {
  const C = useColors();
  const s = makeStyles(C);
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
        { borderColor: type.color, borderWidth: alarm.active ? 2 : 1 },
        !alarm.active && s.cardOff,
        highlighted && s.cardHL,
      ]}
      onPress={selectMode ? onSelect : onEdit}
      onLongPress={selectMode ? undefined : onLongPressSelect}
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
          <Text style={[s.time, !alarm.active && s.dim]}>
            {pad(alarm.hour)}<Text style={s.timeColon}>:</Text>{pad(alarm.min)}
          </Text>
          <Text style={[s.label, { color: type.color }]} numberOfLines={1}>{alarm.label || type.label}</Text>
        </View>
        <Text style={s.metaT} numberOfLines={1}>{fmtDisplayDate(sd) + '부터'}</Text>
        <View style={s.row3}>
          <Text style={s.repeatT} numberOfLines={1}>{'🔄 ' + repeatLabel(alarm)}</Text>
          {alarm.rm === 'rest' && <RestDots cd={alarm.cd ?? 2} rd={alarm.rd ?? 1} s={s} />}
          {repLimited && alarm.active && (
            <View style={s.badgeWarn}><Text style={s.badgeWarnT}>⚠ 1회만</Text></View>
          )}
          <View style={s.snVibRow}>
            {alarm.snd !== 'none' && <Text style={s.snVib}>{snd.icon}</Text>}
            {alarm.vib !== 'none' && <VibIcon size={18} color={C.txt3} />}
          </View>
        </View>
      </View>
      {!selectMode && (
        <View style={s.actions}>
          <TouchableOpacity style={[s.toggle, alarm.active ? s.toggleOn : s.toggleOff]} onPress={onToggle} activeOpacity={0.8}>
            <View style={[s.thumb, alarm.active ? s.thumbOn : s.thumbOff]}/>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
    </Animated.View>
  );
});

function makeStyles(C: Palette) {
  return StyleSheet.create({
  card: { flexDirection:"row", alignItems:"center", paddingVertical:10, paddingHorizontal:14, borderRadius:14, marginBottom:8, backgroundColor:C.bg2, borderWidth:1 },
  cardOff:  { opacity: 0.5 },
  cardHL:   { borderColor: C.accent, borderWidth: 2.5 },
  cb:       { width:26, height:26, borderRadius:13, borderWidth:2, borderColor:C.border2, alignItems:"center", justifyContent:"center", marginRight:10 },
  cbSel:    { backgroundColor:C.accent2, borderColor:C.accent2 },
  ck:       { color:"#fff", fontWeight:"900", fontSize:14 },
  iconDim:  { opacity:0.4 },
  iconT:    { fontSize:22, marginRight:10, alignSelf:"center", width: Platform.OS === 'android' ? 30 : undefined },
  info:     { flex:1, minWidth:0 },
  infoDim:  { opacity:0.45 },
  row1:     { flexDirection:"row", alignItems:"baseline" },
  row3:     { flexDirection:"row", alignItems:"center", marginTop:3, gap:6 },
  time:     { fontFamily: Platform.OS === 'ios' ? 'Courier' : undefined, fontSize:24, fontWeight:"900", letterSpacing: Platform.OS === 'android' ? 0 : -1, color:C.txt, marginRight:8 },
  timeColon:{ fontFamily: Platform.OS === 'ios' ? 'Courier' : undefined, fontSize:24, fontWeight:"900", letterSpacing:0, marginHorizontal: Platform.OS === 'android' ? -2 : 0, color:C.txt },
  label:    { fontSize:15, fontWeight:"800", color:C.txt, flexShrink:1 },
  dim:      { color:C.txt3 },
  repeatT:  { fontSize:13, fontWeight:"800", color:C.txt3, flexShrink:1 },
  metaT:    { fontSize:11, fontWeight:"600", color:C.txt3, marginTop:2 },
  dotsRow:  { flexDirection:'row', gap:3 },
  dotFilled:{ width:6, height:6, borderRadius:3, backgroundColor:C.accent2 },
  dotHollow:{ width:6, height:6, borderRadius:3, borderWidth:1, borderColor:C.border2 },
  snVibRow: { flexDirection:'row', alignItems:'center', marginLeft:'auto', gap:6 },
  snVib:    { fontSize:13 },
  badgeWarn: { paddingHorizontal:8, paddingVertical:2, borderRadius:99, borderWidth:1, borderColor:"#854f0b", backgroundColor:"#412402" },
  badgeWarnT:{ fontSize:11, fontWeight:"700", color:"#fac775" },
  actions:  { alignItems:"center", gap:5, marginLeft:8 },
  toggle:   { width:46, height:28, borderRadius:14, justifyContent:"center", paddingHorizontal:2 },
  toggleOn: { backgroundColor:C.accent2 },
  toggleOff:{ backgroundColor:C.bg3, borderWidth:1.5, borderColor:C.border2 },
  thumb:    { width:24, height:24, borderRadius:12, backgroundColor:"#fff", shadowColor:"#000", shadowOffset:{width:0,height:1}, shadowOpacity:0.3, shadowRadius:2 },
  thumbOn:  { alignSelf:"flex-end" },
  thumbOff: { alignSelf:"flex-start" },
  });
}
