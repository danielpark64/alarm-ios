const { withEntitlementsPlist } = require('@expo/config-plugins');

// expo-notifications 플러그인은 원격 푸시를 안 쓰는 이 앱에서도 무조건
// aps-environment 엔타이틀먼트(Push Notifications capability)를 추가한다.
// 무료(Personal) 개발자 팀은 이 capability를 지원하지 않아 서명이 실패한다
// (2026-09-18, "폰" 재설치 중 발견 — 이 앱은 로컬 알림만 쓰므로 안전하게 제거).
//
// ⚠️ Expo config-plugins의 mod 체인은 "나중에 등록된 게 먼저 실행"되는 LIFO 구조다.
// 그래서 이 플러그인은 app.json의 plugins 배열에서 "expo-notifications"보다
// 반드시 앞에 와야 한다 — 그래야 notifications가 키를 추가한 "다음"에 이 delete가
// 실행돼서 실제로 지워진다. 뒤에 두면 이 delete가 먼저 실행되고 나서 notifications가
// 다시 추가해버려 아무 효과가 없다 (2026-09-18 직접 확인한 실측 동작).
function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults['aps-environment'];
    return config;
  });
}

module.exports = withoutPushEntitlement;
