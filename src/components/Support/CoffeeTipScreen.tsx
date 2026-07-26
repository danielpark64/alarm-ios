import React from 'react';
import { View, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Text } from '../common/AppText';
import { useColors } from '../../hooks/useTheme';
import { Palette } from '../../constants/colors';
// 인앱결제(IAP) 방식은 스토어 정책상 나중에 다시 필요해질 수 있어 useCoffeeTip 훅은 지우지
// 않고 남겨둔다 — 지금은 계좌 후원 방식으로 임시 전환(2026-07-27).
// import { useCoffeeTip } from '../../hooks/useCoffeeTip';

// TODO: 실제 은행명/계좌번호/예금주로 교체
const BANK_NAME = 'OO은행';
const ACCOUNT_NUMBER = '000-0000-000000';
const ACCOUNT_HOLDER = '홍길동';

export function CoffeeTipScreen() {
  const C = useColors();
  const s = makeStyles(C);

  const handleCopy = () => {
    // 디자인 미리보기 단계 — 실제 클립보드 복사는 계좌 정보 확정 후 expo-clipboard로 연결
    Alert.alert('복사됨', `${ACCOUNT_NUMBER}\n(미리보기 — 실제 복사 기능은 아직 연결 전)`);
  };

  return (
    <View style={s.root}>
      <Text style={s.emoji}>💜</Text>
      <Text style={s.title}>개발자 응원하기</Text>
      <Text style={s.desc}>
        알람앱이 마음에 드셨다면{'\n'}
        아래 계좌로 작은 후원을 보내주세요{'\n'}
        큰 힘이 됩니다 🙏
      </Text>

      <View style={s.accountCard}>
        <Text style={s.accountBank}>{BANK_NAME}</Text>
        <Text style={s.accountNumber}>{ACCOUNT_NUMBER}</Text>
        <Text style={s.accountHolder}>예금주 {ACCOUNT_HOLDER}</Text>
        <TouchableOpacity style={s.copyBtn} onPress={handleCopy} activeOpacity={0.8}>
          <Text style={s.copyBtnText}>계좌번호 복사</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.note}>자발적인 후원이며, 앱 이용에는 아무 영향이 없어요</Text>
    </View>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    root:          { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: C.bg },
    emoji:         { fontSize: 64, marginBottom: 16 },
    title:         { fontSize: 22, fontWeight: '900', color: C.txt, marginBottom: 12 },
    desc:          { fontSize: 15, color: C.txt2, textAlign: 'center', lineHeight: 24, marginBottom: 32 },
    accountCard:   { width: '100%', backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 22, alignItems: 'center' },
    accountBank:   { fontSize: 13, fontWeight: '700', color: C.txt3, marginBottom: 6 },
    accountNumber: { fontSize: 22, fontWeight: '900', color: C.txt, letterSpacing: 0.5, marginBottom: 6 },
    accountHolder: { fontSize: 13, fontWeight: '600', color: C.txt3, marginBottom: 18 },
    copyBtn:       { backgroundColor: C.accent2, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14, alignSelf: 'stretch', alignItems: 'center' },
    copyBtnText:   { fontSize: 15, fontWeight: '800', color: C.txt },
    note:          { fontSize: 11, color: C.txt3, marginTop: 24, textAlign: 'center' },
  });
}
