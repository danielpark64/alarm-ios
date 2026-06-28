import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DARK, LIGHT, Palette } from '../constants/colors';

export type ThemeName = 'dark' | 'light';
const KEY = 'theme_v1';

interface ThemeCtx {
  theme: ThemeName;
  colors: Palette;
  loaded: boolean;
  setTheme: (t: ThemeName) => void;
}

const Ctx = createContext<ThemeCtx>({ theme: 'dark', colors: DARK, loaded: false, setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('dark');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw === 'light' || raw === 'dark') setThemeState(raw);
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const setTheme = useCallback((t: ThemeName) => {
    setThemeState(t);
    AsyncStorage.setItem(KEY, t).catch(() => {});
  }, []);

  const colors = theme === 'light' ? LIGHT : DARK;

  return <Ctx.Provider value={{ theme, colors, loaded, setTheme }}>{children}</Ctx.Provider>;
}

// 컴포넌트 안에서 현재 테마 색상 가져오기 — 테마 전환 시 자동 리렌더링됨
export function useColors(): Palette {
  return useContext(Ctx).colors;
}

export function useThemeSetting() {
  const { theme, setTheme, loaded } = useContext(Ctx);
  return { theme, setTheme, loaded };
}
