package com.danielpark.alarmapp

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import java.util.Calendar

class AlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val title   = intent.getStringExtra(AlarmService.EXTRA_TITLE) ?: "⏰ 알람"
        val body    = intent.getStringExtra(AlarmService.EXTRA_BODY)  ?: ""
        val alarmId = intent.getIntExtra("alarmId", -1)
        val isRep   = intent.getBooleanExtra("isRep", false)

        // ForegroundService 시작 (소리 루프 + 진동)
        val svcIntent = Intent(context, AlarmService::class.java).apply {
            putExtra(AlarmService.EXTRA_TITLE, title)
            putExtra(AlarmService.EXTRA_BODY, body)
            putExtra("alarmId", alarmId)
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
                putExtra("isRep", true)
            }
            val repPi = PendingIntent.getBroadcast(
                context, AlarmIds.repSlotId(alarmId, repIdx), repIntent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            val triggerAt = System.currentTimeMillis() + repIdx * 60_000L
            scheduleExact(am, triggerAt, repPi)
        }

        // 다음 발화 재스케줄 (weekly만 — 나머지는 JS가 관리)
        val recurrence = intent.getStringExtra("recurrence") ?: "once"
        val hour       = intent.getIntExtra("hour", 0)
        val min        = intent.getIntExtra("min", 0)
        val weekday    = intent.getIntExtra("weekday", -1)

        val nextTrigger = if (recurrence == "weekly" && weekday >= 1)
            nextWeeklyTrigger(hour, min, weekday)
        else return

        val pi = PendingIntent.getBroadcast(
            context, alarmId, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        scheduleExact(am, nextTrigger, pi)
    }

    private fun scheduleExact(am: AlarmManager, triggerAt: Long, pi: PendingIntent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (am.canScheduleExactAlarms())
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
            else
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
        } else {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
        }
    }

    private fun nextWeeklyTrigger(hour: Int, min: Int, calWeekday: Int): Long {
        val cal = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour); set(Calendar.MINUTE, min)
            set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
            set(Calendar.DAY_OF_WEEK, calWeekday)
        }
        if (cal.timeInMillis <= System.currentTimeMillis())
            cal.add(Calendar.WEEK_OF_YEAR, 1)
        return cal.timeInMillis
    }
}
