// iOS 위젯 타깃 — ios/ 폴더는 prebuild가 새로 만들므로 위젯도 여기서 선언한다(@bacons/apple-targets).
// App Group은 앱·세이람 공유와 같은 것을 쓴다(app.json). 파일은 <공유 폴더>/alarmapp/widget.json만 읽는다.
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'AlarmWidget',
  displayName: 'RotaWake',
  bundleIdentifier: '.widget',
  deploymentTarget: '16.4',
  frameworks: ['SwiftUI', 'WidgetKit', 'AppIntents'],
  entitlements: {
    'com.apple.security.application-groups':
      config.ios.entitlements['com.apple.security.application-groups'],
  },
  colors: {
    $accent: '#6c5ce7',
    $widgetBackground: { light: '#ffffff', dark: '#1c1c1e' },
  },
});
