// iOS 위젯 네이티브 연결(modules/alarmapp-widget) — 계산은 iosWidget.ts, 여기는 넘겨 주기만 한다.
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Alarm, DayOverrides } from '../constants';
import { buildIosWidgetData } from './iosWidget';

const native = requireOptionalNativeModule<{ update(json: string): void }>('AlarmappWidget');

export function syncIosWidget(alarms: Alarm[], overrides: DayOverrides) {
  try { native?.update(buildIosWidgetData(alarms, overrides, new Date())); } catch {}
}
