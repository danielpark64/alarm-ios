import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setApiHolidays } from '../constants/holidays';
import { fetchHolidaysForYear } from '../utils/holidayApi';
import { HOLIDAY_API_KEY } from '../constants/holidayApiKey';

const KEY_CACHE = 'holiday_cache_v1'; // { data: Record<string,string>, fetchedAt: string }
const REFRESH_DAYS = 30; // 마지막 "성공" 이후 이 기간이 지나야 다시 시도한다

async function loadCacheIntoMemory() {
  const raw = await AsyncStorage.getItem(KEY_CACHE);
  if (!raw) return;
  try { setApiHolidays(JSON.parse(raw).data ?? {}); } catch {}
}

// 실패하면 fetchedAt을 갱신하지 않으므로, 인터넷이 안 되는 날엔 계속 실패하다가
// 앱을 여는 어느 날 인터넷이 되면 그날 조용히 성공한다 — 사용자는 아무것도 몰라도 됨
async function refreshHolidays() {
  if (!HOLIDAY_API_KEY) return;

  const raw = await AsyncStorage.getItem(KEY_CACHE);
  if (raw) {
    try {
      const days = (Date.now() - new Date(JSON.parse(raw).fetchedAt).getTime()) / 86400000;
      if (days < REFRESH_DAYS) return;
    } catch {}
  }

  try {
    const now = new Date();
    const [thisYear, nextYear] = await Promise.all([
      fetchHolidaysForYear(HOLIDAY_API_KEY, now.getFullYear()),
      fetchHolidaysForYear(HOLIDAY_API_KEY, now.getFullYear() + 1),
    ]);
    const merged = { ...thisYear, ...nextYear };
    if (!Object.keys(merged).length) return;
    await AsyncStorage.setItem(KEY_CACHE, JSON.stringify({ data: merged, fetchedAt: now.toISOString() }));
    setApiHolidays(merged);
  } catch {}
}

// 앱 시작 시 1회 — 캐시를 먼저 메모리에 올려 오프라인에서도 최근 데이터로 보이게 하고,
// 마지막 성공 후 30일이 지났으면 조용히 백그라운드에서 갱신한다
export function useHolidaySync() {
  useEffect(() => {
    (async () => {
      await loadCacheIntoMemory();
      refreshHolidays();
    })();
  }, []);
}
