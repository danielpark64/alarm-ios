package com.danielpark.alarmapp

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.WindowManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AlarmModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "AlarmModule"

    /**
     * alarmId      - 알람 고유 ID (PendingIntent requestCode)
     * triggerAtMs  - 발동 시각 (Unix ms)
     * title        - 알림 제목
     * body         - 알림 본문
     * recurrence   - "once" | "daily" | "weekly" | "weekdays" | "weekends"
     * hour / min   - 반복 재스케줄용
     * weekday      - Calendar 요일(1=일,2=월..7=토), 해당없으면 -1
     * soundOn      - 알람 소리 재생 여부
     * vibOn        - 진동 여부
     * volume       - 알람 최대 볼륨 (0.0~1.0, 사용자가 설정에서 지정한 알람 기본 볼륨)
     */
    @ReactMethod
    fun scheduleAlarm(
        alarmId: Int, triggerAtMs: Double,
        title: String, body: String,
        recurrence: String, hour: Int, min: Int, weekday: Int,
        soundOn: Boolean, vibOn: Boolean, volume: Double
    ) {
        val ctx = reactContext
        val intent = Intent(ctx, AlarmReceiver::class.java).apply {
            putExtra(AlarmService.EXTRA_TITLE, title)
            putExtra(AlarmService.EXTRA_BODY,  body)
            putExtra("alarmId",    alarmId)
            putExtra("recurrence", recurrence)
            putExtra("hour",       hour)
            putExtra("min",        min)
            putExtra("weekday",    weekday)
            putExtra("soundOn",    soundOn)
            putExtra("vibOn",      vibOn)
            putExtra("volume",     volume.toFloat())
        }
        val pi = PendingIntent.getBroadcast(
            ctx, alarmId, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val triggerAt = triggerAtMs.toLong()
        AlarmScheduling.schedule(ctx, am, triggerAt, pi)
    }

    @ReactMethod
    fun cancelAlarm(alarmId: Int) {
        val ctx = reactContext
        val intent = Intent(ctx, AlarmReceiver::class.java)
        val pi = PendingIntent.getBroadcast(
            ctx, alarmId, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_NO_CREATE
        ) ?: return
        (ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(pi)
    }

    @ReactMethod
    fun stopAlarm(alarmId: Int) {
        val ctx = reactContext
        ctx.startService(Intent(ctx, AlarmService::class.java).apply {
            action = AlarmService.ACTION_STOP
            putExtra("alarmId", alarmId)
        })
        clearRingingWindowFlags()
    }

    // 끄기/스누즈 후 잠금화면 위에 떠 있던 플래그 정리
    private fun clearRingingWindowFlags() {
        val activity = reactContext.currentActivity ?: return
        activity.runOnUiThread {
            activity.window.clearFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            )
        }
    }

    // 현재 AlarmService가 울리고 있는 알람 정보 (앱 재시작/포그라운드 복귀 시 인앱 끄기 팝업 복구용)
    @ReactMethod
    fun getCurrentRinging(promise: Promise) {
        val info = AlarmService.currentRinging
        if (info == null) {
            promise.resolve(null)
            return
        }
        promise.resolve(Arguments.createMap().apply {
            putString("title", info.title)
            putString("body", info.body)
            putInt("alarmId", info.alarmId)
        })
    }

    // "다른 앱 위에 표시" 권한 — 화면이 켜진 채 잠금 해제 상태일 때 알람 끄기 팝업을
    // 백그라운드에서 띄우면 OneUI 등에서 몇 초 후 강제로 닫아버리는 문제 방지용
    @ReactMethod
    fun canDrawOverlays(promise: Promise) {
        val granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
            Settings.canDrawOverlays(reactContext)
        promise.resolve(granted)
    }

    @ReactMethod
    fun requestOverlayPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
        val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${reactContext.packageName}")
        ).apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK }
        reactContext.startActivity(intent)
    }

    @ReactMethod
    fun snoozeAlarm(alarmId: Int, title: String, body: String, volume: Double) {
        val ctx = reactContext
        ctx.startService(Intent(ctx, AlarmService::class.java).apply {
            action = AlarmService.ACTION_SNOOZE
            putExtra("alarmId", alarmId)
            putExtra(AlarmService.EXTRA_TITLE, title)
            putExtra(AlarmService.EXTRA_BODY, body)
            putExtra("volume", volume.toFloat())
        })
        clearRingingWindowFlags()
    }
}
