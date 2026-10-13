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

/** 기기 언어. 지원하지 않는 언어면 영어, 읽기 실패면 한국어(기존 사용자 보호). */
export function systemLang(): Lang {
  try {
    // Hermes 내장 Intl로 읽는다(expo-localization 없이). 예: "ko-KR", "en-US"
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? 'ko';
    return langFromLocale(locale) ?? 'en';
  } catch {
    return 'ko';
  }
}

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
