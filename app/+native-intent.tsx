// 앱으로 들어오는 주소를 expo-router 경로로 바꾸기 전에 거르는 곳(Expo Router "+native-intent").
// 근무표 공유 링크 https://danielpark64.github.io/alarm-ios/s/#v2.… 를 누르면(1.6.1~ 유니버설 링크·App Links)
// 그 주소가 그대로 앱에 온다. 그대로 두면 expo-router가 /alarm-ios/s 를 화면 경로로 보고 Unmatched Route를 띄운다.
// → 처음 열릴 때는 첫 화면('/'), 이미 켜져 있을 때는 화면을 바꾸지 않는다(null).
// 링크 내용(# 뒤)은 useShiftShare가 Linking으로 직접 받아 parseShareLink로 읽는다 — 여기서는 경로만 막는다.
const SHARE_PATH = /^https?:\/\/danielpark64\.github\.io\/alarm-ios\/s(\/|\.html|[?#]|$)/i;

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  try {
    if (typeof path === 'string' && (SHARE_PATH.test(path) || path.startsWith('/alarm-ios/s'))) return initial ? '/' : null;
    return path;
  } catch {
    return initial ? '/' : path;
  }
}
