package com.danielpark.alarmapp

import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import java.lang.ref.WeakReference

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    super.onCreate(null)
    instance = WeakReference(this)
    lockPortraitOnPhones()
    applyRingingWindowFlags(intent)
  }

  // 폰 크기 화면(smallestScreenWidthDp < 600)에서만 세로 고정. 매니페스트의 screenOrientation 대신
  // 여기서 거는 이유는 AndroidManifest.xml의 MainActivity 주석 참고 — 대형 화면(태블릿·펼친 폴더블)은
  // Android 16부터 어차피 제한이 무시되므로 처음부터 걸지 않아 Play 대형 화면 경고를 없앤다.
  // 화면들이 세로 기준으로 설계돼 있어 폰에서는 기존과 동일하게 세로만 허용한다.
  private fun lockPortraitOnPhones() {
    val sw = resources.configuration.smallestScreenWidthDp
    requestedOrientation = if (sw < 600)
      ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
    else
      ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    applyRingingWindowFlags(intent)
  }

  // 지금 맨 앞(resumed)인지 — AlarmService.scheduleKeepFront가 "울림 화면이 가려졌나"를 볼 때 쓴다.
  // 기본 화면의 울림 화면은 이 액티비티 위의 RN 모달(AlarmRinging)이고, 모달(Dialog)은 액티비티를 pause시키지
  // 않으므로 이 값이 곧 "울림 화면이 보이는가"다(앞으로 오면 JS가 getCurrentRinging으로 모달을 다시 띄운다).
  override fun onResume() {
    super.onResume()
    inFront = true
    // 안전망: 울림이 이미 끝났는데 잠금 위 표시가 남아 있으면 푼다(onRingingEnded를 놓친 경우 — 프로세스가 다시 뜬 뒤 낡은 인텐트 등).
    // 방금 건 플래그는 건드리지 않는다 — 전체 화면 인텐트가 AlarmService의 currentRinging 기록보다 먼저 올 수 있다.
    if (ringingFlagsAt > 0 && AlarmService.currentRinging == null &&
        System.currentTimeMillis() - ringingFlagsAt > STALE_FLAGS_MS) {
      clearRingingWindowFlags()
    } else if (ringingFlagsAt > 0 && isStaleRingingIntent(intent)) {
      // 1.6.2: 최근 앱에서 옛 울림 인텐트로 다시 열렸거나, 끈 뒤에 늦게 도착한 울림 인텐트 — 5초를 기다리지 않고 바로 푼다
      clearRingingWindowFlags()
    }
  }

  override fun onDestroy() {
    if (instance?.get() === this) instance = null
    super.onDestroy()
  }

  override fun onPause() {
    inFront = false
    super.onPause()
  }

  companion object {
    @Volatile var inFront = false
      private set

    // 지금 떠 있는 MainActivity — 울림이 끝났을 때 AlarmService가 잠금 위 표시를 풀 대상
    @Volatile private var instance: WeakReference<MainActivity>? = null
    private const val STALE_FLAGS_MS = 5_000L

    /**
     * 울림이 끝났다(끄기·스누즈·서비스 종료 — AlarmService의 모든 끝 경로와 AlarmModule.stopAlarm/snoozeAlarm이 부른다).
     * 잠금 화면 위 표시·화면 켜기를 풀어, 보안 잠금이면 끈 뒤 잠금 화면으로 돌아가게 한다(1.6.2).
     * 예전엔 끈 뒤에도 MainActivity가 PIN 잠금 위에 남아 잠금 해제 없이 앱을 쓸 수 있었다.
     */
    fun onRingingEnded() {
      val a = instance?.get() ?: return
      a.runOnUiThread { a.clearRingingWindowFlags() }
    }
  }

  // 잠금 위 표시를 건 시각(0 = 안 걸림)
  private var ringingFlagsAt = 0L

  /** applyRingingWindowFlags를 되돌린다. setShowWhenLocked(true)는 액티비티 속성이라 창 플래그(clearFlags)만으로는 안 풀린다 */
  fun clearRingingWindowFlags() {
    window.clearFlags(
      WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
      WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
      WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
    )
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(false)
      setTurnScreenOn(false)
    }
    // 낡은 울림 인텐트로 다시 만들어질 때(구성 변경 등) 또 걸지 않게
    intent?.removeExtra("alarmRinging")
    ringingFlagsAt = 0L
  }

  /**
   * 울림용 인텐트인데 그 울림이 이미 끝났는가(1.6.2).
   *  - 최근 앱(FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY)에서 옛 인텐트로 다시 열렸고 지금 울리는 중이 아님
   *  - 인텐트의 울림 시작 시각(ringAt)이 마지막으로 울림이 끝난 시각(AlarmService.lastRingEndedAt) 이하 —
   *    워치·알림 버튼으로 울린 직후 끈 뒤 늦게 도착한 인텐트
   * 판정이 안 되는 인텐트(ringAt 없음 — 예전 판의 알림)는 기존 5초 규칙(onResume)에 맡긴다.
   * 전체 화면 인텐트가 currentRinging 기록보다 먼저 올 수 있어 "지금 안 울림"만으로는 판정하지 않는다.
   */
  private fun isStaleRingingIntent(i: Intent?): Boolean {
    if (i == null) return false
    if ((i.flags and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0 && AlarmService.currentRinging == null) return true
    val ringAt = i.getLongExtra("ringAt", 0L)
    return ringAt > 0 && ringAt <= AlarmService.lastRingEndedAt
  }

  // configChanges에 smallestScreenSize가 있어 폴더블을 접고 펼쳐도 액티비티가 재생성되지 않는다.
  // 펼친 상태(대형 화면, 제한 없음)로 켠 뒤 접으면 커버 화면이 폰 크기인데도 가로 회전이 허용돼
  // 버리므로, 구성이 바뀔 때마다 현재 화면 크기 기준으로 다시 건다. super 호출은 필수(RN 전달).
  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    lockPortraitOnPhones()
  }

  // 알람 울림으로 실행된 경우 잠금화면 위에 끄기 팝업을 띄우고 화면을 켬
  // 폴더블(갤럭시 Z 폴드 등) 폴더를 닫아 커버 화면으로 전환되는 경우에도 안정적으로 뜨도록
  // 레거시 WindowManager 플래그 + Android 8.1+ 권장 Activity API를 함께 사용
  private fun applyRingingWindowFlags(intent: Intent?) {
    if (intent?.getBooleanExtra("alarmRinging", false) != true) return
    // 이미 끝난 울림의 인텐트면 걸지 않는다(1.6.2) — 최근 앱 재진입·울린 직후 끈 뒤 늦게 도착한 인텐트
    if (isStaleRingingIntent(intent)) {
      intent.removeExtra("alarmRinging")
      if (ringingFlagsAt > 0) clearRingingWindowFlags()
      return
    }
    window.addFlags(
      WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
      WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
      WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
    )
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    }
    ringingFlagsAt = System.currentTimeMillis()
    // requestDismissKeyguard()는 호출하지 않음 — 보안 잠금(패턴/지문)이 걸려 있으면
    // 끄기 화면 대신 인증 화면(바운서)을 강제로 띄워버려서 오히려 알람을 끌 수 없게 됨.
    // setShowWhenLocked만으로 잠금화면 위에 그대로 떠야 함 (언락 불필요).
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
