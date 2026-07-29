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
import com.facebook.react.bridge.ReadableArray

class AlarmModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "AlarmModule"

    /**
     * alarmId      - PendingIntent requestCode용 합성 슬롯 ID (mainNativeId/weekdaySlotId 산식)
     * triggerAtMs  - 발동 시각 (Unix ms)
     * title        - 알림 제목
     * body         - 알림 본문
     * recurrence   - "once" | "daily" | "weekly" | "weekdays" | "weekends"
     * hour / min   - 반복 재스케줄용
     * weekday      - Calendar 요일(1=일,2=월..7=토), 해당없으면 -1
     * soundOn      - 알람 소리 재생 여부
     * vibOn        - 진동 여부
     * volume       - 알람 최대 볼륨 (0.0~1.0, 사용자가 설정에서 지정한 알람 기본 볼륨)
     * baseAlarmId  - JS 알람 원본 id (합성 아님) — AlarmReceiver의 비활성 차단 게이트가
     *                activeAlarmIds(bare id 목록)와 비교할 때 사용. 합성 requestCode와
     *                bare id를 비교하면 항상 불일치라 게이트가 전체 차단이 되는 버그가 있었음.
     */
    @ReactMethod
    fun scheduleAlarm(
        alarmId: Int, triggerAtMs: Double,
        title: String, body: String,
        recurrence: String, hour: Int, min: Int, weekday: Int,
        soundOn: Boolean, vibOn: Boolean, volume: Double,
        baseAlarmId: Int
    ) {
        val ctx = reactContext
        val entry = AlarmStore.Entry(
            requestCode = alarmId,
            triggerAtMs = triggerAtMs.toLong(),
            title = title, body = body,
            recurrence = recurrence, hour = hour, min = min, weekday = weekday,
            soundOn = soundOn, vibOn = vibOn, volume = volume.toFloat(),
            baseAlarmId = baseAlarmId,
        )
        AlarmScheduling.arm(ctx, entry)
        // 재부팅·앱 교체로 AlarmManager가 비워져도 BootReceiver가 되살릴 수 있게 원장에 남긴다.
        AlarmStore.put(ctx, entry)
    }

    @ReactMethod
    fun cancelAlarm(alarmId: Int) {
        cancelOne(alarmId)
        AlarmStore.remove(reactContext, listOf(alarmId))
    }

    // 취소 대상이 알람당 수십 개라 개별 브릿지 호출 대신 배열로 한 번에 받는다 — JS
    // cancelNativeAlarms가 이 메서드를 우선 사용(브릿지 왕복 약 70회 → 1회)
    @ReactMethod
    fun cancelAlarms(alarmIds: ReadableArray) {
        val ids = ArrayList<Int>(alarmIds.size())
        for (i in 0 until alarmIds.size()) {
            val id = alarmIds.getInt(i)
            cancelOne(id)
            ids.add(id)
        }
        // 원장 정리는 반드시 한 번에 — id마다 지우면 rescheduleAll 한 번에 디스크 쓰기가 수십 번 발생한다.
        AlarmStore.remove(reactContext, ids)
    }

    /**
     * 원장에 남아 있는데 더 이상 존재하지 않는 알람(=삭제분)의 예약을 싹 정리한다.
     *
     * JS의 rescheduleAll은 "현재 알람 목록"만 순회하며 cancelNativeAlarms를 부르므로,
     * 목록에서 이미 빠진 삭제 알람은 취소 호출을 한 번도 못 받는다(useAlarms.deleteAlarm이
     * 필터링된 목록을 넘기기 때문). 원장이 생기기 전에는 그 잔여 예약이 게이트에 막히다가
     * 14일 뒤 자연 소멸했지만, 이제는 원장에 남아 부팅마다 되살아나므로 반드시 걷어내야 한다.
     *
     * baseAlarmId 기준으로 판정하므로 JS는 "살아있는 알람 id 목록"만 넘기면 되고,
     * 앞으로 어떤 삭제 경로가 추가돼도 유령 예약이 생기지 않는다.
     */
    @ReactMethod
    fun syncActiveAlarms(baseIds: ReadableArray) {
        val alive = HashSet<Int>(baseIds.size())
        for (i in 0 until baseIds.size()) alive.add(baseIds.getInt(i))

        val stale = AlarmStore.all(reactContext).filter { it.baseAlarmId >= 0 && it.baseAlarmId !in alive }
        if (stale.isEmpty()) return
        for (e in stale) cancelOne(e.requestCode)
        AlarmStore.remove(reactContext, stale.map { it.requestCode })
    }

    private fun cancelOne(alarmId: Int) {
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
