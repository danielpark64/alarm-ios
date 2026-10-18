package com.danielpark.alarmapp.share

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri

// 세이람(com.danielpark.sayram)만 읽을 수 있는 읽기 전용 창구.
// content://com.danielpark.alarmapp.share/shifts → 근무표(세이람 달력 칸 표시용)
// content://com.danielpark.alarmapp.share/config → 공유 설정 {"share":true|false,"t":ms}
class ShareProvider : ContentProvider() {
  companion object {
    val ALLOWED = setOf("com.danielpark.sayram")
  }

  override fun onCreate(): Boolean = true

  override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor? {
    val caller = callingPackage ?: return null
    if (caller !in ALLOWED) return null
    val ctx = context ?: return null
    val name = uri.lastPathSegment ?: return null
    val json = ShareFiles.read(ctx, name) ?: return null
    return MatrixCursor(arrayOf("json")).apply { addRow(arrayOf(json)) }
  }

  override fun getType(uri: Uri): String = "application/json"
  override fun insert(uri: Uri, values: ContentValues?): Uri? = null
  override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0
  override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = 0
}
