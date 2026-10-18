// 알람 탭 홍보 배너에 어떤 슬라이드를 보일지 — 순수 함수(로직 테스트 대상). 배너 자체는 한국어 화면에서만 뜬다(AlarmsTab).
// 세이람 소개는 Android에서만(링크가 Play 주소라서 — App Store 출시 후 다시 정함), 세이람이 이 폰에 이미 깔려 있으면 숨긴다.
export type PromoSlideKey = 'susu' | 'sayram' | 'coffee';
export const SAYRAM_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.danielpark.sayram';

export function promoSlideKeys(o: { platform: string; hasSayram: boolean }): PromoSlideKey[] {
  const showSayram = o.platform === 'android' && !o.hasSayram;
  return showSayram ? ['susu', 'sayram', 'coffee'] : ['susu', 'coffee'];
}
