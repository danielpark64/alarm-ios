import { pad } from './index';

// 공공데이터포털 "한국천문연구원_특일 정보" API — 매년 새로 지정되는 임시공휴일,
// 신규/폐지 공휴일까지 정부 공식 데이터로 주기적으로 갱신한다(useHolidaySync, 30일 주기).
//
// 서비스키는 앱에 내장해서 배포한다(src/constants/holidayApiKey.ts). 사용자가 따로 발급받거나
// 입력할 필요 없이 알아서 갱신되는 게 요구사항이라, 키 입력 화면은 두지 않는다.
// 그 대가로 키가 APK 번들(assets/index.android.bundle)에 평문으로 들어가므로,
// 사용량이 늘어 일일 호출 한도가 문제되면 그때 프록시 서버로 옮기는 걸 검토한다.
//
// 갱신 실패는 조용히 무시된다 — 직전 캐시를 유지하고, 그마저 없으면 내장 공휴일 표
// (constants/holidays.ts, 2027년까지)로 표시되므로 사용자 화면이 비는 일은 없다.
const ENDPOINT = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';

interface RestDeItem {
  locdate: number | string;
  dateName: string;
  isHoliday: string; // 'Y' | 'N'
}

async function fetchYearMonth(serviceKey: string, year: number, month: number): Promise<Record<string, string>> {
  const url = `${ENDPOINT}?serviceKey=${encodeURIComponent(serviceKey)}&solYear=${year}&solMonth=${pad(month)}&numOfRows=100&_type=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = await res.json();
  const items = json?.response?.body?.items?.item;
  const arr: RestDeItem[] = Array.isArray(items) ? items : items ? [items] : [];
  const map: Record<string, string> = {};
  for (const it of arr) {
    if (it.isHoliday !== 'Y') continue;
    const ds = String(it.locdate);
    map[`${ds.slice(0,4)}-${ds.slice(4,6)}-${ds.slice(6,8)}`] = it.dateName;
  }
  return map;
}

// 1년치(12개월) 공휴일을 받아와 하나로 합친다
export async function fetchHolidaysForYear(serviceKey: string, year: number): Promise<Record<string, string>> {
  const perMonth = await Promise.all(
    Array.from({ length: 12 }, (_, i) => fetchYearMonth(serviceKey, year, i + 1)),
  );
  return Object.assign({}, ...perMonth);
}
