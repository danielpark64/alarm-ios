// 홍보 배너 슬라이드 — 세이람 소개는 Android에서만, 세이람이 이미 깔려 있으면 숨김(2026-10-18)
module.exports = (U, M) => {
  const P = M.promoSlides;
  check('promoSlides 모듈이 있다', !!P);
  if (!P) return;
  const k = (o) => P.promoSlideKeys(o).join(',');
  check('Android·세이람 없음 → susu·sayram·coffee', k({ platform: 'android', hasSayram: false }) === 'susu,sayram,coffee', k({ platform: 'android', hasSayram: false }));
  check('Android·세이람 있음 → susu·coffee', k({ platform: 'android', hasSayram: true }) === 'susu,coffee', k({ platform: 'android', hasSayram: true }));
  check('iOS → 세이람 소개 없음', k({ platform: 'ios', hasSayram: false }) === 'susu,coffee', k({ platform: 'ios', hasSayram: false }));
  check('세이람 Play 주소', P.SAYRAM_PLAY_URL === 'https://play.google.com/store/apps/details?id=com.danielpark.sayram');
};
