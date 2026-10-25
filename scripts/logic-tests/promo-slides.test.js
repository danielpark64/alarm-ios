// 홍보 배너 슬라이드 — 세이람 소개는 Android에서만, 세이람이 이미 깔려 있으면 숨김(2026-10-18)
module.exports = (U, M) => {
  const P = M.promoSlides;
  check('promoSlides 모듈이 있다', !!P);
  if (!P) return;
  const k = (o) => P.promoSlideKeys(o).join(',');
  check('Android·세이람 없음 → susu·sayram·coffee', k({ platform: 'android', hasSayram: false }) === 'susu,sayram,coffee', k({ platform: 'android', hasSayram: false }));
  check('Android·세이람 있음 → susu·coffee', k({ platform: 'android', hasSayram: true }) === 'susu,coffee', k({ platform: 'android', hasSayram: true }));
  // iOS는 계좌 후원(coffee)을 보이면 안 된다 — App Store 3.1.1(개발자 팁은 인앱결제만). 세이람 소개도 Play 주소라 없음
  // 후원 자리에는 수수여행 채널을 넣는다(세이람 iOS와 같음)
  check('iOS·세이람 없음 → susu·travel(후원 없음)', k({ platform: 'ios', hasSayram: false }) === 'susu,travel', k({ platform: 'ios', hasSayram: false }));
  check('iOS·세이람 있음 → susu·travel(후원 없음)', k({ platform: 'ios', hasSayram: true }) === 'susu,travel', k({ platform: 'ios', hasSayram: true }));
  check('수수여행 주소', P.SUSU_TRAVEL_URL === 'https://www.youtube.com/@susu_travel');
  check('세이람 Play 주소', P.SAYRAM_PLAY_URL === 'https://play.google.com/store/apps/details?id=com.danielpark.sayram');
};
