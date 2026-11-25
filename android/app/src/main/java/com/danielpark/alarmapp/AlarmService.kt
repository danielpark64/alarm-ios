package com.danielpark.alarmapp

import android.app.*
import android.content.Context
import android.content.Intent
import android.hardware.display.DisplayManager
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.UserManager
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import android.view.Display
import androidx.core.app.NotificationCompat
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments

class AlarmService : Service() {

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var fadeHandler: Handler? = null
    private var fadeRunnable: Runnable? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val alarmId = intent?.getIntExtra("alarmId", -1) ?: -1

        when (intent?.action) {
            ACTION_STOP -> {
                cancelReps(alarmId)
                stopRinging()
                cancelPendingRingLaunch()
                cancelCoverRelaunch()
                cancelKeepFront()
                notifyStopped(currentRinging)
                currentRinging = null
                onRingingEnded()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_SNOOZE -> {
                val title = intent.getStringExtra(EXTRA_TITLE) ?: "⏰ 알람"
                val body  = intent.getStringExtra(EXTRA_BODY)  ?: ""
                val soundOn = intent.getBooleanExtra("soundOn", true)
                val vibOn   = intent.getBooleanExtra("vibOn", true)
                val volume  = intent.getFloatExtra("volume", 1f)
                // 스누즈 재알림도 같은 소리 — JS snoozeAlarm 경로엔 extra가 없으니 지금 울리던 소리를 쓴다
                val tone      = intent.getStringExtra("tone") ?: ringingTone
                val crescendo = if (intent.hasExtra("crescendo")) intent.getBooleanExtra("crescendo", false) else ringingCrescendo
                cancelReps(alarmId)
                stopRinging()
                cancelPendingRingLaunch()
                cancelCoverRelaunch()
                cancelKeepFront()
                // 스누즈는 notifyStopped를 보내지 않는다 — 스누즈 진입점은 JS snoozeRinging 하나뿐이고
                // 그쪽이 Expo rep 취소를 이미 직접 한다. 여기서 alarmStopped를 보내면 '한 번' 알람이
                // 비활성화되어 rescheduleAll → cancelNativeAlarms가 방금 건 SNOOZE_REQUEST_CODE까지 지운다.
                currentRinging = null
                onRingingEnded()
                stopForeground(STOP_FOREGROUND_REMOVE)
                scheduleSnooze(title, body, soundOn, vibOn, volume, tone, crescendo)
                stopSelf()
                return START_NOT_STICKY
            }
        }

        val title   = intent?.getStringExtra(EXTRA_TITLE) ?: "⏰ 알람"
        val body    = intent?.getStringExtra(EXTRA_BODY)  ?: ""
        val soundOn = intent?.getBooleanExtra("soundOn", true) ?: true
        val vibOn   = intent?.getBooleanExtra("vibOn", true) ?: true
        val volume  = intent?.getFloatExtra("volume", 1f) ?: 1f
        val baseAlarmId = intent?.getIntExtra("baseAlarmId", -1) ?: -1
        val tone      = intent?.getStringExtra("tone") ?: AlarmTones.DEFAULT
        val crescendo = intent?.getBooleanExtra("crescendo", false) ?: false
        ringingTone = tone
        ringingCrescendo = crescendo
        // 이번 울림의 시작 시각 — 울림 인텐트에 실어 보내, 끈 뒤에 늦게 도착한 인텐트를 MainActivity가 알아본다(1.6.2)
        ringStartedAt = maxOf(System.currentTimeMillis(), lastRingEndedAt + 1)

        startForeground(NOTIFICATION_ID, buildNotification(title, body, alarmId, soundOn, vibOn, volume, tone, crescendo))
        startRinging(soundOn, vibOn, volume, tone, crescendo)
        currentRinging = RingingInfo(title, body, alarmId, baseAlarmId)
        emitRingingEvent(title, body, alarmId, baseAlarmId)
        bringRingingActivityToFront(title, alarmId)
        return START_STICKY
    }

