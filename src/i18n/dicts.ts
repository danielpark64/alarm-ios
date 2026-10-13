// 언어별 사전 모음. 키 = 한국어 원문. 없는 키는 영어 → 한국어 순으로 폴백한다.
// 사전 파일은 ./locales/<lang>.ts — 새 문구를 t('…')로 감쌌으면 scripts/i18n-check.js로 누락을 확인한다.
import type { Lang } from './lang';
import { EN } from './locales/en';
import { JA } from './locales/ja';
import { ZH_HANS } from './locales/zh-Hans';
import { ZH_HANT } from './locales/zh-Hant';
import { ES } from './locales/es';
import { FR } from './locales/fr';
import { DE } from './locales/de';
import { PT } from './locales/pt';

export { EN };
export const DICTS: Partial<Record<Lang, Record<string, string>>> = {
  en: EN, ja: JA, 'zh-Hans': ZH_HANS, 'zh-Hant': ZH_HANT, es: ES, fr: FR, de: DE, pt: PT,
};
