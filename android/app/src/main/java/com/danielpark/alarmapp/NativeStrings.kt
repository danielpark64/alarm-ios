package com.danielpark.alarmapp

import android.content.Context
import org.json.JSONObject

/**
 * 네이티브가 직접 그리는 문구(알림의 "끄기" 버튼, 커버 화면, 위젯 라벨)의 언어 맞춤.
 *
 * 앱 언어는 설정에서 고르는 값이라(system | ko | en | …) 기기 로캘과 다를 수 있다. 그래서 Android 리소스
 * (values-xx/strings.xml)로 나누지 않고, JS가 현재 언어로 번역한 문구 묶음을 넘겨주면(WidgetModule.saveNativeStrings ←
 * src/utils/widgetSync.ts) 여기서 꺼내 쓴다. 아직 한 번도 저장된 적이 없으면(첫 실행 전, 구버전에서 올라온 직후)
 * 호출부가 넘긴 한국어 기본값으로 보여 준다 — 기존 사용자는 전부 한국어였으므로 안전한 기본값이다.
 *
 * 잠금해제 전(Direct Boot)에 울리는 알람도 "끄기" 버튼을 그려야 하므로 device-protected 저장소에 둔다.
 * 들어가는 값은 고정 UI 문구뿐이라 DeviceStorage의 보안 판단(잠금화면에 이미 보이는 정보)에 어긋나지 않는다.
 */
object NativeStrings {
    private const val KEY = "nativeStrings"

    fun save(context: Context, json: String) {
        DeviceStorage.prefs(context, DeviceStorage.PREFS_GATE).edit().putString(KEY, json).apply()
    }

    private fun load(context: Context): JSONObject? = try {
        DeviceStorage.prefs(context, DeviceStorage.PREFS_GATE).getString(KEY, null)?.let { JSONObject(it) }
    } catch (_: Exception) { null }

    fun get(context: Context, key: String, fallback: String): String {
        val v = load(context)?.optString(key, "") ?: ""
        return if (v.isEmpty()) fallback else v
    }

    /** 요일 이름 7개(일~토). 저장된 값이 없거나 개수가 안 맞으면 기본값. */
    fun days(context: Context, fallback: List<String>): List<String> {
        val arr = load(context)?.optJSONArray("days") ?: return fallback
        if (arr.length() != 7) return fallback
        return (0 until 7).map { arr.optString(it, fallback[it]) }
    }
}
