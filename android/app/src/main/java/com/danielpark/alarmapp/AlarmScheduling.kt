package com.danielpark.alarmapp

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent

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
}
