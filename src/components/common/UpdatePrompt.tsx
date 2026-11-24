// 새 버전 안내 창(1.6.3) — "새 버전이 있어요" + 큰 [업데이트] + 작은 [나중에]. 필수 판(required)은 [나중에]가 없다(구조만).
// ⚠️ RN Modal 컴포넌트를 쓰지 않는다 — 화면 안 덮개(View)라 울림 화면(AlarmRinging, Modal)이 늘 그 위에 뜬다.
//    (모달 위 모달은 iOS에서 조용히 안 뜬다 — 알람 끄기를 막으면 안 된다.) 그리는 쪽(app/index.tsx)도 울리는 중엔 그리지 않는다.
// 다른 앱으로 옮길 때 그대로 쓴다(문구 키 3개: '새 버전이 있어요'·'업데이트'·'나중에').
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from './AppText';
import { useT } from '../../i18n';
import { useColors } from '../../hooks/useTheme';

interface Props {
  required: boolean;
  onUpdate: () => void;
  onLater: () => void;
}

export function UpdatePrompt({ required, onUpdate, onLater }: Props) {
  const { t } = useT();
  const C = useColors();
  return (
    <View style={s.backdrop} accessibilityViewIsModal>
      <View style={[s.card, { backgroundColor: C.bg2, borderColor: C.border2 }]}>
        <Text style={[s.title, { color: C.txt }]}>{t('새 버전이 있어요')}</Text>
        <TouchableOpacity style={[s.updateBtn, { backgroundColor: C.accent2 }]} onPress={onUpdate} activeOpacity={0.85} accessibilityRole="button">
          <Text style={s.updateTxt}>{t('업데이트')}</Text>
        </TouchableOpacity>
        {!required && (
          <TouchableOpacity style={s.laterBtn} onPress={onLater} hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }} accessibilityRole="button">
            <Text style={[s.laterTxt, { color: C.txt3 }]}>{t('나중에')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill, zIndex: 1000, elevation: 1000,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 28,
  },
  card: { width: '100%', maxWidth: 360, borderRadius: 20, borderWidth: 1, paddingTop: 28, paddingBottom: 14, paddingHorizontal: 20, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 22 },
  updateBtn: { alignSelf: 'stretch', minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  updateTxt: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  laterBtn: { marginTop: 10, paddingVertical: 8, paddingHorizontal: 16 },
  laterTxt: { fontSize: 13 },
});
