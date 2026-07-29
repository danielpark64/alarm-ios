package com.danielpark.alarmapp

import android.app.*
import android.content.Context
import android.content.Intent
import android.hardware.display.DisplayManager
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.UserManager
import android.os.Vibrator
import android.os.VibratorManager
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
                cancelCoverRelaunch()
                currentRinging = null
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
                cancelReps(alarmId)
                stopRinging()
                cancelCoverRelaunch()
                currentRinging = null
                stopForeground(STOP_FOREGROUND_REMOVE)
                scheduleSnooze(title, body, soundOn, vibOn, volume)
                stopSelf()
                return START_NOT_STICKY
            }
        }

        val title   = intent?.getStringExtra(EXTRA_TITLE) ?: "⏰ 알람"
        val body    = intent?.getStringExtra(EXTRA_BODY)  ?: ""
        val soundOn = intent?.getBooleanExtra("soundOn", true) ?: true
        val vibOn   = intent?.getBooleanExtra("vibOn", true) ?: true
        val volume  = intent?.getFloatExtra("volume", 1f) ?: 1f

        startForeground(NOTIFICATION_ID, buildNotification(title, body, alarmId, soundOn, vibOn, volume))
        startRinging(soundOn, vibOn, volume)
        currentRinging = RingingInfo(title, body, alarmId)
        emitRingingEvent(title, body, alarmId)
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

    private fun bringRingingActivityToFront(title: String, alarmId: Int) {
        val dm = getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
        val handler = Handler(Looper.getMainLooper())
        var launched = false

        // 폴더가 닫혀 커버 디스플레이로 알람을 띄우는 경우, RN 기반 MainActivity는
        // 작은 커버 디스플레이에서 윈도우 재측정에 실패해 화면이 비어 보이는 문제가 있어
        // 대신 순수 네이티브 화면(CoverAlarmActivity, 끄기 버튼만 있음)을 띄운다.
        fun launch(displayId: Int?) {
            if (launched) return
            launched = true
            ringingDisplayListener?.let { dm.unregisterDisplayListener(it) }
            ringingDisplayListener = null
            try {
                val isCoverDisplay = displayId != null && displayId != Display.DEFAULT_DISPLAY
                // 잠금해제 전에는 MainActivity(RN)가 directBootAware가 아니라 실행 자체가 막힌다
                // (ActivityNotFoundException이 아래 catch에 조용히 삼켜져서 화면도 안 켜지고
                //  끄기 UI도 없는 상태가 됐음). 그 구간엔 네이티브 화면으로 대체한다.
                val locked = getSystemService(UserManager::class.java)?.isUserUnlocked == false
                val intent = if (isCoverDisplay || locked) {
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
                    }
                }
                val options = ActivityOptions.makeBasic()
                displayId?.let { options.setLaunchDisplayId(it) }
                startActivity(intent, options.toBundle())
                // 커버 디스플레이는 몇 초 지나면 삼성 자체 AOD 화면으로 강제 전환되어
                // 끄기 버튼이 화면 밖으로 밀려나므로, 알람이 꺼질 때까지 주기적으로
                // 다시 앞으로 띄워서 사용자가 끄기를 누를 기회를 계속 준다.
                if (isCoverDisplay) scheduleCoverRelaunch(alarmId, title, displayId!!)
            } catch (e: Exception) { e.printStackTrace() }
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
        handler.postDelayed({ launch(null) }, 1200L)
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

    // 포그라운드 JS로 알람 울림 이벤트 전달 (인앱 끄기/스누즈 UI 표시용)
    private fun emitRingingEvent(title: String, body: String, alarmId: Int) {
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
            }
            reactContext.emitDeviceEvent("alarmRinging", params)
        } catch (e: Exception) { e.printStackTrace() }
    }

    private fun startRinging(soundOn: Boolean, vibOn: Boolean, volume: Float = 1f) {
        val targetVolume = volume.coerceIn(0f, 1f)
        if (soundOn && mediaPlayer?.isPlaying != true) {
            try {
                mediaPlayer = MediaPlayer().apply {
                    setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                    val afd = resources.openRawResourceFd(R.raw.alarm_long)
                    setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
                    afd.close()
                    isLooping = true
                    prepare()
                    val startVolume = FADE_START_VOLUME.coerceAtMost(targetVolume)
                    setVolume(startVolume, startVolume)
                    start()
                }
                startVolumeFade(targetVolume)
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
    private fun startVolumeFade(targetVolume: Float) {
        val handler = Handler(Looper.getMainLooper())
        val totalSteps = (FADE_DURATION_MS / FADE_STEP_MS).toInt()
        val startVolume = FADE_START_VOLUME.coerceAtMost(targetVolume)
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
    private fun scheduleSnooze(title: String, body: String, soundOn: Boolean, vibOn: Boolean, volume: Float) {
        val intent = Intent(this, AlarmReceiver::class.java).apply {
            putExtra(EXTRA_TITLE, title)
            putExtra(EXTRA_BODY, body)
            putExtra("recurrence", "once")
            putExtra("soundOn", soundOn)
            putExtra("vibOn", vibOn)
            putExtra("volume", volume)
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
        cancelCoverRelaunch()
        currentRinging = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }
    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(CHANNEL_ID, "알람 울림", NotificationManager.IMPORTANCE_HIGH).apply {
                setSound(null, null)
                enableVibration(false)
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(ch)
        }
    }

    private fun buildNotification(title: String, body: String, alarmId: Int, soundOn: Boolean, vibOn: Boolean, volume: Float): Notification {
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
            },
            PendingIntent.FLAG_IMMUTABLE
        )
        val openPi = PendingIntent.getActivity(
            this, 12,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("alarmRinging", true)
            },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentIntent(openPi)
            // 갤럭시 Z 플립 커버 화면의 축소 알림 뷰는 액션이 2개면 커스텀 액션 대신
            // 기본 "앱 열기" 버튼만 보여주는 것으로 보여, 액션을 "끄기" 1개로 줄여 테스트
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "끄기", stopPi)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            // setFullScreenIntent는 시스템이 디스플레이 지정 없이 즉시 MainActivity를 띄워버려서
            // bringRingingActivityToFront()의 커버 디스플레이 타겟팅 시도보다 먼저 기본 디스플레이에
            // 태스크를 만들어버리는 경쟁 상태를 유발함(폴더 닫힘 시 끄기 화면이 안 보이는 원인).
            // bringRingingActivityToFront()가 SYSTEM_ALERT_WINDOW 권한으로 이미 동일한 역할을 하므로 제거.
            .build()
    }

    companion object {
        // 현재 울리고 있는 알람 정보 (RN 쪽이 재시작/포그라운드 복귀해도 끄기 팝업을 복구할 수 있도록)
        data class RingingInfo(val title: String, val body: String, val alarmId: Int)
        @Volatile var currentRinging: RingingInfo? = null

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

        // 커버 디스플레이 AOD 강제 전환(약 4초)보다 짧게 잡아 끄기 화면을 계속 앞으로 띄움
        private const val COVER_RELAUNCH_INTERVAL_MS = 2_500L
    }
}
