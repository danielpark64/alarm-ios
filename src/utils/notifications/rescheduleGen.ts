// rescheduleAll 재진입 방어용 세대 번호.
//
// rescheduleAll은 "전체 취소 → 알람마다 최대 14회 await로 재예약"이라 수 초가 걸린다. 그 사이
// 다른 rescheduleAll이 시작되면(예: 알람 울림으로 앱이 전면에 떠 포그라운드 재스케줄이 도는 중에
// 사용자가 토글 OFF) 뒤 호출이 전체 취소를 끝낸 뒤에도 앞 호출이 남은 루프를 계속 돌며 방금 꺼진
// 알람을 Expo에 다시 예약한다. 네이티브는 activeAlarmIds 게이트가 막아주지만 Expo 알림에는 게이트가
// 없어 그대로 울린다. 그래서 호출마다 세대 번호를 받고, 각 await 뒤에 자기 세대가 아니면 즉시 중단한다
// — 마지막으로 시작한 호출만 끝까지 수행된다.
let current = 0;

export function nextGen(): number { return ++current; }

// gen이 없으면(단일 알람 scheduleAlarm 등 세대 관리 밖의 호출) 항상 유효로 본다.
export function isStaleGen(gen?: number): boolean { return gen != null && gen !== current; }
