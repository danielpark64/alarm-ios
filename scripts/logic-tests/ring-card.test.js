// 1.6.3 울림 카드(src/utils/ringCard.ts) — 울림 화면에 시간·이모지를 빼고 "근무 이름 + 근무일 날짜 + 끄기 + N분 후 다시"만.
//  ① 제목 앞 알람 아이콘(🚆·⏰ 등)은 떼고 근무 이름만 — 글자로 시작하는 이름은 그대로.
//  ② 날짜는 근무일(야간 퇴근은 전날) 기준, 9개 언어 날짜 형식(ClockHeader와 같은 '{month} {d}일 {dow}요일').
//  ③ "5분 후 다시"는 스누즈 분(SNOOZE_MIN)을 넣은 문구.
module.exports = (U, M) => {
  const R = M.ringCard;
  check('ringCard 모듈이 있다', !!R);
  if (!R) return;

  // ── ① 제목 ──
  check('🚆 초번 출근 → 초번 출근', R.ringTitle('🚆 초번 출근') === '초번 출근');
  check('⏰ 알람 → 알람', R.ringTitle('⏰ 알람') === '알람');
  check('이모지 여러 개 → 떼어 냄', R.ringTitle('🌙🏠 야간 퇴근') === '야간 퇴근');
  check('글자로 시작하면 그대로', R.ringTitle('초번 출근') === '초번 출근');
  check('영어 이름 그대로', R.ringTitle('Day shift') === 'Day shift');
  check('숫자로 시작하는 이름 그대로', R.ringTitle('3교대 출근') === '3교대 출근');
  check('이모지만 있으면 빈 문자열 대신 원래 값', R.ringTitle('⏰') === '⏰');
  check('빈 제목 → 빈 문자열', R.ringTitle('') === '');
  check('앞뒤 공백 정리', R.ringTitle('  🍚  점심 ') === '점심');

  // ── ② 날짜 ──
  check('한국어 날짜', R.ringDateLabel('2026-11-26') === '11월 26일 목요일', R.ringDateLabel('2026-11-26'));
  setLang('en');
  const en = R.ringDateLabel('2026-11-26');
  check('영어 날짜(한국어 글자 없음)', !/[가-힣]/.test(en) && /26/.test(en), en);
  setLang('ja');
  const ja = R.ringDateLabel('2026-11-26');
  check('일본어 날짜(한국어 글자 없음)', !/[가-힣]/.test(ja) && /26/.test(ja), ja);
  setLang('ko');
  check('잘못된 날짜 → 빈 문자열', R.ringDateLabel('') === '' && R.ringDateLabel('nope') === '');

  // ── 근무일: 울린 시각에서 근무 날짜(ds) — 네이티브가 넘긴 workDate가 있으면 그대로, 없으면 울린 날 ──
  check('workDate가 있으면 그대로(야간 퇴근 = 전날)', R.ringWorkDate('2026-11-25', new Date(2026, 10, 26, 6, 0)) === '2026-11-25');
  check('없으면 울린 날', R.ringWorkDate(undefined, new Date(2026, 10, 26, 6, 0)) === '2026-11-26');
  check('형식이 틀리면 울린 날', R.ringWorkDate('11/25', new Date(2026, 10, 26, 6, 0)) === '2026-11-26');

  // ── ③ 스누즈 문구 ──
  const C = M.constants;
  check('스누즈 분은 5', C && C.SNOOZE_MIN === 5);
  check('한국어 "5분 후 다시"', R.snoozeLabel() === '5분 후 다시', R.snoozeLabel());
  setLang('en');
  check('영어 스누즈 문구에 5가 있고 한국어 없음', /5/.test(R.snoozeLabel()) && !/[가-힣]/.test(R.snoozeLabel()), R.snoozeLabel());
  setLang('ko');
};
