export const TYPES = [
  { id: 'commute',  label: '출근', icon: '🚇', color: '#2196F3' },
  // 빨강은 비번 전용으로 양보 — 비번이 달력에서 유일하게 빨갛게 띄도록
  { id: 'offwork',  label: '퇴근', icon: '🏠', color: '#00ACC1' },
  // 원래 #4ADE80(파스텔 연두)였으나 라이트 테마 배경(밝은 회백색)과 명도가 거의 같아
  // 텍스트/배경 둘 다 안 보이는 문제 — 다른 TYPES 색상들과 비슷한 명도의 진한 녹색으로 교체
  { id: 'meal',     label: '식사', icon: '🍽️', color: '#16A34A' },
  // 주황은 비번 빨강과 한 계열이라 달력에서 헷갈림 → 노랑 계열로
  { id: 'exercise', label: '운동', icon: '🏃', color: '#F9A825' },
  { id: 'custom',   label: '기타', icon: '✏️', color: '#9C27B0' },
] as const;
// 색은 종류(TYPES) 색상, 비번의 빨강과 겹치지 않도록 선정 — 달력에서 근무 시간대별로 한눈에 구분되게
// 말번은 원래 #F2994A(채도 높은 오렌지)였으나 다크 테마에서 비번(빨강)보다 먼저 눈에 띄어 톤 다운
export const SHIFTS = [
  { id: 'early',  label: '초번', color: '#2F80ED' },
  { id: 'mid',    label: '중번', color: '#27AE60' },
  { id: 'late',   label: '말번', color: '#D98A4A' },
  { id: 'custom', label: '기타', color: '#9B51E0' },
  { id: 'none',   label: '해당없음', color: '#9CA3AF' },
] as const;
// 근무 시간대별 기본 출근/퇴근 시각 — RotationWizard 첫 사용 시, 그리고 기존 알람 편집 화면에서
// 시간대를 새로 고를 때 동일하게 참조(값이 흩어져 있으면 한쪽만 바뀌는 불일치가 생기기 쉬움)
export const DEFAULT_SHIFT_TIMES: Record<string, { commute: { hour: number; min: number }; offwork: { hour: number; min: number } }> = {
  early: { commute: { hour: 5,  min: 40 }, offwork: { hour: 15, min: 0 } },
  late:  { commute: { hour: 13, min: 40 }, offwork: { hour: 23, min: 0 } },
};
export const DEFAULT_SHIFT_TIME_FALLBACK = { commute: { hour: 8, min: 0 }, offwork: { hour: 17, min: 0 } };
// 비번 색 — 달력(CalendarView)의 비번 표시 색과 동일하게 맞춰서, 위저드/블록편집기 미리보기 칩과
// 실제 달력에서 같은 색으로 보이게 한다
export const REST_COLOR = '#e05252';
export const REPEAT = [
  { id: 'once',     label: '한 번' },
  { id: 'wdcustom', label: '요일' },
  { id: 'cycle',    label: 'N일 주기' },
  { id: 'rest',     label: 'N일 후 휴식' },
  { id: 'monthly',  label: '매월' },
  { id: 'yearly',   label: '매년' },
] as const;
export const DAYS = ['월','화','수','목','금','토','일'];
export const SOUNDS = [
  { id: 'none',    label: '없음', icon: '🔇' },
  { id: 'default', label: '소리', icon: '🔔' },
] as const;
export const VIBS = [
  { id: 'none',  label: '없음', icon: '📵' },
  { id: 'pulse', label: '진동', icon: '📳' },
] as const;
export const CYCLE_PRESETS = [2,3,4,7,10,30];
// 인앱 알람 울림 팝업의 "5분 후" 스누즈 버튼 노출 여부. false면 끄기 버튼만 표시.
export const SNOOZE_ENABLED = false;
export type AlarmType  = typeof TYPES[number]['id'];
// 'pattern' = 근무 시간대 로테이션 알람 전용 반복방식. REPEAT 상수엔 안 넣음 —
// 일반 반복방식 선택기에는 안 뜨고, "근무 시간대" 게이트를 통해서만 만들어짐.
export type RepeatMode = typeof REPEAT[number]['id'] | 'weekdays' | 'weekends' | 'daily' | 'pattern';
export type SoundMode  = 'none' | 'default';
export type VibMode    = 'none' | 'pulse';
export type ShiftPeriod = typeof SHIFTS[number]['id'];

// 근무 시간대 로테이션 블록 하나 — "초번 2일 → 말번 2일 → 휴식 1일"처럼 여러 개를 이어붙여
// 하나의 반복 패턴을 구성한다. cycle('N일 주기')/rest('N일 후 휴식')는 이 블록 2개짜리
// 특수 케이스와 동치(예: rest = [근무 cd일, 휴식 rd일]).
export interface WorkSegment {
  blockId: string; // 재조합(reconcile)용 안정적 키 — 블록 생성 시 한 번 부여, 편집돼도 유지
  shift: ShiftPeriod;
  shiftCustom?: string;
  days: number;
  isRest?: boolean; // true면 휴식 블록 — 알람 없음, 그냥 일수만 채움
  commuteTime?: { hour: number; min: number }; // isRest=false면 필수
  hasOffwork: boolean; // 이 블록에 퇴근 알람을 만들지 여부(회사마다 필요 여부가 다름)
  offworkTime?: { hour: number; min: number }; // hasOffwork=true일 때만 존재
}

export interface Alarm {
  id: number; typeId: AlarmType; hour: number; min: number;
  label: string; rm: RepeatMode; days: number[];
  cd: number; rd: number; snd: SoundMode; vib: VibMode; sd: string; active: boolean;
  lastDay?: boolean;
  skips?: string[]; // "이날만 끄기" — 해당 날짜(YYYY-MM-DD)에는 안 울림. 지난 날짜는 로드 시 정리
  lunar?: boolean; // 매년(yearly) 반복 전용 — true면 sd의 월/일을 음력으로 해석해 매년 그 음력 날짜(양력 환산)에 울림
  shift?: ShiftPeriod; // 근무 시간대(초번/중번/말번 등) — 미지정 시 기존 알람과 동일하게 동작
  shiftCustom?: string; // shift가 'custom'(기타)일 때 사용자가 직접 입력한 근무 시간대 이름
  groupId?: number; // 근무 시간대 로테이션 그룹 소속 알람들이 공유하는 id(그룹 첫 알람 자신의 id를 재사용)
  groupRole?: 'commute' | 'offwork'; // 그룹 내에서 이 알람이 출근/퇴근 중 무엇인지
  pattern?: WorkSegment[]; // rm==='pattern'일 때 전체 블록 시퀀스 — 그룹 멤버 전원에 동일하게 복제 저장
}
