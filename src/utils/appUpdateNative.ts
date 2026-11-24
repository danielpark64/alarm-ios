// 새 버전 안내(1.6.3) — 스토어 판 확인(네이티브 연결). 판정은 appUpdate.ts(순수, logic-tests), 띄우기는 hooks/useAppUpdatePrompt.ts.
// 규칙: 본부/규칙/업데이트-안내.md. 다른 앱으로 옮길 때 이 파일은 그대로 쓴다(앱 값은 constants/appInfo.ts, 네이티브는 modules/app-update).
//   iOS: App Store 공개 조회 https://itunes.apple.com/lookup?bundleId=<번들 ID>&country=<기기 지역> — 보내는 값은 이 두 개뿐
//        (기기 ID·사용자 정보·헤더를 따로 넣지 않는다). 지역 기준이라 그 나라에 아직 안 풀린 새 판은 결과가 비어 안 뜬다.
//   Android: Play 인앱 업데이트(AppUpdateManager) — Play 스토어 앱이 확인한다. JS에서 인터넷에 접속하지 않는다(세이람은 INTERNET 권한 없음).
// 실패(모듈 없음·인터넷 없음·응답 없음·Play에서 받은 판이 아님)는 전부 null — 아무것도 띄우지 않는다.
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { IOS_BUNDLE_ID, UPDATE_REQUIRED } from '../constants/appInfo';
import { decideAndroid, decideIos, lookupUrl, type PlayUpdate, type UpdateInfo } from './appUpdate';

type Native = {
  getInstalledVersion(): { version: string; build: string } | null;
  getRegion?(): string | null;                 // iOS
  getPlayUpdate?(): Promise<PlayUpdate | null>; // Android
};
const native = requireOptionalNativeModule<Native>('AppUpdate');

const TIMEOUT_MS = 8000;

/** 정해진 시간 안에 안 끝나면 null(조용히) */
function withTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS): Promise<T | null> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), ms);
    p.then(v => { clearTimeout(timer); resolve(v); }, () => { clearTimeout(timer); resolve(null); });
  });
}

async function checkIos(): Promise<UpdateInfo | null> {
  const installed = native?.getInstalledVersion()?.version;
  if (!installed) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(lookupUrl(IOS_BUNDLE_ID, native?.getRegion?.() ?? null), { signal: ctrl.signal });
    if (!res.ok) return null;
    return decideIos(installed, await res.json(), UPDATE_REQUIRED.iosMinVersion, IOS_BUNDLE_ID);
  } finally {
    clearTimeout(timer);
  }
}

async function checkAndroid(): Promise<UpdateInfo | null> {
  const build = Number(native?.getInstalledVersion()?.build);
  if (!native?.getPlayUpdate || !Number.isFinite(build)) return null;
  const play = await withTimeout(native.getPlayUpdate());
  return decideAndroid(build, play, UPDATE_REQUIRED.androidMinVersionCode);
}

/** 스토어에 새 판이 있으면 그 정보, 없거나 확인 실패면 null. 예외를 밖으로 던지지 않는다 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    if (!native) return null;
    if (Platform.OS === 'ios') return await checkIos();
    if (Platform.OS === 'android') return await checkAndroid();
    return null;
  } catch {
    return null;
  }
}
