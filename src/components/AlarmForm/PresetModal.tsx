import React from 'react';
import { Modal, View, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from '../common/AppText';
import { useColors } from '../../hooks/useTheme';
import { makeStyles } from './styles';
import { useT } from '../../i18n';
import { shiftPresetsFor, ShiftPreset } from '../../constants/shiftPresets';

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick: (preset: ShiftPreset) => void;
}

// "자주 쓰는 근무표" 팝업 — 나라(언어)별 대표 순환 패턴을 한 번에 채운다. 고른 뒤에는 블록 편집 화면에서
// 시각·일수를 자기 근무에 맞게 고치면 된다(프리셋은 초안일 뿐이다).
export function PresetModal({ visible, onClose, onPick }: Props) {
  const C = useColors();
  const s = makeStyles(C);
  const { t, lang } = useT();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={[s.modalContent, { maxHeight: '80%' }]}>
          <Text style={s.wpMenuTitle}>{t('자주 쓰는 근무표')}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {shiftPresetsFor(lang).map(p => (
              <TouchableOpacity key={p.id} style={[s.wpMenuBtn, { alignItems: 'flex-start', paddingHorizontal: 14 }]} onPress={() => onPick(p)}>
                <Text style={s.wpMenuBtnText}>{t(p.name)}</Text>
                <Text style={[s.wpGateBannerText, { flex: 0, marginTop: 4, fontWeight: '500' }]}>{t(p.desc)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={[s.wpGateBannerText, { flex: 0, textAlign: 'center', marginTop: 4 }]}>{t('고른 뒤 시각과 일수를 내 근무에 맞게 고칠 수 있어요')}</Text>
          <TouchableOpacity style={s.wpMenuCancelBtn} onPress={onClose}>
            <Text style={s.wpMenuCancelText}>{t('취소')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
