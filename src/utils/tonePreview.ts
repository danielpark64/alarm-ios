// 알람 소리 미리듣기 — 소리 고르기 시트에서만 쓴다. 미디어 음량으로 3초(TONE_PREVIEW_MS)만 재생하고,
// 실제 알람 예약·울림 경로와는 완전히 별개다(Android AlarmModule.previewTone, iOS AlarmappAlarmKit.previewSound).
import { Platform, NativeModules } from 'react-native';
import { toneIosFile, normalizeTone, TONE_PREVIEW_MS } from '../constants';
import { previewIosSound, stopIosPreview } from './notifications/alarmkit';

export function previewTone(id: unknown) {
  if (Platform.OS === 'android') {
    try { NativeModules.AlarmModule?.previewTone?.(normalizeTone(id), TONE_PREVIEW_MS); } catch {}
  } else {
    previewIosSound(toneIosFile(id), TONE_PREVIEW_MS);
  }
}

export function stopTonePreview() {
  if (Platform.OS === 'android') {
    try { NativeModules.AlarmModule?.stopPreview?.(); } catch {}
  } else {
    stopIosPreview();
  }
}
