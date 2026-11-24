// 새 버전 안내(src/utils/appUpdate.ts, 1.6.3) — 앱을 열 때 스토어에 새 판이 있으면 "새 버전이 있어요" 창.
// 규칙: 본부/규칙/업데이트-안내.md. 판정은 전부 이 순수 함수들 — 화면·네이티브는 판정 결과만 쓴다.
//  - 버전은 숫자 마디로 비교(문자열 비교 금지: "1.6.10" < "1.6.9"가 되어 버린다)
//  - 깔린 판이 스토어 판보다 높으면(심사 중 빌드) 안 띄운다 — 심사 담당자가 "업데이트하라" 창을 보면 안 된다
//  - 응답이 깨졌으면 조용히 넘어간다(null)
//  - [나중에]를 누른 날은 다시 안 묻는다 — 다음 날 다시 묻는다
//  - 울리는 중이면 절대 안 띄운다
module.exports = (U, M) => {
  const A = M.appUpdate;
  check('appUpdate 모듈이 있다', !!A);
  if (!A) return;

  // ── 버전 비교 ──
  check('1.6.10 > 1.6.9', A.compareVersions('1.6.10', '1.6.9') === 1);
  check('1.6.9 < 1.6.10', A.compareVersions('1.6.9', '1.6.10') === -1);
  check('같은 판 = 0', A.compareVersions('1.6.2', '1.6.2') === 0);
  check('마디 수가 달라도 같은 판(1.6 = 1.6.0)', A.compareVersions('1.6', '1.6.0') === 0);
  check('2.0 > 1.99.99', A.compareVersions('2.0', '1.99.99') === 1);
  check('형식이 깨지면 null', A.compareVersions('1.6.x', '1.6.2') === null && A.compareVersions('', '1.0') === null && A.compareVersions(undefined, '1.0') === null);

  // ── iOS: App Store 조회 응답 ──
  const ok = (v) => ({ resultCount: 1, results: [{ version: v, bundleId: 'com.danielpark.alarmapp', trackViewUrl: 'x' }] });
  check('응답에서 버전 꺼내기', A.parseLookupVersion(ok('1.6.3')) === '1.6.3');
  check('형식이 깨진 응답(null) → null', A.parseLookupVersion(null) === null);
  check('형식이 깨진 응답(문자열) → null', A.parseLookupVersion('<html>') === null);
  check('결과 0개(그 나라에 아직 안 풀림) → null', A.parseLookupVersion({ resultCount: 0, results: [] }) === null);
  check('results가 배열이 아님 → null', A.parseLookupVersion({ resultCount: 1, results: {} }) === null);
  check('version이 숫자 형식이 아님 → null', A.parseLookupVersion(ok('beta')) === null);
  check('version 없음 → null', A.parseLookupVersion({ resultCount: 1, results: [{}] }) === null);
  check('다른 앱의 결과면 → null', A.parseLookupVersion({ resultCount: 1, results: [{ version: '9.9.9', bundleId: 'com.other.app' }] }, 'com.danielpark.alarmapp') === null);

  check('iOS 새 판 → 안내', JSON.stringify(A.decideIos('1.6.2', ok('1.6.3'))) === JSON.stringify({ storeVersion: '1.6.3', required: false }));
  check('iOS 1.6.10 스토어, 1.6.9 깔림 → 안내', A.decideIos('1.6.9', ok('1.6.10')) !== null);
  check('iOS 같은 판 → 없음', A.decideIos('1.6.2', ok('1.6.2')) === null);
  check('iOS 높은 판(심사 중 빌드) → 없음', A.decideIos('1.6.3', ok('1.6.2')) === null);
  check('iOS 형식이 깨진 응답 → 없음', A.decideIos('1.6.2', { foo: 1 }) === null);
  check('iOS 깔린 버전을 못 읽음 → 없음', A.decideIos('', ok('1.6.3')) === null);

  // ── Android: Play 인앱 업데이트 정보(updateAvailability 2 = UPDATE_AVAILABLE) ──
  check('Android 새 판 → 안내', JSON.stringify(A.decideAndroid(14, { availability: 2, versionCode: 15 })) === JSON.stringify({ storeVersion: '15', required: false }));
  check('Android 같은 판 → 없음', A.decideAndroid(14, { availability: 1, versionCode: 14 }) === null);
  check('Android 높은 판(내부 테스트 빌드) → 없음', A.decideAndroid(16, { availability: 2, versionCode: 15 }) === null);
  check('Android 업데이트 가능 아님(설치 중 등) → 없음', A.decideAndroid(14, { availability: 3, versionCode: 15 }) === null);
  check('Android Play 없음·실패(null) → 없음', A.decideAndroid(14, null) === null);
  check('Android 형식이 깨짐 → 없음', A.decideAndroid(14, { availability: '2', versionCode: 'x' }) === null && A.decideAndroid(NaN, { availability: 2, versionCode: 15 }) === null);

  // ── 필수 판(구조만 — 설정값이 없으면 늘 false) ──
  check('필수 기준 없음 → 필수 아님', A.decideIos('1.0.0', ok('1.6.3'), null).required === false);
  check('필수 기준보다 낮으면 필수(iOS)', A.decideIos('1.5.0', ok('1.6.3'), '1.6.0').required === true);
  check('필수 기준 이상이면 필수 아님(iOS)', A.decideIos('1.6.0', ok('1.6.3'), '1.6.0').required === false);
  check('필수 기준보다 낮으면 필수(Android)', A.decideAndroid(10, { availability: 2, versionCode: 15 }, 12).required === true);
  check('앱 설정값은 지금 비어 있다(쓰지 않음)', M.appInfo && M.appInfo.UPDATE_REQUIRED.iosMinVersion === null && M.appInfo.UPDATE_REQUIRED.androidMinVersionCode === null);

  // ── 띄울지: [나중에]·울림 ──
  const info = { storeVersion: '1.6.3', required: false };
  const d = (iso) => A.dayKey(new Date(iso));
  check('날짜 키는 기기 날짜(YYYY-MM-DD)', d('2026-11-25T10:00:00') === '2026-11-25');
  check('새 판 있음 → 띄움', A.shouldShowUpdate({ info, laterDay: null, today: '2026-11-25', ringing: false }) === true);
  check('같은 날 [나중에] → 안 띄움', A.shouldShowUpdate({ info, laterDay: '2026-11-25', today: '2026-11-25', ringing: false }) === false);
  check('다음 날 → 다시 띄움', A.shouldShowUpdate({ info, laterDay: '2026-11-25', today: '2026-11-26', ringing: false }) === true);
  check('울리는 중 → 절대 안 띄움', A.shouldShowUpdate({ info, laterDay: null, today: '2026-11-25', ringing: true }) === false);
  check('울리는 중이면 필수 판도 안 띄움', A.shouldShowUpdate({ info: { ...info, required: true }, laterDay: null, today: '2026-11-25', ringing: true }) === false);
  check('필수 판은 [나중에] 누른 날도 띄움', A.shouldShowUpdate({ info: { ...info, required: true }, laterDay: '2026-11-25', today: '2026-11-25', ringing: false }) === true);
  check('새 판 없음(null) → 안 띄움', A.shouldShowUpdate({ info: null, laterDay: null, today: '2026-11-25', ringing: false }) === false);

  // ── iOS 조회 주소: 번들 ID와 나라만 ──
  const url = A.lookupUrl('com.danielpark.alarmapp', 'KR');
  check('조회 주소 = 번들 ID + 나라(소문자 2글자)만', url === 'https://itunes.apple.com/lookup?bundleId=com.danielpark.alarmapp&country=kr', url);
  check('나라를 모르면 country 없이', A.lookupUrl('com.danielpark.alarmapp', null) === 'https://itunes.apple.com/lookup?bundleId=com.danielpark.alarmapp');
  check('이상한 나라 값은 버림', A.lookupUrl('com.danielpark.alarmapp', 'kr&x=1') === 'https://itunes.apple.com/lookup?bundleId=com.danielpark.alarmapp');
};
