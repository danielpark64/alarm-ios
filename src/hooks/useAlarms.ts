import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alarm } from '../constants';
import { todayStr } from '../utils';
import { scheduleAlarm, cancelAlarmNotifications, rescheduleAll } from '../utils/notifications';

const KEY = 'alarms_v1_rn';
const DEFAULT: Alarm[] = [
  { id:1, typeId:'commute', hour:8,  min:0, label:'출근', rm:'daily', days:[], cd:1, rd:1, snd:'default', vib:'pulse', sd:todayStr(), active:true },
  { id:2, typeId:'offwork', hour:18, min:0, label:'퇴근', rm:'daily', days:[], cd:1, rd:1, snd:'default', vib:'pulse', sd:todayStr(), active:true },
];

export function useAlarms() {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [nextId, setNextId] = useState(100);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      let loaded: Alarm[] = DEFAULT;
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) { const d = JSON.parse(raw); loaded = d.alarms ?? DEFAULT; setNextId(d.nextId ?? 100); }
      } catch {}
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
    const next = [...alarms, a]; const nid = nextId+1;
    setAlarms(next); setNextId(nid); await save(next, nid); await scheduleAlarm(a);
  }, [alarms, nextId, save]);

  const updateAlarm = useCallback(async (id: number, data: Partial<Alarm>) => {
    const next = alarms.map(a => a.id===id ? {...a,...data} : a);
    setAlarms(next); await save(next, nextId);
    const u = next.find(a => a.id===id);
    if (u) { await cancelAlarmNotifications(id); if (u.active) await scheduleAlarm(u); }
  }, [alarms, nextId, save]);

  const deleteAlarm = useCallback(async (id: number) => {
    const next = alarms.filter(a => a.id!==id);
    setAlarms(next); await save(next, nextId); await cancelAlarmNotifications(id);
  }, [alarms, nextId, save]);

  const deleteAlarms = useCallback(async (ids: Set<number>) => {
    const next = alarms.filter(a => !ids.has(a.id));
    setAlarms(next); await save(next, nextId);
    for (const id of ids) await cancelAlarmNotifications(id);
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
