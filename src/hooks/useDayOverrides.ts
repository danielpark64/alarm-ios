import { useState, useEffect, useCallback } from 'react';
import { Alarm, DayOverride, DayOverrides, OVERRIDE_KINDS } from '../constants';
import { rescheduleAll } from '../utils/notifications';
import { syncWidget } from '../utils/widgetSync';
import { loadDayOverrides, saveDayOverrides, getDayOverridesCache } from '../utils/dayOverrideStore';

// 하루 근무 변경(연차·대근 등) 저장소. useAlarms.ts와 완전히 별도 AsyncStorage 키를 쓴다 —
// Alarm.dayOverrides처럼 알람 객체에 얹으면 같은 날짜를 여러 알람에 중복 기록해야 하고
// 나중에 추가된 알람은 그 override를 물려받지 못한다. 날짜의 속성은 날짜에 저장한다.
export function useDayOverrides(alarms: Alarm[]) {
  const [overrides, setOverrides] = useState<DayOverrides>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const raw = await loadDayOverrides();
      // 지난 기록은 지우지 않는다 — 달력 아래 "이번 달/올해" 집계와 지난 달력 배지가 이 기록으로
      // 만들어진다. 전날이 되자마자 지우면 대근·연차 내역이 사라진다(2026-10-07 버그).
      // 알람 예약은 오늘 이후만 보므로 남겨 둬도 영향이 없다. 다만 저장소가 무한히 커지지 않게
      // 10년 전 1월 1일보다 오래된 것만 정리한다. (예전엔 "작년 1월 1일"이었는데, 2026-10-09에
      // 지난 날짜 편집을 허용하면서 그보다 오래된 날짜에 적은 기록이 다음 실행 때 조용히 사라지는
      // 경로가 생겨 넉넉히 늘렸다 — 날짜당 수십 바이트라 10년치여도 크기는 문제가 안 된다.)
      // 여기서 kind도 같이 검증한다 — OVERRIDE_KINDS에서 나중에 빠진 값(예: 예전에 있던
      // "기타")이 그대로 저장돼 있으면 dayOverrideDisplay/dayWorkFor는 이미 무시하지만
      // 저장소엔 라벨 없는 죽은 데이터로 영원히 남는다. kind가 없어지고 family도 없는
      // 완전히 빈 항목이면 이 기회에 통째로 지운다.
      const keepFrom = `${new Date().getFullYear() - 10}-01-01`;
      let changed = false;
      const kept: DayOverrides = {};
      for (const [ds, v] of Object.entries(raw)) {
        if (ds < keepFrom) { changed = true; continue; }
        const knownKind = v.kind && OVERRIDE_KINDS.some(k => k.id === v.kind) ? v.kind : undefined;
        if (!knownKind && !v.family) { changed = true; continue; }
        if (knownKind !== v.kind) {
          changed = true;
          kept[ds] = { family: v.family };
        } else {
          kept[ds] = v;
        }
      }
      if (changed) await saveDayOverrides(kept);
      setOverrides(kept);
      setLoaded(true);
    })();
  }, []);

  // ov를 넘기면 그 날짜에 override를 쓰거나 덮어쓰고, null을 넘기면 지운다(원래대로 되돌림).
  // alarms는 호출 시점의 최신 배열이어야 한다 — 이 값으로 곧장 syncWidget→rescheduleAll을
  // 돌려서 방금 건 override가 지연 없이 예약에 반영되게 한다(useAlarms.ts와 같은 순서).
  const setOverride = useCallback(async (dateStr: string, ov: DayOverride | null) => {
    // 동기 캐시(getDayOverridesCache)를 기준으로 next를 만든다 — saveDayOverrides가 캐시를 즉시
    // 갱신하므로 setOverride가 연속 호출돼도 뒤 호출이 앞 호출의 결과를 이어받는다.
    // setOverrides(prev => …) 업데이터 안에서 next를 만들면 React 19에서 업데이터가 늦게 돌아
    // 빈 {}이 저장돼 기록 전체가 날아갈 수 있다.
    const next: DayOverrides = { ...getDayOverridesCache() };
    if (ov) next[dateStr] = ov; else delete next[dateStr];
    setOverrides(next);
    await saveDayOverrides(next);
    syncWidget(alarms, next);
    await rescheduleAll(alarms, next);
  }, [alarms]);

  return { overrides, overridesLoaded: loaded, setOverride };
}
