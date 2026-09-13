# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# ============================================================
# R8 난독화 (android.enableMinifyInReleaseBuilds=true) — 2026-09-13
#
# ⚠️ 이 앱에서 난독화 실패는 크래시가 아니라 "조용한 no-op"으로 나타난다.
#    재부팅 후 알람이 등록만 안 되거나, 위젯이 갱신만 안 되는 식이라
#    로그도 안 남고 테스트에서도 안 잡힌다. 아래 keep을 지우지 말 것.
#
# 참고: AndroidManifest.xml에 등록된 컴포넌트는 AGP가 keep을 자동 생성하지만
#      (build/intermediates/aapt_proguard_file/release/aapt_rules.txt),
#      그건 빌드 생성물이라 눈에 안 보이고 매니페스트 구조가 바뀌면 조용히
#      사라진다. 그래서 여기에 명시적으로 한 번 더 적는다.
# ============================================================

# 스택트레이스 판독용 — 난독화는 하되 줄번호는 남긴다.
# 이게 없으면 mapping.txt가 있어도 크래시가 몇 번째 줄인지 못 짚는다.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

-dontwarn kotlinx.coroutines.**
-dontwarn kotlin.reflect.**

# [최우선] AppWidgetProvider — 클래스명이 런처의 AppWidgetHost DB에 영구 저장돼 있다.
# 이름이 바뀌면 기존 사용자 홈화면 위젯이 "로드할 수 없음"이 되고, 앱을 롤백해도
# 런처 DB에 죽은 ComponentName이 남아서 사용자가 직접 위젯을 다시 추가하는 수밖에 없다.
-keep class com.danielpark.alarmapp.AlarmWidgetMedium { *; }
-keep class com.danielpark.alarmapp.AlarmWidgetLarge  { *; }
-keep class com.danielpark.alarmapp.WidgetListService { *; }

# 시스템이 "이름으로" 우리 컴포넌트를 찾아 배달하는 경로.
# BootReceiver가 깨지면 크래시 없이 "재부팅 후 알람 안 울림"만 남고,
# AlarmService/AlarmReceiver/CoverAlarmActivity는 잠금 해제 전(directBoot) 경로라
# 일반 QA에서 재현조차 안 된다.
-keep class com.danielpark.alarmapp.BootReceiver       { *; }
-keep class com.danielpark.alarmapp.AlarmReceiver      { *; }
-keep class com.danielpark.alarmapp.AlarmService       { *; }
-keep class com.danielpark.alarmapp.CoverAlarmActivity { *; }

# JS 브리지 표면. RN 코어 consumer rule이 이미 NativeModule을 통째로 지키지만,
# JS가 `if (AlarmModule.cancelAlarms)`처럼 존재 여부로 분기하기 때문에
# (src/utils/notifications/android.ts) 메서드가 사라져도 예외 없이 폴백으로 샌다
# = "껐는데 알람이 울린다"로 이어진다. 방어를 이중으로 건다.
-keep class com.danielpark.alarmapp.AlarmModule   { *; }
-keep class com.danielpark.alarmapp.WidgetModule  { *; }
-keepclassmembers class * { @com.facebook.react.bridge.ReactMethod <methods>; }

# ViewManager는 RN 코어 룰의 NativeModule 규칙에 안 걸린다.
# gesture-handler / screens / safe-area-context / slider는 consumer proguard 파일이
# 아예 없어서(확인함) 이 두 줄이 유일한 보호막이다.
-keep class * extends com.facebook.react.uimanager.ViewManager { *; }
-keep class * extends com.facebook.react.uimanager.ViewGroupManager { *; }

# ⚠️ `-keep class com.danielpark.alarmapp.** { *; }` 같은 패키지 통째 keep은 금지.
#    난독화율이 다시 떨어져 Play 기준(25%)을 못 맞춘다. AlarmStore/AlarmScheduling/
#    AlarmIds/DeviceStorage 등 내부 전용 클래스는 코드에서 직접 참조되므로
#    난독화돼도 안전하다(이름이 같이 바뀐다).

# Add any project specific keep options here:
