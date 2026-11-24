// 앱에 묶인 값 — 한 곳에만 둔다(1.6.3 새 버전 안내, 근무표 공유의 [업데이트]).
// ⚠️ 다른 앱(세이람·사진첩·장바구니)이 새 버전 안내를 가져갈 때는 이 파일 값만 그 앱 것으로 바꾼다.
//    나머지(src/utils/appUpdate.ts·appUpdateNative.ts·storeLink.ts, src/hooks/useAppUpdatePrompt.ts,
//    src/components/common/UpdatePrompt.tsx, modules/app-update)는 그대로 복사한다.
// 순수 값만 — import 금지(scripts/logic-tests가 node에서 읽는다).

/** iOS 번들 ID — App Store 조회(itunes lookup)에 보내는 유일한 앱 값 */
export const IOS_BUNDLE_ID = 'com.danielpark.alarmapp';
/** Android 패키지 이름 */
export const ANDROID_PACKAGE = 'com.danielpark.alarmapp';
/** App Store 앱 페이지 */
export const STORE_IOS = 'https://apps.apple.com/app/id6825757463';
/** Play 스토어 앱으로 직접(웹 주소가 안 열릴 때만 — 삼성 폰에서 스토어 고르기 창이 뜬다) */
export const STORE_ANDROID = `market://details?id=${ANDROID_PACKAGE}`;
/** Play 웹 주소 — Play 스토어 앱이 바로 받는다(먼저 연다) */
export const STORE_ANDROID_WEB = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

/** "필수" 판 — 이보다 낮은 판은 [나중에] 없이 [업데이트]만 보인다. 구조만 열어 둔다: 지금은 쓰지 않는다(null).
 *  쓸지·어느 판부터인지는 사용자가 정한다(본부/규칙/업데이트-안내.md). */
export const UPDATE_REQUIRED: { iosMinVersion: string | null; androidMinVersionCode: number | null } = {
  iosMinVersion: null,
  androidMinVersionCode: null,
};
