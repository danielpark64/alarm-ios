// 번역 함수(React·AsyncStorage 의존 없음) — utils·notifications·widgetSync 같은 순수 모듈은 여기서 가져온다.
// index.tsx(프로바이더·저장)를 가져오면 순수 로직 테스트(scripts/logic-tests)가 네이티브 모듈을 끌고 와 못 돈다.
import { DICTS, EN } from './dicts';
import { getLang, systemLang, type Lang, type LanguageSetting } from './lang';

export function resolveLang(setting: LanguageSetting): Lang {
  return setting === 'system' ? systemLang() : setting;
}

export type Params = Record<string, string | number>;

export function translate(lang: Lang, key: string, params?: Params): string {
  let s = lang === 'ko' ? key : (DICTS[lang]?.[key] ?? EN[key] ?? key);
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
/** 현재 언어로 번역 (순수 함수용) */
export function t(key: string, params?: Params): string {
  return translate(getLang(), key, params);
}
