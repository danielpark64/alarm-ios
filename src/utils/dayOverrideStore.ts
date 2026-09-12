import AsyncStorage from '@react-native-async-storage/async-storage';
import { DayOverrides } from '../constants';

const KEY = 'dayOverrides_v1';

// useAlarms.ts는 알람 CRUD마다 rescheduleAll/syncWidget을 동기적으로 호출한다.
// override는 별도 훅(useDayOverrides)이 관리하므로, useAlarms 쪽 호출부가 최신 override를
// async 없이 즉시 얻을 수 있도록 메모리 캐시를 둔다 — 두 훅을 서로 의존시키지 않기 위한 것.
let cache: DayOverrides = {};

export function getDayOverridesCache(): DayOverrides {
  return cache;
}

export async function loadDayOverrides(): Promise<DayOverrides> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? JSON.parse(raw) : {};
  } catch {
    cache = {};
  }
  return cache;
}

export async function saveDayOverrides(next: DayOverrides): Promise<void> {
  cache = next;
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}
