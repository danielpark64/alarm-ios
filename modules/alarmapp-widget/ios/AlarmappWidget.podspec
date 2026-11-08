Pod::Spec.new do |s|
  s.name           = 'AlarmappWidget'
  s.version        = '1.0.0'
  s.summary        = '교대알람 iOS 위젯 데이터 전달'
  s.description    = '교대알람 iOS 위젯 데이터 전달'
  s.license        = 'UNLICENSED'
  s.author         = 'danielpark'
  s.homepage       = 'https://github.com/danielpark64/alarm-ios'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'SWIFT_COMPILATION_MODE' => 'wholemodule' }
end
