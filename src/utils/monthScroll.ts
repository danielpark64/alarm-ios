// 달력 위아래 연속 스크롤(2026-11-22) — 세이람 lib/calendarKit/monthLayout.ts와 같은 방식의 순수 계산.
// 달마다 주 수(4~6주)가 달라 높이가 다르다 → 누적 위치표를 미리 만들어 FlatList getItemLayout에 넘긴다(저사양 32에서
// 측정 없이 바로 그 달로 뛸 수 있게). 테스트: scripts/logic-tests/month-scroll.test.js

/** 그 달이 차지하는 주 수(ws: 주 시작 요일 0=일, 1=월) */
export function monthWeeksCount(year: number, month: number, ws: number = 0): number {
  const lead = (new Date(year, month, 1).getDay() - ws + 7) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  return Math.ceil((lead + days) / 7);
}

/** 목록 번호 → 연·월. anchor 달이 before번 자리 */
export function monthAt(anchorYear: number, anchorMonth: number, before: number) {
  return (idx: number) => {
    const total = anchorYear * 12 + anchorMonth + (idx - before);
    return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
  };
}

/** 연·월 → 목록 번호 */
export function indexOf(anchorYear: number, anchorMonth: number, before: number, year: number, month: number): number {
  return (year - anchorYear) * 12 + (month - anchorMonth) + before;
}

export type MonthLayout = { offsets: number[]; heights: number[]; total: number };

/** 달 count개의 높이(제목 titleH + 주 수 × weekH)와 누적 위치 */
export function buildMonthLayout(anchorYear: number, anchorMonth: number, before: number, count: number,
  ws: number, weekH: number, titleH: number): MonthLayout {
  const at = monthAt(anchorYear, anchorMonth, before);
  const offsets: number[] = []; const heights: number[] = [];
  let acc = 0;
  for (let i = 0; i < count; i++) {
    const { year, month } = at(i);
    const h = titleH + monthWeeksCount(year, month, ws) * weekH;
    offsets.push(acc); heights.push(h); acc += h;
  }
  return { offsets, heights, total: acc };
}

/** 누적 위치표(오름차순)에서 y 위치가 속한 달 번호 */
export function monthIndexAt(offsets: number[], y: number): number {
  let lo = 0;
  let hi = offsets.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (offsets[mid] <= y) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
