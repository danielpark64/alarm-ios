// iOS 26+ AlarmKit 경로 결정(src/utils/alarmkitRoute.ts) — 어느 알람을 AlarmKit으로 보낼지, 예약 id·요일 변환.
// 두 경로가 동시에 걸리면 같은 알람이 두 번 울리므로, 분기 조건은 이 함수 하나에서만 정한다.
module.exports = (U, M) => {
  const R = M.alarmkitRoute;
  check('alarmkitRoute 모듈이 있다', !!R);
  if (!R) return;

  // ── 모드: iOS + 프레임워크 있음(iOS 26+) + 권한 허용일 때만 AlarmKit ──
  check('iOS 26+ 허용 → AlarmKit', R.alarmKitEnabled({ os: 'ios', available: true, auth: 'authorized' }) === true);
  check('iOS 26+ 거부 → Expo', R.alarmKitEnabled({ os: 'ios', available: true, auth: 'denied' }) === false);
  check('iOS 26+ 아직 안 물음 → Expo', R.alarmKitEnabled({ os: 'ios', available: true, auth: 'notDetermined' }) === false);
  check('iOS 26 미만 → Expo', R.alarmKitEnabled({ os: 'ios', available: false, auth: 'unavailable' }) === false);
  check('Android는 항상 Expo+네이티브', R.alarmKitEnabled({ os: 'android', available: true, auth: 'authorized' }) === false);

  // 권한 요청은 iOS 26+에서 한 번(아직 안 물었을 때)만
  check('안 물었으면 요청', R.shouldAskAlarmKit({ os: 'ios', available: true, auth: 'notDetermined' }) === true);
  check('거부했으면 다시 안 물음', R.shouldAskAlarmKit({ os: 'ios', available: true, auth: 'denied' }) === false);
  check('iOS 26 미만은 안 물음', R.shouldAskAlarmKit({ os: 'ios', available: false, auth: 'unavailable' }) === false);
  check('Android는 안 물음', R.shouldAskAlarmKit({ os: 'android', available: false, auth: 'unavailable' }) === false);

  // ── 알람별: 모드가 켜지면 소리 알람·진동만 알람 모두 AlarmKit(2026-11-28) ──
  // 진동만을 Expo 알림으로 두면 맥 "iPhone 알림"·워치가 알림을 가져가 폰이 진동하지 않았다(사용자 폰 재현).
  // AlarmKit + 완전 무음 30초 파일(silent_30s.wav)은 잠금 상태 폰에서 진동하고 맥에 안 뜬다(같은 날 폰 확인).
  const a = (snd, vib) => ({ snd, vib, active: true });
  const ENV_ON = R.alarmKitEnabled({ os: 'ios', available: true, auth: 'authorized' });
  const ENV_OLD = R.alarmKitEnabled({ os: 'ios', available: false, auth: 'unavailable' });
  const ENV_DENIED = R.alarmKitEnabled({ os: 'ios', available: true, auth: 'denied' });
  check('소리 알람 + 모드 켜짐 → AlarmKit', R.usesAlarmKit(a('default', 'pulse'), ENV_ON) === true);
  check('소리만(진동 없음) + 모드 켜짐 → AlarmKit', R.usesAlarmKit(a('default', 'none'), ENV_ON) === true);
  check('진동만 + 모드 켜짐 → AlarmKit', R.usesAlarmKit(a('none', 'pulse'), ENV_ON) === true);
  check('진동만 + iOS 26 미만 → Expo', R.usesAlarmKit(a('none', 'pulse'), ENV_OLD) === false);
  check('진동만 + AlarmKit 거부 → Expo', R.usesAlarmKit(a('none', 'pulse'), ENV_DENIED) === false);
  check('소리 알람 + 모드 꺼짐 → Expo', R.usesAlarmKit(a('default', 'pulse'), false) === false);

  // ── AlarmKit 소리 파일: 소리 알람은 고른 소리 그대로, 진동만은 완전 무음 30초(0.5초 무음은 꺼진 화면에서 진동 없음) ──
  check('AlarmKit 함수 alarmKitSound가 있다', typeof R.alarmKitSound === 'function');
  if (typeof R.alarmKitSound === 'function') {
    check('소리 알람 → 고른 소리 파일', R.alarmKitSound(a('default', 'pulse'), 'tone_piano.caf') === 'tone_piano.caf');
    check('진동만 → silent_30s.wav', R.alarmKitSound(a('none', 'pulse'), 'tone_piano.caf') === 'silent_30s.wav');
    check('silent_short.wav는 AlarmKit에 쓰지 않는다', R.alarmKitSound(a('none', 'pulse'), 'tone_beep.caf') !== 'silent_short.wav');
  }

  // ── 예약 id: 같은 알람·같은 날은 항상 같은 UUID(겹쳐 돈 재예약이 덮어써서 두 번 울리지 않게), 다르면 다름 ──
  const UUID_RE = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/;
  const u1 = R.alarmKitUuid(101, '2026-11-22');
  check('UUID 형식', UUID_RE.test(u1), u1);
  check('같은 입력 → 같은 UUID', u1 === R.alarmKitUuid(101, '2026-11-22'));
  check('날짜가 다르면 다른 UUID', u1 !== R.alarmKitUuid(101, '2026-11-23'));
  check('알람이 다르면 다른 UUID', u1 !== R.alarmKitUuid(102, '2026-11-22'));
  check('요일 반복 키도 구분', R.alarmKitUuid(101, 'weekly') !== u1);
  // 2주 × 알람 30개 범위에서 충돌 없음
  const seen = new Set();
  for (let id = 100; id < 130; id++) for (let d = 1; d <= 28; d++) seen.add(R.alarmKitUuid(id, `2026-11-${String(d).padStart(2, '0')}`));
  check('840개 UUID 충돌 없음', seen.size === 30 * 28, String(seen.size));

  // ── 요일: 앱은 0=월 … 6=일, AlarmKit(Locale.Weekday)은 영문 이름 ──
  check('요일 변환', JSON.stringify(R.alarmKitWeekdays([0, 4, 6])) === JSON.stringify(['monday', 'friday', 'sunday']),
    JSON.stringify(R.alarmKitWeekdays([0, 4, 6])));
  check('잘못된 요일은 버림', JSON.stringify(R.alarmKitWeekdays([7, -1, 2])) === JSON.stringify(['wednesday']));
};
