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

    // 활성 알람 ID 목록을 SharedPreferences에 저장 — AlarmReceiver가 비활성 알람 필터링에 사용
    @ReactMethod
    fun saveActiveAlarmIds(ids: String) {
        val prefs = reactContext.getSharedPreferences("AlarmWidgetData", android.content.Context.MODE_PRIVATE)
        prefs.edit().putString("activeAlarmIds", ids).apply()
    }
}
