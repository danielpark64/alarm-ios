import { Alarm, WorkSegment, SoundMode, VibMode, SHIFTS, ShiftPeriod } from '../constants';
import { shiftPrefixFor } from './index';

// 근무 시간대 로테이션 그룹은 항상 최대 2개 알람(출근/퇴근)만 갖는다 — 블록별로 알람을
// 따로 만들지 않는다. 어느 블록이 활성인지는 매 날짜마다 resolveSegment/effectiveTime이
// pattern을 읽어 동적으로 계산하므로, 블록 크기/순서를 바꿔도 같은 출근·퇴근 알람의
// pattern 필드만 갱신되고 id·켜짐 상태는 그대로 보존된다.
export interface ReconcileResult {
  toAdd: Omit<Alarm, 'id' | 'active'>[];
  toUpdate: { id: number; data: Partial<Alarm> }[];
  toRemove: number[];
}

// 블록 편집 UI용 안정적 키 생성(재조합 매칭에는 안 씀 — 이제 그룹은 항상 출근/퇴근 최대 2개
// 알람뿐이라 블록 단위 매칭이 필요 없어졌지만, blockId는 리스트 렌더링 key로는 계속 쓴다)
export function newBlockId(): string {
  return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function firstWorkSegment(pattern: WorkSegment[]): WorkSegment | undefined {
  return pattern.find(s => !s.isRest);
}

// 알림 제목에 쓰일 "{시간대} 출근/퇴근" — shiftPrefixFor는 뒤에 공백을 붙여 반환하므로
// 그대로 이어붙이면 "초번 출근"처럼 자연스럽게 조합됨
export function roleLabel(shiftInfo: { shift: ShiftPeriod; shiftCustom?: string }, role: 'commute' | 'offwork'): string {
  const base = role === 'commute' ? '출근' : '퇴근';
  return `${shiftPrefixFor(shiftInfo.shift, shiftInfo.shiftCustom)}${base}`;
}

// 팝업/미리보기용 — "초번 2일(06:00) → 말번 2일(14:00, 퇴근 없음) → 휴식 1일 반복"
export function workPatternPreviewLabel(pattern: WorkSegment[]): string {
  if (!pattern.length) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const parts = pattern.map(seg => {
    if (seg.isRest) return `휴식 ${seg.days}일`;
    const label = seg.shift === 'custom' ? (seg.shiftCustom?.trim() || '기타') : SHIFTS.find(s => s.id === seg.shift)!.label;
    const time = seg.commuteTime ? `${pad(seg.commuteTime.hour)}:${pad(seg.commuteTime.min)}` : '';
    const off = seg.hasOffwork ? '' : ', 퇴근 없음';
    return `${label} ${seg.days}일(${time}${off})`;
  });
  return `${parts.join(' → ')} 반복`;
}

function buildRoleAlarm(
  pattern: WorkSegment[], sd: string, role: 'commute' | 'offwork', snd: SoundMode, vib: VibMode,
): Omit<Alarm, 'id' | 'active'> {
  const first = firstWorkSegment(pattern);
  const t = (role === 'commute' ? first?.commuteTime : first?.offworkTime) ?? first?.commuteTime ?? { hour: 9, min: 0 };
  const cd = pattern.filter(s => !s.isRest).reduce((n, s) => n + Math.max(1, s.days), 0);
  const rd = pattern.filter(s => s.isRest).reduce((n, s) => n + Math.max(1, s.days), 0);
  return {
    typeId: role, hour: t.hour, min: t.min, label: '', rm: 'pattern', days: [],
    cd, rd, snd, vib, sd,
    pattern,
    shift: first?.shift, shiftCustom: first?.shiftCustom, // 레거시 폴백(패턴 모르는 코드용) — 첫 근무 세그먼트 값
    groupRole: role,
  };
}

export function reconcileWorkPattern(
  existingGroupAlarms: Alarm[], pattern: WorkSegment[], sd: string, snd: SoundMode, vib: VibMode,
): ReconcileResult {
  const toAdd: Omit<Alarm, 'id' | 'active'>[] = [];
  const toUpdate: { id: number; data: Partial<Alarm> }[] = [];
  const toRemove: number[] = [];

  const needsOffwork = pattern.some(s => !s.isRest && s.hasOffwork);
  const commute = existingGroupAlarms.find(a => a.groupRole === 'commute');
  const offwork = existingGroupAlarms.find(a => a.groupRole === 'offwork');

  const commuteData = buildRoleAlarm(pattern, sd, 'commute', snd, vib);
  if (commute) toUpdate.push({ id: commute.id, data: commuteData });
  else toAdd.push(commuteData);

  if (needsOffwork) {
    const offworkData = buildRoleAlarm(pattern, sd, 'offwork', snd, vib);
    if (offwork) toUpdate.push({ id: offwork.id, data: offworkData });
    else toAdd.push(offworkData);
  } else if (offwork) {
    toRemove.push(offwork.id);
  }

  return { toAdd, toUpdate, toRemove };
}
