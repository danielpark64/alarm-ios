import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'alarm_defaults_v1';

export interface AlarmDefaults {
  volume: number; // 0~1, Android 알람 최대 볼륨
}

const DEFAULTS: AlarmDefaults = { volume: 1 };

// core.ts 등 React 트리 밖 코드(네이티브 알람 예약)에서도 최신 볼륨값을 동기적으로 읽을 수 있도록 캐시
let cached: AlarmDefaults = DEFAULTS;
export function getAlarmDefaults(): AlarmDefaults {
  return cached;
}

interface Ctx {
  defaults: AlarmDefaults;
  loaded: boolean;
  setDefaults: (d: Partial<AlarmDefaults>) => void;
}

const Context = createContext<Ctx>({ defaults: DEFAULTS, loaded: false, setDefaults: () => {} });

export function AlarmDefaultsProvider({ children }: { children: React.ReactNode }) {
  const [defaults, setDefaultsState] = useState<AlarmDefaults>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const parsed = { ...DEFAULTS, ...JSON.parse(raw) };
          setDefaultsState(parsed);
          cached = parsed;
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const setDefaults = useCallback((patch: Partial<AlarmDefaults>) => {
    setDefaultsState(prev => {
      const next = { ...prev, ...patch };
      cached = next;
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return <Context.Provider value={{ defaults, loaded, setDefaults }}>{children}</Context.Provider>;
}

export function useAlarmDefaults() {
  return useContext(Context);
}
