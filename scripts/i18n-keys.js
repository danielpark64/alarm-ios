// 번역 키(한국어 원문) 추출·사전 누락 검사.
//   node scripts/i18n-keys.js            → 키 목록을 src/i18n/keys.json에 쓰고 요약 출력
//   node scripts/i18n-keys.js --check    → 각 언어 사전에 빠진 키가 있으면 종료코드 1 (정적 스위트용)
// 키는 t('…') / t("…") / t(`…`) / N('…') 의 문자열 리터럴에서만 모은다(변수·템플릿 보간이 들어간 호출은 제외 —
// 그런 건 '{n}일' 같은 고정 키 + params로 써야 한다). 한글이 없는 키('Android' 등)는 번역 대상이 아니므로 제외.
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); const st = fs.statSync(p);
  if (st.isDirectory()) { if (!/node_modules|locales/.test(p)) walk(p); } else if (/\.(ts|tsx)$/.test(f)) files.push(p); } })(path.join(ROOT, 'src'));
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (/\.(ts|tsx)$/.test(f)) files.push(p); } })(path.join(ROOT, 'app'));
const keys = new Map(); // key -> [files]
const re = /\b(?:t|N|tr)\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\$]|\\.)*)`)/g;
const unesc = s => s.replace(/\\n/g, '\n').replace(/\\(['"`\\])/g, '$1');
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8'); let m;
  while ((m = re.exec(src))) {
    const k = unesc(m[1] ?? m[2] ?? m[3] ?? '');
    if (!/[가-힣]/.test(k)) continue;
    if (!keys.has(k)) keys.set(k, []);
    const rel = path.relative(ROOT, f); if (!keys.get(k).includes(rel)) keys.get(k).push(rel);
  }
}
const list = [...keys.keys()].sort();
const LOCALES = ['en', 'ja', 'zh-Hans', 'zh-Hant', 'es', 'fr', 'de', 'pt'];
function loadDict(lang) {
  const p = path.join(ROOT, 'src/i18n/locales', lang + '.ts'); if (!fs.existsSync(p)) return null;
  const ts = require('typescript');
  const js = ts.transpileModule(fs.readFileSync(p, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const mod = { exports: {} }; new Function('module', 'exports', js)(mod, mod.exports);
  return Object.values(mod.exports)[0];
}
if (process.argv.includes('--check')) {
  let bad = 0;
  for (const lang of LOCALES) {
    const d = loadDict(lang); if (!d) { console.log(`${lang}: 사전 파일 없음`); bad++; continue; }
    const missing = list.filter(k => !(k in d));
    // {name} 자리표시자가 번역에서 빠지면 값이 화면에서 사라진다 — 같이 검사.
    const broken = list.filter(k => k in d && (k.match(/\{\w+\}/g) || []).some(ph => !d[k].includes(ph)));
    // 알림 본문 "{time} 알람"류는 네이티브 끄기 경로가 본문 맨 앞의 HH:MM을 정규식으로 읽는다 — 시각이 맨 앞이어야 한다.
    const timeFirst = list.filter(k => k.startsWith('{time}') && k in d && !d[k].startsWith('{time}'));
    if (missing.length || broken.length || timeFirst.length) { bad++;
      console.log(`${lang}: 누락 ${missing.length} / 자리표시자 깨짐 ${broken.length} / 시각이 맨 앞이 아님 ${timeFirst.length}`);
      for (const k of [...missing.slice(0, 5), ...broken.slice(0, 5), ...timeFirst]) console.log('   · ' + JSON.stringify(k).slice(0, 90)); }
  }
  console.log(`i18n: 키 ${list.length}개, 언어 ${LOCALES.length}개 — ${bad ? bad + '개 언어에 문제' : '누락 없음'}`);
  process.exit(bad ? 1 : 0);
}
fs.writeFileSync(path.join(ROOT, 'src/i18n/keys.json'), JSON.stringify(list.map(k => ({ key: k, files: keys.get(k) })), null, 1));
console.log(`i18n: 키 ${list.length}개 → src/i18n/keys.json`);
