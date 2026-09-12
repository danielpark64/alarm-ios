import { useState, useEffect, useCallback } from 'react';
import { Alarm, DayOverride, DayOverrides, OVERRIDE_KINDS } from '../constants';
import { todayStr } from '../utils';
import { rescheduleAll } from '../utils/notifications';
import { syncWidget } from '../utils/widgetSync';
import { loadDayOverrides, saveDayOverrides } from '../utils/dayOverrideStore';

// 하루 근무 변경(연차·대근 등) 저장소. useAlarms.ts와 완전히 별도 AsyncStorage 키를 쓴다 —
// Alarm.dayOverrides처럼 알람 객체에 얹으면 같은 날짜를 여러 알람에 중복 기록해야 하고
// 나중에 추가된 알람은 그 override를 물려받지 못한다. 날짜의 속성은 날짜에 저장한다.
export function useDayOverrides(alarms: Alarm[]) {
  const [overrides, setOverrides] = useState<DayOverrides>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const raw = await loadDayOverrides();
      // 지난 날짜 override 정리 — useAlarms.ts의 skips 정리와 같은 방식.
      // 여기서 kind도 같이 검증한다 — OVERRIDE_KINDS에서 나중에 빠진 값(예: 예전에 있던
      // "기타")이 그대로 저장돼 있으면 dayOverrideDisplay/dayWorkFor는 이미 무시하지만
      // 저장소엔 라벨 없는 죽은 데이터로 영원히 남는다. kind가 없어지고 family도 없는
      // 완전히 빈 항목이면 이 기회에 통째로 지운다.
      const today = todayStr();
      let changed = false;
      const kept: DayOverrides = {};
      for (const [ds, v] of Object.entries(raw)) {
        if (ds < today) { changed = true; continue; }
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
    // 함수형 업데이트로 next를 만든다 — 클로저가 캡처한 overrides로 계산하면, 짧은 시간 안에
    // setOverride가 연속 호출될 때(예: 메모 입력 onBlur 직후 다른 날짜 선택) 뒤 호출이 앞
    // 호출의 반영 전 상태를 기준으로 계산해서 한쪽 변경이 조용히 덮어써질 수 있다.
    let next: DayOverrides = {};
    setOverrides(prev => {
      next = { ...prev };
      if (ov) next[dateStr] = ov; else delete next[dateStr];
      return next;
    });
    await saveDayOverrides(next);
    syncWidget(alarms, next);
    await rescheduleAll(alarms, next);
  }, [alarms]);

  return { overrides, overridesLoaded: loaded, setOverride };
}
