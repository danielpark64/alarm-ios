// 자정 넘는 근무(야간·24시간) — isOvernight / effectiveTime / dayWorkFor / getNextFireDate
module.exports = (U) => {
  const fmt = d => d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` : 'null';
  const T = (h, m = 0) => ({ hour: h, min: m });
  check('isOvernight 22→06', U.isOvernight(T(22), T(6)) === true);
  check('isOvernight 08→08 (24시간)', U.isOvernight(T(8), T(8)) === true);
  check('isOvernight 06→15 아님', U.isOvernight(T(6), T(15)) === false);
  check('isOvernight 한쪽 없음', U.isOvernight(undefined, T(6)) === false);

  // 로테이션: 야간 2일(22~06) → 비번 2일, 시작 2026-10-12(월)
  const pattern = [
    { blockId: 'a', shift: 'night', days: 2, commuteTime: T(22), hasOffwork: true, offworkTime: T(6) },
    { blockId: 'b', shift: 'none', days: 2, isRest: true, hasOffwork: false },
  ];
  const base = { id: 1, label: '', rm: 'pattern', days: [], cd: 2, rd: 2, snd: 'none', vib: 'pulse', sd: '2026-10-12', active: true, pattern, hour: 22, min: 0 };
  const commute = { ...base, typeId: 'commute', groupRole: 'commute' };
  const offwork = { ...base, id: 2, typeId: 'offwork', groupRole: 'offwork', hour: 6 };

  const et = U.effectiveTime(offwork, '2026-10-12');
  check('effectiveTime 퇴근 dayOffset=1', et && et.hour === 6 && et.dayOffset === 1, JSON.stringify(et));
  const ec = U.effectiveTime(commute, '2026-10-12');
  check('effectiveTime 출근엔 dayOffset 없음', ec && ec.hour === 22 && !ec.dayOffset, JSON.stringify(ec));
  check('휴식일은 null', U.effectiveTime(offwork, '2026-10-14') === null);

  // 10/12 20:00 — 출근은 오늘 22:00, 퇴근은 내일 06:00
  withNow('2026-10-12T20:00:00', () => {
    check('출근 다음 발화 = 10/12 22:00', fmt(U.getNextFireDate(commute)) === '2026-10-12 22:00', fmt(U.getNextFireDate(commute)));
    check('퇴근 다음 발화 = 10/13 06:00', fmt(U.getNextFireDate(offwork)) === '2026-10-13 06:00', fmt(U.getNextFireDate(offwork)));
  });
  // 10/13 03:00(근무 중) — 어제 근무분 퇴근이 오늘 06:00에 와야 한다(예전엔 10/13 근무분의 "10/13 06:00"… 같은 값이지만 근무일이 다름)
  withNow('2026-10-13T03:00:00', () => {
    check('근무 중: 퇴근 = 10/13 06:00', fmt(U.getNextFireDate(offwork)) === '2026-10-13 06:00', fmt(U.getNextFireDate(offwork)));
  });
  // 10/14 03:00 — 10/13 근무(둘째 야간)의 퇴근이 10/14 06:00. 10/14는 비번이라 예전 로직은 이걸 놓쳤다.
  withNow('2026-10-14T03:00:00', () => {
    check('둘째 야간의 퇴근 = 10/14 06:00 (비번일 아침)', fmt(U.getNextFireDate(offwork)) === '2026-10-14 06:00', fmt(U.getNextFireDate(offwork)));
    check('비번일: 출근 다음 발화 = 10/16 22:00', fmt(U.getNextFireDate(commute)) === '2026-10-16 22:00', fmt(U.getNextFireDate(commute)));
  });
  // 10/14 07:00 — 퇴근이 끝난 뒤. 다음 퇴근은 10/16 근무분 = 10/17 06:00
  withNow('2026-10-14T07:00:00', () => {
    check('퇴근 지난 뒤 다음 퇴근 = 10/17 06:00', fmt(U.getNextFireDate(offwork)) === '2026-10-17 06:00', fmt(U.getNextFireDate(offwork)));
  });
  // "이날 끄기"는 근무일 기준 — 10/13 근무분을 끄면 10/14 06:00 퇴근이 사라진다
  withNow('2026-10-13T12:00:00', () => {
    const sk = { ...offwork, skips: ['2026-10-13'] };
    check('근무일 skip → 그 근무의 다음날 퇴근 없음', fmt(U.getNextFireDate(sk)) === '2026-10-17 06:00', fmt(U.getNextFireDate(sk)));
  });

  // 주간 근무(06→15)는 기존과 동일해야 한다(회귀)
  const dayPattern = [{ blockId: 'a', shift: 'early', days: 1, commuteTime: T(6), hasOffwork: true, offworkTime: T(15) }, { blockId: 'b', shift: 'none', days: 1, isRest: true, hasOffwork: false }];
  const dayOff = { ...base, id: 3, typeId: 'offwork', groupRole: 'offwork', pattern: dayPattern, hour: 15 };
  withNow('2026-10-12T10:00:00', () => check('주간 퇴근 = 당일 15:00', fmt(U.getNextFireDate(dayOff)) === '2026-10-12 15:00', fmt(U.getNextFireDate(dayOff))));
  withNow('2026-10-13T10:00:00', () => check('주간: 비번일엔 다음 근무일 15:00', fmt(U.getNextFireDate(dayOff)) === '2026-10-14 15:00', fmt(U.getNextFireDate(dayOff))));

  // 24시간 근무(08→08): 근무 1 휴무 2
  const p24 = [{ blockId: 'a', shift: 'custom', shiftCustom: '24h', days: 1, commuteTime: T(8), hasOffwork: true, offworkTime: T(8) }, { blockId: 'b', shift: 'none', days: 2, isRest: true, hasOffwork: false }];
  const off24 = { ...base, id: 4, typeId: 'offwork', groupRole: 'offwork', pattern: p24, hour: 8 };
  withNow('2026-10-12T09:00:00', () => check('24시간 근무 퇴근 = 다음날 08:00', fmt(U.getNextFireDate(off24)) === '2026-10-13 08:00', fmt(U.getNextFireDate(off24))));

  // 하루 근무 변경: 비번일(10/14)에 야간 특근 22~06
  const ov = { '2026-10-14': { kind: 'special', work: { shift: 'night', start: T(22), end: T(6) } } };
  const dwC = U.dayWorkFor(commute, ov['2026-10-14']), dwO = U.dayWorkFor(offwork, ov['2026-10-14']);
  check('override 출근 22:00, dayOffset 없음', dwC.fires && dwC.time.hour === 22 && !dwC.dayOffset);
  check('override 퇴근 06:00, dayOffset=1', dwO.fires && dwO.time.hour === 6 && dwO.dayOffset === 1);
  withNow('2026-10-14T12:00:00', () => {
    check('특근 출근 = 10/14 22:00', fmt(U.getNextFireDate(commute, ov)) === '2026-10-14 22:00', fmt(U.getNextFireDate(commute, ov)));
    check('특근 퇴근 = 10/15 06:00', fmt(U.getNextFireDate(offwork, ov)) === '2026-10-15 06:00', fmt(U.getNextFireDate(offwork, ov)));
  });
  withNow('2026-10-15T02:00:00', () => check('자정 넘긴 뒤에도 특근 퇴근 = 10/15 06:00', fmt(U.getNextFireDate(offwork, ov)) === '2026-10-15 06:00', fmt(U.getNextFireDate(offwork, ov))));
  // 주간 override(09~18)는 offset 없음
  const dwD = U.dayWorkFor(offwork, { kind: 'substitute', work: { start: T(9), end: T(18) } });
  check('주간 override 퇴근 dayOffset 없음', dwD.fires && !dwD.dayOffset);

  // "이날 끄기" 정리(pruneSkips) — skips는 근무일 기준이고 야간 퇴근은 근무일 다음 날 울린다.
  // 오늘보다 이전을 전부 지우면, 10/13 근무분을 끈 사용자가 10/14 새벽에 앱을 열 때 skip이 사라져
  // 10/14 06:00 퇴근이 다시 예약된다(alarm-logic 리뷰 2026-10-13). 어제까지는 남겨야 한다.
  check('pruneSkips: 어제는 남김', JSON.stringify(U.pruneSkips(['2026-10-12', '2026-10-13', '2026-10-14'], '2026-10-14')) === JSON.stringify(['2026-10-13', '2026-10-14']));
  check('pruneSkips: 전부 지나면 undefined', U.pruneSkips(['2026-10-01'], '2026-10-14') === undefined);
  check('pruneSkips: 월 경계', JSON.stringify(U.pruneSkips(['2026-10-31'], '2026-11-01')) === JSON.stringify(['2026-10-31']));
  withNow('2026-10-14T03:00:00', () => {
    const sk = { ...offwork, skips: U.pruneSkips(['2026-10-13'], '2026-10-14') };
    check('자정 뒤 로드해도 끈 야간 퇴근은 안 울림', fmt(U.getNextFireDate(sk)) === '2026-10-17 06:00', fmt(U.getNextFireDate(sk)));
  });

  // 헤더 "다음 알람" 라벨은 근무일의 근무조여야 한다 — 야간2 → 초번2 패턴에서 10/14 03:00의 다음 알람은
  // 10/13 야간 근무의 퇴근(06:00)인데, 발화일(10/14=초번) 기준으로 라벨을 만들면 "초번 퇴근"이 된다.
  const mix = [
    { blockId: 'a', shift: 'night', days: 2, commuteTime: T(22), hasOffwork: true, offworkTime: T(6) },
    { blockId: 'b', shift: 'early', days: 2, commuteTime: T(7), hasOffwork: true, offworkTime: T(15) },
  ];
  const mixOff = { ...offwork, id: 5, pattern: mix };
  withNow('2026-10-14T03:00:00', () => {
    const p = U.nextAlarmParts([mixOff]);
    check('헤더 라벨 = 야간 퇴근(근무일 기준)', p && p.label === '야간 퇴근' && p.when === '오늘 06:00', JSON.stringify(p));
  });
  withNow('2026-10-14T08:00:00', () => {
    const p = U.nextAlarmParts([mixOff]);
    check('주간 근무는 발화일 기준 그대로(초번 퇴근 15:00)', p && p.label === '초번 퇴근' && p.when === '오늘 15:00', JSON.stringify(p));
  });

  // 출퇴근이 아닌 알람·요일 알람은 영향 없음(회귀)
  const meal = { id: 9, typeId: 'meal', label: '', hour: 12, min: 0, rm: 'wdcustom', days: [0,1,2,3,4,5,6], cd: 1, rd: 1, snd: 'none', vib: 'pulse', sd: '2026-01-01', active: true };
  check('overnightFrom: 식사 알람 0', U.overnightFrom(meal) === 0);
  check('overnightFrom: 로테이션 퇴근 -1', U.overnightFrom(offwork) === -1);
  check('overnightFrom: 로테이션 출근 0', U.overnightFrom(commute) === 0);
  withNow('2026-10-12T13:00:00', () => check('식사 알람 = 다음날 12:00', fmt(U.getNextFireDate(meal)) === '2026-10-13 12:00', fmt(U.getNextFireDate(meal))));
};
