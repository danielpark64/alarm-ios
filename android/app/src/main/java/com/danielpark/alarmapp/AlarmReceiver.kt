package com.danielpark.alarmapp

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.UserManager

class AlarmReceiver : BroadcastReceiver() {

    companion object {
        // JS(widgetSync.ts의 ACTIVE_IDS_NONE)와 반드시 같은 값이어야 한다.
        const val ACTIVE_IDS_NONE = "none"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val title   = intent.getStringExtra(AlarmService.EXTRA_TITLE) ?: "⏰ 알람"
        val body    = intent.getStringExtra(AlarmService.EXTRA_BODY)  ?: ""
        val alarmId = intent.getIntExtra("alarmId", -1)
        val isRep   = intent.getBooleanExtra("isRep", false)
        val soundOn = intent.getBooleanExtra("soundOn", true)
        val vibOn   = intent.getBooleanExtra("vibOn", true)
        val volume  = intent.getFloatExtra("volume", 1f)

        // 비활성 알람 차단 — JS 측이 꺼둔 알람은 울리지 않음.
        // 비교 기준은 반드시 baseAlarmId(JS 알람 원본 id)여야 한다 — alarmId extra는 합성
        // requestCode(mainNativeId/weekdaySlotId 산식)라 activeAlarmIds(bare id 목록)와
        // 비교하면 항상 불일치 → 활성 알람까지 전부 차단되는 버그가 있었음.
        // baseAlarmId가 없거나(-1, 구버전 예약분) activeAlarmIds가 null/빈 문자열이면
        // (앱 미실행/재부팅 직후) → 허용(fail-safe open)
        val baseAlarmId = intent.getIntExtra("baseAlarmId", -1)
        if (baseAlarmId >= 0) {
            val activeIdsStr = readActiveIds(context)
            // "none" = 활성 알람이 0개임을 JS가 명시한 상태 → 전부 차단.
            // 빈 문자열/null은 '아직 한 번도 기록된 적 없음'으로만 해석해 fail-safe open을 유지한다
            // (예전에는 활성 0개도 빈 문자열이라 게이트가 통째로 열렸음 — 전부 꺼둔 사용자에게
            //  잔여 예약이 울리는 경로였다).
            if (activeIdsStr == ACTIVE_IDS_NONE) return
            if (!activeIdsStr.isNullOrEmpty()) {
                val activeIds = activeIdsStr.split(",").mapNotNull { it.trim().toIntOrNull() }.toSet()
                if (baseAlarmId !in activeIds) return
            }
        }

        // ForegroundService 시작 (소리 루프 + 진동)
        val svcIntent = Intent(context, AlarmService::class.java).apply {
            putExtra(AlarmService.EXTRA_TITLE, title)
            putExtra(AlarmService.EXTRA_BODY, body)
            putExtra("alarmId", alarmId)
            putExtra("soundOn", soundOn)
            putExtra("vibOn", vibOn)
            putExtra("volume", volume)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            context.startForegroundService(svcIntent)
        else
            context.startService(svcIntent)

        if (alarmId < 0 || isRep) return

        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        // rep 슬롯 예약 (+1분, +2분) — isRep=true로 재귀 방지
        for (repIdx in 1..2) {
            val repIntent = Intent(context, AlarmReceiver::class.java).apply {
                putExtra(AlarmService.EXTRA_TITLE, title)
                putExtra(AlarmService.EXTRA_BODY, body)
                putExtra("alarmId", alarmId)
                putExtra("baseAlarmId", baseAlarmId) // rep 발화도 같은 게이트를 통과해야 함
                putExtra("isRep", true)
                putExtra("soundOn", soundOn)
                putExtra("vibOn", vibOn)
                putExtra("volume", volume)
            }
            val repPi = PendingIntent.getBroadcast(
                context, AlarmIds.repSlotId(alarmId, repIdx), repIntent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            val triggerAt = System.currentTimeMillis() + repIdx * 60_000L
            scheduleExact(context, am, triggerAt, repPi)
        }

        // 다음 발화 재스케줄 (weekly만 — 나머지는 JS가 관리)
        val recurrence = intent.getStringExtra("recurrence") ?: "once"
        val hour       = intent.getIntExtra("hour", 0)
        val min        = intent.getIntExtra("min", 0)
        val weekday    = intent.getIntExtra("weekday", -1)

        val nextTrigger = if (recurrence == "weekly" && weekday >= 1)
            AlarmScheduling.nextWeeklyTrigger(hour, min, weekday)
        else return

        val pi = PendingIntent.getBroadcast(
            context, alarmId, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        scheduleExact(context, am, nextTrigger, pi)
    }

    private fun scheduleExact(context: Context, am: AlarmManager, triggerAt: Long, pi: PendingIntent) {
        AlarmScheduling.schedule(context, am, triggerAt, pi)
    }

    /**
     * 차단 게이트가 볼 활성 알람 id 목록.
     *
     * 우선 device-protected 저장소를 본다 — 잠금해제 전(Direct Boot)에는 여기만 열린다.
     * 값이 없으면(=이 저장소가 생기기 전 버전에서 올라온 설치) 잠금해제 상태일 때에 한해
     * 기존 위치를 읽는다. 잠긴 상태에서 기본 저장소를 건드리면 예외가 나므로 시도하지 않는다.
     */
    private fun readActiveIds(context: Context): String? {
        DeviceStorage.prefs(context, DeviceStorage.PREFS_GATE)
            .getString("activeAlarmIds", null)
            ?.let { return it }

        val um = context.getSystemService(UserManager::class.java)
        if (um?.isUserUnlocked != true) return null   // → fail-safe open (알람을 놓치는 쪽보다 낫다)

        val legacy = context.getSharedPreferences("AlarmWidgetData", Context.MODE_PRIVATE)
            .getString("activeAlarmIds", null)
        // 읽은 김에 새 위치로 옮겨둔다 — 그래야 다음 재부팅의 잠금 구간에서도 게이트가 판정된다.
        // (앱을 한 번 열면 saveActiveAlarmIds가 어차피 양쪽에 쓰지만, 그 전에 울리는 알람도 있다)
        if (legacy != null) {
            DeviceStorage.prefs(context, DeviceStorage.PREFS_GATE)
                .edit().putString("activeAlarmIds", legacy).apply()
        }
        return legacy
    }
}
