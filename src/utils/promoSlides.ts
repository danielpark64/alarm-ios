// 알람 탭 홍보 배너에 어떤 슬라이드를 보일지 — 순수 함수(로직 테스트 대상). 배너 자체는 한국어 화면에서만 뜬다(AlarmsTab).
// 세이람 소개는 세이람이 이 폰에 이미 깔려 있으면 숨긴다. 링크는 플랫폼별 스토어(sayramStoreUrl — 세이람 App Store 출시, 2026-10-27).
// 계좌 후원(coffee)은 Android에서만 — App Store는 개발자 팁·후원을 인앱결제로만 허용한다(Guideline 3.1.1, 2026-10-23).
// iOS는 후원 자리에 수수여행 채널을 넣는다(세이람 iOS와 같음).
export type PromoSlideKey = 'susu' | 'sayram' | 'coffee' | 'travel';
export const SAYRAM_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.danielpark.sayram';
// 나라 코드 없이 — 사용자의 App Store 국가로 열린다
export const SAYRAM_APPSTORE_URL = 'https://apps.apple.com/app/id6825225042';
export const SUSU_TRAVEL_URL = 'https://www.youtube.com/@susu_travel';

export function promoSlideKeys(o: { platform: string; hasSayram: boolean }): PromoSlideKey[] {
  if (o.platform !== 'android') return o.hasSayram ? ['susu', 'travel'] : ['susu', 'sayram', 'travel'];
  return o.hasSayram ? ['susu', 'coffee'] : ['susu', 'sayram', 'coffee'];
}

export function sayramStoreUrl(platform: string): string {
  return platform === 'android' ? SAYRAM_PLAY_URL : SAYRAM_APPSTORE_URL;
}
