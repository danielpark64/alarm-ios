import { TutorialStep } from '../components/Tutorial/CycleAlarmTutorial';

// step 0, 10은 특정 UI를 가리키지 않는 인트로/완료 화면 (rect 없음 → 화면 전체를 반투명하게 덮고 중앙에 카드)
// step 1~7, 9는 직접 따라 입력하는 단계로 "다음" 버튼으로 넘기고, step 8(추가 버튼)은 실제로 눌러야 다음으로 진행됨
export const cycleTutorialStepsKo: readonly TutorialStep[] = [
  { icon: '👋', text: '간단한 실습으로 알람을 처음부터 끝까지 직접 만들어볼게요.', cta: '시작하기' },
  { icon: '🏷️', text: '먼저 알람 종류를 선택해보세요. (예: 출근)', cta: '다음' },
  { icon: '⏰', text: '시간을 맞춰보세요.', cta: '다음' },
  { icon: '✏️', text: '라벨에 내용을 적어보세요. (예: 기상)', cta: '다음' },
  { icon: '🔁', text: '반복 방식에서 "N일 주기"를 눌러보세요.', cta: null },
  { icon: '🔢', text: '며칠마다 울릴지 골라보세요. (예: 3일)', cta: '다음' },
  { icon: '📅', text: '시작일자를 선택해보세요.', cta: null },
  { icon: '👀', text: '다음 알람이 울릴 날짜들을 확인해보세요.', cta: '다음' },
  { icon: '➕', text: '"추가" 버튼을 눌러 알람을 완성해보세요!', cta: null },
  { icon: '🗑️', text: '이 알람을 삭제하시려면 이 버튼을 누르세요. 원하지 않으시면 다음을 누르세요.', cta: '다음' },
  { icon: '🎉', text: '정말 잘하셨어요! 이제부터는 직접 자유롭게 사용해보세요.', cta: '확인' },
];

// 근무표 만들기(RotationWizard) 튜토리얼 — 기본값 그대로 "초번 1일 → 말번 1일 → 비번 1일"
// 3일 주기 순환표를 손잡고 만들어보는 시나리오.
//
// 인트로(0)/완료(14)만 오버레이 자체 cta 버튼으로 넘어가고, 나머지는 전부 cta:null —
// 각 단계가 가리키는 실제 UI가 사용자의 직전 조작 이후에만 화면에 나타나므로(예: AddShiftModal은
// "+"를 눌러야 뜨고, 출근 시각 확인 화면은 초번을 골라야 뜸), 오버레이 버튼으로 미리 앞서가면
// 스포트라이트가 아직 없는 요소를 가리키게 된다 — 그래서 실제 조작(app/index.tsx의
// handleRotationShiftPick/handleRotationWizardEvent)이 감지될 때만 한 칸씩 전진한다.
export const rotationTutorialStepsKo: readonly TutorialStep[] = [
  { icon: '👋', text: '기본값 그대로, 초번→말번→비번이 도는 3일 주기 근무표를 함께 만들어볼게요.', cta: '시작하기' },
  { icon: '🏷️', text: '근무 시간대에서 "초번"을 눌러보세요.', cta: null },
  { icon: '⏰', text: '출근 시각이에요. 기본값 그대로 "다음"을 눌러보세요.', cta: null },
  { icon: '🏠', text: '퇴근 알람도 필요해요? "네"를 눌러보세요.', cta: null },
  { icon: '⏰', text: '퇴근 시각도 기본값 그대로 "완료"를 눌러보세요.', cta: null },
  { icon: '➕', text: '＋ 를 눌러 다음 근무를 추가해보세요.', cta: null },
  { icon: '🏷️', text: '이번엔 "말번"을 선택해보세요.', cta: null },
  { icon: '⏰', text: '출근 시각도 기본값 그대로 "다음"을 눌러보세요.', cta: null },
  { icon: '🏠', text: '퇴근 알람도 필요해요? "네"를 눌러보세요.', cta: null },
  { icon: '⏰', text: '퇴근 시각도 기본값 그대로 "완료"를 눌러보세요.', cta: null },
  { icon: '➕', text: '＋ 를 다시 눌러 이번엔 쉬는 날을 추가해볼게요.', cta: null },
  { icon: '🌙', text: '"비번"을 선택해보세요 — 시각 입력 없이 바로 추가돼요.', cta: null },
  { icon: '✅', text: '초번·말번·비번이 다 모였어요! "여기서 반복"을 눌러 완성해보세요.', cta: null },
  { icon: '💾', text: '마지막으로 "추가" 버튼을 눌러 저장하세요.', cta: null },
  { icon: '🎉', text: '완성! 이 순환표가 3일마다 계속 반복돼요. 이제부터는 직접 자유롭게 만들어보세요.', cta: '확인' },
];
