import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alarm, WorkSegment, SoundMode, VibMode } from '../constants';
import { todayStr } from '../utils';
import { rescheduleAll } from '../utils/notifications';
import { syncWidget } from '../utils/widgetSync';
import { reconcileWorkPattern } from '../utils/workPattern';

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
      // syncWidget이 먼저 — 여기서 저장하는 activeAlarmIds가 네이티브 차단 게이트의 기준이라,
      // 예약보다 나중에 쓰면 그 사이에 발화한 알람이 게이트 판정을 못 받는다
      // (다른 경로도 save() → rescheduleAll 순서라 여기만 반대였다).
      syncWidget(loaded);
      // 앱 시작 시 전체 재스케줄링 — 사운드 설정 변경 등 즉시 반영
      await rescheduleAll(loaded);
      setLoaded(true);
    })();
  }, []);

  const save = useCallback(async (a: Alarm[], nid: number) => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ alarms: a, nextId: nid }));
    syncWidget(a);
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

  // 근무 시간대 로테이션 그룹(출근+퇴근)은 항상 함께 삭제된다 — 멤버 하나만 지우면
  // 나머지가 짝을 잃은 반쪽짜리 알람으로 남는 걸 막기 위해, 대상 id에 groupId가
  // 있으면 그 그룹 전체로 삭제 범위를 자동 확장한다.
  const expandGroups = useCallback((ids: Set<number>): Set<number> => {
    const groupIds = new Set(
      alarms.filter(a => ids.has(a.id) && a.groupId != null).map(a => a.groupId!)
    );
    if (!groupIds.size) return ids;
    const expanded = new Set(ids);
    alarms.forEach(a => { if (a.groupId != null && groupIds.has(a.groupId)) expanded.add(a.id); });
    return expanded;
  }, [alarms]);

  const deleteAlarm = useCallback(async (id: number) => {
    const idsToRemove = expandGroups(new Set([id]));
    const next = alarms.filter(a => !idsToRemove.has(a.id));
    setAlarms(next); await save(next, nextId); await rescheduleAll(next);
  }, [alarms, nextId, save, expandGroups]);

  const deleteAlarms = useCallback(async (ids: Set<number>) => {
    const idsToRemove = expandGroups(ids);
    const next = alarms.filter(a => !idsToRemove.has(a.id));
    setAlarms(next); await save(next, nextId); await rescheduleAll(next);
  }, [alarms, nextId, save, expandGroups]);

  // 근무 시간대 로테이션 그룹(출근+퇴근 최대 2개)을 블록 패턴 기준으로 정밀 재조합해서
  // 반영한다 — 블록을 편집해도 같은 출근/퇴근 알람의 pattern만 갱신되므로 id·켜짐 상태가
  // 그대로 유지된다(퇴근 알람만 새로 생기거나 없어질 수 있음). 개별 addAlarm/updateAlarm을
  // 여러 번 부르면 rescheduleAll이 그만큼 반복 실행돼 원자성이 깨지므로, 최종 리스트를
  // 한 번에 확정한 뒤 rescheduleAll을 딱 한 번만 호출한다.
  const submitWorkPattern = useCallback(async (
    groupId: number | undefined, pattern: WorkSegment[], sd: string, snd: SoundMode, vib: VibMode,
    // 일반(비그룹) 알람을 편집해서 근무표로 전환하는 경우, 새 세트만 추가하면 편집 중이던
    // 원본 알람이 목록에 그대로 남아 중복된다 — 원본 id를 받아 같은 원자적 계산에서 제거한다.
    replaceAlarmId?: number,
  ) => {
    const existing = groupId != null ? alarms.filter(a => a.groupId === groupId) : [];
    const { toAdd, toUpdate, toRemove } = reconcileWorkPattern(existing, pattern, sd, snd, vib);

    let nid = nextId;
    let gid = groupId;
    const removeSet = new Set(toRemove);
    if (replaceAlarmId != null && groupId == null) removeSet.add(replaceAlarmId);
    const added: Alarm[] = toAdd.map(data => {
      const id = nid++;
      if (gid == null) gid = id; // 그룹의 첫 알람 자신의 id를 그룹 id로 재사용 — 별도 카운터 불필요
      return { ...data, id, active: true, groupId: gid };
    });
    const next = alarms
      .filter(a => !removeSet.has(a.id))
      .map(a => {
        const u = toUpdate.find(x => x.id === a.id);
        return u ? { ...a, ...u.data, groupId: gid } : a;
      })
      .concat(added);

    setAlarms(next); setNextId(nid); await save(next, nid); await rescheduleAll(next);
    return gid!;
  }, [alarms, nextId, save]);

  const toggleAlarm = useCallback(async (id: number) => {
    const a = alarms.find(a => a.id===id); if (!a) return;
    await updateAlarm(id, { active: !a.active });
  }, [alarms, updateAlarm]);

  const toggleAll = useCallback(async (active: boolean) => {
    const next = alarms.map(a => ({...a, active}));
    setAlarms(next); await save(next, nextId); await rescheduleAll(next);
  }, [alarms, nextId, save]);

  return { alarms, loaded, addAlarm, updateAlarm, deleteAlarm, deleteAlarms, toggleAlarm, toggleAll, submitWorkPattern };
}
