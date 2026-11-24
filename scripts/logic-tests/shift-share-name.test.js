// 근무표 공유 받기 쉽게(1.6.1, 2026-11-24) — 보낸 사람 이름(v2 배열 8번째 칸)·업데이트 안내 스토어 주소·
// 안내 페이지(docs/s/index.html) 미리보기 풀기가 앱과 같은 결과인지.
const fs = require('fs'); const path = require('path');
module.exports = (U, M) => {
  const L = M.shiftShareLink;
  if (!L) return;
  const today = new Date(2026, 10, 24);
  const NOW = new Date(2026, 10, 24, 9, 0).getTime();
  // 초번 2 → 말번 2 → 비번 1 되풀이(주기 압축이 되는 모양) + 어긋난 날 하나
  let d = ''; for (let i = 0; i < 215; i++) d += '00112'[i % 5];
  d = d.slice(0, 40) + '-' + d.slice(41);
  const body = JSON.stringify({ f: '2026-11-24', l: ['초번', '말번', '비번'], c: ['#F0A35E', '#5EC8F0', '#9AA0A6'], o: [0, 0, 1], d, t: NOW });

  // ── 이름 넣은 링크 왕복 ──
  check('cleanSenderName이 있다', typeof L.cleanSenderName === 'function');
  check('이름 최대 길이 20', L.SENDER_NAME_MAX === 20, String(L.SENDER_NAME_MAX));
  const withName = L.buildShareLink(body, 'ab12cd34', '김민수');
  const r1 = L.parseShareLink(withName, today);
  check('이름 넣은 링크를 읽는다', r1.ok === true, JSON.stringify(r1).slice(0, 80));
  check('이름이 그대로 돌아온다', r1.ok && r1.name === '김민수', r1.ok ? r1.name : '');
  check('이름 넣어도 근무는 같다', r1.ok && r1.data.days.length === 215 && L.shiftOn(r1.data, new Date(2026, 10, 26)).label === '말번');
  check('어긋난 날(40번째 칸 비움)도 왕복', r1.ok && r1.data.days[40] === -1);
  check('이름 넣어도 상한 안', withName.length <= L.MAX_LINK, String(withName.length));

  // ── 이름 없는 링크 — 8번째 칸을 넣지 않는다(1.6.0 링크와 같은 모양) ──
  const noName = L.buildShareLink(body, 'ab12cd34');
  const noName2 = L.buildShareLink(body, 'ab12cd34', '   ');
  const arrOf = (link) => JSON.parse(L.fromBase64Url(link.split('#v2.')[1]));
  check('이름 없으면 배열 7칸', arrOf(noName).length === 7, String(arrOf(noName).length));
  check('공백 이름도 7칸', arrOf(noName2).length === 7);
  check('이름 있으면 배열 8칸', arrOf(withName).length === 8 && arrOf(withName)[7] === '김민수');
  const r2 = L.parseShareLink(noName, today);
  check('이름 없는 링크 → name 빈 문자열', r2.ok && r2.name === '', r2.ok ? JSON.stringify(r2.name) : '');

  // ── 8칸 링크를 옛 파서 규칙(length >= 7, 앞 7칸만 본다)이 읽는가 = 1.6.0 앱이 받는다 ──
  const a8 = arrOf(withName);
  check('옛 규칙: 배열이고 7칸 이상', Array.isArray(a8) && a8.length >= 7);
  const [sender, f8, l, c, o, t36, cells] = a8;
  check('옛 규칙: 앞 7칸 자리가 그대로', sender === 'ab12cd34' && f8 === '20261124' && Array.isArray(l) && /^([0-9a-fA-F]{6})*$/.test(c) && /^[01]*$/.test(o) && /^[0-9a-z]{1,12}$/.test(t36) && cells != null);
  // 1.6.0 파서는 8번째 칸을 모른 채 앞 7칸만으로 만든다 — 그 결과가 이름 없는 링크와 같아야 한다
  const old7 = L.toBase64Url(JSON.stringify(a8.slice(0, 7)));
  const rOld = L.parseShareLink(L.SHARE_PAGE + '#v2.' + old7, today);
  check('옛 규칙으로 읽은 근무 = 새 규칙', rOld.ok && r1.ok && rOld.body === r1.body);

  // ── 이름 길이 제한·이상한 문자 ──
  const C = L.cleanSenderName;
  check('앞뒤 공백 자르기', C('  민수  ') === '민수');
  check('20자 넘으면 자름(코드 포인트 기준)', [...C('가'.repeat(30))].length === 20);
  check('이모지 반쪽이 남지 않게', C('😀'.repeat(25)) === '😀'.repeat(20));
  check('줄바꿈·제어문자 → 공백 한 칸', C('민\n\t수\u0000') === '민 수', JSON.stringify(C('민\n\t수\u0000')));
  check('방향 바꾸는 문자(RLO 등) 제거', C('a‮b⁦c‏d') === 'abcd', JSON.stringify(C('a‮b⁦c‏d')));
  check('문자열 아니면 빈 문자열', C(12) === '' && C(null) === '' && C(['x']) === '');
  check('HTML 글자는 그대로(표시는 글자로만)', C('<b>x</b>') === '<b>x</b>');
  // 받을 때도 정리한다 — 손으로 만든 긴·이상한 이름
  const evil = L.toBase64Url(JSON.stringify([...arrOf(noName), '‮' + '가'.repeat(40) + '\n']));
  const r3 = L.parseShareLink(L.SHARE_PAGE + '#v2.' + evil, today);
  check('받을 때 이름 정리(20자·RLO·줄바꿈 제거)', r3.ok && r3.name === '가'.repeat(20), r3.ok ? JSON.stringify(r3.name) : JSON.stringify(r3));
  const numName = L.toBase64Url(JSON.stringify([...arrOf(noName), 123]));
  const r4 = L.parseShareLink(L.SHARE_PAGE + '#v2.' + numName, today);
  check('이름 칸이 문자열이 아니면 무시하고 읽는다', r4.ok && r4.name === '');
  check('v1 링크는 이름 없음', (() => { const r = L.parseShareLink(L.buildShareLinkV1(body, 'ab12cd34'), today); return r.ok && r.name === ''; })());

  // ── 업데이트 안내 — 플랫폼별 스토어 ──
  check('스토어 주소: iOS', L.STORE_IOS === 'https://apps.apple.com/app/id6825757463');
  check('스토어 주소: Android market', L.STORE_ANDROID === 'market://details?id=com.danielpark.alarmapp');
  check('스토어 주소: Android 웹(실패 시)', L.STORE_ANDROID_WEB === 'https://play.google.com/store/apps/details?id=com.danielpark.alarmapp');

  // ── 안내 페이지 미리보기 풀기(docs/s/index.html의 /*DECODE*/ 블록)가 앱과 같은 결과 ──
  const html = fs.readFileSync(path.resolve(__dirname, '../../docs/s/index.html'), 'utf8');
  const m = /\/\*DECODE-START\*\/([\s\S]*?)\/\*DECODE-END\*\//.exec(html);
  check('안내 페이지에 풀기 블록(DECODE-START~END)이 있다', !!m);
  if (!m) return;
  const decodeShare = new Function(m[1] + '\nreturn decodeShare;')();
  const pv = (link) => decodeShare(link.slice(link.indexOf('#') + 1));
  const p1 = pv(withName);
  check('페이지: 이름 넣은 링크 풀기', p1 && p1.name === '김민수' && p1.from === '2026-11-24', JSON.stringify(p1 && { n: p1.name, f: p1.from }));
  check('페이지: 칸이 앱과 같다', p1 && r1.ok && p1.days.join(',') === r1.data.days.join(','));
  check('페이지: 라벨·색·쉬는 날', p1 && p1.labels.join() === '초번,말번,비번' && p1.colors[1] === '#5EC8F0' && p1.off[2] === true && p1.off[0] === false);
  const p2 = pv(noName);
  check('페이지: 이름 없는 링크', p2 && p2.name === '' && p2.days.length === 215);
  const p3 = pv(L.SHARE_PAGE + '#v2.' + evil);
  check('페이지: 이름 정리도 앱과 같다', p3 && r3.ok && p3.name === r3.name, JSON.stringify(p3 && p3.name));
  const pV1 = pv(L.buildShareLinkV1(body, 'ab12cd34'));
  check('페이지: v1 링크도 같은 카드', pV1 && pV1.days.length === 215 && pV1.labels[0] === '초번' && pV1.name === '');
  check('페이지: 깨진 링크 → null', decodeShare('v2.!!!') === null && decodeShare('v2.' + withName.split('#v2.')[1].slice(0, 30)) === null && decodeShare('') === null);
  check('페이지: 모르는 판 → null', decodeShare('v3.abc') === null);
  // 한글·이모지 UTF-8을 앱과 같이 푼다
  const emo = L.buildShareLink(body, 'ab12cd34', '엄마😀');
  check('페이지: 이모지 이름 UTF-8', pv(emo) && pv(emo).name === '엄마😀');
};
