// 한국 전용 기능은 언어가 한국어일 때만 — 공휴일 건너뛰기가 해외 사용자의 알람을 끄면 안 된다.
// 그리고 번역 함수의 기본 동작(한국어=원문, 사전에 없으면 영어→원문 폴백, ##문맥 떼기, 자리표시자 치환).
module.exports = (U, M) => {
  const fmt = d => d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` : 'null';
  const { holidays, translate } = M;
  // 2026-10-09(금) 한글날. 평일 출근 알람(요일 반복)은 한국어에서 그날을 건너뛴다.
  const commute = { id: 1, typeId: 'commute', label: '', hour: 7, min: 0, rm: 'wdcustom', days: [0,1,2,3,4], cd: 1, rd: 1, snd: 'none', vib: 'pulse', sd: '2026-01-01', active: true };
  setLang('ko');
  check('ko: 한글날은 법정공휴일', holidays.isStatutoryHoliday('2026-10-09') === true);
  check('ko: 공휴일 이름 표시', holidays.getHoliday('2026-10-09') === '한글날');
  withNow('2026-10-08T12:00:00', () => check('ko: 출근 알람이 한글날을 건너뜀(다음 = 10/12 월)', fmt(U.getNextFireDate(commute)) === '2026-10-12 07:00', fmt(U.getNextFireDate(commute))));
  check('ko: 2026년 공휴일 목록 있음', holidays.statutoryHolidaysInYear(2026).length > 10);

  setLang('en');
  check('en: 한국 공휴일은 공휴일이 아님', holidays.isStatutoryHoliday('2026-10-09') === false);
  check('en: 공휴일 이름 없음', holidays.getHoliday('2026-10-09') === undefined);
  withNow('2026-10-08T12:00:00', () => check('en: 출근 알람이 10/9에 그대로 울림', fmt(U.getNextFireDate(commute)) === '2026-10-09 07:00', fmt(U.getNextFireDate(commute))));
  check('en: 공휴일 목록 비어 있음(휴일근무 집계 없음)', holidays.statutoryHolidaysInYear(2026).length === 0);
  check('en: 휴일근무 판정 false', U.isHolidayWorkDay([commute], '2026-10-09') === false);
  if (M.solarTerms) check('en: 24절기 없음', M.solarTerms.getSolarTerm('2026-10-08') === undefined && M.solarTerms.getSolarTerm('2026-10-23') === undefined);

  // 번역 함수
  check('translate ko = 원문', translate.translate('ko', '알람 추가') === '알람 추가');
  check('translate ko ##문맥 떼기', translate.translate('ko', '일##단위') === '일');
  check('translate 미등록 키 = 원문 폴백', translate.translate('en', '사전에없는문구zz') === '사전에없는문구zz');
  check('translate 미등록 ##키 = ## 뗀 원문', translate.translate('en', '없는키zz##문맥') === '없는키zz');
  check('translate 자리표시자', translate.translate('ko', '{n}일 주기', { n: 3 }) === '3일 주기');
  setLang('ko');
};
// (추가) 사전이 채워진 뒤의 실제 번역 결과 — 근무조·출퇴근 라벨, 알림 본문, 기본 라벨 현지화
module.exports = ((prev) => (U, M) => {
  prev(U, M);
  const fmt = d => d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` : 'null';
  const T = (h, m = 0) => ({ hour: h, min: m });
  const { translate } = M.translate;
  for (const lang of M.lang.LANGS) {
    const body = translate(lang, '{time} 알람', { time: '06:00' });
    check(`${lang}: 알림 본문이 시각으로 시작(네이티브 끄기 정규식)`, /^\d{2}:\d{2}/.test(body), body);
    check(`${lang}: 근무조 이름이 서로 다름`, new Set(['초번','중번','말번','주간','야간'].map(k => translate(lang, k))).size === 5);
  }
  setLang('en');
  check('en: alarmLabel 기본 라벨 현지화(한국어로 저장된 "초번 출근")', U.alarmLabel({ label: '초번 출근', typeId: 'commute' }) === translate('en', '{shift} 출근', { shift: translate('en', '초번') }), U.alarmLabel({ label: '초번 출근', typeId: 'commute' }));
  check('en: 기본 라벨에 한글이 남지 않음', !/[가-힣]/.test(U.alarmLabel({ label: '초번 출근', typeId: 'commute' })));
  check('en: alarmLabel 사용자 라벨 유지', U.alarmLabel({ label: '아침 약 먹기', typeId: 'custom' }) === '아침 약 먹기');
  const pattern = [{ blockId: 'a', shift: 'night', days: 2, commuteTime: T(22), hasOffwork: true, offworkTime: T(6) }, { blockId: 'b', shift: 'none', days: 2, isRest: true, hasOffwork: false }];
  const off = { id: 2, typeId: 'offwork', groupRole: 'offwork', label: '', rm: 'pattern', days: [], cd: 2, rd: 2, snd: 'none', vib: 'pulse', sd: '2026-10-12', active: true, pattern, hour: 6, min: 0 };
  withNow('2026-10-14T03:00:00', () => {
    const p = U.nextAlarmParts([off]);
    check('en: 헤더 라벨에 한글이 없음', p && !/[가-힣]/.test(p.label + p.when), JSON.stringify(p));
    check('en: 시각은 언어와 무관하게 동일(10/14 06:00)', fmt(U.getNextFireDate(off)) === '2026-10-14 06:00');
  });
  setLang('ja');
  check('ja: alarmLabel(영어로 저장된 기본 라벨도 현재 언어로)', U.alarmLabel({ label: 'Clock in', typeId: 'commute' }) === translate('ja', '출근'), U.alarmLabel({ label: 'Clock in', typeId: 'commute' }));
  setLang('ko');
  check('ko: alarmLabel(영어로 저장된 기본 라벨 → 한국어)', U.alarmLabel({ label: 'Early Clock in', typeId: 'commute' }) === '초번 출근', U.alarmLabel({ label: 'Early Clock in', typeId: 'commute' }));
  check('ko: 문장 키 꼴 기본 라벨(영어) → 한국어', U.alarmLabel({ label: translate('en', '{shift} 출근', { shift: translate('en', '야간') }), typeId: 'commute' }) === '야간 출근');
})(module.exports);
