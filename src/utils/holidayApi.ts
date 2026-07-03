import { pad } from './index';

// 공공데이터포털 "한국천문연구원_특일 정보" API — 매년 새로 지정되는 임시공휴일까지 반영하려고
// 정부 공식 데이터로 주기적으로 갱신한다. 서비스키는 사용자가 data.go.kr에서 직접 발급받아
// 설정 화면에 입력해야 한다(무료, 개인 발급 필요 — 앱에 미리 내장할 수 없음).
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
