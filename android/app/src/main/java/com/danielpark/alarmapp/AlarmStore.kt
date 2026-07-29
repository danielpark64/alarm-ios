package com.danielpark.alarmapp

import android.content.Context
import android.os.Handler
import android.os.HandlerThread
import org.json.JSONArray
import org.json.JSONObject

/**
 * 네이티브 AlarmManager 예약 원장(ledger).
 *
 * Android는 재부팅과 앱 교체(업데이트) 시 AlarmManager에 걸린 예약을 전부 지운다.
 * Expo 쪽 예약은 expo-notifications가 자체 BOOT_COMPLETED 리시버로 복구하지만,
 * 우리가 직접 건 네이티브 예약은 복구 주체가 없어서 앱을 다시 열기 전까지 비어 있었다
 * (= 이중 알람 시스템이 재부팅 직후 반쪽이 됨).
 *
 * 그래서 JS가 예약을 걸 때마다 그 파라미터를 여기에 남겨두고, BootReceiver가 부팅 직후
 * 이 원장을 그대로 다시 걸어준다. 예약/취소 경로는 AlarmModule 하나뿐이므로 원장도
 * 그 한 곳에서만 갱신되면 된다.
 *
 * 저장 위치는 위젯이 쓰는 "AlarmWidgetData"와 분리한다 — 원장은 알람 슬롯 단위(수백 건)라
 * 성격이 다르고, 위젯 동기화가 원장을 통째로 덮어쓰는 사고를 막기 위해서다.
 * 또한 잠금해제 전에도 복구할 수 있어야 하므로 device-protected 저장소를 쓴다(DeviceStorage).
 */
object AlarmStore {
    private const val PREFS = "NativeAlarmStore"
    private const val KEY = "entries"

    // 지난 예약을 언제까지 남겨둘지 — 부팅이 늦어져도 직전 알람 정보를 잃지 않도록 하루 여유를 둔다.
    private const val KEEP_PAST_MS = 24 * 60 * 60 * 1000L

    data class Entry(
        val requestCode: Int,
        val triggerAtMs: Long,
        val title: String,
        val body: String,
        val recurrence: String,
        val hour: Int,
        val min: Int,
        val weekday: Int,
        val soundOn: Boolean,
        val vibOn: Boolean,
        val volume: Float,
        val baseAlarmId: Int,
    )

    // requestCode → Entry. 예약/취소가 짧은 시간에 수십~수백 번 몰아쳐 들어오므로
    // (rescheduleAll이 전체 취소 후 전체 재등록) 매번 디스크를 읽지 않도록 메모리에 이고 있는다.
    private var cache: LinkedHashMap<Int, Entry>? = null

    @Synchronized
    fun put(context: Context, entry: Entry) {
        val map = load(context)
        map[entry.requestCode] = entry
        scheduleFlush(context)
    }

    /** 취소는 알람 하나당 70개 남짓 몰려오므로 반드시 배열로 받아 한 번만 기록한다. */
    @Synchronized
    fun remove(context: Context, requestCodes: List<Int>) {
        val map = load(context)
        var changed = false
        for (rc in requestCodes) if (map.remove(rc) != null) changed = true
        if (changed) scheduleFlush(context)
    }

    @Synchronized
    fun all(context: Context): List<Entry> {
        val map = load(context)
        flushNow(context)   // 읽는 쪽(부팅 복구·유령 정리)은 항상 최신 상태를 보게 한다
        return map.values.toList()
    }

