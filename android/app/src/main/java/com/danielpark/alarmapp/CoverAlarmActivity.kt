package com.danielpark.alarmapp

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.window.OnBackInvokedCallback
import android.window.OnBackInvokedDispatcher
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

// 폴더블(갤럭시 Z 플립 등)을 접어서 커버 디스플레이로 전환된 상태에서 알람이 울릴 때 띄우는
// 전용 화면. React Native MainActivity를 커버 디스플레이(보통 매우 작은 해상도)에 그대로 띄우면
// 기존에 메인 디스플레이 크기로 측정된 RN 루트뷰가 재측정에 실패해 창이 즉시 stopped 처리되어
// 아무것도 보이지 않는 문제가 있어, RN 없이 순수 네이티브 화면을 사용한다(1.6.3부터 JS 울림 화면과 같은 카드 모양).
class CoverAlarmActivity : Activity() {
    private var alarmId: Int = -1
    private var backBlocker: Any? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        instance = java.lang.ref.WeakReference(this)
        alarmId = intent?.getIntExtra("alarmId", -1) ?: -1
        val title = intent?.getStringExtra("title") ?: NativeStrings.get(this, "appName", "교대알람")

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

        setContentView(buildRingCard(title))
        blockBack()
    }

    // ── 1.6.3 울림 카드(docs/시안/울림화면-카드-시안.html "바꿀 모양", JS AlarmRinging.tsx와 같은 모양) ─────────────
    // 밤하늘 바탕(정적 — 애니메이션·블러 없음, 저사양 32 기준) 위 어둡게 + 가운데 카드: 앱 이름 → 근무 이름 → 근무일 날짜 → 보라 원 끄기 → "5분 후 다시".
    // 시간·이모지는 넣지 않는다. 카드 밖을 눌러도 아무 일 없다. 플립 커버처럼 아주 작은 화면은 글자·버튼을 줄이고,
    // 그래도 넘치면 잘리지 않게 스크롤로 감싼다.
    private fun buildRingCard(rawTitle: String): View {
        val d = resources.displayMetrics.density
        val hDp = resources.displayMetrics.heightPixels / d
        val wDp = resources.displayMetrics.widthPixels / d
        val tiny = hDp < 300 || wDp < 200
        val short = !tiny && hDp < 480
        fun dp(v: Float) = (v * d).toInt()
        fun pick(big: Float, mid: Float, small: Float) = if (tiny) small else if (short) mid else big

        val sky = FrameLayout(this).apply {
            background = GradientDrawable().apply {
                gradientType = GradientDrawable.RADIAL_GRADIENT
                colors = intArrayOf(Color.parseColor("#1d1850"), Color.parseColor("#0d0b26"))
                setGradientCenter(0.5f, 0.2f)
                gradientRadius = maxOf(resources.displayMetrics.widthPixels, resources.displayMetrics.heightPixels) * 0.6f
            }
        }
        // 작은 별 몇 개(위치는 화면 비율) — 정적
        val stars = listOf(0.13f to 0.10f, 0.73f to 0.07f, 0.40f to 0.16f, 0.83f to 0.19f, 0.20f to 0.81f, 0.67f to 0.87f, 0.53f to 0.76f)
        val sw = resources.displayMetrics.widthPixels; val sh = resources.displayMetrics.heightPixels
        for ((fx, fy) in stars) {
            sky.addView(View(this).apply {
                background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(Color.WHITE) }
                alpha = 0.7f
            }, FrameLayout.LayoutParams(dp(2f), dp(2f)).apply { leftMargin = (sw * fx).toInt(); topMargin = (sh * fy).toInt() })
        }
        // 카드 뒤 어둡게
        sky.addView(View(this).apply { setBackgroundColor(Color.parseColor("#66000000")) },
            FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))

        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#16133a")); cornerRadius = pick(24f, 20f, 14f) * d
                setStroke(dp(1f), Color.parseColor("#2e2870"))
            }
            val ph = dp(pick(18f, 14f, 8f)); val pt = dp(pick(22f, 16f, 8f)); val pb = dp(pick(20f, 14f, 8f))
            setPadding(ph, pt, ph, pb)
        }
        // 앱 아이콘 + "교대알람"(작게, #b3abff)
        val appRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER
            val sz = dp(pick(18f, 16f, 12f))
            try {
                addView(ImageView(this@CoverAlarmActivity).apply { setImageDrawable(packageManager.getApplicationIcon(packageName)) },
                    LinearLayout.LayoutParams(sz, sz).apply { rightMargin = dp(6f) })
            } catch (_: Exception) {}
            addView(TextView(this@CoverAlarmActivity).apply {
                text = NativeStrings.get(this@CoverAlarmActivity, "appName", "교대알람")
                setTextColor(Color.parseColor("#b3abff")); textSize = pick(13f, 12f, 10f); maxLines = 1
            })
        }
        card.addView(appRow)
        // 근무 이름(가장 크게) — 아이콘을 뗀 알람 제목
        card.addView(TextView(this).apply {
            text = ringTitle(rawTitle)
            setTextColor(Color.WHITE); typeface = Typeface.DEFAULT_BOLD; gravity = Gravity.CENTER
            maxLines = 2
            val big = pick(28f, 22f, 16f)
            textSize = big
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                setAutoSizeTextTypeUniformWithConfiguration(10, big.toInt(), 1, TypedValue.COMPLEX_UNIT_SP)
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            topMargin = dp(pick(14f, 10f, 4f)); bottomMargin = dp(pick(4f, 2f, 1f))
        })
        // 근무일 날짜
        val date = ringDateLabel(intent?.getStringExtra("workDate") ?: AlarmService.currentRinging?.workDate)
        if (date.isNotEmpty()) card.addView(TextView(this).apply {
            text = date; setTextColor(Color.parseColor("#aaa6d6")); textSize = pick(14f, 13f, 10f); gravity = Gravity.CENTER; maxLines = 2
        })
        // 보라 원 끄기(약 68dp, 빛 테두리)
        val offSize = dp(pick(68f, 60f, 44f)); val glow = dp(pick(4f, 4f, 3f))
        val offRing = FrameLayout(this).apply {
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(Color.parseColor("#337c6cf6")) }
            setPadding(glow, glow, glow, glow)
        }
        val offBtn = TextView(this).apply {
            text = NativeStrings.get(this@CoverAlarmActivity, "stop", "끄기")
            setTextColor(Color.WHITE); typeface = Typeface.DEFAULT_BOLD; gravity = Gravity.CENTER; maxLines = 1
            val big = pick(15f, 14f, 12f)
            textSize = big
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                setAutoSizeTextTypeUniformWithConfiguration(8, big.toInt(), 1, TypedValue.COMPLEX_UNIT_SP)
            val p = dp(6f); setPadding(p, p, p, p)
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(Color.parseColor("#7c6cf6")) }
            isClickable = true
            setOnClickListener { stopAlarmAndFinish() }
        }
        offRing.addView(offBtn, FrameLayout.LayoutParams(offSize, offSize))
        card.addView(offRing, LinearLayout.LayoutParams(offSize + glow * 2, offSize + glow * 2).apply { topMargin = dp(pick(26f, 18f, 8f)) })
        // "5분 후 다시" 알약 — 기존 네이티브 스누즈(AlarmService.ACTION_SNOOZE)
        card.addView(TextView(this).apply {
            text = NativeStrings.get(this@CoverAlarmActivity, "snooze", "{n}분 후 다시").replace("{n}", AlarmService.SNOOZE_MINUTES.toString())
            setTextColor(Color.parseColor("#cfcaff")); textSize = pick(12f, 12f, 10f); gravity = Gravity.CENTER; maxLines = 1
            background = GradientDrawable().apply {
                cornerRadius = 20f * d; setStroke(dp(1f), Color.parseColor("#3a3480")); setColor(Color.TRANSPARENT)
            }
            setPadding(dp(pick(14f, 12f, 10f)), dp(pick(6f, 5f, 4f)), dp(pick(14f, 12f, 10f)), dp(pick(6f, 5f, 4f)))
            isClickable = true
            setOnClickListener { snoozeAlarmAndFinish() }
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            topMargin = dp(pick(16f, 12f, 6f))
        })

        // 카드 폭: 중간 크기(최대 320dp), 작은 화면은 가장자리 여백만 남기고
        val margin = dp(pick(26f, 16f, 6f))
        val cardW = minOf(resources.displayMetrics.widthPixels - margin * 2, dp(320f))
        val center = FrameLayout(this).apply { setPadding(0, margin, 0, margin) }
        center.addView(card, FrameLayout.LayoutParams(cardW, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER))
        val scroll = ScrollView(this).apply { isFillViewport = true; isVerticalScrollBarEnabled = false; overScrollMode = View.OVER_SCROLL_NEVER }
        scroll.addView(center, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT))
        sky.addView(scroll, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        return sky
    }

    /** 알림 제목("<아이콘> 초번 출근")에서 앞의 알람 아이콘을 떼고 이름만 — src/utils/ringCard.ts ringTitle과 같은 규칙 */
    private fun ringTitle(title: String): String {
        val s = title.trim()
        if (s.isEmpty()) return ""
        val parts = s.split(Regex("\\s+"))
        var i = 0
        while (i < parts.size && !parts[i].codePoints().anyMatch { Character.isLetterOrDigit(it) }) i++
        if (i == 0 || i >= parts.size) return s
        return parts.drop(i).joinToString(" ")
    }

    /** "11월 26일 목요일" — src/utils/ringCard.ts ringDateLabel과 같은 형식(JS가 현재 언어로 넘긴 틀·달·요일 이름) */
    private fun ringDateLabel(workDate: String?): String {
        val m = Regex("""(\d{4})-(\d{2})-(\d{2})""").matchEntire(workDate ?: "") ?: return ""
        val cal = java.util.Calendar.getInstance().apply {
            clear(); set(m.groupValues[1].toInt(), m.groupValues[2].toInt() - 1, m.groupValues[3].toInt())
        }
        val months = NativeStrings.months(this)
        val days = NativeStrings.days(this, listOf("일", "월", "화", "수", "목", "금", "토"))
        return NativeStrings.get(this, "dateFmt", "{month} {d}일 {dow}요일")
            .replace("{month}", months[cal.get(java.util.Calendar.MONTH)])
            .replace("{d}", cal.get(java.util.Calendar.DAY_OF_MONTH).toString())
            .replace("{dow}", days[cal.get(java.util.Calendar.DAY_OF_WEEK) - 1])
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
        if (instance?.get() === this) instance = null
        super.onDestroy()
    }

    companion object {
        /** 지금 맨 앞(resumed)인지 — AlarmService.scheduleKeepFront가 가려졌는지 볼 때 쓴다 */
        @Volatile var inFront = false
            private set

        @Volatile private var instance: java.lang.ref.WeakReference<CoverAlarmActivity>? = null

        /**
         * 울림이 끝났다(AlarmService 끄기·스누즈·서비스 종료) — 떠 있는 커버 울림 화면을 닫는다(1.6.2).
         * 알림 줄 "끄기"·워치로 끄면 이 화면은 onResume을 다시 안 거쳐(가려지지 않았으므로) 잠금 위에 남을 수 있었다.
         */
        fun onRingingEnded() {
            val a = instance?.get() ?: return
            a.runOnUiThread { if (!a.isFinishing) a.finish() }
        }
    }

    // "5분 후 다시" — 기존 네이티브 스누즈 한 길(AlarmService.ACTION_SNOOZE: 울림·보조 울림 정리 → 스누즈 예약 → JS alarmSnoozed)
    private fun snoozeAlarmAndFinish() {
        try {
            startService(Intent(this, AlarmService::class.java).apply {
                action = AlarmService.ACTION_SNOOZE
                putExtra("alarmId", alarmId)
            })
        } catch (e: Exception) { e.printStackTrace() }
        finish()
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
