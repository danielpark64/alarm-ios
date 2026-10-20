// 세이람과 자동 공유(v2) — 근무표 만들기·공유 여부·세이람 일정 읽기. 형식: 세이람 저장소 docs/shift-share-protocol.md
module.exports = (U, M) => {
  const S = M.sayramShare;
  check('sayramShare 모듈이 있다', !!S);
  if (!S) return;
  const B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
  const T = (h, m = 0) => ({ hour: h, min: m });

  // 로테이션: 초번 2일 → 말번 2일 → 비번 1일, 시작 2026-10-18
  const pattern = [
    { blockId: 'a', shift: 'early', days: 2, commuteTime: T(5, 40), hasOffwork: true, offworkTime: T(15) },
    { blockId: 'b', shift: 'late', days: 2, commuteTime: T(13), hasOffwork: true, offworkTime: T(22) },
    { blockId: 'c', shift: 'none', days: 1, isRest: true, hasOffwork: false },
  ];
  const base = { label: '', rm: 'pattern', days: [], cd: 2, rd: 1, snd: 'none', vib: 'pulse', sd: '2026-10-18', active: true, pattern, hour: 5, min: 40 };
  const alarms = [
    { ...base, id: 1, typeId: 'commute', groupRole: 'commute' },
    { ...base, id: 2, typeId: 'offwork', groupRole: 'offwork', hour: 15, min: 0 },
  ];
  const today = new Date(2026, 9, 18);
  const at = (p, ds) => { // 근무표에서 그날의 [이름, 색, 쉬는 날]
    const [y, m, d] = ds.split('-').map(Number);
    const [fy, fm, fd] = p.f.split('-').map(Number);
    const i = Math.round((new Date(y, m - 1, d) - new Date(fy, fm - 1, fd)) / 86400000);
    const ch = p.d[i];
    if (ch === undefined || ch === '-') return null;
    const k = B36.indexOf(ch);
    return [p.l[k], p.c[k], p.o[k]];
  };

  const p = JSON.parse(S.buildShiftShare(alarms, {}, today));
  check('f = 오늘 31일 전', p.f === '2026-09-17', p.f);
  check('d는 215일', p.d.length === 215, String(p.d.length));
  check('d는 800자 이하·허용 글자만', p.d.length <= 800 && /^[0-9a-z-]+$/.test(p.d));
  check('l·c·o 길이가 같다', p.l.length === p.c.length && p.c.length === p.o.length);
  check('l은 36개 이하·12자 이내', p.l.length <= 36 && p.l.every(x => typeof x === 'string' && x.length > 0 && x.length <= 12));
  check('c는 #RRGGBB', p.c.every(x => /^#[0-9A-Fa-f]{6}$/.test(x)), JSON.stringify(p.c));
  check('o는 0/1', p.o.every(x => x === 0 || x === 1));
  check('d의 번호가 l 안에 있다', [...p.d].every(ch => ch === '-' || B36.indexOf(ch) < p.l.length));
  check('t는 숫자', typeof p.t === 'number');
  check('시작일 전은 근무 없음(-)', at(p, '2026-10-17') === null && at(p, '2026-09-17') === null);
  check('10/18 초번', JSON.stringify(at(p, '2026-10-18')?.slice(0, 1)) === '["초번"]', JSON.stringify(at(p, '2026-10-18')));
  check('10/19 초번', at(p, '2026-10-19')?.[0] === '초번');
  check('10/20 말번', at(p, '2026-10-20')?.[0] === '말번', JSON.stringify(at(p, '2026-10-20')));
  check('10/21 말번·근무일', at(p, '2026-10-21')?.[0] === '말번' && at(p, '2026-10-21')?.[2] === 0);
  // 위젯 규칙에선 평소 쉬는 날 라벨이 '' — 그대로 두면 비번이 세이람에 하나도 안 간다
  check('10/22 평소 비번이 빠지지 않는다', at(p, '2026-10-22')?.[0] === '비번' && at(p, '2026-10-22')?.[2] === 1, JSON.stringify(at(p, '2026-10-22')));
  check('10/23 다시 초번(로테이션 반복)', at(p, '2026-10-23')?.[0] === '초번');
  check('세이람 칸엔 알람 이름이 아니라 시간대 이름만', !p.l.some(x => /출근|퇴근/.test(x)), JSON.stringify(p.l));
  check('같은 근무는 번호 하나를 같이 쓴다', p.l.filter(x => x === '초번').length === 1);
  check('초번 색은 근무조 고유색', at(p, '2026-10-18')?.[1] === '#2F80ED', at(p, '2026-10-18')?.[1]);

  // 하루 근무 변경: 10/19 연차(초번이던 날), 10/22 대근(비번이던 날) 말번으로
  const ov = {
    '2026-10-19': { kind: 'annual' },
    '2026-10-22': { kind: 'substitute', work: { shift: 'late', start: T(13), end: T(22) } },
    '2026-10-25': { family: '결혼식' }, // 경조사 메모만 — 근무엔 영향 없음
  };
  const q = JSON.parse(S.buildShiftShare(alarms, ov, today));
  check('연차는 그 이름·쉬는 날', at(q, '2026-10-19')?.[0] === '연차' && at(q, '2026-10-19')?.[2] === 1, JSON.stringify(at(q, '2026-10-19')));
  check('대근은 그 이름·근무일·근무조 색', at(q, '2026-10-22')?.[0] === '대근' && at(q, '2026-10-22')?.[2] === 0 && at(q, '2026-10-22')?.[1] === '#D98A4A', JSON.stringify(at(q, '2026-10-22')));
  check('경조사 메모만 있는 날은 원래 근무 그대로', at(q, '2026-10-25')?.[0] === at(p, '2026-10-25')?.[0], JSON.stringify(at(q, '2026-10-25')));

  // 근무 알람이 없으면 전부 '-'
  const e = JSON.parse(S.buildShiftShare([], {}, today));
  check('알람 없으면 모든 날 -', /^-+$/.test(e.d) && e.l.length === 0);

  // 영어로 바꾸면 번역된 이름
  setLang('en');
  const en = JSON.parse(S.buildShiftShare(alarms, {}, today));
  check('영어: 초번 → Early', at(en, '2026-10-18')?.[0] === 'Early', JSON.stringify(at(en, '2026-10-18')));
  check('영어: 비번 번역', at(en, '2026-10-22')?.[0] !== '비번', JSON.stringify(at(en, '2026-10-22')));
  setLang('ko');

  // 공유 여부: 한쪽만 켜도
  check('둘 다 꺼짐 → 공유 안 함', S.shareEnabled(false, null) === false && S.shareEnabled(false, { share: false }) === false);
  check('내 쪽만 켬 → 공유', S.shareEnabled(true, null) === true);
  check('세이람 쪽만 켬 → 공유', S.shareEnabled(false, { share: true, t: 1 }) === true);

  // 세이람 일정 읽기
  const ev = S.parseSiblingEvents(JSON.stringify({ v: 1, t: 1, e: [
    { d: '2026-10-20', h: 870, n: '안전보건 교육' },
    { d: '2026-10-22', e: '2026-10-24', n: '가족 휴가' },
    { d: '2026-13-01', n: '없는 날짜' },
    { d: '2026-10-21', h: 2000, n: '시각 범위 밖' },
    { d: '2026-10-21', n: '' },
  ] }));
  check('일정 읽기 성공', !!ev);
  if (ev) {
    check('시각 있는 일정', ev['2026-10-20']?.[0]?.name === '안전보건 교육' && ev['2026-10-20']?.[0]?.time === '14:30', JSON.stringify(ev['2026-10-20']));
    check('기간 일정은 끝나는 날까지 매일', ['2026-10-22', '2026-10-23', '2026-10-24'].every(ds => ev[ds]?.some(x => x.name === '가족 휴가')) && !ev['2026-10-25']);
    check('없는 날짜는 버린다', !Object.values(ev).flat().some(x => x.name === '없는 날짜'));
    check('범위 밖 시각은 시각 없이', ev['2026-10-21']?.find(x => x.name === '시각 범위 밖')?.time === undefined);
    check('이름이 비면 •', ev['2026-10-21']?.some(x => x.name === '•'));
  }
  check('깨진 JSON은 null', S.parseSiblingEvents('{oops') === null && S.parseSiblingEvents(null) === null);
  check('형식이 다르면 null', S.parseSiblingEvents(JSON.stringify({ v: 1 })) === null);
  // 아주 긴 기간 일정이 달력을 덮지 않게 상한
  const long = S.parseSiblingEvents(JSON.stringify({ v: 1, t: 1, e: [{ d: '2026-01-01', e: '2027-12-31', n: '긴 일정' }] }));
  check('기간 일정은 최대 366일까지만 펼친다', long && Object.keys(long).length <= 366, long ? String(Object.keys(long).length) : 'null');
  // v3 — 열 때는 받은 파일만 읽고, 직접 가져오기는 처음·상대가 옛 버전일 때만(실행당 1번) (2026-10-18)
  check('needsPull 함수가 있다', typeof S.needsPull === 'function');
  if (typeof S.needsPull === 'function') {
    check('이번 실행에 이미 가져왔으면 안 가져온다', S.needsPull(null, true) === false && S.needsPull('{"share":false}', true) === false);
    check('받은 게 없으면(처음) 가져온다', S.needsPull(null, false) === true);
    check('상대가 옛 버전(push 표시 없음)이면 가져온다', S.needsPull('{"share":true,"t":1}', false) === true);
    check('상대가 v3(push:1)이면 안 가져온다', S.needsPull('{"share":false,"push":1,"t":1}', false) === false);
    check('깨진 JSON이면 가져온다', S.needsPull('{oops', false) === true);
  }
  check('config 읽기가 push 표시를 지킨다', S.parseShareConfig('{"share":true,"push":1,"t":5}')?.push === 1);
};
