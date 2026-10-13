// ─── 다국어 ────────────────────────────────────────────────────────────────────
// 세이람과 같은 방식: 키는 한국어 원문 그대로 t('알람 추가'). 사전에 없으면 영어 → 한국어 순으로 돌려줘
// 누락이 있어도 화면이 깨지지 않는다. 한국어일 때는 키를 그대로 반환하므로 기존 화면은 한 글자도 안 바뀐다.
// 치환: t('{n}일', { n: 3 }). 언어는 설정(system | 언어)에서 고르고, system은 기기 언어를 따른다.
// 컴포넌트는 useT()로 받아 언어가 바뀌면 다시 그려지고, 훅을 못 쓰는 순수 함수(알림 문구·위젯·유틸)는 t()를 직접 쓴다.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translate, t, resolveLang, type Params } from './translate';
export { translate, t, resolveLang, type Params };
import { LANGS, LANG_NATIVE_NAME, getLang, setCurrentLang, subscribeLang, systemLang, isKoreanLocale, type Lang, type LanguageSetting } from './lang';
export { LANGS, LANG_NATIVE_NAME, getLang, setCurrentLang, subscribeLang, systemLang, isKoreanLocale, type Lang, type LanguageSetting };

const KEY = 'language_v1';
const SETTINGS: LanguageSetting[] = ['system', ...LANGS];

// 저장된 언어 설정을 한 번 읽어 현재 언어에 반영한다. 앱 시작 시 알람 재예약(useAlarms)보다 먼저 끝나야
// 알림 문구가 사용자가 고른 언어로 만들어진다 — 그래서 프로바이더의 useEffect에만 맡기지 않고
// 같은 Promise를 useAlarms도 await한다(여러 번 불러도 읽기는 한 번).
let settingCache: LanguageSetting = 'system';
let loadPromise: Promise<LanguageSetting> | null = null;
export function loadLanguageSetting(): Promise<LanguageSetting> {
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw && (SETTINGS as string[]).includes(raw)) settingCache = raw as LanguageSetting;
      } catch {}
      setCurrentLang(resolveLang(settingCache));
      return settingCache;
    })();
  }
  return loadPromise;
}

type Ctx = { lang: Lang; setting: LanguageSetting; setSetting: (s: LanguageSetting) => void; t: (key: string, params?: Params) => string };
const LangContext = createContext<Ctx>({ lang: getLang(), setting: 'system', setSetting: () => {}, t: (k, p) => translate(getLang(), k, p) });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [setting, setSettingState] = useState<LanguageSetting>(settingCache);
  useEffect(() => { loadLanguageSetting().then(setSettingState); }, []);
  const lang = resolveLang(setting);
  // 렌더 중에 모듈 상태를 맞춘다 — 같은 렌더 안의 자식들이 t()를 직접 불러도 새 언어를 본다.
  setCurrentLang(lang);
  const setSetting = useCallback((s: LanguageSetting) => {
    settingCache = s;
    setSettingState(s);
    AsyncStorage.setItem(KEY, s).catch(() => {});
  }, []);
  const value = useMemo<Ctx>(() => ({ lang, setting, setSetting, t: (k, p) => translate(lang, k, p) }), [lang, setting, setSetting]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

/** 컴포넌트용: const { t, lang } = useT(); — 언어가 바뀌면 다시 그려진다. */
export function useT() {
  return useContext(LangContext);
}
/** 설정 화면 선택지 라벨. 'system'만 번역 대상이고 나머지는 각 언어의 자기 이름. */
export const LANGUAGE_LABEL: Record<LanguageSetting, string> = { system: '시스템', ...LANG_NATIVE_NAME };
