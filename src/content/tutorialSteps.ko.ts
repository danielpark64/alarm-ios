import { TutorialStep } from '../components/Tutorial/CycleAlarmTutorial';

// ⚠️ 현재 이 시나리오를 시작하는 진입점은 없다 — 사용법 안내의 "N일 주기 알람 추가 따라하기" 배너와
// 첫 실행 권유 팝업이 모두 근무표 만들기 따라하기(rotationTutorialStepsKo)로 일원화됐다.
// 로직은 app/index.tsx에 그대로 남아 있어 진입점만 되살리면 다시 동작한다.
//
// step 0, 10은 특정 UI를 가리키지 않는 인트로/완료 화면 (rect 없음 → 화면 전체를 반투명하게 덮고 중앙에 카드)
// step 1~3, 9는 직접 따라 입력하는 단계로 "다음" 버튼으로 넘기고, step 4~8은 실제로 눌러야 다음으로 진행됨 —
// 특히 5, 7단계는 "N일 주기" 설정이 진짜 <Modal> 팝업 안에서 이루어져 튜토리얼 오버레이가 그 위로
// 보이지 않으므로(네이티브 모달이 항상 위) cta 버튼을 두지 않고 실제 탭(프리셋 선택/팝업 닫기)으로만 진행된다.
export const cycleTutorialStepsKo: readonly TutorialStep[] = [
  { icon: '👋', text: '간단한 실습으로 알람을 처음부터 끝까지 직접 만들어볼게요.', cta: '시작하기' },
  { icon: '🏷️', text: '먼저 알람 종류를 선택해보세요. (예: 출근)', cta: '다음' },
  { icon: '⏰', text: '시간을 맞춰보세요.', cta: '다음' },
  { icon: '✏️', text: '라벨에 내용을 적어보세요. (예: 기상)', cta: '다음' },
  { icon: '🔁', text: '반복 방식에서 "N일 주기"를 눌러보세요.', cta: null },
  { icon: '🔢', text: '팝업에서 며칠마다 울릴지 골라보세요. (예: 3일)', cta: null },
  { icon: '📅', text: '시작일자를 선택해보세요.', cta: null },
  { icon: '👀', text: '다음 알람 날짜를 확인하고 닫기 버튼을 눌러보세요.', cta: null },
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
  { icon: '🏷️', text: '교대근무에서 "초번"을 눌러보세요.', cta: null },
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
