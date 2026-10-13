// 순수 로직(utils/index.ts)의 시나리오 테스트 러너 — Jest 없이 typescript.transpileModule로 필요한 파일만
// CommonJS로 바꿔 임시 폴더에서 실행한다. 사용: node scripts/logic-tests/run.js
const ts = require('typescript'); const fs = require('fs'); const path = require('path'); const os = require('os');
const ROOT = path.resolve(__dirname, '../..');
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'alarm-logic-'));
function emit(rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const out = path.join(OUT, rel.replace(/\.tsx?$/, '.js'));
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, js);
}
for (const f of fs.readdirSync(path.join(ROOT, 'src/constants'))) if (/\.ts$/.test(f)) emit('src/constants/' + f);
emit('src/utils/index.ts');
// i18n은 순수 모듈(.ts)만 — index.tsx(React·AsyncStorage)는 제외한다. utils는 '../i18n/translate'만 가져온다.
for (const dir of ['src/i18n', 'src/i18n/locales']) {
  if (!fs.existsSync(path.join(ROOT, dir))) continue;
  for (const f of fs.readdirSync(path.join(ROOT, dir))) if (/\.ts$/.test(f)) emit(dir + '/' + f);
}
const I18N = fs.existsSync(path.join(OUT, 'src/i18n/lang.js')) ? require(path.join(OUT, 'src/i18n/lang.js')) : null;
global.setLang = (l) => I18N && I18N.setCurrentLang(l);
if (I18N) I18N.setCurrentLang('ko'); // 테스트 기본 언어는 한국어(기기 로캘과 무관하게 결정적)
fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(OUT, 'node_modules'), 'junction');
const U = require(path.join(OUT, 'src/utils/index.js'));
let pass = 0, fail = 0;
global.check = (name, cond, detail) => { if (cond) { pass++; } else { fail++; console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); } };
// 시각 고정: 테스트가 new Date()를 쓰는 코드를 결정적으로 돌릴 수 있게 한다.
const RealDate = Date;
global.withNow = (iso, fn) => {
  const fixed = new RealDate(iso).getTime();
  class FakeDate extends RealDate { constructor(...a) { if (a.length === 0) super(fixed); else super(...a); } static now() { return fixed; } }
  global.Date = FakeDate; try { return fn(); } finally { global.Date = RealDate; }
};
for (const f of fs.readdirSync(__dirname).filter(f => /\.test\.js$/.test(f)).sort()) require(path.join(__dirname, f))(U);
try { fs.rmSync(OUT, { recursive: true, force: true }); } catch {}
console.log(`logic-tests: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
