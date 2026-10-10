import { useEffect, useState } from 'react';
import { getHolidayVersion, subscribeHolidays } from '../constants/holidays';

// 공휴일 데이터(apiHolidays)가 바뀔 때마다 올라가는 번호. useMemo deps나 memo 컴포넌트 prop에
// 넣으면 네트워크 갱신이 끝난 그 자리에서 달력 집계·셀 표기가 다시 계산된다.
// 마운트 전에 이미 바뀐 적이 있어도 getHolidayVersion()으로 현재 값을 읽으므로 놓치지 않는다.
export function useHolidayVersion(): number {
  const [v, setV] = useState(getHolidayVersion);
  useEffect(() => subscribeHolidays(() => setV(getHolidayVersion())), []);
  return v;
}
