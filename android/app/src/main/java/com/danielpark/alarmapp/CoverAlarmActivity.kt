package com.danielpark.alarmapp

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.WindowManager
import android.window.OnBackInvokedCallback
import android.window.OnBackInvokedDispatcher
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

// 폴더블(갤럭시 Z 플립 등)을 접어서 커버 디스플레이로 전환된 상태에서 알람이 울릴 때 띄우는
// 전용 화면. React Native MainActivity를 커버 디스플레이(보통 매우 작은 해상도)에 그대로 띄우면
// 기존에 메인 디스플레이 크기로 측정된 RN 루트뷰가 재측정에 실패해 창이 즉시 stopped 처리되어
// 아무것도 보이지 않는 문제가 있어, RN 없이 "끄기" 버튼 하나만 있는 순수 네이티브 화면을 사용한다.
class CoverAlarmActivity : Activity() {
    private var alarmId: Int = -1
    private var backBlocker: Any? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        alarmId = intent?.getIntExtra("alarmId", -1) ?: -1
        val title = intent?.getStringExtra("title") ?: "⏰ 알람"

        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
        // 메인 디스플레이에서는 requestDismissKeyguard()가 보안 잠금 인증 화면(바운서)을
        // 강제로 띄우는 부작용이 있어 MainActivity에서는 빼두었지만, 커버 디스플레이의
        // 글랜스 화면은 메인 보안 잠금과 다른 레이어라 다르게 동작할 가능성이 있어 시도해본다.
        //
        // 잠금해제 전(Direct Boot) 구간에는 이 화면이 기본 디스플레이에도 뜨는데, 그때는
        // 해제를 요청하면 바운서가 알람 화면을 덮어버린다 — 호출부가 넘긴 값으로 구분한다.
        if (intent.getBooleanExtra("dismissKeyguard", true)) {
            try {
                (getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager)
                    ?.requestDismissKeyguard(this, null)
            } catch (e: Exception) { e.printStackTrace() }
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.BLACK)
            setPadding(24, 12, 24, 12)
        }
        val titleView = TextView(this).apply {
            text = title
            setTextColor(Color.WHITE)
            textSize = 14f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
        }
        val stopButton = Button(this).apply {
            text = NativeStrings.get(this@CoverAlarmActivity, "stop", "끄기")
            textSize = 16f
            setOnClickListener { stopAlarmAndFinish() }
        }
        root.addView(titleView, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            bottomMargin = 8
        })
        root.addView(stopButton, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        setContentView(root)
        blockBack()
    }

    /**
     * 울리는 동안 뒤로 가기로 이 화면이 닫히면 소리·진동은 계속되는데 끌 곳이 안 보인다(세이람 "알람이 숨어 버림" 보고).
     * → 울리는 중에는 뒤로 가기를 무시한다. 이미 꺼졌으면(알림 버튼·워치 등 다른 경로) 닫는다.
     * 매니페스트가 enableOnBackInvokedCallback="false"라 지금은 onBackPressed로 오지만, 켜질 때를 위해 콜백도 건다.
     */
    private fun blockBack() {
        if (Build.VERSION.SDK_INT >= 33) {
            try {
                val cb = OnBackInvokedCallback { if (AlarmService.currentRinging == null) finish() }
                onBackInvokedDispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, cb)
                backBlocker = cb
            } catch (e: Exception) { e.printStackTrace() }
        }
    }

    @Deprecated("Android 13 미만·예측형 뒤로 가기를 안 쓰는 경우의 뒤로 가기")
    @Suppress("DEPRECATION", "MissingSuperCall")
    override fun onBackPressed() {
        // 울리는 중에는 닫지 않는다(super를 부르지 않음). 이미 꺼졌으면 남아 있을 이유가 없으니 닫는다.
        if (AlarmService.currentRinging == null) finish()
    }

    override fun onResume() {
        super.onResume()
        // 다른 경로(알림 버튼·워치 등)로 이미 꺼졌으면 낡은 끄기 화면을 남기지 않는다 — 뒤로 가기를 막았으므로 꼭 필요
        if (AlarmService.currentRinging == null) { finish(); return }
        inFront = true
    }

    override fun onPause() {
        inFront = false
        super.onPause()
    }

    override fun onDestroy() {
        if (Build.VERSION.SDK_INT >= 33) {
            (backBlocker as? OnBackInvokedCallback)?.let {
                try { onBackInvokedDispatcher.unregisterOnBackInvokedCallback(it) } catch (_: Exception) {}
            }
        }
        backBlocker = null
        super.onDestroy()
    }

    companion object {
        /** 지금 맨 앞(resumed)인지 — AlarmService.scheduleKeepFront가 가려졌는지 볼 때 쓴다 */
        @Volatile var inFront = false
            private set
    }

    private fun stopAlarmAndFinish() {
        try {
            startService(Intent(this, AlarmService::class.java).apply {
                action = AlarmService.ACTION_STOP
                putExtra("alarmId", alarmId)
            })
        } catch (e: Exception) { e.printStackTrace() }
        finish()
    }
}
