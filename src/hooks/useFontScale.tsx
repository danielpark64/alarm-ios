import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FontScaleName = 'small' | 'medium' | 'large';
const KEY = 'font_scale_v1';

interface Ctx {
  fontScale: FontScaleName;
  loaded: boolean;
  setFontScale: (v: FontScaleName) => void;
}

const Context = createContext<Ctx>({ fontScale: 'medium', loaded: false, setFontScale: () => {} });

// 글자크기 설정값만 저장/제공 — 실제 텍스트 크기 반영은 추후 연결 예정
export function FontScaleProvider({ children }: { children: React.ReactNode }) {
  const [fontScale, setFontScaleState] = useState<FontScaleName>('medium');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw === 'small' || raw === 'medium' || raw === 'large') setFontScaleState(raw);
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const setFontScale = useCallback((v: FontScaleName) => {
    setFontScaleState(v);
    AsyncStorage.setItem(KEY, v).catch(() => {});
  }, []);

  return <Context.Provider value={{ fontScale, loaded, setFontScale }}>{children}</Context.Provider>;
}

export function useFontScale() {
  return useContext(Context);
}
