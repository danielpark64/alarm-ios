package com.danielpark.alarmapp

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class WidgetModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "WidgetModule"

    // JS에서 알람 데이터가 바뀔 때마다 호출 — JSON 문자열을 SharedPreferences에 저장하고 위젯 갱신
    @ReactMethod
    fun updateWidgetData(json: String) {
        val prefs = reactContext.getSharedPreferences("AlarmWidgetData", android.content.Context.MODE_PRIVATE)
        prefs.edit().putString("widgetData", json).apply()
        refreshAllWidgets(reactContext)
    }

    // 활성 알람 ID 목록 저장 — AlarmReceiver가 비활성 알람 필터링(차단 게이트)에 사용.
    //
    // 게이트는 잠금해제 전에도 판정할 수 있어야 하므로 device-protected 저장소에 쓴다.
    // 그렇지 않으면 Direct Boot 구간에 게이트가 값을 못 읽어 fail-safe open으로 빠지고,
    // 꺼둔 알람까지 울리게 된다.
    // 기존 AlarmWidgetData 쪽에도 계속 써서 구버전 예약분(옛 경로로 읽는 예약)과 호환을 남긴다.
    @ReactMethod
    fun saveActiveAlarmIds(ids: String) {
        DeviceStorage.prefs(reactContext, DeviceStorage.PREFS_GATE)
            .edit().putString("activeAlarmIds", ids).apply()
        reactContext.getSharedPreferences("AlarmWidgetData", android.content.Context.MODE_PRIVATE)
            .edit().putString("activeAlarmIds", ids).apply()
    }
}
