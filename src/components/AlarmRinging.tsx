import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Vibration, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

interface Props {
  visible: boolean;
  title: string;
  body: string;
  source?: 'native' | 'expo';
  onStop: () => void;
  onSnooze: () => void;
}

const REPEAT_INTERVAL_MS = 24000;

export function AlarmRinging({ visible, title, body, source = 'expo', onStop, onSnooze }: Props) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingIdsRef = useRef<string[]>([]);

  const scheduleRepeat = async () => {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'alarm_long.wav' },
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
        <Text style={s.title}>{title}</Text>
        <Text style={s.body}>{body}</Text>
        <View style={s.btns}>
          <TouchableOpacity style={s.snooze} onPress={snooze}>
            <Text style={s.snoozeT}>5분 후</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.stop} onPress={stop}>
            <Text style={s.stopT}>끄기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0b0b1c', alignItems: 'center', justifyContent: 'center', gap: 16 },
  icon:    { fontSize: 80 },
  title:   { fontSize: 28, fontWeight: '900', color: '#f0f0ff', textAlign: 'center', paddingHorizontal: 24 },
  body:    { fontSize: 18, color: '#c8c8e0', textAlign: 'center' },
  btns:    { flexDirection: 'row', gap: 20, marginTop: 40 },
  snooze:  { paddingHorizontal: 32, paddingVertical: 18, borderRadius: 50, backgroundColor: '#1c1c40', borderWidth: 1, borderColor: '#30306a' },
  snoozeT: { fontSize: 18, fontWeight: '700', color: '#a29bfe' },
  stop:    { paddingHorizontal: 40, paddingVertical: 18, borderRadius: 50, backgroundColor: '#a29bfe' },
  stopT:   { fontSize: 18, fontWeight: '900', color: '#0b0b1c' },
});
