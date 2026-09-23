const { withPodfile } = require('@expo/config-plugins');

// CocoaPods가 일부 리소스 번들 타겟(예: RNCAsyncStorage-RNCAsyncStorage_resources)에는
// Podfile의 `platform :ios` 값이나 expo-build-properties의 deploymentTarget을 적용하지 않고,
// 팟스펙에 박힌 옛날 값(13.4 등)을 그대로 쓴다. Xcode 27부터는 이게 빌드 실패로 이어진다
// (2026-09-18, "폰" 재설치 중 발견 — CLAUDE.md 참고).
// expo-build-properties가 처리 못 하는 이 틈을 post_install에서 강제로 메운다.
const MIN_TARGET = 16.4;

function withIosMinDeploymentTarget(config) {
  return withPodfile(config, (config) => {
    const marker = '# @generated withIosMinDeploymentTarget';
    if (config.modResults.contents.includes(marker)) {
      return config;
    }

    const patch = `
  ${marker}
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |build_configuration|
      current = build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f
      if current > 0 && current < ${MIN_TARGET}
        build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_TARGET}'
      end
    end
  end
`;

    config.modResults.contents = config.modResults.contents.replace(
      /post_install do \|installer\|/,
      `post_install do |installer|\n${patch}`
    );

    return config;
  });
}

module.exports = withIosMinDeploymentTarget;
