package com.danielpark.alarmapp

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import java.util.Calendar

// setExactAndAllowWhileIdle 대신 setAlarmClock을 사용한다.
// setAlarmClock은 "알람시계" 앱 전용으로 설계된 API라 정확한 시각 발화가 항상 보장되고
// (SCHEDULE_EXACT_ALARM 권한 불필요), 상태바에 다음 알람 아이콘이 표시되며,
// 삼성 등 OEM이 이 등록 정보를 인식해 폴더블 커버 화면에서 자체 알람 끄기 UI를 보여주는
// 단서가 될 수 있어(삼성 기본 시계 앱이 커버 화면에서 끄기/스누즈가 되는 반면 우리 앱은
// setExactAndAllowWhileIdle만 쓸 때는 안 됐음) 모든 알람 예약 경로를 여기로 통일한다.
object AlarmScheduling {
    fun schedule(context: Context, am: AlarmManager, triggerAt: Long, operation: PendingIntent) {
        val showIntent = PendingIntent.getActivity(
            context, 0,
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        am.setAlarmClock(AlarmManager.AlarmClockInfo(triggerAt, showIntent), operation)
    }

    /**
     * AlarmReceiver가 기대하는 extra 구성을 한 곳에서만 만든다.
     * JS 예약(AlarmModule)과 부팅 복구(BootReceiver)가 각자 intent를 조립하면 extra 하나만
     * 어긋나도 부팅 후에만 조용히 다르게 동작하는(=재현이 매우 어려운) 버그가 되므로 공용화한다.
     */
    fun buildAlarmIntent(context: Context, e: AlarmStore.Entry): Intent =
        Intent(context, AlarmReceiver::class.java).apply {
            putExtra(AlarmService.EXTRA_TITLE, e.title)
            putExtra(AlarmService.EXTRA_BODY,  e.body)
            putExtra("alarmId",     e.requestCode)
            putExtra("baseAlarmId", e.baseAlarmId)
            putExtra("recurrence",  e.recurrence)
            putExtra("hour",        e.hour)
            putExtra("min",         e.min)
            putExtra("weekday",     e.weekday)
            putExtra("soundOn",     e.soundOn)
            putExtra("vibOn",       e.vibOn)
            putExtra("volume",      e.volume)
        }

    /** 원장 엔트리 하나를 실제 AlarmManager 예약으로 건다. */
    fun arm(context: Context, e: AlarmStore.Entry, triggerAt: Long = e.triggerAtMs) {
        val pi = PendingIntent.getBroadcast(
            context, e.requestCode, buildAlarmIntent(context, e),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        schedule(context, am, triggerAt, pi)
    }

    /** weekly 알람의 다음 발화 시각 — AlarmReceiver(발화 후 재예약)와 BootReceiver가 공유한다. */
    fun nextWeeklyTrigger(hour: Int, min: Int, calWeekday: Int): Long {
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
