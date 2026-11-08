// iOS 위젯 데이터 — 순수 계산만 둔다(네이티브 연결은 iosWidgetNative.ts). iOS 위젯은 혼자 계산하지 못하고 앱이 넘겨 준 값만
// 그리므로, 앱을 안 열어도 자정·알람 뒤에 스스로 넘어갈 수 있게 지난달 1일~다음 달 말일 근무표와 그동안의 알람 시각을 미리 넘긴다.
// 읽는 쪽: targets/widget/WidgetData.swift. 형식을 바꾸면 양쪽을 같이 고칠 것.
import { Alarm, DayOverrides, DAYS_DISPLAY } from '../constants';
import { getHoliday } from '../constants/holidays';
import { getLang } from '../i18n/lang';
import { t } from '../i18n/translate';
import { getNextFireDate, pad } from './index';
import { buildShiftTable } from './sayramShare';

const SCAN_STEP_DAYS = 14; // getNextFireDate가 한 번에 훑는 범위 — 그동안 없으면 그만큼 건너뛰어 다시 찾는다
const MAX_FIRES = 200;

/** from 다음부터 until까지 이 알람이 울리는 시각(초) */
function firesOf(alarm: Alarm, overrides: DayOverrides, now: Date, until: Date): number[] {
  const out: number[] = [];
  let from = now;
  while (from < until && out.length < MAX_FIRES) {
    const next = getNextFireDate(alarm, overrides, from);
    if (!next) {
      from = new Date(from.getFullYear(), from.getMonth(), from.getDate() + SCAN_STEP_DAYS, from.getHours(), from.getMinutes());
      continue;
    }
    if (next > until) break;
    out.push(Math.floor(next.getTime() / 1000));
    from = next;
  }
  return out;
}

export function buildIosWidgetData(alarms: Alarm[], overrides: DayOverrides, now: Date): string {
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const until = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  const days = Math.round((until.getTime() - from.getTime()) / 86400000);

  const a = [...new Set(alarms.filter(x => x.active).flatMap(x => firesOf(x, overrides, now, until)))]
    .sort((x, y) => x - y)
    .slice(0, MAX_FIRES);

  // 공휴일은 날짜 위치만 — 빨간 숫자로만 쓰고 이름은 칸에 넣지 않는다. getHoliday가 한국어일 때만 값을 준다.
  const h: number[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    if (getHoliday(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)) h.push(i);
  }

  return JSON.stringify({
    v: 1,
    lang: getLang(),
    ...buildShiftTable(alarms, overrides, from, days),
    h,
    a,
    s: {
      nextAlarm: t('⏰ 다음 알람'),
      offToday: t('오늘 비번! 🎉'),
      offIn: t('비번 {n}일 후'), // {n}은 위젯이 채운다
      noOff: t('비번 없음'),
      openApp: t('앱을 열어 주세요'),
      days: DAYS_DISPLAY.map(d => t(d)), // 일~토
    },
  });
}
