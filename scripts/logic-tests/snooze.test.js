// 1.6.3 "5분 후 다시"(네이티브 스누즈, 요청코드 9002) 뒷정리 — src/utils/snoozeCheck.ts
//  ① snoozeStillDue: 스누즈를 건 뒤 일정이 바뀌어 그 알람이 "그 근무일·그 시각"에 더 이상 울리지 않으면 false(→ 스누즈 취소).
//     대상: 이날 끄기(근무일 기준), 하루 근무 변경으로 비번, 시간 변경, 끄기, 삭제. 그대로면(앱만 다시 연 경우) true.
//  ② keepOnceForSnooze: 자정 직전에 스누즈한 '한 번' 알람은 시작 때 자동 끄기에서 뺀다.
module.exports = (U, M) => {
  const S = M.snoozeCheck;
  check('snoozeCheck 모듈이 있다', !!S);
  if (!S) return;
  const T = (h, m = 0) => ({ hour: h, min: m });
  const at = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi, 0, 0).getTime();

  // 일반 출근 알람(요일 전부) 07:00 — 11/25 07:00에 울려 스누즈
  const commute = { id: 10, typeId: 'commute', label: '', rm: 'wdcustom', days: [0, 1, 2, 3, 4, 5, 6], cd: 1, rd: 1, snd: 'none', vib: 'pulse', sd: '2026-11-01', active: true, hour: 7, min: 0 };
  const sz = { baseAlarmId: 10, workDate: '2026-11-25', fireAt: at(2026, 11, 25, 7, 0) };
  withNow('2026-11-25T07:02:00', () => {
    check('그대로(앱만 다시 염) → 유지', S.snoozeStillDue(commute, sz, {}) === true);
    check('이날 끄기(그 근무일) → 취소', S.snoozeStillDue({ ...commute, skips: ['2026-11-25'] }, sz, {}) === false);
    check('다른 날 끄기 → 유지', S.snoozeStillDue({ ...commute, skips: ['2026-11-26'] }, sz, {}) === true);
    check('시간 변경 07:00→07:30 → 취소', S.snoozeStillDue({ ...commute, min: 30 }, sz, {}) === false);
    check('알람 끔 → 취소', S.snoozeStillDue({ ...commute, active: false }, sz, {}) === false);
    check('알람 삭제(없음) → 취소', S.snoozeStillDue(undefined, sz, {}) === false);
    check('하루 근무 변경 연차(비번) → 취소', S.snoozeStillDue(commute, sz, { '2026-11-25': { kind: 'annual' } }) === false);
    check('하루 근무 변경 대근 07:00 그대로 → 유지', S.snoozeStillDue(commute, sz, { '2026-11-25': { kind: 'substitute', work: { start: T(7), end: T(16) } } }) === true);
    check('하루 근무 변경 대근 09:00으로 → 취소', S.snoozeStillDue(commute, sz, { '2026-11-25': { kind: 'substitute', work: { start: T(9), end: T(18) } } }) === false);
    check('발화 시각을 모르면(옛 스누즈) → 유지', S.snoozeStillDue(commute, { baseAlarmId: 10, workDate: '', fireAt: 0 }, {}) === true);
    check('스누즈 기록 없음 → 유지', S.snoozeStillDue(commute, null, {}) === true);
  });

  // 야간 근무표(22~06) — 10/12 근무분의 퇴근이 10/13 06:00에 울려 스누즈. 근무일은 10/12.
  const pattern = [
    { blockId: 'a', shift: 'night', days: 2, commuteTime: T(22), hasOffwork: true, offworkTime: T(6) },
    { blockId: 'b', shift: 'none', days: 2, isRest: true, hasOffwork: false },
  ];
  const offwork = { id: 2, typeId: 'offwork', groupRole: 'offwork', label: '', rm: 'pattern', days: [], cd: 2, rd: 2, snd: 'none', vib: 'pulse', sd: '2026-10-12', active: true, pattern, hour: 6, min: 0 };
  const nz = { baseAlarmId: 2, workDate: '2026-10-12', fireAt: at(2026, 10, 13, 6, 0) };
  withNow('2026-10-13T06:03:00', () => {
    check('야간 퇴근 그대로 → 유지', S.snoozeStillDue(offwork, nz, {}) === true);
    check('야간 퇴근: 근무일(10/12) 끄기 → 취소', S.snoozeStillDue({ ...offwork, skips: ['2026-10-12'] }, nz, {}) === false);
    check('야간 퇴근: 울린 날(10/13) 끄기는 다른 근무 → 유지', S.snoozeStillDue({ ...offwork, skips: ['2026-10-13'] }, nz, {}) === true);
    check('야간 퇴근: 근무일 연차 → 취소', S.snoozeStillDue(offwork, nz, { '2026-10-12': { kind: 'annual' } }) === false);
    check('야간 퇴근: 근무일이 어긋난 기록 → 취소', S.snoozeStillDue(offwork, { ...nz, workDate: '2026-10-13' }, {}) === false);
  });

  // 근무표 출근(testShift 모양) — 오늘 초번 1일 → 비번 1일
  const early = { id: 30, typeId: 'commute', groupRole: 'commute', label: '', rm: 'pattern', days: [], cd: 1, rd: 1, snd: 'none', vib: 'pulse', sd: '2026-11-25', active: true,
    pattern: [{ blockId: 'tn1', shift: 'early', days: 1, commuteTime: T(15, 10), hasOffwork: false }, { blockId: 'tn2', shift: 'none', days: 1, isRest: true, hasOffwork: false }], hour: 15, min: 10 };
  const ez = { baseAlarmId: 30, workDate: '2026-11-25', fireAt: at(2026, 11, 25, 15, 10) };
  withNow('2026-11-25T15:12:00', () => {
    check('근무표 출근 그대로 → 유지', S.snoozeStillDue(early, ez, {}) === true);
    check('근무표 출근 이날 끄기 → 취소', S.snoozeStillDue({ ...early, skips: ['2026-11-25'] }, ez, {}) === false);
  });

  // 자정 직전 '한 번' 알람(11/25 23:58) 스누즈 → 11/26 00:01에 앱 시작
  const once = { id: 40, typeId: 'commute', label: '', rm: 'once', days: [], cd: 1, rd: 1, snd: 'none', vib: 'pulse', sd: '2026-11-25', active: true, hour: 23, min: 58 };
  const oz = { baseAlarmId: 40, workDate: '2026-11-25', fireAt: at(2026, 11, 25, 23, 58) };
  withNow('2026-11-26T00:01:00', () => {
    check('한 번 알람 자정 넘어도 스누즈 유지', S.snoozeStillDue(once, oz, {}) === true);
    check('지난 한 번 알람: 스누즈 대기 중이면 자동 끄기 안 함', S.keepOnceForSnooze(once, oz) === true);
    check('지난 한 번 알람: 스누즈 없으면 자동 끄기', S.keepOnceForSnooze(once, null) === false);
    check('지난 한 번 알람: 다른 알람 스누즈면 자동 끄기', S.keepOnceForSnooze(once, { ...oz, baseAlarmId: 41 }) === false);
  });
};
