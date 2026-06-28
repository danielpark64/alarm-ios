package com.danielpark.alarmapp

// Android AlarmManager PendingIntent request-code 산식.
// src/utils/notifications/alarmIds.ts(JS)와 동일한 규칙을 공유하는 단일 소스.
object AlarmIds {

    const val SNOOZE_REQUEST_CODE = 9002

    // 같은 시간대 묶음 재알림(+1분/+2분) 슬롯
    fun repSlotId(alarmId: Int, repIdx: Int): Int = alarmId * 100 + 50 + repIdx

    // 날짜 기반(once/cycle/rest) 메인 트리거: 알람당 최대 14개(idx 0~13)
    fun mainNativeId(alarmId: Int, idx: Int): Int = alarmId * 1000 + idx

    // wdcustom(요일 선택) 메인 트리거: 요일별(0~6) 슬롯
    fun weekdaySlotId(alarmId: Int, day: Int): Int = alarmId * 100 + 3 + day
}
