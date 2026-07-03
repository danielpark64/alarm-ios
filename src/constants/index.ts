export const TYPES = [
  { id: 'commute',  label: '출근', icon: '🚇', color: '#2196F3' },
  // 빨강은 비번 전용으로 양보 — 비번이 달력에서 유일하게 빨갛게 띄도록
  { id: 'offwork',  label: '퇴근', icon: '🏠', color: '#00ACC1' },
  { id: 'meal',     label: '식사', icon: '🍽️', color: '#4ADE80' },
  // 주황은 비번 빨강과 한 계열이라 달력에서 헷갈림 → 노랑 계열로
  { id: 'exercise', label: '운동', icon: '🏃', color: '#F9A825' },
  { id: 'custom',   label: '기타', icon: '✏️', color: '#9C27B0' },
] as const;
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
export type RepeatMode = typeof REPEAT[number]['id'] | 'weekdays' | 'weekends';
export type SoundMode  = 'none' | 'default';
export type VibMode    = 'none' | 'pulse';
export interface Alarm {
  id: number; typeId: AlarmType; hour: number; min: number;
  label: string; rm: RepeatMode; days: number[];
  cd: number; rd: number; snd: SoundMode; vib: VibMode; sd: string; active: boolean;
  lastDay?: boolean;
  skips?: string[]; // "이날만 끄기" — 해당 날짜(YYYY-MM-DD)에는 안 울림. 지난 날짜는 로드 시 정리
  lunar?: boolean; // 매년(yearly) 반복 전용 — true면 sd의 월/일을 음력으로 해석해 매년 그 음력 날짜(양력 환산)에 울림
}
