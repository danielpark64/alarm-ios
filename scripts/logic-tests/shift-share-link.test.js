// 근무표 공유(1.6.0, 2026-11-22) — 링크 만들기·읽기, 틀린·옛·너무 긴 링크, 새것 판정, 다 같이 쉬는 날, 자동 색·이름.
// 근무표 형식은 세이람 docs/shift-share-protocol.md(shifts)와 같다. 받은 근무는 보기만(알람 없음).
module.exports = (U, M) => {
  const L = M.shiftShareLink;
  check('shiftShareLink 모듈이 있다', !!L);
  if (!L) return;
  const T = (h, m = 0) => ({ hour: h, min: m });
  // 초번 2일 → 말번 2일 → 비번 1일, 시작 2026-11-22
  const pattern = [
    { blockId: 'a', shift: 'early', days: 2, commuteTime: T(5, 40), hasOffwork: true, offworkTime: T(15) },
    { blockId: 'b', shift: 'late', days: 2, commuteTime: T(13), hasOffwork: true, offworkTime: T(22) },
    { blockId: 'c', shift: 'none', days: 1, isRest: true, hasOffwork: false },
  ];
  const base = { label: '', rm: 'pattern', days: [], cd: 2, rd: 1, snd: 'none', vib: 'pulse', sd: '2026-11-22', active: true, pattern, hour: 5, min: 40 };
  const alarms = [
    { ...base, id: 1, typeId: 'commute', groupRole: 'commute' },
    { ...base, id: 2, typeId: 'offwork', groupRole: 'offwork', hour: 15, min: 0 },
  ];
  const today = new Date(2026, 10, 22);
  const NOW = new Date(2026, 10, 22, 9, 0).getTime();

  // ── 보내기: 오늘부터 215일, 세이람 형식 ──
  const body = L.buildShareBody(alarms, {}, today, NOW);
  const b = JSON.parse(body);
  check('보내는 근무표는 오늘부터', b.f === '2026-11-22', b.f);
  check('215일', b.d.length === 215, String(b.d.length));
  check('만든 시각 t', b.t === NOW);
  check('세이람 형식 검사(parseShiftBody)를 통과', !!L.parseShiftBody(b));
  const link = L.buildShareLink(body, 'ab12cd34');
  check('https 안내 페이지 링크', link.startsWith(L.SHARE_PAGE + '#'), link.slice(0, 60));
  check('데이터는 # 뒤에만(서버로 안 감)', !link.split('#')[0].includes('p='));
  check('링크 길이가 상한 안', link.length <= L.MAX_LINK, String(link.length));
  check('링크에 줄바꿈·공백 없음', !/\s/.test(link));

  // ── 받기: 안내 페이지 링크, 앱 주소 둘 다 ──
  const r = L.parseShareLink(link, today);
  check('내 링크를 읽는다', r && r.ok === true, JSON.stringify(r).slice(0, 80));
  check('보낸 사람 id', r.ok && r.sender === 'ab12cd34');
  check('11/22 초번', r.ok && L.shiftOn(r.data, new Date(2026, 10, 22))?.label === '초번');
  check('11/24 말번', r.ok && L.shiftOn(r.data, new Date(2026, 10, 24))?.label === '말번');
  check('11/26 비번·쉬는 날', r.ok && L.shiftOn(r.data, new Date(2026, 10, 26))?.off === true);
  check('보낸 시각 sentAt', r.ok && r.data.sentAt === NOW);
  const app = L.appLinkFromPage(link);
  check('안내 페이지 → 새 앱 주소(alarmappshare://)', app.startsWith(L.SHARE_SCHEME + '://'), app.slice(0, 40));
  check('기존 alarmapp:// 주소는 쓰지 않는다(옛 버전이 열리지 않게)', !app.startsWith('alarmapp://'));
  const r2 = L.parseShareLink(app, today);
  check('앱 주소로 받아도 같은 근무표', r2.ok && r2.sender === 'ab12cd34' && r2.data.days.length === 215);

  // ── 틀린 링크 ──
  const bad = (u) => L.parseShareLink(u, today);
  check('공유 링크가 아니면 notShare', bad('alarmapp://?widget=1').reason === 'notShare' && bad('https://example.com/#v=1').reason === 'notShare');
  check('개발 딥링크는 공유 링크로 읽지 않는다', bad('alarmapp://?k=x&testAlarm=3').reason === 'notShare');
  check('p 없음 → format', bad(L.SHARE_PAGE + '#v=1&i=ab12cd34').reason === 'format');
  check('JSON 깨짐 → format', bad(L.SHARE_PAGE + '#v=1&i=ab12cd34&p=%7Bxx').reason === 'format');
  const badBody = encodeURIComponent(JSON.stringify({ ...b, d: 'Z' + b.d.slice(1) }));
  check('형식 밖 글자 → format', bad(L.SHARE_PAGE + '#v=1&i=ab12cd34&p=' + badBody).reason === 'format');
  const badDate = encodeURIComponent(JSON.stringify({ ...b, f: '2026-13-45' }));
  check('없는 날짜 → format', bad(L.SHARE_PAGE + '#v=1&i=ab12cd34&p=' + badDate).reason === 'format');
  check('보낸 사람 id 형식 밖 → format', bad(L.SHARE_PAGE + '#v=1&i=AB!&p=' + encodeURIComponent(body)).reason === 'format');
  const noT = encodeURIComponent(JSON.stringify({ ...b, t: undefined }));
  check('만든 시각 t 없음 → format(새것 판정 불가)', bad(L.SHARE_PAGE + '#v=1&i=ab12cd34&p=' + noT).reason === 'format');
  check('다음 판 형식(v=2) → version(앱 업데이트 안내)', bad(L.SHARE_PAGE + '#v=2&i=ab12cd34&p=' + encodeURIComponent(body)).reason === 'version');
  check('v 없음 → format', bad(L.SHARE_PAGE + '#i=ab12cd34&p=' + encodeURIComponent(body)).reason === 'format');
  check('너무 긴 링크 → tooLong', bad(L.SHARE_PAGE + '#v=1&i=ab12cd34&p=' + 'x'.repeat(L.MAX_LINK)).reason === 'tooLong');
  // 옛 링크: 마지막 날이 지난 근무표
  const oldLink = L.buildShareLink(JSON.stringify({ f: '2026-01-01', l: ['주간'], c: ['#E0A106'], o: [0], d: '0'.repeat(215), t: NOW }), 'ab12cd34'); // 8/3에 끝남
  check('기간이 다 지난 옛 링크 → expired', bad(oldLink).reason === 'expired', JSON.stringify(bad(oldLink)).slice(0, 60));
  check('기간이 아직 남은 링크는 받는다', L.parseShareLink(oldLink, new Date(2026, 5, 1)).ok === true);

  // ── 업데이트 뒤 같은 링크 다시 누르기: 데이터가 링크 안에 있으니 그대로 받아진다 ──
  const later = new Date(2026, 11, 20); // 한 달 뒤 업데이트하고 다시 누름
  check('업데이트 뒤 같은 링크(안내 페이지)를 다시 누르면 받아진다', L.parseShareLink(link, later).ok === true);
  check('업데이트 뒤 같은 앱 주소를 다시 열어도 받아진다', L.parseShareLink(app, later).ok === true);

  // ── 새것 판정 ──
  const people = [{ id: 'ab12cd34', name: '엄마', seq: 1, color: '#F0A35E', visible: true, receivedAt: NOW, body }];
  check('처음 보낸 사람 → new', L.decideIncoming(people, 'zz99zz99', NOW).kind === 'new');
  check('같은 사람·같은 t → same(다시 묻지 않음)', L.decideIncoming(people, 'ab12cd34', NOW).kind === 'same');
  check('같은 사람·더 새 t → update', L.decideIncoming(people, 'ab12cd34', NOW + 1).kind === 'update');
  check('같은 사람·더 옛 t → same(옛것이 새것을 덮지 않음)', L.decideIncoming(people, 'ab12cd34', NOW - 1000).kind === 'same');
  check('자기 자신이 보낸 링크 → self', L.decideIncoming(people, 'me000000', NOW, 'me000000').kind === 'self');

  // ── 자동 색: 이미 쓰는 사람과 겹치지 않게 ──
  const P = L.AUTO_COLORS;
  check('색 후보 8개 이상·#RRGGBB', P.length >= 8 && P.every(c => /^#[0-9A-F]{6}$/.test(c)));
  check('아무도 없으면 첫 색', L.pickAutoColor([]) === P[0]);
  check('첫 색을 쓰면 둘째 색', L.pickAutoColor([P[0]]) === P[1]);
  check('대소문자 달라도 같은 색으로 본다', L.pickAutoColor([P[0].toLowerCase()]) === P[1]);
  check('중간이 비면 빈 색', L.pickAutoColor([P[0], P[2]]) === P[1]);
  check('전부 쓰면 가장 적게 쓴 색', L.pickAutoColor([...P, P[0], P[1]]) === P[2]);
  check('내 색(나 창)은 후보에서 뺀다', !P.includes(L.MY_COLOR));

  // ── 자동 이름 순서(공유1·공유2…) ──
  check('처음 받으면 1번', L.nextSeq([]) === 1);
  check('다음은 가장 큰 번호 + 1', L.nextSeq([{ seq: 1 }, { seq: 3 }]) === 4);

  // ── 다 같이 쉬는 날 ──
  check('모두 쉬면 true', L.isTogetherOff(['off', 'off', 'off']) === true);
  check('한 명이라도 근무면 false', L.isTogetherOff(['off', 'work', 'off']) === false);
  check('근무표가 없는 날(null)이 끼면 false', L.isTogetherOff(['off', null]) === false);
  check('혼자면 false(같이가 아님)', L.isTogetherOff(['off']) === false);
  check('dayStatus: 비번 = off', L.dayStatus(r.data, '2026-11-26') === 'off');
  check('dayStatus: 초번 = work', L.dayStatus(r.data, '2026-11-22') === 'work');
  check('dayStatus: 범위 밖 = null', L.dayStatus(r.data, '2026-11-21') === null);
  // 두 사람: 나(위 근무표)와 상대(3일 주기 비번 2일) — 같이 쉬는 날만 골라진다
  const other = L.parseShiftBody({ f: '2026-11-22', l: ['주간', '비번'], c: ['#E0A106', '#9AA0A6'], o: [0, 1], d: '1100110011', t: 1 });
  const days = ['2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'];
  const together = days.filter(ds => L.isTogetherOff([L.dayStatus(r.data, ds), L.dayStatus(other, ds)]));
  check('같이 쉬는 날 = 11/26', JSON.stringify(together) === '["2026-11-26"]', JSON.stringify(together));

  // ── 칸의 색 점: 4개까지 + 나머지 숫자 ──
  check('점 3개면 그대로', JSON.stringify(L.dotsFor(['a', 'b', 'c'])) === '{"dots":["a","b","c"],"more":0}');
  check('점 6개면 4개 + 2', JSON.stringify(L.dotsFor(['a', 'b', 'c', 'd', 'e', 'f'])) === '{"dots":["a","b","c","d"],"more":2}');

  // ── 보낸 사람 id ──
  const id = L.newSenderId(() => 0.5);
  check('보낸 사람 id는 8자 소문자·숫자', /^[0-9a-z]{8}$/.test(id), id);

  // ── v2 짧은 링크(빌드 10~): #v2.<base64url> · 미리보기 카드 페이지 /s/ ──
  check('v2 링크 모양: …/alarm-ios/s/#v2.<base64url>', /^https:\/\/danielpark64\.github\.io\/alarm-ios\/s\/#v2\.[A-Za-z0-9_-]+$/.test(link), link.slice(0, 70));
  const v1 = L.buildShareLinkV1(body, 'ab12cd34');
  check('v1(옛 링크) 모양 그대로', v1.startsWith(L.SHARE_PAGE_V1 + '#v=1&i=ab12cd34&p='));
  console.log(`    링크 길이(215일 초번2·말번2·비번1): v1 ${v1.length}자 → v2 ${link.length}자`);
  check('v2가 v1보다 확실히 짧다(절반 이하)', link.length * 2 <= v1.length, `${v1.length} → ${link.length}`);
  check('v2는 200자 이하', link.length <= 200, String(link.length));
  // v2 왕복 — 근무표 원문(body)이 v1과 같은 내용으로 복원된다
  const r1 = L.parseShareLink(v1, today);
  check('v1 옛 링크도 계속 받는다(하위호환)', r1.ok === true && r1.sender === 'ab12cd34');
  check('v1 앱 주소도 받는다', L.parseShareLink(L.appLinkFromPage(v1), today).ok === true);
  check('v2 왕복: 날짜 칸 215개 그대로', r.ok && r1.ok && JSON.stringify(r.data.days) === JSON.stringify(r1.data.days));
  check('v2 왕복: 라벨·색·쉬는 날·시작일·보낸 시각 그대로', r.ok && JSON.stringify([r.data.labels, r.data.colors, r.data.off, r.data.from, r.data.sentAt]) === JSON.stringify([r1.data.labels, r1.data.colors, r1.data.off, r1.data.from, r1.data.sentAt]));
  check('v2 앱 주소: alarmappshare://?v2.…', L.appLinkFromPage(link).startsWith('alarmappshare://?v2.'));
  // 하루 근무 변경으로 주기가 어긋난 날도 예외(x)로 보존
  const odd = JSON.parse(body); const dd = odd.d.split(''); dd[3] = '2'; dd[100] = '0'; dd[214] = '-'; odd.d = dd.join('');
  const oddLink = L.buildShareLink(JSON.stringify(odd), 'ab12cd34');
  const ro = L.parseShareLink(oddLink, today);
  check('어긋난 날(예외) 왕복', ro.ok && ro.data.days.map(i => i < 0 ? '-' : i.toString(36)).join('') === odd.d);
  // 주기가 없는 근무표는 칸 그대로(d)
  let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const rand = Array.from({ length: 215 }, () => '012'[Math.floor(rnd() * 3)]).join('');
  check('주기 없음 → 칸 그대로(d)', typeof L.packDays(rand).d === 'string' && L.unpackDays(L.packDays(rand)) === rand);
  check('packDays 왕복(같은 순서 되풀이)', L.unpackDays(L.packDays('0011200112001120')) === '0011200112001120');
  // 한글 라벨(UTF-8) 왕복
  check('base64url UTF-8 왕복(한글·일본어·이모지)', L.fromBase64Url(L.toBase64Url('초번 夜勤 🌙')) === '초번 夜勤 🌙');
  // 틀린 v2
  check('v2 깨진 base64 → format', bad(L.SHARE_PAGE + '#v2.%%%').reason === 'format');
  check('v2 JSON 아님 → format', bad(L.SHARE_PAGE + '#v2.' + L.toBase64Url('xx')).reason === 'format');
  check('v2 보낸 사람 없음 → format', bad(L.SHARE_PAGE + '#v2.' + L.toBase64Url(JSON.stringify(['', '20261122', ['a'], 'ffffff', '0', 'a', '0']))).reason === 'format');
  check('v2 칸 그대로(d) 형식도 받는다', L.parseShareLink(L.SHARE_PAGE + '#v2.' + L.toBase64Url(JSON.stringify(['ab12cd34', '20261122', ['a', 'b'], 'ffffff000000', '01', 'zzzzzzz', '0101'])), today).ok === true);
  check('v2 예외 날짜 범위 밖 → format', L.unpackDays({ q: '01', n: 10, x: 'zz0' }) === null);
  check('다음 판(v3.) → version(앱 업데이트 안내)', bad(L.SHARE_PAGE + '#v3.abc').reason === 'version');
  check('v2 너무 긴 링크 → tooLong', bad(L.SHARE_PAGE + '#v2.' + 'A'.repeat(L.MAX_LINK)).reason === 'tooLong');

  // ── 보내기 글(세이람과 같은 모양): 요약 줄 · 이번 주 → 빈 줄 → '눌러서 교대알람에서 보기 ▶ 링크' ──
  const msg = L.buildShareMessage(body, link);
  const ml = msg.split('\n');
  check('첫 줄: 📅 근무표를 보냈어요 (기간)', ml[0] === '📅 근무표를 보냈어요 (11월 22일 ~ 2027년 6월 24일)', ml[0]);
  check('둘째 줄: 이번 주 근무', ml[1] === '이번 주: 일 초번 · 월 초번 · 화 말번 · 수 말번 · 목 비번 · 금 초번 · 토 초번', ml[1]);
  check('빈 줄 뒤 마지막 줄에 링크(글 끝)', ml[2] === '' && ml[3] === '눌러서 교대알람에서 보기 ▶ ' + link && msg.endsWith(link));
  setLang('en');
  const men = L.buildShareMessage(body, link);
  // (근무 라벨 '초번'은 보낸 사람이 만든 데이터라 그대로 — 고정 문구만 본다)
  check('영어 글의 고정 문구에 한국어 없음', !/[가-힣]/.test(men.replace(/초번|말번|비번/g, '')), men.slice(0, 160));
  setLang('ko');
};
