// 근무표 프리셋 — 모든 프리셋이 유효한 블록 목록이 되고, 자정 넘는 블록의 퇴근이 다음 날로 계산되는지.
module.exports = (U, M) => {
  const path = require('path');
  const P = M.presets;
  if (!P) { check('shiftPresets 모듈 로드', false); return; }
  let n = 0; const id = () => 'b' + (++n);
  for (const p of P.ALL_SHIFT_PRESETS) {
    const segs = P.presetToSegments(p, id);
    check(`프리셋 ${p.id}: 근무 블록이 있음`, segs.some(s => !s.isRest));
    check(`프리셋 ${p.id}: 근무 블록은 출퇴근 시각을 가짐`, segs.filter(s => !s.isRest).every(s => s.commuteTime && s.offworkTime && s.hasOffwork));
    check(`프리셋 ${p.id}: 일수 > 0`, segs.every(s => s.days > 0));
    check(`프리셋 ${p.id}: 근무조 id 유효`, segs.every(s => M.constants.SHIFTS.some(x => x.id === s.shift)));
  }
  for (const lang of M.lang.LANGS) check(`언어 ${lang}: 프리셋 3개 이상`, P.shiftPresetsFor(lang).length >= 3 && P.shiftPresetsFor(lang).every(Boolean));
  // 24시간 근무 프리셋: 10/12 08:00 출근 → 퇴근은 10/13 08:00
  const h24 = P.presetToSegments(P.ALL_SHIFT_PRESETS.find(p => p.id === 'h24'), id);
  const off = { id: 1, typeId: 'offwork', groupRole: 'offwork', label: '', rm: 'pattern', days: [], cd: 1, rd: 2, snd: 'none', vib: 'pulse', sd: '2026-10-12', active: true, pattern: h24, hour: 8, min: 0 };
  const fmt = d => d ? `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` : 'null';
  withNow('2026-10-12T09:00:00', () => check('24시간 프리셋 퇴근 = 다음날 08:00', fmt(U.getNextFireDate(off)) === '10/13 08:00', fmt(U.getNextFireDate(off))));
  // 알람 기본 라벨 현지화(한국어): 기본 라벨·사용자 라벨
  check('alarmLabel: 빈 라벨 → 타입 이름', U.alarmLabel({ label: '', typeId: 'commute' }) === '출근');
  check('alarmLabel: 기본 라벨 그대로', U.alarmLabel({ label: '초번 출근', typeId: 'commute' }) === '초번 출근');
  check('alarmLabel: 사용자 라벨은 손대지 않음', U.alarmLabel({ label: '아침 약 먹기', typeId: 'custom' }) === '아침 약 먹기');
};
