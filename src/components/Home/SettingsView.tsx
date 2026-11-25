import React, { useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Platform, StyleSheet, Switch, TextInput, AppState } from 'react-native';
import { Text } from '../common/AppText';
import Slider from '@react-native-community/slider';
import Constants from 'expo-constants';
import { Palette } from '../../constants/colors';
import { useColors, useThemeSetting, ThemeName } from '../../hooks/useTheme';
import { useAlarmDefaults } from '../../hooks/useAlarmDefaults';
import { useFontScale, FontScaleName } from '../../hooks/useFontScale';
import { useT, N, LANGS, LANGUAGE_LABEL, type LanguageSetting } from '../../i18n';
import { useWeekStart, type WeekStartSetting } from '../../hooks/useWeekStart';
import { useSayramShare } from '../../hooks/useSayramShare';
import { useShiftShare } from '../../hooks/useShiftShare';
import { SENDER_NAME_MAX } from '../../utils/shiftShareLink';
import { alarmKitAuthState, canDrawOverlays, canUseFullScreenIntent, isIgnoringBatteryOptimizations, openAlarmKitPermission, openBatteryOptimizationSettings, openFullScreenIntentSettings, requestOverlayPermission } from '../../utils/alarmScreenNative';

const FONT_SCALES: { id: FontScaleName; label: string }[] = [
  { id: 'small',  label: N('작게') },
  { id: 'medium', label: N('보통') },
  { id: 'large',  label: N('크게') },
];

const WEEK_STARTS: { id: WeekStartSetting; label: string }[] = [
  { id: 'auto', label: N('자동') },
  { id: 'sun',  label: N('일요일') },
  { id: 'mon',  label: N('월요일') },
];

interface Props {
  onStartRotationTutorial?: () => void;
  onOpenHelp?: () => void;
  onSendShifts?: () => void; // 근무표 공유 — 달력 위 [보내기]와 같은 동작
}

