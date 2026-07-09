package com.danielpark.alarmapp

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.widget.RemoteViews
import org.json.JSONObject

class AlarmWidgetMedium : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
        ids.forEach { updateWidget(ctx, mgr, it, R.layout.widget_medium) }
    }
}

class AlarmWidgetLarge : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
        ids.forEach { updateWidget(ctx, mgr, it, R.layout.widget_large) }
    }
}

fun updateWidget(ctx: Context, mgr: AppWidgetManager, widgetId: Int, layout: Int) {
    val prefs = ctx.getSharedPreferences("AlarmWidgetData", Context.MODE_PRIVATE)
    val json   = prefs.getString("widgetData", null)
    val parsed = if (json != null) runCatching { JSONObject(json) }.getOrNull() else null

    val nextAlarm    = parsed?.optString("nextAlarm", "--:--") ?: "--:--"
    val shiftName    = parsed?.optString("shiftName", "--") ?: "--"
    val shiftColor   = parsed?.optString("shiftColor", "#a29bfe") ?: "#a29bfe"
    val isOffToday   = parsed?.optBoolean("isOffToday", false) ?: false
    val daysUntilOff = parsed?.optInt("daysUntilOff", -1) ?: -1

    val views = RemoteViews(ctx.packageName, layout)

    val openIntent = Intent(ctx, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val pi = PendingIntent.getActivity(ctx, 0, openIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    views.setOnClickPendingIntent(R.id.widget_root, pi)

    views.setTextViewText(R.id.widget_alarm_time, nextAlarm)
    views.setTextViewText(R.id.widget_shift_name, if (isOffToday) "비번" else shiftName)

    val dotColor = if (isOffToday) "#f06565" else shiftColor
    views.setTextColor(R.id.widget_shift_dot, Color.parseColor(dotColor))
    views.setTextColor(R.id.widget_shift_name, Color.parseColor(dotColor))

    // 비번 D-day (중/대 공통)
    val offText = when {
        isOffToday       -> "오늘 비번! 🎉"
        daysUntilOff > 0 -> "비번 ${daysUntilOff}일 후"
        else             -> "비번 없음"
    }
    views.setTextViewText(R.id.widget_off_text, offText)
    views.setTextViewText(R.id.widget_off_icon, if (isOffToday) "🎉" else "🔴")

    // 대 위젯: ListView 연결
    if (layout == R.layout.widget_large) {
        val listIntent = Intent(ctx, WidgetListService::class.java).apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
            data = Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
        }
        views.setRemoteAdapter(R.id.widget_list, listIntent)
        mgr.notifyAppWidgetViewDataChanged(widgetId, R.id.widget_list)
    }

    mgr.updateAppWidget(widgetId, views)
}

fun refreshAllWidgets(ctx: Context) {
    val mgr = AppWidgetManager.getInstance(ctx)

    listOf(
        AlarmWidgetMedium::class.java to R.layout.widget_medium,
        AlarmWidgetLarge::class.java  to R.layout.widget_large,
    ).forEach { (cls, layout) ->
        val ids = mgr.getAppWidgetIds(ComponentName(ctx, cls))
        ids.forEach { updateWidget(ctx, mgr, it, layout) }
    }
}
