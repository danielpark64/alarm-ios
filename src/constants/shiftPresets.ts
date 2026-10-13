// 자주 쓰는 근무표 프리셋 — 나라마다 대표 순환 패턴이 달라(docs/shift-systems-research.md) 언어별로 보여 줄 목록을 고른다.
// 프리셋은 "초안"이다: 고르면 블록 편집 화면에 채워지고, 시각·일수는 사용자가 거기서 고친다.
// 퇴근 시각이 출근보다 이르면 다음 날 퇴근이다(utils의 isOvernight) — 12시간 야간·24시간 근무가 그렇게 표현된다.
import { N } from '../i18n/lang';
import type { Lang } from '../i18n/lang';
import type { ShiftPeriod, WorkSegment } from './index';

type T = { hour: number; min: number };
type Seg = { shift: ShiftPeriod | 'REST'; days: number; start?: T; end?: T; name?: string };
export interface ShiftPreset { id: string; name: string; desc: string; segs: Seg[] }

const at = (h: number, m = 0): T => ({ hour: h, min: m });
const D12 = { start: at(7), end: at(19) };   // 12시간 주간
const N12 = { start: at(19), end: at(7) };   // 12시간 야간(다음 날 퇴근)
const E8 = { start: at(6), end: at(14) }, L8 = { start: at(14), end: at(22) }, N8 = { start: at(22), end: at(6) };

const PRESETS: Record<string, ShiftPreset> = {
  // 한국
  kr3: { id: 'kr3', name: N('초번·말번·비번'), desc: N('초번 1일 → 말번 1일 → 비번 1일'),
    segs: [{ shift: 'early', days: 1, start: at(5, 40), end: at(15) }, { shift: 'late', days: 1, start: at(13, 40), end: at(23) }, { shift: 'REST', days: 1 }] },
  kr2: { id: 'kr2', name: N('주야비휴'), desc: N('주간 1일 → 야간 1일 → 비번 2일 (4조 2교대)'),
    segs: [{ shift: 'day', days: 1, ...D12 }, { shift: 'night', days: 1, ...N12 }, { shift: 'REST', days: 2 }] },
  // 8시간 3교대(전진 순환) — 독일 Vollkonti, 일본 4直3交替, 한국 4조 3교대
  fwd8: { id: 'fwd8', name: N('3교대 전진 순환'), desc: N('초번 2일 → 말번 2일 → 야간 2일 → 비번 2일'),
    segs: [{ shift: 'early', days: 2, ...E8 }, { shift: 'late', days: 2, ...L8 }, { shift: 'night', days: 2, ...N8 }, { shift: 'REST', days: 2 }] },
  // 미국·영국 12시간
  p223: { id: 'p223', name: N('2-2-3 (피트먼)'), desc: N('12시간 근무. 2일 근무 → 2일 휴무 → 3일 근무 → 2일 휴무 → 2일 근무 → 3일 휴무'),
    segs: [{ shift: 'day', days: 2, ...D12 }, { shift: 'REST', days: 2 }, { shift: 'day', days: 3, ...D12 }, { shift: 'REST', days: 2 }, { shift: 'day', days: 2, ...D12 }, { shift: 'REST', days: 3 }] },
  on4off4: { id: 'on4off4', name: N('4일 근무 4일 휴무'), desc: N('12시간 근무. 주간 4일 → 휴무 4일 → 야간 4일 → 휴무 4일'),
    segs: [{ shift: 'day', days: 4, ...D12 }, { shift: 'REST', days: 4 }, { shift: 'night', days: 4, ...N12 }, { shift: 'REST', days: 4 }] },
  dupont: { id: 'dupont', name: N('듀폰'), desc: N('12시간 근무, 28일 주기. 야간 4 → 휴무 3 → 주간 3 → 휴무 1 → 야간 3 → 휴무 3 → 주간 4 → 휴무 7'),
    segs: [{ shift: 'night', days: 4, ...N12 }, { shift: 'REST', days: 3 }, { shift: 'day', days: 3, ...D12 }, { shift: 'REST', days: 1 }, { shift: 'night', days: 3, ...N12 }, { shift: 'REST', days: 3 }, { shift: 'day', days: 4, ...D12 }, { shift: 'REST', days: 7 }] },
  h24: { id: 'h24', name: N('24시간 근무 · 48시간 휴무'), desc: N('24시간 근무 1일 → 휴무 2일 (소방·구급)'),
    segs: [{ shift: 'custom', name: '24h', days: 1, start: at(8), end: at(8) }, { shift: 'REST', days: 2 }] },
  // 일본 병원 2교대(16시간 야근 → 明け → 休)
  jp2: { id: 'jp2', name: N('2교대 (주간·장시간 야간)'), desc: N('주간 2일 → 야간 1일(16시간) → 휴무 2일'),
    segs: [{ shift: 'day', days: 2, start: at(8, 30), end: at(17) }, { shift: 'night', days: 1, start: at(16, 30), end: at(9) }, { shift: 'REST', days: 2 }] },
  // 중국·대만
  cn43: { id: 'cn43', name: N('4조 3교대 (3근 1휴)'), desc: N('초번 3일 → 휴무 1일 → 말번 3일 → 휴무 1일 → 야간 3일 → 휴무 1일'),
    segs: [{ shift: 'early', days: 3, ...E8 }, { shift: 'REST', days: 1 }, { shift: 'late', days: 3, ...L8 }, { shift: 'REST', days: 1 }, { shift: 'night', days: 3, start: at(0), end: at(8) }, { shift: 'REST', days: 1 }] },
  on2off2: { id: 'on2off2', name: N('2일 근무 2일 휴무'), desc: N('12시간 근무. 2일 근무 → 2일 휴무'),
    segs: [{ shift: 'day', days: 2, ...D12 }, { shift: 'REST', days: 2 }] },
  dn2: { id: 'dn2', name: N('주간 2 · 야간 2 · 휴무 2'), desc: N('12시간 근무. 주간 2일 → 야간 2일 → 휴무 2일'),
    segs: [{ shift: 'day', days: 2, ...D12 }, { shift: 'night', days: 2, ...N12 }, { shift: 'REST', days: 2 }] },
};

