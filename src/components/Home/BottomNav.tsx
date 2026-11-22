import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../common/AppText';
import { Palette } from '../../constants/colors';
import { useColors } from '../../hooks/useTheme';
import { useT } from '../../i18n';

export type HomeTab = 'alarms' | 'calendar' | 'add' | 'share' | 'settings';

// 하단 네비 — 달력 / 알람 / 공유 / 설정 (추가는 헤더의 + 버튼으로 진입)
// 달력이 메인 화면이라 첫 자리에 둔다. 공유(1.6.0)는 받은 근무표 전용 — 내 달력과 섞지 않으려고 탭을 따로 뒀다
export function BottomNav({ tab, setTab, bottomInset }: { tab: HomeTab; setTab: (t: HomeTab) => void; bottomInset: number }) {
  const s = makeStyles(useColors());
  const { t } = useT();
  return (
    <View style={[s.nav, { paddingBottom: Math.max(bottomInset, 14) }]}>
      <TouchableOpacity style={s.navBtn} onPress={()=>setTab('calendar')}>
        <View style={[s.navI, tab==='calendar' && s.navIA]}>
          <Text style={s.navIT}>📅</Text>
        </View>
        <Text style={[s.navL, tab==='calendar' && s.navLA]}>{t('달력')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.navBtn} onPress={()=>setTab('alarms')}>
        <View style={[s.navI, tab==='alarms' && s.navIA]}>
          <Text style={s.navIT}>⏰</Text>
        </View>
        <Text style={[s.navL, tab==='alarms' && s.navLA]}>{t('알람')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.navBtn} onPress={()=>setTab('share')}>
        <View style={[s.navI, tab==='share' && s.navIA]}>
          <Text style={s.navIT}>👥</Text>
        </View>
        <Text style={[s.navL, tab==='share' && s.navLA]}>{t('공유')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.navBtn} onPress={()=>setTab('settings')}>
        <View style={[s.navI, tab==='settings' && s.navIA]}>
          <Text style={s.navIT}>⚙️</Text>
        </View>
        <Text style={[s.navL, tab==='settings' && s.navLA]}>{t('설정')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    nav:    { flexDirection:'row', justifyContent:'space-around', alignItems:'center', paddingTop:10, backgroundColor:C.bg2, borderTopWidth:1, borderTopColor:C.border },
    navBtn: { flex:1, alignItems:'center', gap:3, paddingHorizontal:4, paddingVertical:4 },
    navI:   { width:34, height:34, borderRadius:17, alignItems:'center', justifyContent:'center' },
    navIA:  { backgroundColor:'rgba(162,155,254,0.18)' },
    navIT:  { fontSize:18 },
    navL:   { fontSize:10, fontWeight:'700', color:C.txt3 },
    navLA:  { color:C.accent },
  });
}
