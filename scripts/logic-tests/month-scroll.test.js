// 달력 위아래 연속 스크롤(2026-11-22, 세이람 MonthScroll 방식) — 달마다 높이·누적 위치·스크롤 위치→달 계산
module.exports = (U, M) => {
  const S = M.monthScroll;
  check('monthScroll 모듈이 있다', !!S);
  if (!S) return;
  // 주 수: 2026-02(일요일 1일, 28일) = 4주, 2026-11(일요일 시작) = 5주, 2026-08(토요일 1일, 31일) = 6주
  check('2026-02 일요일 시작은 4주', S.monthWeeksCount(2026, 1, 0) === 4, String(S.monthWeeksCount(2026, 1, 0)));
  check('2026-02 월요일 시작은 5주', S.monthWeeksCount(2026, 1, 1) === 5, String(S.monthWeeksCount(2026, 1, 1)));
  check('2026-11 일요일 시작은 5주', S.monthWeeksCount(2026, 10, 0) === 5);
  check('2026-08 일요일 시작은 6주', S.monthWeeksCount(2026, 7, 0) === 6);
  // 앵커 기준 번호 ↔ 연·월
  const at = S.monthAt(2026, 10, 24);
  check('번호 24 = 앵커 달', JSON.stringify(at(24)) === '{"year":2026,"month":10}', JSON.stringify(at(24)));
  check('번호 23 = 한 달 전', JSON.stringify(at(23)) === '{"year":2026,"month":9}');
  check('번호 26 = 해 넘김(2027-01)', JSON.stringify(at(26)) === '{"year":2027,"month":0}', JSON.stringify(at(26)));
  check('번호 0 = 24달 전(2024-11)', JSON.stringify(at(0)) === '{"year":2024,"month":10}', JSON.stringify(at(0)));
  check('연·월 → 번호', S.indexOf(2026, 10, 24, 2027, 0) === 26 && S.indexOf(2026, 10, 24, 2024, 10) === 0);
  // 누적 위치표: 높이 = 제목 + 주 수 × 주 높이
  const L = S.buildMonthLayout(2026, 10, 24, 49, 0, 60, 20);
  check('달 49개', L.heights.length === 49 && L.offsets.length === 49);
  check('첫 위치 0', L.offsets[0] === 0);
  check('앵커 달(5주) 높이 = 20 + 5×60', L.heights[24] === 320, String(L.heights[24]));
  check('누적 위치가 이어진다', L.offsets.every((o, i) => i === 0 || o === L.offsets[i - 1] + L.heights[i - 1]));
  check('전체 길이', L.total === L.offsets[48] + L.heights[48]);
  // 스크롤 위치 → 달
  check('맨 위는 0번 달', S.monthIndexAt(L.offsets, 0) === 0);
  check('앵커 달 시작 위치는 앵커 달', S.monthIndexAt(L.offsets, L.offsets[24]) === 24);
  check('앵커 달 시작 1px 앞은 앞 달', S.monthIndexAt(L.offsets, L.offsets[24] - 1) === 23);
  check('끝을 넘어도 마지막 달', S.monthIndexAt(L.offsets, L.total + 999) === 48);
  check('음수 위치는 0번 달', S.monthIndexAt(L.offsets, -50) === 0);
};