    // 잠금/배경/타앱 사용 중 어떤 상태든 끄기 팝업을 화면 맨 앞으로 즉시 띄움
    // (AlarmManager 발화 직후 포그라운드 서비스 시작 시점은 백그라운드 액티비티 실행 제한의 예외에 해당)
    //
    // 폴더블(갤럭시 Z 플립 등)을 접은 상태에서 알람이 울리면 메인 디스플레이(기본, 0번)는
    // 접혀서 안 보이고 별도의 커버 디스플레이가 대신 켜진다. 이 전환에 걸리는 시간이
    // 매번 달라(약 100~400ms) 고정 딜레이로는 못 맞추는 경우가 있어, DisplayListener로
    // 커버 디스플레이가 실제로 켜지는 시점을 감지해서 그 디스플레이로 띄운다.
    // 일정 시간 내에 커버 디스플레이가 켜지지 않으면(=폴더가 닫혀있지 않은 일반적인 경우)
    // 기본 디스플레이로 띄운다.
    private var ringingDisplayListener: DisplayManager.DisplayListener? = null
    // 기다렸다 띄우기(1200ms 뒤 기본 화면) — 울린 직후 끄면 취소해야 한다(cancelPendingRingLaunch)
    private val ringLaunchHandler = Handler(Looper.getMainLooper())
    private var ringLaunchTimeout: Runnable? = null

    /**
     * 아직 실행 안 된 울림 화면 띄우기를 취소한다(1.6.2) — 끄기·스누즈·onDestroy 세 곳에서 부른다.
     * 워치·알림 버튼으로 울린 지 1.2초 안에 끄면 예전엔 이 대기가 남아 끈 뒤에 MainActivity가 잠금 위로 다시 떴다.
     */
    private fun cancelPendingRingLaunch() {
        ringLaunchTimeout?.let { ringLaunchHandler.removeCallbacks(it) }
        ringLaunchTimeout = null
        ringingDisplayListener?.let {
            try { (getSystemService(Context.DISPLAY_SERVICE) as DisplayManager).unregisterDisplayListener(it) } catch (_: Exception) {}
        }
        ringingDisplayListener = null
    }

    private fun bringRingingActivityToFront(title: String, alarmId: Int) {
        val dm = getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
        val handler = ringLaunchHandler
        cancelPendingRingLaunch() // 앞 울림의 대기가 남아 있으면 정리
        var launched = false
        val token = ringStartedAt

        // 폴더가 닫혀 커버 디스플레이로 알람을 띄우는 경우, RN 기반 MainActivity는
        // 작은 커버 디스플레이에서 윈도우 재측정에 실패해 화면이 비어 보이는 문제가 있어
        // 대신 순수 네이티브 화면(CoverAlarmActivity, 끄기 버튼만 있음)을 띄운다.
        fun launch(displayId: Int?) {
            if (launched) return
            launched = true
            cancelPendingRingLaunch()
            // 띄우기 직전 재확인 — 그사이 꺼졌거나(스누즈 포함) 다른 울림으로 바뀌었으면 띄우지 않는다
            if (currentRinging == null || ringStartedAt != token) return
            try {
                val isCoverDisplay = displayId != null && displayId != Display.DEFAULT_DISPLAY
                // 잠금해제 전에는 MainActivity(RN)가 directBootAware가 아니라 실행 자체가 막힌다
                // (ActivityNotFoundException이 아래 catch에 조용히 삼켜져서 화면도 안 켜지고
                //  끄기 UI도 없는 상태가 됐음). 그 구간엔 네이티브 화면으로 대체한다.
                val intent = ringScreenIntent(alarmId, title, isCoverDisplay)
                val options = ActivityOptions.makeBasic()
                displayId?.let { options.setLaunchDisplayId(it) }
                startActivity(intent, options.toBundle())
                // 커버 디스플레이는 몇 초 지나면 삼성 자체 AOD 화면으로 강제 전환되어
                // 끄기 버튼이 화면 밖으로 밀려나므로, 알람이 꺼질 때까지 주기적으로
                // 다시 앞으로 띄워서 사용자가 끄기를 누를 기회를 계속 준다.
                if (isCoverDisplay) scheduleCoverRelaunch(alarmId, title, displayId!!)
            } catch (e: Exception) { e.printStackTrace() }
            // 기본 화면: 울리는 동안 홈 버튼·다른 앱에 가려지면 다시 맨 앞으로 올린다(커버 화면은 위의 재표시가 맡는다)
            if (displayId == null || displayId == Display.DEFAULT_DISPLAY) scheduleKeepFront(alarmId, title)
        }

        val alreadyOn = findRingingTargetDisplayId(dm)
        if (alreadyOn != null) { launch(alreadyOn); return }

        // 커버 디스플레이는 OFF -> DOZE -> ON 순서로 전환되며, DOZE 단계에서 이미
        // 화면이 사실상 켜지는 절차가 시작된 것이므로 ON까지 기다리지 않고 DOZE에서도 띄운다
        // (ON만 기다리면 타임아웃이 ON 전환보다 먼저 발동해 기본 디스플레이로 떨어지는 경우가 있었음).
        val listener = object : DisplayManager.DisplayListener {
            override fun onDisplayAdded(displayId: Int) {}
            override fun onDisplayRemoved(displayId: Int) {}
            override fun onDisplayChanged(displayId: Int) {
                if (displayId == Display.DEFAULT_DISPLAY) return
                val d = dm.getDisplay(displayId) ?: return
                if (d.state != Display.STATE_OFF) launch(displayId)
            }
        }
        ringingDisplayListener = listener
        dm.registerDisplayListener(listener, handler)
        val timeout = Runnable { launch(null) }
        ringLaunchTimeout = timeout
        handler.postDelayed(timeout, 1200L)
    }

