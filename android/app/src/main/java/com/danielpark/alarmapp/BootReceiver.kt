package com.danielpark.alarmapp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * 재부팅·앱 교체 후 네이티브 AlarmManager 예약 복구.
 *
 * Android는 부팅과 패키지 교체(앱 업데이트) 시 AlarmManager에 걸린 예약을 전부 폐기한다.
 * expo-notifications는 자체 리시버로 자기 예약을 되살리지만 우리가 직접 건 네이티브 예약은
 * 복구 주체가 없어서, 사용자가 앱을 다시 열어 rescheduleAll이 돌기 전까지는 이중 알람 중
 * 네이티브 쪽(포그라운드 서비스 반복 재생·커버 화면·full-screen intent)이 통째로 비어 있었다.
 *
 * AlarmStore 원장을 그대로 다시 걸어 그 공백을 없앤다.
 *
 * 주의 — 여기서 하는 일은 "이미 JS가 결정해둔 예약을 다시 거는 것"뿐이다. 어떤 알람이
 * 켜져 있는지 판단하지 않는다. 비활성 알람 차단은 AlarmReceiver가 발화 시점에
 * activeAlarmIds로 거르므로(끄기 게이트), 부팅 복구가 꺼둔 알람을 울리게 만들지 않는다.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            // LOCKED_BOOT_COMPLETED: 잠금해제 전에 오는 첫 신호. 이게 없으면 사용자가 폰을
            // 처음 만질 때까지(실측 9분 이상) 네이티브 예약이 통째로 비어 있다.
            Intent.ACTION_LOCKED_BOOT_COMPLETED,
            Intent.ACTION_BOOT_COMPLETED,
            "android.intent.action.QUICKBOOT_POWERON",
            "com.htc.intent.action.QUICKBOOT_POWERON",
            Intent.ACTION_MY_PACKAGE_REPLACED -> Unit
            else -> return
        }

        val appCtx = context.applicationContext
        // 원장 읽기(디스크) + 예약 수백 건을 메인 스레드에서 돌리면 부팅 직후 리시버 제한
        // (약 10초)에 걸려 ANR/강제 종료가 날 수 있다. 워커로 넘기고 goAsync로 수명을 늘린다.
        val pending = goAsync()
        Thread {
            try {
                restore(appCtx)
            } finally {
                pending.finish()
            }
        }.start()
    }

    private fun restore(appCtx: Context) {
        val now = System.currentTimeMillis()
        for (e in AlarmStore.all(appCtx)) {
            if (e.triggerAtMs > now) {
                AlarmScheduling.arm(appCtx, e)
                continue
            }
            // 이미 지난 예약: weekly만 다음 주기로 당겨서 되살린다.
            // 나머지(once/날짜 슬롯)는 지나간 알람이므로 되살리면 안 되고, 앞으로의 날짜 슬롯은
            // 앱을 다음에 열 때 rescheduleAll이 14일 창으로 다시 채운다.
            if (e.recurrence == "weekly" && e.weekday >= 1) {
                AlarmScheduling.arm(appCtx, e, AlarmScheduling.nextWeeklyTrigger(e.hour, e.min, e.weekday))
            }
        }
    }
}
