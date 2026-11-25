import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Modal, Vibration, Platform, Image, ScrollView, useWindowDimensions } from 'react-native';
import { Text } from './common/AppText';
import * as Notifications from 'expo-notifications';
import { notifSoundFor } from '../constants';
import { ringTitle, ringDateLabel, ringWorkDate, snoozeLabel } from '../utils/ringCard';
import { useT } from '../i18n';

interface Props {
  visible: boolean;
  title: string;
  body: string;
  source?: 'native' | 'expo';
  tone?: string; // 알람마다 고른 소리 id(알림 data.tone)
  workDate?: string; // 근무일(YYYY-MM-DD) — 카드의 날짜. 없으면 울린 날
  onStop: () => void;
  onSnooze: () => void;
}

const REPEAT_INTERVAL_MS = 24000;

export function AlarmRinging({ visible, title, body, source = 'expo', tone, workDate, onStop, onSnooze }: Props) {
  const { t } = useT();
  const { width, height } = useWindowDimensions();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingIdsRef = useRef<string[]>([]);

  const scheduleRepeat = async () => {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: notifSoundFor(Platform.OS, true, tone) as string },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(Date.now() + REPEAT_INTERVAL_MS) },
    });
    pendingIdsRef.current.push(id);
  };

  const cancelAll = async () => {
    for (const id of pendingIdsRef.current) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    }
    pendingIdsRef.current = [];
  };

  useEffect(() => {
    if (!visible) return;
    // 네이티브 AlarmService가 이미 소리/진동/재알림(rep)을 처리 중이므로 중복 방지
    if (source === 'native') return;

    scheduleRepeat();

    if (Platform.OS === 'android') {
      Vibration.vibrate([0, 500, 300, 500, 300, 500], true);
    }

    timerRef.current = setInterval(scheduleRepeat, REPEAT_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      Vibration.cancel();
      cancelAll();
    };
  }, [visible, source]);

  const stop = () => {
    if (source !== 'native') {
      if (timerRef.current) clearInterval(timerRef.current);
      Vibration.cancel();
      cancelAll();
    }
    onStop();
  };

  const snooze = () => {
    if (source !== 'native') {
      if (timerRef.current) clearInterval(timerRef.current);
      Vibration.cancel();
      cancelAll();
    }
    onSnooze();
  };

  const name = ringTitle(title) || t('교대알람');
  const date = ringDateLabel(ringWorkDate(workDate));

  // 1.6.3 울림 카드(docs/시안/울림화면-카드-시안.html "바꿀 모양", 커버 화면 CoverAlarmActivity와 같은 모양).
  // 밤하늘 바탕(정적 — 애니메이션·블러 없음, 저사양 32 기준) 위 어둡게 + 가운데 카드. 시간·이모지는 넣지 않는다.
  // 카드 밖을 눌러도 아무 일 없고, 뒤로 가기로도 닫히지 않는다(onRequestClose 무시 — 끄기·다시 알림으로만 닫힘).
  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={s.root}>
        {/* 위쪽 은은한 보라 — 겹친 원 세 개로 방사형 그라데이션을 흉내(라이브러리·블러 없이) */}
        <View pointerEvents="none" style={[s.glow, { width: width * 1.6, height: width * 1.6, borderRadius: width * 0.8, left: -width * 0.3, top: -width * 1.05, opacity: 0.55 }]} />
        <View pointerEvents="none" style={[s.glow, { width: width * 1.2, height: width * 1.2, borderRadius: width * 0.6, left: -width * 0.1, top: -width * 0.75, opacity: 0.6 }]} />
        <View pointerEvents="none" style={[s.glow, { width: width * 0.8, height: width * 0.8, borderRadius: width * 0.4, left: width * 0.1, top: -width * 0.45, opacity: 0.7 }]} />
        {STARS.map(([fx, fy], i) => (
          <View key={i} pointerEvents="none" style={[s.star, { left: width * fx, top: height * fy }]} />
        ))}
        <View pointerEvents="none" style={s.dim} />
        <ScrollView contentContainerStyle={s.center} bounces={false} overScrollMode="never" showsVerticalScrollIndicator={false}>
          <View style={[s.card, { width: Math.min(width - 52, 320) }]}>
            <View style={s.appRow}>
              <Image source={require('../../assets/icon.png')} style={s.appIcon} />
              <Text style={s.appName} numberOfLines={1}>{t('교대알람')}</Text>
            </View>
            <Text style={s.name} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.5}>{name}</Text>
            {!!date && <Text style={s.date} numberOfLines={2}>{date}</Text>}
            <View style={s.offRing}>
              <TouchableOpacity style={s.off} onPress={stop} activeOpacity={0.8} accessibilityRole="button">
                <Text style={s.offT} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{t('끄기')}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.snz} onPress={snooze} activeOpacity={0.7} accessibilityRole="button">
              <Text style={s.snzT} numberOfLines={1}>{snoozeLabel()}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// 작은 별 위치(화면 비율) — 시안과 같은 일곱 개, 정적
const STARS: [number, number][] = [[0.13, 0.10], [0.73, 0.07], [0.40, 0.16], [0.83, 0.19], [0.20, 0.81], [0.67, 0.87], [0.53, 0.76]];

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0d0b26', overflow: 'hidden' },
  glow:    { position: 'absolute', backgroundColor: '#1d1850' },
  star:    { position: 'absolute', width: 2, height: 2, borderRadius: 1, backgroundColor: '#fff', opacity: 0.7 },
  dim:     { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  center:  { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 26 },
  card:    { backgroundColor: '#16133a', borderWidth: 1, borderColor: '#2e2870', borderRadius: 24, paddingTop: 22, paddingBottom: 20, paddingHorizontal: 18, alignItems: 'center' },
  appRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  appIcon: { width: 18, height: 18, borderRadius: 5, marginRight: 6 },
  appName: { fontSize: 13, color: '#b3abff' },
  name:    { fontSize: 28, fontWeight: '800', color: '#fff', textAlign: 'center', marginTop: 14, marginBottom: 4 },
  date:    { fontSize: 14, color: '#aaa6d6', textAlign: 'center' },
  offRing: { marginTop: 26, width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(124,108,246,0.2)', alignItems: 'center', justifyContent: 'center' },
  off:     { width: 68, height: 68, borderRadius: 34, backgroundColor: '#7c6cf6', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, elevation: 8, shadowColor: '#7c6cf6' },
  offT:    { fontSize: 15, fontWeight: '800', color: '#fff', textAlign: 'center' },
  snz:     { marginTop: 16, borderWidth: 1, borderColor: '#3a3480', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  snzT:    { fontSize: 12, color: '#cfcaff' },
});