const BY_LANG: Record<Lang, string[]> = {
  ko: ['kr3', 'kr2', 'fwd8', 'dn2', 'h24'],
  en: ['p223', 'on4off4', 'dupont', 'h24', 'fwd8', 'dn2'],
  ja: ['jp2', 'fwd8', 'dn2', 'on4off4', 'h24'],
  de: ['fwd8', 'dn2', 'on4off4', 'p223', 'h24'],
  'zh-Hans': ['cn43', 'dn2', 'on2off2', 'fwd8', 'h24'],
  'zh-Hant': ['cn43', 'on2off2', 'dn2', 'fwd8', 'h24'],
  es: ['fwd8', 'p223', 'on4off4', 'dn2', 'h24'],
  fr: ['fwd8', 'dn2', 'on4off4', 'p223', 'h24'],
  pt: ['fwd8', 'p223', 'dn2', 'on4off4', 'h24'],
};

export function shiftPresetsFor(lang: Lang): ShiftPreset[] {
  return (BY_LANG[lang] ?? BY_LANG.en).map(id => PRESETS[id]);
}
export const ALL_SHIFT_PRESETS: ShiftPreset[] = Object.values(PRESETS);

/** 프리셋 → 블록 목록. blockId는 호출마다 새로 만든다(newId는 workPattern.newBlockId를 넘긴다). */
export function presetToSegments(p: ShiftPreset, newId: () => string): WorkSegment[] {
  return p.segs.map(g => g.shift === 'REST'
    ? { blockId: newId(), shift: 'none' as ShiftPeriod, days: g.days, isRest: true, hasOffwork: false }
    : { blockId: newId(), shift: g.shift, shiftCustom: g.name, days: g.days, isRest: false,
        commuteTime: g.start!, hasOffwork: true, offworkTime: g.end! });
}
