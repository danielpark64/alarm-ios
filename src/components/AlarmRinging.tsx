import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Modal, Vibration, Platform, Image } from 'react-native';
import { Text } from './common/AppText';
import * as Notifications from 'expo-notifications';
import { SNOOZE_ENABLED, notifSoundFor } from '../constants';
import { useT } from '../i18n';

interface Props {
  visible: boolean;
  title: string;
  body: string;
  source?: 'native' | 'expo';
  tone?: string; // 알람마다 고른 소리 id(알림 data.tone)
  onStop: () => void;
  onSnooze: () => void;
}

const REPEAT_INTERVAL_MS = 24000;

export function AlarmRinging({ visible, title, body, source = 'expo', tone, onStop, onSnooze }: Props) {
  const { t } = useT();
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

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View style={s.root}>
        <Text style={s.icon}>⏰</Text>
        {/* 어느 앱 알람인지(1.6.2, 세이람 1.2.3 AlarmRingActivity와 같은 모양) — 아이콘 22dp + 앱 이름 18sp #9aa0ff, 작고 흐리게.
            가장 큰 글자는 그 아래 알람 이름(근무표 알람은 "초번 출근" 같은 근무 이름 — core.ts가 근무일 기준 roleLabel로 만든 제목). */}
        <View style={s.appRow}>
          <Image source={require('../../assets/icon.png')} style={s.appIcon} />
          <Text style={s.appName}>{t('교대알람')}</Text>
        </View>
        <Text style={s.title} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.6}>{title}</Text>
        <Text style={s.body}>{body}</Text>
        <View style={s.btns}>
          {SNOOZE_ENABLED && (
            <TouchableOpacity style={s.snooze} onPress={snooze}>
              <Text style={s.snoozeT}>{t('5분 후')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.stop} onPress={stop}>
            <Text style={s.stopT}>{t('끄기')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0b0b1c', alignItems: 'center', justifyContent: 'center', gap: 16 },
  icon:    { fontSize: 80 },
  appRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: -8 },
  appIcon: { width: 22, height: 22, borderRadius: 5, marginRight: 6 },
  appName: { fontSize: 18, color: '#9aa0ff' },
  title:   { fontSize: 28, fontWeight: '900', color: '#f0f0ff', textAlign: 'center', paddingHorizontal: 24 },
  body:    { fontSize: 18, color: '#c8c8e0', textAlign: 'center' },
  btns:    { flexDirection: 'row', gap: 20, marginTop: 40 },
  snooze:  { paddingHorizontal: 32, paddingVertical: 18, borderRadius: 50, backgroundColor: '#1c1c40', borderWidth: 1, borderColor: '#30306a' },
  snoozeT: { fontSize: 18, fontWeight: '700', color: '#a29bfe' },
  stop:    { paddingHorizontal: 40, paddingVertical: 18, borderRadius: 50, backgroundColor: '#a29bfe' },
  stopT:   { fontSize: 18, fontWeight: '900', color: '#0b0b1c' },
});
