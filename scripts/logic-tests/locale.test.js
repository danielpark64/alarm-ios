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
