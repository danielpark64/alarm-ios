import React from 'react';
import { Modal, View, TouchableOpacity } from 'react-native';
import { Text } from '../common/AppText';
import { CYCLE_PRESETS } from '../../constants';
import { useColors } from '../../hooks/useTheme';
import { makeStyles } from './styles';
import { useT } from '../../i18n';

interface Props {
  rm: string;
  cd: number;
  setCd: (v: number) => void;
  rd: number;
  setRd: (v: number) => void;
  sd: string;
  setShowCal: (v: boolean) => void;
  visible: boolean;
  onClose: () => void;
  presetRef?: React.Ref<View>;
  dateChipRef?: React.Ref<View>;
  closeBtnRef?: React.Ref<View>;
  onPresetPick?: () => void;
  // 이 팝업 위에 겹쳐 띄울 모달(시작일 달력) — 반드시 이 <Modal>의 자식 트리 안에 있어야 한다.
  // 형제로 두면 RN이 두 모달을 동시에 present하려다 iOS에서 조용히 무시되어 달력이 안 뜬다(재현됨).
  children?: React.ReactNode;
}

// "{n}일마다" 같은 문장 키를 숫자 앞/뒤 조각으로 나눈다 — 숫자와 단위의 글자 크기가 달라 한 Text로 못 쓰는데,
// 언어마다 숫자 위치가 달라서(예: "Every 3 days") 단위만 따로 키로 두지 않고 문장 키를 쪼개 쓴다.
function splitN(s: string): [string, string] {
  const i = s.indexOf('{n}');
  return i < 0 ? ['', s] : [s.slice(0, i), s.slice(i + 3)];
}

function addDaysMD(sd: string, n: number): string {
  const [y, m, d] = sd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

// N일 주기/N일 후 휴식 설정 팝업 — 예전엔 반복방식 카드 바로 아래 폼에 항상 펼쳐져 있었지만,
// 진짜 RN <Modal>로 바꿔서 다른 반복방식(요일/매월 등)과 섞여 보이지 않는 전용 화면처럼 만들었다
// (absolute+zIndex 오버레이 방식은 기각됨). DateModal/AddShiftModal과 동일한 모달 컨벤션을 따름.
export function CycleRestControls({ rm, cd, setCd, rd, setRd, sd, setShowCal, visible, onClose, presetRef, dateChipRef, closeBtnRef, onPresetPick, children }: Props) {
  const s = makeStyles(useColors());
  const { t } = useT();
  const [, m, d] = sd.split('-').map(Number);
  const [cdPre, cdPost] = splitN(rm === 'rest' ? t('{n}일 알람') : t('{n}일마다'));
  const [rdPre, rdPost] = splitN(t('{n}일 휴식'));

  // Modal 엘리먼트 자체를 visible로 조건부 마운트 — <Modal visible={visible}>로 계속 마운트해둔 채
  // prop만 토글하면 iOS에서 한 번 닫힌 뒤 다시 안 열리는 경우가 있어(재현됨), 매번 새로 마운트해서
  // 이전 표시 상태가 남지 않게 한다.
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.modalContent}>
          <View style={s.cycleModalHeader}>
            <Text style={s.cycleModalTitle}>{rm === 'rest' ? `🌙 ${t('N일 후 휴식')}` : `🔁 ${t('N일 주기')}`}</Text>
            <TouchableOpacity style={s.cycleModalCloseBtn} onPress={onClose} hitSlop={8}>
              <Text style={s.cycleModalCloseBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={s.cycleDateRow}>
            <Text style={s.cycleDateLabel}>{rm === 'rest' ? t('알람시작일') : t('오늘부터 며칠마다?')}</Text>
            <TouchableOpacity ref={dateChipRef} style={s.cycleDateChip} onPress={() => setShowCal(true)}>
              <Text>📅</Text>
              <Text style={s.cycleDateChipText}>{t('{date} 시작', { date: `${m}/${d}` })}</Text>
            </TouchableOpacity>
          </View>

          {rm === 'rest' && <Text style={s.cycleLabel}>{t('알람일수')}</Text>}
          <View style={s.stepper}>
            <TouchableOpacity style={s.stepBtn} onPress={() => setCd(Math.max(1, cd - 1))}>
              <Text style={s.stepBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={s.stepVal}>
              {!!cdPre && <Text style={s.stepUnit}>{cdPre}</Text>}{cd}<Text style={s.stepUnit}>{cdPost}</Text>
            </Text>
            <TouchableOpacity style={s.stepBtn} onPress={() => setCd(Math.min(365, cd + 1))}>
              <Text style={s.stepBtnText}>＋</Text>
            </TouchableOpacity>
          </View>
          <View style={s.presetRow} ref={rm === 'cycle' ? presetRef : undefined}>
            {(rm === 'cycle' ? CYCLE_PRESETS : [1, 2, 3, 4, 5, 6, 7]).map(n => (
              <TouchableOpacity
                key={n}
                style={[s.preset, cd === n && s.presetActive]}
                onPress={() => { setCd(n); onPresetPick?.(); }}
              >
                <Text style={[s.presetText, cd === n && s.presetTextActive]}>{t('{n}일', { n })}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {rm === 'rest' && (
            <>
              <Text style={[s.cycleLabel, { marginTop: 12 }]}>{t('휴식 일수')}</Text>
              <View style={s.stepper}>
                <TouchableOpacity style={s.stepBtn} onPress={() => setRd(Math.max(1, rd - 1))}>
                  <Text style={s.stepBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={s.stepVal}>
                  {!!rdPre && <Text style={s.stepUnit}>{rdPre}</Text>}{rd}<Text style={s.stepUnit}>{rdPost}</Text>
                </Text>
                <TouchableOpacity style={s.stepBtn} onPress={() => setRd(Math.min(30, rd + 1))}>
                  <Text style={s.stepBtnText}>＋</Text>
                </TouchableOpacity>
              </View>
              <View style={s.cycleInfoBox}>
                <Text style={s.cycleInfo}>🔁 {t('{cd}일 알람 → {rd}일 휴식 반복', { cd, rd })}</Text>
              </View>
              <DotPreview cd={cd} rd={rd} s={s} />
            </>
          )}

          {rm === 'cycle' && (
            <View style={s.cycleInfoBox}>
              <Text style={s.cycleInfo}>
                {t('다음: {dates}', { dates: [0, cd, cd * 2, cd * 3].map(n => addDaysMD(sd, n)).join(' · ') })}
              </Text>
            </View>
          )}

          <TouchableOpacity ref={closeBtnRef} style={[s.wpModalConfirmBtn, { marginTop: 16 }]} onPress={onClose}>
            <Text style={s.wpModalConfirmText}>{t('확인')}</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
      {/* 오버레이 TouchableOpacity 바깥(형제)에 둔다 — 안에 넣으면 배경 탭 닫기와 터치가 얽힌다 */}
      {children}
    </Modal>
  );
}

function DotPreview({ cd, rd, s }: { cd: number; rd: number; s: ReturnType<typeof makeStyles> }) {
  const { t } = useT();
  const total = cd + rd;
  const showCount = Math.min(total, 10);
  const filledCount = Math.min(cd, showCount);
  const dots = Array.from({ length: showCount }, (_, i) => i < filledCount);
  return (
    <>
      <View style={s.previewDots}>
        {dots.map((filled, i) => (
          <View key={i} style={filled ? s.dotFilled : s.dotHollow} />
        ))}
      </View>
      <Text style={s.previewHint}>{total > showCount ? t('● 알람  ○ 휴식 (일부만 표시)') : t('● 알람  ○ 휴식')}</Text>
    </>
  );
}
