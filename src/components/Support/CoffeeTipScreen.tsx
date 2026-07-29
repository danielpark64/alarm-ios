import React from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../common/AppText';
import { useColors } from '../../hooks/useTheme';
import { Palette } from '../../constants/colors';
// 인앱결제(IAP) 방식은 스토어 정책상 나중에 다시 필요해질 수 있어 useCoffeeTip 훅은 지우지
// 않고 남겨둔다 — 지금은 계좌 후원 방식으로 운영(2026-07-29 계좌 확정).
// import { useCoffeeTip } from '../../hooks/useCoffeeTip';

const BANK_NAME = '카카오뱅크';
const ACCOUNT_NUMBER = '3333166925857';
const ACCOUNT_HOLDER = '장미향';

// 한 번에 복사하는 버튼은 expo-clipboard가 필요한데, react-native-iap와 nitro-modules의
// 기존 peer 충돌 때문에 지금 설치가 막혀 있다. 대신 계좌번호를 selectable로 두어 길게 누르면
// OS 기본 "복사" 메뉴가 뜨게 했다 — 네이티브 의존성 추가 없이 복사가 가능하다.
export function CoffeeTipScreen({ onClose }: { onClose: () => void }) {
  const C = useColors();
  const s = makeStyles(C);

  return (
    <View style={s.root}>
      <View style={s.topBar}>
        <Text style={s.topBarTitle}>개발자 응원하기</Text>
        <TouchableOpacity style={s.closeBtn} onPress={onClose}>
          <Text style={s.closeBtnText}>닫기</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.emoji}>💜</Text>
        <Text style={s.desc}>
          알람앱이 마음에 드셨다면{'\n'}
          아래 계좌로 작은 후원을 보내주세요{'\n'}
          큰 힘이 됩니다 🙏
        </Text>

        <View style={s.accountCard}>
          <Text style={s.accountBank}>{BANK_NAME}</Text>
          <Text style={s.accountNumber} selectable>{ACCOUNT_NUMBER}</Text>
          <Text style={s.accountHolder}>예금주 {ACCOUNT_HOLDER}</Text>
          <Text style={s.copyHint}>번호를 길게 눌러 복사할 수 있어요</Text>
        </View>

        <Text style={s.note}>자발적인 후원이며, 앱 이용에는 아무 영향이 없어요</Text>
      </ScrollView>
    </View>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    root:          { flex: 1, backgroundColor: C.bg },
    topBar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
    topBarTitle:   { fontSize: 19, fontWeight: '800', color: C.txt },
    closeBtn:      { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 14, borderWidth: 1.5, borderColor: C.border2 },
    closeBtnText:  { fontSize: 15, fontWeight: '700', color: C.txt2 },
    body:          { alignItems: 'center', padding: 32, paddingBottom: 60 },
    emoji:         { fontSize: 64, marginBottom: 16 },
    desc:          { fontSize: 15, color: C.txt2, textAlign: 'center', lineHeight: 24, marginBottom: 32 },
    accountCard:   { width: '100%', backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 22, alignItems: 'center' },
    accountBank:   { fontSize: 13, fontWeight: '700', color: C.txt3, marginBottom: 6 },
    accountNumber: { fontSize: 22, fontWeight: '900', color: C.txt, letterSpacing: 0.5, marginBottom: 6 },
    accountHolder: { fontSize: 13, fontWeight: '600', color: C.txt3, marginBottom: 14 },
    copyHint:      { fontSize: 12, color: C.txt3 },
    note:          { fontSize: 11, color: C.txt3, marginTop: 24, textAlign: 'center' },
  });
}
