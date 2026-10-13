// ─── 현재 언어 상태 (의존성 없음) ───────────────────────────────────────────────
// 세이람(lib/i18n/lang.ts)과 같은 구조. utils·notifications·widgetSync 같은 순수 모듈이 React 없이
// 언어만 읽을 수 있게 분리했다.
export const LANGS = ['ko', 'en', 'ja', 'zh-Hans', 'zh-Hant', 'es', 'fr', 'de', 'pt'] as const;
export type Lang = (typeof LANGS)[number];
export type LanguageSetting = 'system' | Lang;
export const LANG_NATIVE_NAME: Record<Lang, string> = {
  ko: '한국어', en: 'English', ja: '日本語', 'zh-Hans': '简体中文', 'zh-Hant': '繁體中文',
  es: 'Español', fr: 'Français', de: 'Deutsch', pt: 'Português',
};

/** 기기 로캘("ja-JP", "zh-Hant-TW", "pt-BR"…) → 지원 언어, 없으면 null */
export function langFromLocale(locale: string | undefined | null): Lang | null {
  const l = (locale ?? '').toLowerCase();
  if (l.startsWith('ko')) return 'ko';
  if (l.startsWith('en')) return 'en';
  if (l.startsWith('ja')) return 'ja';
  if (l.startsWith('zh')) return /hant|tw|hk|mo/.test(l) ? 'zh-Hant' : 'zh-Hans';
  if (l.startsWith('es')) return 'es';
  if (l.startsWith('fr')) return 'fr';
  if (l.startsWith('de')) return 'de';
  if (l.startsWith('pt')) return 'pt';
  return null;
}

// 기기 언어를 읽는 방법은 플랫폼 쪽(index.tsx)이 등록한다. 이 파일은 순수 모듈이라 react-native를 import하지 않는다.
// ⚠️ Intl만 믿으면 안 된다: iOS의 Intl 로캘은 "앱이 지원한다고 선언한 언어"(CFBundleLocalizations) 안에서 정해져서,
// 선언이 영어뿐이면 한국어 iPhone에서도 en이 나온다 → 앱이 영어로 뜨고 공휴일 건너뛰기까지 꺼진다.
// 그래서 iOS는 AppleLanguages, Android는 I18nManager의 로캘을 직접 읽고(index.tsx), Intl은 마지막 폴백으로만 쓴다.
let localeProvider: (() => string | null | undefined) | null = null;
export function setSystemLocaleProvider(fn: () => string | null | undefined) {
  localeProvider = fn;
  if (followingSystem) setCurrentLang(systemLang());
}
/** 기기 언어. 지원하지 않는 언어면 영어, 읽기 실패면 한국어(기존 사용자 보호). */
export function systemLang(): Lang {
  try {
    const native = localeProvider?.();
    if (native) return langFromLocale(native.replace(/_/g, '-')) ?? 'en';
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? 'ko';
    return langFromLocale(locale) ?? 'en';
  } catch {
    return 'ko';
  }
}
// 아직 저장된 언어 설정을 적용하기 전(= 기기 언어를 따르는 중)인지 — 그동안에는 로캘 제공자가 등록되면 바로 반영한다.
let followingSystem = true;
export function markLanguageResolved() { followingSystem = false; }

// 저장된 설정을 읽기 전에도 기기 언어로 시작한다 — 한국어 기기는 처음부터 한국어.
let currentLang: Lang = systemLang();
const listeners = new Set<(l: Lang) => void>();
export function getLang(): Lang { return currentLang; }
export function setCurrentLang(l: Lang) {
  if (l === currentLang) return;
  currentLang = l;
  listeners.forEach(fn => { try { fn(l); } catch {} });
}
/** 언어가 바뀔 때 알림 문구·위젯을 다시 만들어야 하는 쪽이 구독한다. */
export function subscribeLang(fn: (l: Lang) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** 한국 전용 기능(법정공휴일 건너뛰기·휴일근무 집계·음력·24절기·후원 계좌)을 보일지 — 언어가 한국어일 때만. */
export function isKoreanLocale(): boolean { return currentLang === 'ko'; }

/** 번역 대상 표식(아무 일도 안 함). 상수 배열의 라벨처럼 모듈 최상위에서 만들어져 그 자리에서 t()를 못 부르는 문자열을
 *  N('초번')으로 감싸 둔다 — 표시할 때 t(x.label)로 번역하고, 키 추출 스크립트(scripts/i18n-keys.js)는 N()과 t()의
 *  문자열 리터럴만 모으므로 이 표식이 없으면 사전에서 빠진다. */
export const N = (s: string): string => s;
