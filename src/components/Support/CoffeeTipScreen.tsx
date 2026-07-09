import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { Text } from '../common/AppText';
import { useColors } from '../../hooks/useTheme';
import { Palette } from '../../constants/colors';
import { useCoffeeTip } from '../../hooks/useCoffeeTip';

export function CoffeeTipScreen() {
  const C = useColors();
  const s = makeStyles(C);
  const { product, loading, purchasing, purchase, error } = useCoffeeTip();

  useEffect(() => {
    if (error) Alert.alert('오류', error);
  }, [error]);

  return (
    <View style={s.root}>
      <Text style={s.emoji}>☕</Text>
      <Text style={s.title}>커피 한 잔 사주기</Text>
      <Text style={s.desc}>
        알람앱이 마음에 드셨다면{'\n'}
        개발자에게 커피 한 잔을 후원해주세요!{'\n'}
        큰 힘이 됩니다 🙏
      </Text>

      {loading ? (
        <ActivityIndicator size="large" color={C.accent} style={{ marginTop: 32 }} />
      ) : product ? (
        <TouchableOpacity
          style={[s.btn, purchasing && s.btnDisabled]}
          onPress={purchase}
          disabled={purchasing}
          activeOpacity={0.8}
        >
          {purchasing
            ? <ActivityIndicator size="small" color="#0b0b1c" />
            : <Text style={s.btnText}>☕ 커피 한 잔 {product.displayPrice ?? ''}</Text>
          }
        </TouchableOpacity>
      ) : (
        <Text style={s.unavailable}>현재 이용할 수 없습니다</Text>
      )}

      <Text style={s.note}>결제는 Google Play를 통해 안전하게 처리됩니다</Text>
    </View>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    root:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: C.bg },
    emoji:       { fontSize: 64, marginBottom: 16 },
    title:       { fontSize: 22, fontWeight: '900', color: C.txt, marginBottom: 12 },
    desc:        { fontSize: 15, color: C.txt2, textAlign: 'center', lineHeight: 24, marginBottom: 32 },
    btn:         { backgroundColor: C.accent, paddingHorizontal: 36, paddingVertical: 18, borderRadius: 50, minWidth: 200, alignItems: 'center' },
    btnDisabled: { opacity: 0.6 },
    btnText:     { fontSize: 17, fontWeight: '900', color: '#0b0b1c' },
    unavailable: { fontSize: 14, color: C.txt3, marginTop: 24 },
    note:        { fontSize: 11, color: C.txt3, marginTop: 24, textAlign: 'center' },
  });
}
