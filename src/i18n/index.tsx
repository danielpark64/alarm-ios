// ─── 다국어 ────────────────────────────────────────────────────────────────────
// 세이람과 같은 방식: 키는 한국어 원문 그대로 t('알람 추가'). 사전에 없으면 영어 → 한국어 순으로 돌려줘
// 누락이 있어도 화면이 깨지지 않는다. 한국어일 때는 키를 그대로 반환하므로 기존 화면은 한 글자도 안 바뀐다.
// 치환: t('{n}일', { n: 3 }). 언어는 설정(system | 언어)에서 고르고, system은 기기 언어를 따른다.
// 컴포넌트는 useT()로 받아 언어가 바뀌면 다시 그려지고, 훅을 못 쓰는 순수 함수(알림 문구·위젯·유틸)는 t()를 직접 쓴다.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Settings, I18nManager } from 'react-native';
import { translate, t, resolveLang, type Params } from './translate';
export { translate, t, resolveLang, type Params };
import { LANGS, LANG_NATIVE_NAME, N, getLang, setCurrentLang, subscribeLang, systemLang, isKoreanLocale, setSystemLocaleProvider, markLanguageResolved, type Lang, type LanguageSetting } from './lang';
export { LANGS, LANG_NATIVE_NAME, N, getLang, setCurrentLang, subscribeLang, systemLang, isKoreanLocale, type Lang, type LanguageSetting };

// 기기 언어를 네이티브에서 직접 읽는다(lang.ts의 setSystemLocaleProvider 주석 참고).
// iOS: 사용자가 설정한 선호 언어 목록의 첫 항목(예: "ko-KR"). Android: 시스템 로캘(예: "ko_KR").
setSystemLocaleProvider(() => {
  try {
    if (Platform.OS === 'ios') {
      const langs = Settings.get('AppleLanguages');
      if (Array.isArray(langs) && typeof langs[0] === 'string') return langs[0];
      const loc = Settings.get('AppleLocale');
      return typeof loc === 'string' ? loc : null;
    }
    const id = (I18nManager.getConstants() as { localeIdentifier?: string }).localeIdentifier;
    return typeof id === 'string' ? id : null;
  } catch {
    return null;
  }
});

const KEY = 'language_v1';
const ALARMS_KEY = 'alarms_v1_rn'; // useAlarms의 저장 키 — 기존 설치 판별용
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
        if (raw && (SETTINGS as string[]).includes(raw)) {
          settingCache = raw as LanguageSetting;
        } else {
          // 언어 설정이 저장된 적 없는 첫 실행. 다국어 이전 버전에서 올라온 기존 설치(알람 데이터가 이미 있음)는
          // 지금까지 한국어 화면을 써 온 사용자다 — 폰 언어가 영어라는 이유로 갑자기 영어로 바뀌면 공휴일 건너뛰기까지
          // 조용히 꺼진다. 그런 설치는 '한국어'로 고정하고, 새 설치는 '시스템'으로 둔다. 어느 쪽이든 값을 바로 저장해
          // 이 판별이 딱 한 번만 일어나게 한다(나중에 알람을 만든 해외 사용자가 한국어로 바뀌는 일이 없도록).
          let existing = false;
          try {
            const a = await AsyncStorage.getItem(ALARMS_KEY);
            existing = !!a && (JSON.parse(a).alarms ?? []).length > 0;
          } catch {}
          settingCache = existing ? 'ko' : 'system';
          AsyncStorage.setItem(KEY, settingCache).catch(() => {});
        }
      } catch {}
      markLanguageResolved();
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
export const LANGUAGE_LABEL: Record<LanguageSetting, string> = { system: N('시스템'), ...LANG_NATIVE_NAME };
