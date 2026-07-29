import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Text } from '../common/AppText';
import { useColors } from '../../hooks/useTheme';
import { Palette } from '../../constants/colors';
// 인앱결제(IAP) 방식은 스토어 정책상 나중에 다시 필요해질 수 있어 useCoffeeTip 훅은 지우지
// 않고 남겨둔다 — 지금은 계좌 후원 방식으로 운영(2026-07-29 계좌 확정).
// import { useCoffeeTip } from '../../hooks/useCoffeeTip';

const BANK_NAME = '카카오뱅크';
const ACCOUNT_NUMBER = '3333166925857';
const ACCOUNT_HOLDER = '장미향';

export function CoffeeTipScreen({ onClose }: { onClose: () => void }) {
  const C = useColors();
  const s = makeStyles(C);
  const [copied, setCopied] = useState(false);

  // 계좌번호는 은행 앱에 붙여넣어야 하므로 한 번에 복사되는 게 중요하다.
  // Alert로 알리면 확인을 또 눌러야 해서, 버튼 문구를 잠깐 "복사됐어요"로 바꿔서 알린다.
  const handleCopy = async () => {
    await Clipboard.setStringAsync(ACCOUNT_NUMBER);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
          <TouchableOpacity
            style={[s.copyBtn, copied && s.copyBtnDone]}
            onPress={handleCopy}
            activeOpacity={0.8}
          >
            <Text style={s.copyBtnText}>{copied ? '✓ 복사됐어요' : '계좌번호 복사'}</Text>
          </TouchableOpacity>
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
    accountHolder: { fontSize: 13, fontWeight: '600', color: C.txt3, marginBottom: 18 },
    copyBtn:       { backgroundColor: C.accent2, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14, alignSelf: 'stretch', alignItems: 'center' },
    copyBtnDone:   { backgroundColor: C.accent },
    copyBtnText:   { fontSize: 15, fontWeight: '800', color: C.txt },
    note:          { fontSize: 11, color: C.txt3, marginTop: 24, textAlign: 'center' },
  });
}
