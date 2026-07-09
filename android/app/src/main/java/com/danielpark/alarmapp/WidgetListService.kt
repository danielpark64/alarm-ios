package com.danielpark.alarmapp

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import org.json.JSONObject

class WidgetListService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory =
        WidgetListFactory(applicationContext)
}

class WidgetListFactory(private val ctx: Context) : RemoteViewsService.RemoteViewsFactory {
    private data class DayItem(val dayLabel: String, val shiftLabel: String, val color: String)
    private val items = mutableListOf<DayItem>()

    override fun onCreate() { load() }
    override fun onDataSetChanged() { load() }
    override fun onDestroy() {}

    private fun load() {
        items.clear()
        val prefs = ctx.getSharedPreferences("AlarmWidgetData", Context.MODE_PRIVATE)
        val json = prefs.getString("widgetData", null) ?: return
        val parsed = runCatching { JSONObject(json) }.getOrNull() ?: return
        val weekData = parsed.optJSONArray("weekSchedule") ?: return
        val dayNames = listOf("월", "화", "수", "목", "금", "토", "일")
        for (i in 0 until minOf(weekData.length(), 7)) {
            val day = weekData.optJSONObject(i) ?: continue
            val isOff   = day.optBoolean("isOff", false)
            val isToday = day.optBoolean("isToday", false)
            val shift   = day.optString("shift", "")
            val eventsArr = day.optJSONArray("events")
            val eventStr = if (eventsArr != null && eventsArr.length() > 0) {
                " / " + (0 until eventsArr.length()).map { eventsArr.getString(it) }.joinToString("/")
            } else ""
            val label   = when {
                isOff              -> "비번"
                shift.isNotEmpty() -> shift
                else               -> "-"
            } + eventStr + if (isToday) " ◀" else ""
            val shiftColor = day.optString("color", "#c8c8e0").ifEmpty { "#c8c8e0" }
            val color = when {
                isToday -> "#ffffff"
                isOff   -> "#f06565"
                else    -> shiftColor
            }
            items.add(DayItem(dayNames[i], label, color))
        }
    }

    override fun getCount() = items.size
    override fun getViewTypeCount() = 1
    override fun getItemId(pos: Int) = pos.toLong()
    override fun hasStableIds() = true
    override fun getLoadingView() = null

    override fun getViewAt(pos: Int): RemoteViews {
        val item = items.getOrNull(pos) ?: return RemoteViews(ctx.packageName, R.layout.widget_list_item)
        val views = RemoteViews(ctx.packageName, R.layout.widget_list_item)
        views.setTextViewText(R.id.widget_list_day, item.dayLabel)
        views.setTextViewText(R.id.widget_list_shift, item.shiftLabel)
        views.setTextColor(R.id.widget_list_day, Color.parseColor(
            if (item.color == "#ffffff") "#aaaacc" else "#888899"
        ))
        views.setTextColor(R.id.widget_list_shift, Color.parseColor(item.color))
        return views
    }
}
