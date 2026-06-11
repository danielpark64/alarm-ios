package com.danielpark.alarmapp

import android.app.*
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Build
import android.os.IBinder
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments

class AlarmService : Service() {

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null

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
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_SNOOZE -> {
                val title = intent.getStringExtra(EXTRA_TITLE) ?: "⏰ 알람"
                val body  = intent.getStringExtra(EXTRA_BODY)  ?: ""
                cancelReps(alarmId)
                stopRinging()
                stopForeground(STOP_FOREGROUND_REMOVE)
                scheduleSnooze(title, body)
                stopSelf()
                return START_NOT_STICKY
            }
        }

        val title = intent?.getStringExtra(EXTRA_TITLE) ?: "⏰ 알람"
        val body  = intent?.getStringExtra(EXTRA_BODY)  ?: ""

        startForeground(NOTIFICATION_ID, buildNotification(title, body, alarmId))
        startRinging()
        emitRingingEvent(title, body, alarmId)
        return START_STICKY
    }

    // 사용자가 끄기/스누즈 시 남은 +1분/+2분 rep 슬롯 즉시 취소
    private fun cancelReps(alarmId: Int) {
        if (alarmId < 0) return
        val am = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        for (repIdx in 1..2) {
            val pi = PendingIntent.getBroadcast(
                this, AlarmIds.repSlotId(alarmId, repIdx),
                Intent(this, AlarmReceiver::class.java),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_NO_CREATE
            )
            if (pi != null) { am.cancel(pi); pi.cancel() }
        }
    }

    // 포그라운드 JS로 알람 울림 이벤트 전달 (인앱 끄기/스누즈 UI 표시용)
    private fun emitRingingEvent(title: String, body: String, alarmId: Int) {
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

    private fun startRinging() {
        if (mediaPlayer?.isPlaying == true) return // 이미 울리는 중 (rep 중복 방지)
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
                start()
            }
        } catch (e: Exception) { e.printStackTrace() }

        // 진동
        try {
            vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }
            val pattern = longArrayOf(0, 500, 300, 500, 300, 500)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, 0)
            }
        } catch (e: Exception) { e.printStackTrace() }
    }

    private fun stopRinging() {
        mediaPlayer?.stop()
        mediaPlayer?.release()
        mediaPlayer = null
        vibrator?.cancel()
        vibrator = null
    }

    private fun scheduleSnooze(title: String, body: String) {
        val intent = Intent(this, AlarmReceiver::class.java).apply {
            putExtra(EXTRA_TITLE, title)
            putExtra(EXTRA_BODY, body)
            putExtra("recurrence", "once")
        }
        val pi = PendingIntent.getBroadcast(
            this, AlarmIds.SNOOZE_REQUEST_CODE, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val am = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val triggerAt = System.currentTimeMillis() + 5 * 60 * 1000L
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (am.canScheduleExactAlarms())
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
        } else {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
        }
    }

    override fun onDestroy() { stopRinging(); stopForeground(STOP_FOREGROUND_REMOVE); super.onDestroy() }
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

    private fun buildNotification(title: String, body: String, alarmId: Int): Notification {
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
            },
            PendingIntent.FLAG_IMMUTABLE
        )
        val openPi = PendingIntent.getActivity(
            this, 12,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentIntent(openPi)
            .addAction(0, "끄기",   stopPi)
            .addAction(0, "5분 후", snoozePi)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setFullScreenIntent(openPi, true)
            .build()
    }

    companion object {
        const val CHANNEL_ID          = "alarm_ringing_ch"
        const val NOTIFICATION_ID     = 9001
        const val ACTION_STOP         = "com.danielpark.alarmapp.STOP"
        const val ACTION_SNOOZE       = "com.danielpark.alarmapp.SNOOZE"
        const val EXTRA_TITLE         = "title"
        const val EXTRA_BODY          = "body"
    }
}
