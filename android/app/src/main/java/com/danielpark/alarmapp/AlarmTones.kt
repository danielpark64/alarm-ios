package com.danielpark.alarmapp

/**
 * 알람 소리 id → res/raw 리소스(2026-11-23 알람 소리 고르기).
 *
 * id 표는 JS src/constants/alarmTones.ts와 반드시 같아야 한다(정적 체크 ⑦이 양쪽을 대조한다).
 * 알 수 없는 id(옛 예약·깨진 원장)는 기본음 — 소리가 안 나는 것보다 낫다.
 * ⚠️ R.raw.alarm_long은 이 파일에서만 쓴다. 다른 곳에 박으면 그 경로만 고른 소리를 무시한다.
 */
object AlarmTones {
    const val DEFAULT = "default"

    fun rawRes(tone: String?): Int = when (tone) {
        "beep"     -> R.raw.snd_beep
        "chime"    -> R.raw.snd_chime
        "oldclock" -> R.raw.snd_oldclock
        "marimba"  -> R.raw.snd_marimba
        "piano"    -> R.raw.snd_piano
        "musicbox" -> R.raw.snd_musicbox
        else       -> R.raw.alarm_long
    }
}
