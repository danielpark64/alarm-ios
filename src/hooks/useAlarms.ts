import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alarm } from '../constants';
import { todayStr } from '../utils';
import { rescheduleAll } from '../utils/notifications';

const KEY = 'alarms_v1_rn';
// 처음 설치 시에는 알람 없이 시작 — 첫 알람은 "따라하기" 튜토리얼에서 직접 만들도록 유도
const DEFAULT: Alarm[] = [];

// daily/weekdays/weekends → wdcustom 마이그레이션 + 지난 "이날만 끄기" 날짜 정리
function migrateAlarm(a: Alarm): Alarm {
  if (a.skips?.length) {
    const today = todayStr();
    const kept = a.skips.filter(s => s >= today);
    if (kept.length !== a.skips.length) a = { ...a, skips: kept.length ? kept : undefined };
  }
  if (a.rm === 'daily')    return { ...a, rm: 'wdcustom', days: [0,1,2,3,4,5,6] };
  if (a.rm === 'weekdays') return { ...a, rm: 'wdcustom', days: [0,1,2,3,4] };
  if (a.rm === 'weekends') return { ...a, rm: 'wdcustom', days: [5,6] };
  return a;
}

export function useAlarms() {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [nextId, setNextId] = useState(100);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      let loaded: Alarm[] = DEFAULT;
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) { const d = JSON.parse(raw); loaded = (d.alarms ?? DEFAULT).map(migrateAlarm); setNextId(d.nextId ?? 100); }
      } catch {}
      // 만료된 '한 번' 알람 자동 비활성화
      const today = todayStr();
      const migrated = loaded.map(a => (a.rm === 'once' && a.sd < today && a.active) ? { ...a, active: false } : a);
      if (migrated.some((a, i) => a.active !== loaded[i].active)) {
        loaded = migrated;
        await AsyncStorage.setItem(KEY, JSON.stringify({ alarms: loaded, nextId: 100 }));
      }
      setAlarms(loaded);
      // 앱 시작 시 전체 재스케줄링 — 사운드 설정 변경 등 즉시 반영
      await rescheduleAll(loaded);
      setLoaded(true);
    })();
  }, []);

  const save = useCallback(async (a: Alarm[], nid: number) => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ alarms: a, nextId: nid }));
  }, []);

  const addAlarm = useCallback(async (data: Omit<Alarm,'id'|'active'>) => {
    const a: Alarm = { ...data, id: nextId, active: true };
    const next = [...alarms, a]; const nid = nextId + 1;
    setAlarms(next); setNextId(nid); await save(next, nid); await rescheduleAll(next);
    return a;
  }, [alarms, nextId, save]);

  const updateAlarm = useCallback(async (id: number, data: Partial<Alarm>) => {
    const next = alarms.map(a => a.id === id ? { ...a, ...data } : a);
    setAlarms(next); await save(next, nextId); await rescheduleAll(next);
  }, [alarms, nextId, save]);

  const deleteAlarm = useCallback(async (id: number) => {
    const next = alarms.filter(a => a.id !== id);
    setAlarms(next); await save(next, nextId); await rescheduleAll(next);
  }, [alarms, nextId, save]);

  const deleteAlarms = useCallback(async (ids: Set<number>) => {
    const next = alarms.filter(a => !ids.has(a.id));
    setAlarms(next); await save(next, nextId); await rescheduleAll(next);
  }, [alarms, nextId, save]);

  const toggleAlarm = useCallback(async (id: number) => {
    const a = alarms.find(a => a.id===id); if (!a) return;
    await updateAlarm(id, { active: !a.active });
  }, [alarms, updateAlarm]);

  const toggleAll = useCallback(async (active: boolean) => {
    const next = alarms.map(a => ({...a, active}));
    setAlarms(next); await save(next, nextId); await rescheduleAll(next);
  }, [alarms, nextId, save]);

  return { alarms, loaded, addAlarm, updateAlarm, deleteAlarm, deleteAlarms, toggleAlarm, toggleAll };
}
