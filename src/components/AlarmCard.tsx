import React, { memo, useEffect, useRef, useState } from 'react';
import { Animated, Platform } from 'react-native';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from './common/AppText';
import { Alarm } from '../constants';
import { Palette } from '../constants/colors';
import { useColors } from '../hooks/useTheme';
import { getType, getSound, getVib, repeatLabel, pad, todayStr, effectiveShift, effectiveTime } from '../utils';
import { roleLabel } from '../utils/workPattern';
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
  // 로테이션 알람은 alarm.label이 비어있음(제목이 세그먼트마다 다르므로 스케줄링 시점에 조합) —
  // 리스트 카드엔 오늘 세그먼트 기준 "초번 출근"류 라벨을 대신 보여준다(휴식일이면 일반 라벨로 폴백).
  // 단, 시작일이 아직 안 된 그룹(오늘 < sd)은 resolveSegment가 오늘 기준으론 항상 null이라
  // "출근"처럼 밋밋한 일반 라벨로 떨어지는 버그가 있었음 — 이런 경우엔 시작일(day 1) 기준으로
  // 대신 계산해서 "이 그룹이 시작하면 어떤 모습일지" 미리 보여준다.
  const resolveDate = alarm.sd && alarm.sd > todayStr() ? alarm.sd : todayStr();
  const patternShift = alarm.rm === 'pattern' ? effectiveShift(alarm, resolveDate) : null;
  const displayLabel = patternShift ? roleLabel(patternShift, alarm.groupRole ?? 'commute') : (alarm.label || type.label);
  // 로테이션 알람의 alarm.hour/min은 항상 첫 블록(예: 초번) 시각으로 고정된 레거시 폴백값 —
  // 카드에 보여줄 시각도 위와 같은 기준 날짜로 다시 계산해야 라벨과 시각이 일치한다
  const patternTime = alarm.rm === 'pattern' ? effectiveTime(alarm, resolveDate) : null;
  const dispHour = patternTime ? patternTime.hour : alarm.hour;
  const dispMin = patternTime ? patternTime.min : alarm.min;
  // 그룹 펼치기 — 이 알람 하나만 봐선 "말번이 사라졌다"고 오인하기 쉬워서(오늘 세그먼트만 보이므로),
  // 눌러서 펼치면 이 알람의 역할(출근/퇴근)에 해당하는 전체 로테이션 세그먼트 시각을 다 보여준다.
  // alarm.pattern이 그룹 멤버 전원에 복제 저장돼 있어 이 알람 하나만으로 완결적으로 렌더링 가능.
  const [expanded, setExpanded] = useState(false);
  const role = alarm.groupRole ?? 'commute';
  const segRows = alarm.rm === 'pattern' && alarm.pattern
    ? alarm.pattern
        .filter(seg => !seg.isRest && (role === 'commute' || seg.hasOffwork))
        .map(seg => ({
          label: roleLabel(seg, role),
          time: role === 'offwork' ? seg.offworkTime : seg.commuteTime,
        }))
        .filter((r): r is { label: string; time: { hour: number; min: number } } => !!r.time)
    : [];
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
    {/* 켜고 끄기 스위치를 카드 전체 Touchable 안에 두면, 살짝 빗나간 탭이 부모로 떨어져
        수정 화면이 열렸다("잘못 눌러 수정 갔다가 다시 와서 재시도"). 카드는 일반 View로 두고
        본문만 Touchable로 감싸서, 스위치 주변을 빗나가면 아무 일도 일어나지 않게 한다. */}
    <View
      style={[
        s.card,
        { borderColor: type.color, borderWidth: alarm.active ? 2 : 1 },
        !alarm.active && s.cardOff,
        highlighted && s.cardHL,
      ]}
    >
      <TouchableOpacity
        style={s.cardMain}
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
            {pad(dispHour)}<Text style={s.timeColon}>:</Text>{pad(dispMin)}
          </Text>
          <Text style={[s.label, { color: type.color }]} numberOfLines={1}>{displayLabel}</Text>
        </View>
        {/* 소리·진동 아이콘은 짧은 "…부터" 줄에 붙인다. 반복 문구 줄에 두면 그 줄의 가용 폭을
            가져가서, 글자크기 "크게"에서 "매년 음력 7월 29일 (양력 9월 10일)" 같은 긴 문구가
            한글 9~10자마다 끊기고 결국 잘렸다(줄 수만 늘리면 "7월 / 29일"처럼 더 지저분해짐). */}
        <View style={s.row2}>
          <Text style={s.metaT} numberOfLines={1}>{fmtDisplayDate(sd) + '부터'}</Text>
          <View style={s.snVibRow}>
            {alarm.snd !== 'none' && <Text style={s.snVib}>{snd.icon}</Text>}
            {alarm.vib !== 'none' && <VibIcon size={18} color={C.txt3} />}
          </View>
        </View>
        <View style={s.row3}>
          <Text style={s.repeatT} numberOfLines={2}>{'🔄 ' + repeatLabel(alarm)}</Text>
          {/* 로테이션(pattern) 알람은 "1일→1일→1일 휴식 반복" 텍스트가 이미 순서까지 정확히
              보여주므로 점(RestDots)은 정보 중복 — 단순 "N일 후 휴식"(rest)에서만 유지 */}
          {alarm.rm === 'rest' && <RestDots cd={alarm.cd ?? 2} rd={alarm.rd ?? 1} s={s} />}
          {repLimited && alarm.active && (
            <View style={s.badgeWarn}><Text style={s.badgeWarnT}>⚠ 1회만</Text></View>
          )}
        </View>
        {expanded && segRows.length > 0 && (
          <View style={s.segList}>
            {segRows.map((r, i) => (
              <View key={i} style={s.segRow}>
                <Text style={s.segLabel}>{r.label}</Text>
                <Text style={s.segTime}>{pad(r.time.hour)}:{pad(r.time.min)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      </TouchableOpacity>
      {!selectMode && (
        <View style={s.actions}>
          {segRows.length > 0 && (
            <TouchableOpacity style={s.expandBtn} onPress={() => setExpanded(v => !v)} hitSlop={{top:8,bottom:4,left:8,right:8}}>
              <Text style={s.expandBtnText}>{expanded ? '▲' : '▼'}</Text>
            </TouchableOpacity>
          )}
          {/* 알약(46×28)은 그대로 두고 감싸는 Touchable에 실제 여백을 줘서 62×50을 확보한다.
              hitSlop은 Android에서 부모 경계에 클리핑되는 경우가 있어 레이아웃 패딩이 더 확실하다. */}
          <TouchableOpacity style={s.toggleHit} onPress={onToggle} activeOpacity={0.8}>
            <View style={[s.toggle, alarm.active ? s.toggleOn : s.toggleOff]}>
              <View style={[s.thumb, alarm.active ? s.thumbOn : s.thumbOff]}/>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
    </Animated.View>
  );
});

function makeStyles(C: Palette) {
  return StyleSheet.create({
  card: { flexDirection:"row", alignItems:"center", paddingVertical:10, paddingHorizontal:14, borderRadius:14, marginBottom:8, backgroundColor:C.bg2, borderWidth:1 },
  cardMain: { flex:1, flexDirection:"row", alignItems:"center", minWidth:0 },
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
  row2:     { flexDirection:"row", alignItems:"center" },
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
  actions:  { alignItems:"center", gap:8, marginLeft:8 },
  // 고령층 사용성 피드백 — 화살표가 너무 작고 흐려서 안 보인다고 함. 배경 있는
  // 버튼 형태로 키우고 색도 진하게 바꿔 탭할 수 있는 요소라는 게 분명히 보이도록 함
  expandBtn: { width:32, height:32, borderRadius:16, backgroundColor:C.bg3, borderWidth:1, borderColor:C.border2, alignItems:"center", justifyContent:"center" },
  expandBtnText: { fontSize:16, fontWeight:"900", color:C.txt2 },
  segList:  { marginTop:8, paddingTop:8, borderTopWidth:1, borderTopColor:C.border },
  segRow:   { flexDirection:"row", justifyContent:"space-between", paddingVertical:2 },
  segLabel: { fontSize:12, fontWeight:"700", color:C.txt2 },
  segTime:  { fontSize:12, fontWeight:"700", color:C.txt3 },
  toggleHit:{ paddingVertical:11, paddingHorizontal:8 },
  toggle:   { width:46, height:28, borderRadius:14, justifyContent:"center", paddingHorizontal:2 },
  toggleOn: { backgroundColor:C.accent2 },
  toggleOff:{ backgroundColor:C.bg3, borderWidth:1.5, borderColor:C.border2 },
  thumb:    { width:24, height:24, borderRadius:12, backgroundColor:"#fff", shadowColor:"#000", shadowOffset:{width:0,height:1}, shadowOpacity:0.3, shadowRadius:2 },
  thumbOn:  { alignSelf:"flex-end" },
  thumbOff: { alignSelf:"flex-start" },
  });
}
