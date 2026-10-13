import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useT, type Lang } from '../i18n';

// 달력의 주 시작 요일. 'auto'는 언어를 따른다 — 한국·미국·일본·대만은 일요일, 유럽·중국·남미는 월요일이 표준이다.
// 메인 달력과 날짜 선택 달력에만 적용된다(Android 홈 위젯의 주간 줄은 일~토 고정 — 네이티브 쪽이 위치로 요일을 맞춘다).
export type WeekStartSetting = 'auto' | 'sun' | 'mon';
const KEY = 'week_start_v1';
const MONDAY_LANGS: Lang[] = ['de', 'fr', 'es', 'pt', 'zh-Hans'];

interface Ctx { setting: WeekStartSetting; weekStart: 0 | 1; setSetting: (v: WeekStartSetting) => void }
const Context = createContext<Ctx>({ setting: 'auto', weekStart: 0, setSetting: () => {} });

export function WeekStartProvider({ children }: { children: React.ReactNode }) {
  const { lang } = useT();
  const [setting, setState] = useState<WeekStartSetting>('auto');
  useEffect(() => {
    AsyncStorage.getItem(KEY).then(raw => { if (raw === 'sun' || raw === 'mon' || raw === 'auto') setState(raw); }).catch(() => {});
  }, []);
  const setSetting = useCallback((v: WeekStartSetting) => { setState(v); AsyncStorage.setItem(KEY, v).catch(() => {}); }, []);
  const weekStart: 0 | 1 = setting === 'mon' ? 1 : setting === 'sun' ? 0 : (MONDAY_LANGS.includes(lang) ? 1 : 0);
  return <Context.Provider value={{ setting, weekStart, setSetting }}>{children}</Context.Provider>;
}

/** weekStart: 0 = 일요일 시작, 1 = 월요일 시작 */
export function useWeekStart() { return useContext(Context); }