    // 폴더블(갤럭시 Z 플립 등)을 접으면 기본 디스플레이(메인 화면)는 꺼지고
    // 별도의 커버 디스플레이가 켜진다. 기본 디스플레이로만 액티비티를 띄우면
    // 접힌 상태에서는 끄기 화면이 보이지 않으므로, 현재 켜져 있는 디스플레이 중
    // 기본 디스플레이가 아닌 것(커버 화면)이 있으면 그쪽을 우선 타겟한다.
    private fun findRingingTargetDisplayId(dm: DisplayManager): Int? {
        return try {
            val onDisplays = dm.displays.filter { it.state != Display.STATE_OFF }
            val cover = onDisplays.firstOrNull { it.displayId != Display.DEFAULT_DISPLAY }
            cover?.displayId
        } catch (e: Exception) { null }
    }

    /**
     * 울림 화면 인텐트. 커버 화면이거나 잠금해제 전(Direct Boot — MainActivity(RN)는 directBootAware가 아니라
     * 실행 자체가 막힌다)이면 네이티브 화면(CoverAlarmActivity), 아니면 앱 본 화면(MainActivity) 위의 RN 끄기 모달.
     */
    private fun ringScreenIntent(alarmId: Int, title: String, isCoverDisplay: Boolean): Intent {
        val locked = getSystemService(UserManager::class.java)?.isUserUnlocked == false
        return if (isCoverDisplay || locked) {
            Intent(this, CoverAlarmActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                putExtra("alarmId", alarmId)
                putExtra("title", title)
                // 기본 디스플레이에서 키가드 해제를 요청하면 보안 잠금 바운서가 떠서
                // 알람 화면을 가린다 — 커버 화면일 때만 해제를 요청하게 알려준다.
                putExtra("dismissKeyguard", isCoverDisplay)
            }
        } else {
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("alarmRinging", true)
                putExtra("ringAt", ringStartedAt)
            }
        }
    }

    // ── 가려지면 다시 맨 앞으로(1.6.1, 세이람 0eb9d8b 이식) ──
    private var keepFrontRunnable: Runnable? = null

    /**
     * 울리는 동안에만 KEEP_FRONT_INTERVAL_MS마다 "울림 화면이 맨 앞인가"를 보고, 홈 버튼·다른 앱에 가려졌으면 다시 올린다
     * (세이람 사용자 보고 "알람이 숨어 버림" — 소리는 계속인데 끌 곳이 안 보임).
     * 울림이 끝나면(끄기·스누즈·서비스 종료) cancelKeepFront가 멈춘다 — 끈 뒤에는 절대 튀어나오지 않는다.
     * 화면이 꺼져 있으면(전원 버튼) 다시 켜지 않고, 통화 중이면 통화 화면을 덮지 않는다.
     * "다른 앱 위에 표시"가 없으면 백그라운드에서 띄울 수 없으므로(Android 10+, 예외 없이 조용히 막힘) 돌리지 않는다.
     */
    private fun scheduleKeepFront(alarmId: Int, title: String) {
        cancelKeepFront()
        if (!canDrawOverlays()) return
        val dm = getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
        val r = object : Runnable {
            override fun run() {
                if (currentRinging == null) return
                // 펼쳐서 울리다 접은 플립처럼 커버 화면이 켜져 있으면 기본 화면에 다시 띄우지 않는다
                val coverOn = findRingingTargetDisplayId(dm) != null
                val shown = MainActivity.inFront || CoverAlarmActivity.inFront
                if (!shown && coverRelaunchRunnable == null && !coverOn && isScreenOn() && !inCall()) {
                    try {
                        startActivity(ringScreenIntent(alarmId, title, false))
                    } catch (e: Exception) { e.printStackTrace() }
                }
                coverRelaunchHandler.postDelayed(this, KEEP_FRONT_INTERVAL_MS)
            }
        }
        keepFrontRunnable = r
        coverRelaunchHandler.postDelayed(r, KEEP_FRONT_INTERVAL_MS)
    }

    private fun cancelKeepFront() {
        keepFrontRunnable?.let { coverRelaunchHandler.removeCallbacks(it) }
        keepFrontRunnable = null
    }

    private fun isScreenOn(): Boolean =
        try { (getSystemService(Context.POWER_SERVICE) as PowerManager).isInteractive } catch (_: Exception) { true }

    private fun inCall(): Boolean = try {
        val mode = (getSystemService(Context.AUDIO_SERVICE) as AudioManager).mode
        mode == AudioManager.MODE_IN_CALL || mode == AudioManager.MODE_IN_COMMUNICATION || mode == AudioManager.MODE_RINGTONE
    } catch (_: Exception) { false }

    private fun canDrawOverlays(): Boolean =
        try { Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(this) } catch (_: Exception) { false }

    private fun hasMultipleDisplays(): Boolean =
        try { (getSystemService(Context.DISPLAY_SERVICE) as DisplayManager).displays.size > 1 } catch (_: Exception) { false }

    private val coverRelaunchHandler = Handler(Looper.getMainLooper())
    private var coverRelaunchRunnable: Runnable? = null

    // 커버 디스플레이는 사용자 인터랙션 없이 몇 초가 지나면 삼성 AOD 화면으로 자동 전환되어
    // 끄기 버튼이 화면 밖으로 밀려난다. 알람이 멈출 때까지 일정 간격으로 CoverAlarmActivity를
    // 다시 앞으로 띄워서 AOD 전환 타이머를 계속 리셋시키고, 사용자에게 끄기를 누를 기회를 준다.
    private fun scheduleCoverRelaunch(alarmId: Int, title: String, displayId: Int) {
        cancelCoverRelaunch()
        val runnable = object : Runnable {
            override fun run() {
                if (currentRinging == null) return
                try {
                    val intent = Intent(this@AlarmService, CoverAlarmActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                        putExtra("alarmId", alarmId)
                        putExtra("title", title)
                    }
                    val options = ActivityOptions.makeBasic().apply { setLaunchDisplayId(displayId) }
                    startActivity(intent, options.toBundle())
                } catch (e: Exception) { e.printStackTrace() }
                coverRelaunchHandler.postDelayed(this, COVER_RELAUNCH_INTERVAL_MS)
            }
        }
        coverRelaunchRunnable = runnable
        coverRelaunchHandler.postDelayed(runnable, COVER_RELAUNCH_INTERVAL_MS)
    }

    private fun cancelCoverRelaunch() {
        coverRelaunchRunnable?.let { coverRelaunchHandler.removeCallbacks(it) }
        coverRelaunchRunnable = null
    }

    // 사용자가 끄기/스누즈 시 남은 +1분/+2분 rep 슬롯 즉시 취소
    // alarmId는 JS의 alarm.id(expo 알림 경로) 또는 mainNativeId/weekdaySlotId로 합성된
    // 네이티브 requestCode(AlarmService 자체 ringing 경로) 둘 중 하나일 수 있어
    // 가능한 모든 조합을 시도해 실제 예약된 rep PendingIntent를 찾아 취소함
    private fun cancelReps(alarmId: Int) {
        if (alarmId < 0) return
        val am = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val candidates = mutableListOf(alarmId)
        for (idx in 0..13) candidates.add(AlarmIds.mainNativeId(alarmId, idx))
        for (day in 0..6) candidates.add(AlarmIds.weekdaySlotId(alarmId, day))
        for (base in candidates) {
            for (repIdx in 1..2) {
                val code = AlarmIds.repSlotId(base, repIdx)
                val pi = PendingIntent.getBroadcast(
                    this, code,
                    Intent(this, AlarmReceiver::class.java),
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_NO_CREATE
                )
                if (pi != null) {
                    am.cancel(pi); pi.cancel()
                }
            }
        }
    }

    /**
     * 네이티브 경로(상시 알림의 "끄기" 버튼 — 워치로 브릿지되는 것도 이 버튼 —, 커버 화면 "끄기")로
     * 알람을 끄면 JS는 그 사실을 모른다. 그런데 +1분/+2분 재알림 중 Expo 쪽(grp_{h}_{m}_rep1/2)은
     * JS만 취소할 수 있어서, 인앱 팝업으로 끌 때(cancelExpoGroupReps)와 달리 1분·2분 뒤 두 번 더 울렸다.
     *
     * 두 갈래로 알린다:
     *  1) RN이 살아 있으면 alarmStopped 이벤트 즉시 전달
     *  2) RN이 죽어 있을 수 있으니 "마지막으로 끈 알람"을 prefs에도 남겨, JS가 다음 포그라운드 때
     *     AlarmModule.consumeLastStopped로 읽어 처리(rep 발화는 1~2분 뒤라 그 안에 앱이 열려야 효과가 있다)
     * body는 원래 시각 문구 그대로다 — cancelExpoGroupReps가 이걸 파싱해 rep 식별자를 만든다(core.ts 주석 참고).
     */
    private fun notifyStopped(info: RingingInfo?) {
        if (info == null) return
        try {
            getSharedPreferences(PREFS_STOPPED, Context.MODE_PRIVATE).edit()
                .putString("body", info.body)
                .putInt("baseAlarmId", info.baseAlarmId)
                .putLong("at", System.currentTimeMillis())
                .apply()
        } catch (e: Exception) { e.printStackTrace() }
        if (getSystemService(UserManager::class.java)?.isUserUnlocked == false) return
        try {
            val reactContext = (applicationContext as? ReactApplication)
                ?.reactHost?.currentReactContext ?: return
            val params = Arguments.createMap().apply {
                putString("body", info.body)
                putInt("baseAlarmId", info.baseAlarmId)
            }
            reactContext.emitDeviceEvent("alarmStopped", params)
        } catch (e: Exception) { e.printStackTrace() }
    }

    // 포그라운드 JS로 알람 울림 이벤트 전달 (인앱 끄기/스누즈 UI 표시용)
    private fun emitRingingEvent(title: String, body: String, alarmId: Int, baseAlarmId: Int) {
        // 잠금해제 전(Direct Boot)에는 RN이 붙을 수 없어 어차피 no-op이다. 그런데 reactHost가
        // by lazy라 여기서 건드리는 순간 잠긴 상태에서 ReactHost 전체가 생성되면서
        // startForeground 5초 제한을 갉아먹는다. 잠겨 있으면 아예 만지지 않는다.
        // (이 구간에 놓친 이벤트는 잠금 해제 후 getCurrentRinging 복구 흐름이 메운다)
        if (getSystemService(UserManager::class.java)?.isUserUnlocked == false) return
        try {
            val reactContext = (applicationContext as? ReactApplication)
                ?.reactHost?.currentReactContext ?: return
            val params = Arguments.createMap().apply {
                putString("title", title)
                putString("body", body)
                putInt("alarmId", alarmId)
                putInt("baseAlarmId", baseAlarmId)
            }
            reactContext.emitDeviceEvent("alarmRinging", params)
        } catch (e: Exception) { e.printStackTrace() }
    }

    // tone: 알람마다 고른 소리(AlarmTones). crescendo: 점점 크게 — 켜면 아주 작게 시작해 20초 동안 키운다.
    // 꺼져 있으면 예전과 똑같이 15%에서 15초 동안 올린다(기존 동작 그대로).
    private fun startRinging(soundOn: Boolean, vibOn: Boolean, volume: Float = 1f, tone: String = AlarmTones.DEFAULT, crescendo: Boolean = false) {
        val targetVolume = volume.coerceIn(0f, 1f)
        val fadeStart = if (crescendo) CRESCENDO_START_VOLUME else FADE_START_VOLUME
        val fadeMs = if (crescendo) CRESCENDO_DURATION_MS else FADE_DURATION_MS
        if (soundOn && mediaPlayer?.isPlaying != true) {
            try {
                mediaPlayer = MediaPlayer().apply {
                    setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                    val afd = resources.openRawResourceFd(AlarmTones.rawRes(tone))
                    setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
                    afd.close()
                    isLooping = true
                    prepare()
                    val startVolume = fadeStart.coerceAtMost(targetVolume)
                    setVolume(startVolume, startVolume)
                    start()
                }
                startVolumeFade(targetVolume, fadeStart, fadeMs)
            } catch (e: Exception) { e.printStackTrace() }
        }

        // 진동
        if (vibOn) {
            try {
                vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
                } else {
                    @Suppress("DEPRECATION")
                    getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                }
                val pattern = longArrayOf(0, 500, 300, 500, 300, 500)
                // USAGE_ALARM을 지정해야 무음/진동 끔 등 링거 모드 설정과 무관하게 항상 진동이 동작함
                val alarmAttrs = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0), alarmAttrs)
                } else {
                    @Suppress("DEPRECATION")
                    vibrator?.vibrate(pattern, 0)
                }
            } catch (e: Exception) { e.printStackTrace() }
        }
    }

    // 알람 소리를 작게 시작해서 점점 사용자가 설정한 최대 볼륨까지 올림
    private fun startVolumeFade(targetVolume: Float, fadeStart: Float = FADE_START_VOLUME, fadeMs: Long = FADE_DURATION_MS) {
        val handler = Handler(Looper.getMainLooper())
        val totalSteps = (fadeMs / FADE_STEP_MS).toInt()
        val startVolume = fadeStart.coerceAtMost(targetVolume)
        var step = 0
        val runnable = object : Runnable {
            override fun run() {
                step++
                val volume = (startVolume + (targetVolume - startVolume) * step / totalSteps).coerceAtMost(targetVolume)
                mediaPlayer?.setVolume(volume, volume)
                if (step < totalSteps) handler.postDelayed(this, FADE_STEP_MS)
            }
        }
        fadeHandler = handler
        fadeRunnable = runnable
        handler.postDelayed(runnable, FADE_STEP_MS)
    }

    private fun stopRinging() {
        fadeRunnable?.let { fadeHandler?.removeCallbacks(it) }
        fadeHandler = null
        fadeRunnable = null
        mediaPlayer?.stop()
        mediaPlayer?.release()
        mediaPlayer = null
        vibrator?.cancel()
        vibrator = null
    }

    // 의도적으로 AlarmStore 원장에 기록하지 않는다 — 스누즈는 수명 5분짜리 일회성 예약이라
    // 부팅 복구 대상이 아니고, 매 rescheduleAll이 지우는 대상이라 원장에 넣으면 정합성만 나빠진다.
    // 절충: 스누즈 대기 중에 재부팅하면 그 스누즈는 사라진다(원래 알람 예약은 정상 복구됨).
    private fun scheduleSnooze(title: String, body: String, soundOn: Boolean, vibOn: Boolean, volume: Float, tone: String, crescendo: Boolean) {
        val intent = Intent(this, AlarmReceiver::class.java).apply {
            putExtra(EXTRA_TITLE, title)
            putExtra(EXTRA_BODY, body)
            putExtra("recurrence", "once")
            putExtra("soundOn", soundOn)
            putExtra("vibOn", vibOn)
            putExtra("volume", volume)
            putExtra("tone", tone)
            putExtra("crescendo", crescendo)
        }
        val pi = PendingIntent.getBroadcast(
            this, AlarmIds.SNOOZE_REQUEST_CODE, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val am = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val triggerAt = System.currentTimeMillis() + 5 * 60 * 1000L
        AlarmScheduling.schedule(this, am, triggerAt, pi)
    }

    override fun onDestroy() {
        stopRinging()
        cancelPendingRingLaunch()
        cancelCoverRelaunch()
        cancelKeepFront()
        currentRinging = null
        onRingingEnded()
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }
    override fun onBind(intent: Intent?): IBinder? = null

    /**
     * 울림이 끝났을 때 화면 뒷정리(1.6.2) — 끄기·스누즈·서비스 종료 세 곳 모두에서 부른다.
     * MainActivity: 잠금 위 표시(setShowWhenLocked)를 풀어 보안 잠금이면 잠금 화면으로 돌아가게.
     * CoverAlarmActivity: 떠 있으면 닫는다(알림 "끄기"·워치로 끄면 onResume을 다시 안 거쳐 남았다).
     */
    private fun onRingingEnded() {
        // 끝난 시각 — 이보다 먼저 시작된 울림의 인텐트가 늦게 와도 MainActivity가 잠금 위 표시를 걸지 않는다(1.6.2)
        lastRingEndedAt = System.currentTimeMillis()
        try { MainActivity.onRingingEnded() } catch (e: Exception) { e.printStackTrace() }
        try { CoverAlarmActivity.onRingingEnded() } catch (e: Exception) { e.printStackTrace() }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // 채널 이름은 시스템 알림 설정 화면에 보인다. 같은 id로 다시 만들면 이름만 갱신된다(언어 변경 반영).
            val ch = NotificationChannel(CHANNEL_ID, NativeStrings.get(this, "channel", "알람 울림"), NotificationManager.IMPORTANCE_HIGH).apply {
                setSound(null, null)
                enableVibration(false)
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(ch)
        }
    }

    private fun buildNotification(title: String, body: String, alarmId: Int, soundOn: Boolean, vibOn: Boolean, volume: Float, tone: String, crescendo: Boolean): Notification {
        val stopPi = PendingIntent.getService(
            this, 10,
            Intent(this, AlarmService::class.java).apply {
                action = ACTION_STOP
                putExtra("alarmId", alarmId)
            },
            PendingIntent.FLAG_IMMUTABLE
        )
        val snoozePi = PendingIntent.getService(
            this, 11,
            Intent(this, AlarmService::class.java).apply {
                action = ACTION_SNOOZE
                putExtra(EXTRA_TITLE, title); putExtra(EXTRA_BODY, body)
                putExtra("alarmId", alarmId)
                putExtra("soundOn", soundOn)
                putExtra("vibOn", vibOn)
                putExtra("volume", volume)
                putExtra("tone", tone)
                putExtra("crescendo", crescendo)
            },
            PendingIntent.FLAG_IMMUTABLE
        )
        val openPi = PendingIntent.getActivity(
            this, 12,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("alarmRinging", true)
                putExtra("ringAt", ringStartedAt)
            },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val b = NotificationCompat.Builder(this, CHANNEL_ID)
            // 어느 앱 알람인지(1.6.2, 세이람 1.2.3과 같은 "앱 이름 · …" 형식). 이 알림은 아이콘이 시스템 알람 아이콘이고
            // 접힌 상태에선 앱 이름이 안 보여(32 캡처) 제목에 넣는다. 교대알람은 알람 이름(근무 이름)이 가장 중요해
            // 세이람의 "알람이 울리는 중" 대신 알람 제목을 그대로 둔다. 본문(HH:MM …)은 끄기 경로가 읽으므로 건드리지 않는다.
            .setContentTitle("${NativeStrings.get(this, "appName", "교대알람")} · $title")
            .setContentText(body)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentIntent(openPi)
            // 갤럭시 Z 플립 커버 화면의 축소 알림 뷰는 액션이 2개면 커스텀 액션 대신
            // 기본 "앱 열기" 버튼만 보여주는 것으로 보여, 액션을 "끄기" 1개로 줄여 테스트
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, NativeStrings.get(this, "stop", "끄기"), stopPi)
            // ⚠️ setOngoing(true)인 알림은 Wear OS로 브릿지되지 않는다(공식 문서: ongoing/localOnly 제외).
            // 즉 워치에서 보이는 건 이 알림이 아니라 Expo 쪽 알림("알람 끄기" 액션, notifications/index.ts
            // registerNotificationCategories)이다. 워치에서 그 액션을 누르면 Expo 응답 리스너 →
            // AlarmModule.stopAlarm → 여기 ACTION_STOP으로 들어와 같은 뒷정리(notifyStopped)를 거친다.
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        // setFullScreenIntent는 시스템이 디스플레이 지정 없이 즉시 MainActivity를 띄워버려서
        // bringRingingActivityToFront()의 커버 디스플레이 타겟팅 시도보다 먼저 기본 디스플레이에
        // 태스크를 만들어버리는 경쟁 상태를 유발함(폴더 닫힘 시 끄기 화면이 안 보이는 원인) → 접는 폰(화면 둘 이상)은 달지 않는다.
        // 화면이 하나뿐인 일반 폰은 커버와 경쟁할 일이 없으므로 단다(1.6.1, 세이람 0eb9d8b) — "다른 앱 위에 표시"가 꺼져
        // 있거나 직접 띄우기가 어떤 이유로 막혀도 잠금·화면 꺼짐 상태에서는 시스템이 울림 화면을 띄운다.
        // 둘 다 떠도 MainActivity는 singleTask, CoverAlarmActivity는 singleInstance라 화면은 하나다.
        if (!hasMultipleDisplays()) {
            val fullScreenPi = PendingIntent.getActivity(
                this, 13,
                ringScreenIntent(alarmId, title, false),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            b.setFullScreenIntent(fullScreenPi, true)
        }
        return b.build()
    }

    companion object {
        // 현재 울리고 있는 알람 정보 (RN 쪽이 재시작/포그라운드 복귀해도 끄기 팝업을 복구할 수 있도록)
        // alarmId는 합성 requestCode, baseAlarmId는 JS 알람 원본 id(없으면 -1 — 구버전 예약분)
        data class RingingInfo(val title: String, val body: String, val alarmId: Int, val baseAlarmId: Int = -1)
        @Volatile var currentRinging: RingingInfo? = null
        // 지금 울리는 알람의 소리 — JS snoozeAlarm(extra 없음) 경로의 스누즈 재알림이 같은 소리를 쓰게
        @Volatile var ringingTone: String = AlarmTones.DEFAULT
        @Volatile var ringingCrescendo: Boolean = false
        // 울림 시작·끝 시각(1.6.2) — 울림 인텐트의 ringAt이 lastRingEndedAt 이하면 이미 끝난 울림의 인텐트다
        @Volatile var ringStartedAt: Long = 0L
        @Volatile var lastRingEndedAt: Long = 0L

        // 네이티브 경로로 마지막에 끈 알람 기록 — AlarmModule.consumeLastStopped가 읽고 지운다
        const val PREFS_STOPPED       = "AlarmLastStopped"

        const val CHANNEL_ID          = "alarm_ringing_ch"
        const val NOTIFICATION_ID     = 9001
        const val ACTION_STOP         = "com.danielpark.alarmapp.STOP"
        const val ACTION_SNOOZE       = "com.danielpark.alarmapp.SNOOZE"
        const val EXTRA_TITLE         = "title"
        const val EXTRA_BODY          = "body"

        // 알람 소리 페이드인 설정
        private const val FADE_START_VOLUME = 0.15f
        private const val FADE_DURATION_MS  = 15_000L
        private const val FADE_STEP_MS      = 1_000L
        // 점점 크게 울리기(알람별 설정, 기본 꺼짐) — JS constants/alarmTones.ts CRESCENDO_MS와 같은 20초
        private const val CRESCENDO_START_VOLUME = 0.02f
        private const val CRESCENDO_DURATION_MS  = 20_000L

        // 커버 디스플레이 AOD 강제 전환(약 4초)보다 짧게 잡아 끄기 화면을 계속 앞으로 띄움
        private const val COVER_RELAUNCH_INTERVAL_MS = 2_500L
        // 가려진 울림 화면을 다시 올리는 간격(세이람과 같은 2.5초)
        private const val KEEP_FRONT_INTERVAL_MS = 2_500L
    }
}