export function SettingsView({ onStartRotationTutorial, onOpenHelp, onSendShifts }: Props) {
  const C = useColors();
  const s = makeStyles(C);
  const { theme, setTheme } = useThemeSetting();
  const { fontScale, setFontScale } = useFontScale();
  const { defaults, setDefaults } = useAlarmDefaults();
  const { t, setting: langSetting, setSetting: setLangSetting } = useT();
  const { setting: weekSetting, setSetting: setWeekSetting } = useWeekStart();
  const share = useSayramShare();
  // 보낼 때 내 이름(1.6.1~) — 처음 보낼 때 한 번 묻고, 바꾸기는 여기 한 곳에서만
  const shift = useShiftShare();
  const [myName, setMyNameText] = useState(shift.myName ?? '');
  useEffect(() => { setMyNameText(shift.myName ?? ''); }, [shift.myName]);
  const commitName = () => { if (myName.trim() !== (shift.myName ?? '')) shift.setMyName(myName); };

  // 알람 화면 권한(1.6.1) — 울릴 때 끄기 화면이 맨 앞에 뜨게 하는 것. 설정 앱에서 바꾸고 돌아오면 다시 읽는다.
  //   Android 14+만 "전체 화면 알림" 줄(13 이하는 늘 허용), iOS 26 미만은 AlarmKit 줄을 숨긴다('unavailable').
  const showFsiRow = Platform.OS === 'android' && Number(Platform.Version) >= 34;
  const [overlayOk, setOverlayOk] = useState(true);
  const [fsiOk, setFsiOk] = useState(true);
  // 배터리 최적화 제외(1.6.2, 세이람 1.2.3 SettingsSheet에서 가져옴) — 이 줄에서만 안내한다. 시작·알람 저장 때는 띄우지 않는다
  // (처음 보는 안내라 거부감 — 사용자 결정 2026-11-25). 알람은 setAlarmClock이라 Doze에서도 울리고, 늦게 울리는 폰만 여기서 뺀다
  const [batteryOk, setBatteryOk] = useState(true);
  const [akAuth, setAkAuth] = useState(() => alarmKitAuthState());
  useEffect(() => {
    const refresh = () => {
      if (Platform.OS === 'android') {
        canDrawOverlays().then(setOverlayOk);
        canUseFullScreenIntent().then(setFsiOk);
        isIgnoringBatteryOptimizations().then(setBatteryOk);
      } else setAkAuth(alarmKitAuthState());
    };
    refresh();
    const sub = AppState.addEventListener('change', st => { if (st === 'active') refresh(); });
    return () => sub.remove();
  }, []);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={s.scrollC} showsVerticalScrollIndicator={false}>
      <Text style={s.sectionLabel}>{t('화면')}</Text>
      <View style={s.card}>
        <View style={s.row}>
          <Text style={s.rowLabel}>{t('글자크기')}</Text>
          <View style={s.segment}>
            {FONT_SCALES.map(f => (
              <TouchableOpacity
                key={f.id}
                style={[s.segBtn, fontScale === f.id && s.segBtnActive]}
                onPress={() => setFontScale(f.id)}
              >
                <Text style={[s.segBtnText, fontScale === f.id && s.segBtnTextActive]}>{t(f.label)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={s.divider} />
        <View style={s.row}>
          <Text style={s.rowLabel}>{t('테마')}</Text>
          <View style={s.segment}>
            {(['dark', 'light'] as ThemeName[]).map(th => (
              <TouchableOpacity
                key={th}
                style={[s.segBtn, theme === th && s.segBtnActive]}
                onPress={() => setTheme(th)}
              >
                <Text style={[s.segBtnText, theme === th && s.segBtnTextActive]}>{th === 'dark' ? t('다크') : t('라이트')}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={s.divider} />
        {/* 언어 — 세이람과 같은 방식: '시스템'은 폰 언어를 따르고, 나머지는 각 언어의 자기 이름으로 보여준다.
            선택지가 10개라 한 줄 세그먼트 대신 줄바꿈되는 칩으로 둔다. */}
        <View style={{ paddingVertical: 13, paddingHorizontal: 14 }}>
          <Text style={s.rowLabel}>{t('언어')}</Text>
          <View style={s.langWrap}>
            {(['system', ...LANGS] as LanguageSetting[]).map(l => (
              <TouchableOpacity
                key={l}
                style={[s.langChip, langSetting === l && s.segBtnActive]}
                onPress={() => setLangSetting(l)}
                accessibilityLabel={`${t('언어')} ${l === 'system' ? t(LANGUAGE_LABEL[l]) : LANGUAGE_LABEL[l]}`}
              >
                <Text style={[s.segBtnText, langSetting === l && s.segBtnTextActive]}>
                  {l === 'system' ? t(LANGUAGE_LABEL[l]) : LANGUAGE_LABEL[l]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.langSub}>{t('시스템은 폰의 언어를 따라요')}</Text>
        </View>
        <View style={s.divider} />
        <View style={s.row}>
          <Text style={s.rowLabel}>{t('달력 주 시작')}</Text>
          <View style={s.segment}>
            {WEEK_STARTS.map(w => (
              <TouchableOpacity key={w.id} style={[s.segBtn, weekSetting === w.id && s.segBtnActive]} onPress={() => setWeekSetting(w.id)}>
                <Text style={[s.segBtnText, weekSetting === w.id && s.segBtnTextActive]}>{t(w.label)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* 근무표 공유(1.6.0) — 달력 위 [보내기]와 같은 항목. 링크 한 줄로 보내고 서버에 저장하지 않는다 */}
      {onSendShifts && (
        <>
          <Text style={s.sectionLabel}>{t('근무표 공유')}</Text>
          <TouchableOpacity style={s.card} activeOpacity={0.75} onPress={onSendShifts} accessibilityRole="button">
            <View style={s.row}>
              <View style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                <Text style={s.rowLabel}>{t('내 근무표 보내기')}</Text>
                <Text style={s.rowSub}>{t('오늘부터 약 7개월 근무표를 링크 한 줄로 카톡·문자에 보내요. 받은 사람은 달력에서 보기만 해요.')}</Text>
              </View>
              <Text style={s.rowValue}>›</Text>
            </View>
          </TouchableOpacity>
          <View style={[s.card, { marginTop: 8 }]}>
            <View style={s.row}>
              <View style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                <Text style={s.rowLabel}>{t('보낼 때 내 이름')}</Text>
                <Text style={s.rowSub}>{t('받은 사람에게 "{name}님의 근무표"로 보여요. 비워 두면 이름 없이 보내요.', { name: myName.trim() || '○○' })}</Text>
              </View>
              <TextInput style={s.nameInput} value={myName} onChangeText={setMyNameText} onEndEditing={commitName} onBlur={commitName}
                maxLength={SENDER_NAME_MAX} placeholder={t('예: 민수')} placeholderTextColor={C.txt3} returnKeyType="done"
                accessibilityLabel={t('보낼 때 내 이름')} />
            </View>
          </View>
        </>
      )}

      {/* 세이람과 일정 공유 — 같은 폰의 세이람만 읽을 수 있는 창구로 근무표를 내보내고 세이람 일정을 읽는다(인터넷 없음).
          한쪽 앱에서만 켜도 공유된다. Android는 ContentProvider, iOS는 App Group 공유 폴더(2026-10-20~). */}
      {share.available && (
        <>
          <Text style={s.sectionLabel}>{t('다른 앱')}</Text>
          <View style={s.card}>
            <View style={s.row}>
              <View style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                <Text style={s.rowLabel}>{t('세이람과 일정 공유')}</Text>
                <Text style={s.rowSub}>{t('같은 폰의 세이람 일정이 달력에, 근무가 세이람 달력에 보여요. 한쪽 앱에서만 켜도 돼요.')}</Text>
                {!share.mine && share.siblingOn && (
                  <Text style={[s.rowSub, { color: C.accent }]}>{t('세이람에서 켜 둬서 지금 공유 중이에요')}</Text>
                )}
              </View>
              <Switch
                value={share.mine}
                onValueChange={share.setMine}
                // 꺼진 상태가 카드 바탕(bg2)에 묻히지 않게 테두리 색으로(세이람도 같은 문제를 고침, 2026-10-21)
                trackColor={{ false: C.border2, true: C.accent2 }}
                ios_backgroundColor={C.border2}
                thumbColor="#fff"
                accessibilityLabel={t('세이람과 일정 공유')}
              />
            </View>
          </View>
        </>
      )}

      {(Platform.OS === 'android' || akAuth !== 'unavailable') && (
        <>
          <Text style={s.sectionLabel}>{t('알람 화면')}</Text>
          <View style={s.card}>
            {Platform.OS === 'android' && (
              <TouchableOpacity style={s.row} activeOpacity={overlayOk ? 1 : 0.7}
                onPress={() => { if (!overlayOk) requestOverlayPermission(); }}
                accessibilityLabel={t('다른 앱 위에 알람 띄우기')}>
                <View style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                  <Text style={s.rowLabel}>{t('다른 앱 위에 알람 띄우기')}</Text>
                  <Text style={s.rowSub}>{overlayOk
                    ? t('다른 앱을 쓰는 중에도 알람 끄기 화면이 맨 앞에 떠요')
                    : t('눌러서 "다른 앱 위에 표시"를 켜면 다른 앱을 쓰는 중에도 알람 끄기 화면이 맨 앞에 떠요')}</Text>
                </View>
                <Text style={[s.rowValue, overlayOk && { color: C.accent }]}>{overlayOk ? t('켜짐') : t('꺼짐 ›')}</Text>
              </TouchableOpacity>
            )}
            {showFsiRow && (
              <>
                <View style={s.divider} />
                <TouchableOpacity style={s.row} activeOpacity={fsiOk ? 1 : 0.7}
                  onPress={() => { if (!fsiOk) openFullScreenIntentSettings(); }}
                  accessibilityLabel={t('잠금 화면에 알람 띄우기')}>
                  <View style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                    <Text style={s.rowLabel}>{t('잠금 화면에 알람 띄우기')}</Text>
                    <Text style={s.rowSub}>{fsiOk
                      ? t('화면이 꺼져 있거나 잠겨 있어도 알람 끄기 화면이 떠요')
                      : t('눌러서 "전체 화면 알림"을 허용하면 화면이 꺼져 있거나 잠겨 있어도 알람 끄기 화면이 떠요')}</Text>
                  </View>
                  <Text style={[s.rowValue, fsiOk && { color: C.accent }]}>{fsiOk ? t('켜짐') : t('꺼짐 ›')}</Text>
                </TouchableOpacity>
              </>
            )}
            {Platform.OS === 'android' && (
              <>
                <View style={s.divider} />
                <TouchableOpacity style={s.row} activeOpacity={batteryOk ? 1 : 0.7}
                  onPress={() => { if (!batteryOk) openBatteryOptimizationSettings(); }}
                  accessibilityLabel={t('배터리 최적화 제외')}>
                  <View style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                    <Text style={s.rowLabel}>{t('배터리 최적화 제외')}</Text>
                    <Text style={s.rowSub}>{batteryOk
                      ? t('절전 중에도 알람이 제때 울려요')
                      : t('알람이 늦게 울리면 여기를 눌러 주세요')}</Text>
                  </View>
                  <Text style={[s.rowValue, batteryOk && { color: C.accent }]}>{batteryOk ? t('켜짐') : t('꺼짐 ›')}</Text>
                </TouchableOpacity>
              </>
            )}
            {Platform.OS === 'ios' && (
              <TouchableOpacity style={s.row} activeOpacity={akAuth === 'authorized' ? 1 : 0.7}
                onPress={() => {
                  if (akAuth === 'authorized') return;
                  openAlarmKitPermission().then(() => setAkAuth(alarmKitAuthState())).catch(() => {});
                }}
                accessibilityLabel={t('시계 앱처럼 울리기')}>
                <View style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                  <Text style={s.rowLabel}>{t('시계 앱처럼 울리기')}</Text>
                  <Text style={s.rowSub}>{akAuth === 'authorized'
                    ? t('무음·집중 모드에서도 시계 앱처럼 잠금 화면 가득 알람이 떠요')
                    : akAuth === 'notDetermined'
                      ? t('눌러서 허용하면 무음·집중 모드에서도 시계 앱처럼 잠금 화면 가득 알람이 떠요')
                      : t('눌러서 설정 앱의 "알람 및 타이머"를 켜면 무음·집중 모드에서도 시계 앱처럼 잠금 화면 가득 알람이 떠요')}</Text>
                </View>
                <Text style={[s.rowValue, akAuth === 'authorized' && { color: C.accent }]}>{akAuth === 'authorized' ? t('켜짐') : t('꺼짐 ›')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      {Platform.OS === 'android' && (
        <>
          <Text style={s.sectionLabel}>{t('알람 기본값')}</Text>
          <View style={s.card}>
            <View style={{ paddingVertical: 13, paddingHorizontal: 14 }}>
              <View style={s.volumeHeadRow}>
                <Text style={s.rowLabel}>{t('알람 볼륨')}</Text>
                <View style={s.androidBadge}><Text style={s.androidBadgeText}>Android</Text></View>
              </View>
              <View style={s.volumeRow}>
                <Text style={s.volumeIcon}>🔈</Text>
                <Slider
                  style={{ flex: 1 }}
                  minimumValue={0.1}
                  maximumValue={1}
                  step={0.05}
                  value={defaults.volume}
                  minimumTrackTintColor={C.accent2}
                  maximumTrackTintColor={C.bg3}
                  thumbTintColor={C.accent}
                  onSlidingComplete={v => setDefaults({ volume: v })}
                />
                <Text style={s.volumeIcon}>🔊</Text>
              </View>
            </View>
          </View>
        </>
      )}

      <TouchableOpacity
        style={s.helpBanner}
        activeOpacity={0.8}
        onPress={onOpenHelp}
      >
        <View style={s.tutorialIcon}><Text style={s.tutorialIconT}>📖</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.tutorialTitle}>{t('사용법 안내')}</Text>
          <Text style={s.tutorialSub}>{t('기본 사용법과 잘 안 보이는 기능까지 알려드려요')}</Text>
        </View>
        <Text style={s.tutorialArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={s.tutorialBanner}
        activeOpacity={0.8}
        onPress={onStartRotationTutorial}
      >
        <View style={s.tutorialIcon}><Text style={s.tutorialIconT}>🗓️</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.tutorialTitle}>{t('근무표 만들기 따라하기')}</Text>
          <Text style={s.tutorialSub}>{t('초번·말번·비번 순환표를 직접 만들어봐요')}</Text>
        </View>
        <Text style={s.tutorialArrow}>›</Text>
      </TouchableOpacity>

      <Text style={s.sectionLabel}>{t('정보')}</Text>
      <View style={s.card}>
        <View style={s.row}>
          <Text style={s.rowLabel}>{t('앱 버전')}</Text>
          <Text style={s.rowValue}>{Constants.expoConfig?.version ?? '1.0.0'}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    scrollC: { padding: 14, paddingBottom: 100 },
    sectionLabel: { fontSize: 11, fontWeight: '700', color: C.txt3, marginTop: 14, marginBottom: 6, marginLeft: 4, letterSpacing: 0.3 },
    card: { backgroundColor: C.bg2, borderRadius: 14, borderWidth: 1, borderColor: C.border },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 14 },
    rowLabel: { fontSize: 14, fontWeight: '600', color: C.txt },
    rowValue: { fontSize: 13, color: C.txt3 },
    rowSub: { fontSize: 11, color: C.txt3, marginTop: 3, lineHeight: 15 },
    nameInput: { width: 120, borderRadius: 10, borderWidth: 1, borderColor: C.border2, paddingHorizontal: 10, paddingVertical: 7, fontSize: 14, color: C.txt, backgroundColor: C.bg3 },
    divider: { height: 1, backgroundColor: C.border, marginHorizontal: 14 },
    segment: { flexDirection: 'row', gap: 4, backgroundColor: C.bg3, borderRadius: 10, padding: 3 },
    segBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    segBtnActive: { backgroundColor: C.accent2 },
    langWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    langChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: C.bg3 },
    langSub: { fontSize: 11, color: C.txt3, marginTop: 8 },
    segBtnText: { fontSize: 12, color: C.txt3, fontWeight: '700' },
    segBtnTextActive: { color: '#fff' },
    androidBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(162,155,254,0.15)' },
    androidBadgeText: { fontSize: 11, fontWeight: '700', color: C.accent },
    volumeHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    volumeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    volumeIcon: { fontSize: 13 },
    helpBanner: { flexDirection: 'row', alignItems: 'center', marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,180,80,0.10)', borderWidth: 1, borderColor: 'rgba(255,180,80,0.3)' },
    tutorialBanner: { flexDirection: 'row', alignItems: 'center', marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: 'rgba(162,155,254,0.10)', borderWidth: 1, borderColor: 'rgba(162,155,254,0.3)' },
    tutorialIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(162,155,254,0.18)', marginRight: 12 },
    tutorialIconT: { fontSize: 17 },
    tutorialTitle: { fontSize: 14, fontWeight: '700', color: C.txt },
    tutorialSub: { fontSize: 11, color: C.txt3, marginTop: 2 },
    tutorialArrow: { fontSize: 16, color: C.txt3 },
  });
}