    // rescheduleAll 한 번에 put이 수백 번 들어오는데(알람 수 × 14일 슬롯) 매번 배열 전체를
    // 직렬화하면 O(n²)이 된다. 짧게 모아서 한 번만 쓴다.
    // 쓰기 전에 프로세스가 죽어도 실제 AlarmManager 예약은 이미 걸려 있고, 앱을 다시 열면
    // rescheduleAll이 원장을 통째로 다시 채우므로 자기 복구된다.
    // 직렬화는 rescheduleAll 직후 — UI가 가장 바쁜 순간 — 에 몰리므로 메인 스레드를 피한다.
    private const val FLUSH_DELAY_MS = 200L
    private val flushHandler = Handler(
        HandlerThread("AlarmStoreFlush").apply { start() }.looper
    )
    private var pendingFlush: Runnable? = null

    private fun scheduleFlush(context: Context) {
        pendingFlush?.let { flushHandler.removeCallbacks(it) }
        val appCtx = context.applicationContext
        val r = Runnable { flushNow(appCtx) }
        pendingFlush = r
        flushHandler.postDelayed(r, FLUSH_DELAY_MS)
    }

    @Synchronized
    private fun flushNow(context: Context) {
        pendingFlush?.let { flushHandler.removeCallbacks(it) }
        pendingFlush = null
        cache?.let { flush(context, it) }
    }

    private fun load(context: Context): LinkedHashMap<Int, Entry> {
        cache?.let { return it }
        // 저장 위치를 DE로 옮기기 전 버전에서 올라온 설치의 원장을 이어받는다(최초 1회).
        DeviceStorage.migrateFromCredentialStorage(context, PREFS)
        val map = LinkedHashMap<Int, Entry>()
        val raw = prefs(context).getString(KEY, null)
        if (!raw.isNullOrEmpty()) {
            try {
                val arr = JSONArray(raw)
                for (i in 0 until arr.length()) {
                    val e = fromJson(arr.getJSONObject(i))
                    map[e.requestCode] = e
                }
            } catch (_: Exception) {
                // 원장이 깨졌으면 통째로 버린다 — 앱을 한 번 열면 JS가 전부 다시 등록한다.
            }
        }
        cache = map
        return map
    }

    private fun flush(context: Context, map: LinkedHashMap<Int, Entry>) {
        // 지나간 예약은 여기서 걷어낸다 — 안 그러면 원장이 무한정 커진다.
        val cutoff = System.currentTimeMillis() - KEEP_PAST_MS
        val it = map.entries.iterator()
        while (it.hasNext()) {
            val e = it.next().value
            if (e.triggerAtMs < cutoff && e.recurrence != "weekly") it.remove()
        }
        val arr = JSONArray()
        for (e in map.values) arr.put(toJson(e))
        prefs(context).edit().putString(KEY, arr.toString()).apply()
    }

    // device-protected 저장소에 둔다 — 잠금해제 전(Direct Boot)에도 BootReceiver가 원장을
    // 읽어 예약을 되살릴 수 있어야 하기 때문. 자세한 배경은 DeviceStorage 참고.
    private fun prefs(context: Context) = DeviceStorage.prefs(context, PREFS)

    private fun toJson(e: Entry) = JSONObject().apply {
        put("rc", e.requestCode)
        put("at", e.triggerAtMs)
        put("title", e.title)
        put("body", e.body)
        put("rec", e.recurrence)
        put("h", e.hour)
        put("m", e.min)
        put("wd", e.weekday)
        put("snd", e.soundOn)
        put("vib", e.vibOn)
        put("vol", e.volume.toDouble())
        put("base", e.baseAlarmId)
    }

    private fun fromJson(o: JSONObject) = Entry(
        requestCode = o.getInt("rc"),
        triggerAtMs = o.getLong("at"),
        title = o.optString("title", "⏰ 알람"),
        body = o.optString("body", ""),
        recurrence = o.optString("rec", "once"),
        hour = o.optInt("h", 0),
        min = o.optInt("m", 0),
        weekday = o.optInt("wd", -1),
        soundOn = o.optBoolean("snd", true),
        vibOn = o.optBoolean("vib", true),
        volume = o.optDouble("vol", 1.0).toFloat(),
        baseAlarmId = o.optInt("base", -1),
    )
}
