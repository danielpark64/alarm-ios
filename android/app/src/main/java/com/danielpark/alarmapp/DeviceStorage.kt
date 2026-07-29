package com.danielpark.alarmapp

import android.content.Context
import android.content.SharedPreferences

/**
 * 잠금해제 전(Direct Boot)에도 읽을 수 있는 저장소.
 *
 * 재부팅 직후 사용자가 처음 잠금을 풀기 전까지는 기본 저장소(credential-encrypted)가 아예
 * 열리지 않는다. 그래서 그 구간에는 BOOT_COMPLETED도 오지 않고 알람 예약도 복구되지 않는데,
 * 새벽 OTA 업데이트로 재부팅된 폰을 아침까지 안 만지면 정확히 그 구간에 알람 시각이 걸린다.
 *
 * 알람이 울리는 데 꼭 필요한 두 가지 —
 *   1) 예약 원장(AlarmStore)
 *   2) 활성 알람 id 목록(차단 게이트)
 * — 만 device-protected 저장소에 두면, LOCKED_BOOT_COMPLETED 시점에 예약을 되살리고
 * 게이트 판정까지 할 수 있다. 위젯 표시용 데이터처럼 잠금해제 후에나 쓰이는 값은
 * 기존 저장소(AlarmWidgetData)에 그대로 둔다 — 여기로 옮길 이유가 없다.
 *
 * 보안 판단: 여기엔 알람 시각·id뿐 아니라 사용자가 입력한 라벨(title/body)도 들어간다.
 * device-protected 저장소도 암호화되지만(키가 TEE/verified boot에 묶임) 사용자 자격증명
 * 없이 복호화된다는 점이 기본 저장소와 다르다. 그럼에도 수용 가능한 이유는, 같은 title/body를
 * 이미 `VISIBILITY_PUBLIC` 알림으로 잠금화면에 그대로 띄우고 있어서 — 잠긴 폰을 든 사람이
 * 이미 볼 수 있는 정보라 — 기밀성 기준선이 낮아지지 않기 때문이다. 이 근거가 성립하지 않는
 * 값(예: 계정 정보)은 여기에 넣지 말 것.
 */
object DeviceStorage {
    const val PREFS_GATE = "AlarmGateData"

    /** 잠금 상태와 무관하게 항상 접근 가능한 컨텍스트. */
    fun context(context: Context): Context =
        context.applicationContext.createDeviceProtectedStorageContext()

    fun prefs(context: Context, name: String): SharedPreferences =
        context(context).getSharedPreferences(name, Context.MODE_PRIVATE)

    /**
     * 같은 이름의 기존(credential-encrypted) 저장소를 device-protected 쪽으로 1회 이관한다.
     *
     * 저장 위치만 옮긴 업데이트에서는 파일명이 같아도 컨텍스트가 달라 기존 값이 안 보인다.
     * 그대로 두면 "업데이트 직후 앱을 안 열고 재부팅" 시 원장이 비어 있어 네이티브 예약이
     * 통째로 사라진다 — BootReceiver가 없애려던 바로 그 공백이 업데이트 때마다 재현된다.
     *
     * 잠금 상태에서는 원본(CE)을 열 수 없으므로 잠금해제 이후에만 시도한다. 그 전에는
     * 이관이 미뤄질 뿐, 앱을 한 번 열면 어차피 원장이 새로 채워지므로 손실은 없다.
     */
    fun migrateFromCredentialStorage(context: Context, name: String) {
        val appCtx = context.applicationContext
        val deCtx = context(appCtx)
        if (deCtx.getSharedPreferences(name, Context.MODE_PRIVATE).all.isNotEmpty()) return
        val um = appCtx.getSystemService(android.os.UserManager::class.java)
        if (um?.isUserUnlocked != true) return
        try {
            deCtx.moveSharedPreferencesFrom(appCtx, name)
        } catch (_: Exception) {
            // 실패해도 치명적이지 않다 — 앱이 다음에 열릴 때 원장이 새로 기록된다.
        }
    }
}
