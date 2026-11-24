// 알람 화면 권한 안내 창(1.6.1, 세이람 0eb9d8b 이식) — 3일에 한 번, 켜진 알람이 있을 때만.
//   Android 14+: "다른 앱 위에 표시"가 켜진 뒤에도 "전체 화면 알림"이 꺼져 있으면 → 허용 화면으로
//   iOS 26+: AlarmKit("알람 및 타이머")을 거부했으면 → 설정 앱의 이 앱 화면으로
// "다른 앱 위에 표시" 안내는 원래 있던 것(app/index.tsx showOverlayPrompt, 앱을 켤 때마다) 그대로 — 여기서 겹쳐 묻지 않는다.
// 무엇을·언제 물을지는 순수 함수(src/utils/alarmScreenAsk.ts, logic-tests)에서 정한다.
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alarm } from '../constants';
import { useT } from '../i18n';
import { nextAlarmScreenNeed, shouldAskAlarmScreen, type AlarmScreenNeed } from '../utils/alarmScreenAsk';
import { alarmScreenEnv, openAlarmKitPermission, openFullScreenIntentSettings } from '../utils/alarmScreenNative';

const ASKED_AT_KEY = '@alarmScreenAskedAt';

/** ready: 시작 때 뜨는 권한 창(알림·AlarmKit 시스템 창, 표시 권한 확인)이 끝났는지 — 창이 겹치지 않게 그 뒤에만 */
export function useAlarmScreenAsk(alarms: Alarm[], loaded: boolean, ready: boolean) {
  const { t } = useT();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !loaded || !ready) return;
    done.current = true; // 앱을 켤 때 한 번만 본다
    (async () => {
      const hasActive = alarms.some(a => a.active);
      const last = Number(await AsyncStorage.getItem(ASKED_AT_KEY).catch(() => null)) || 0;
      const now = Date.now();
      if (!shouldAskAlarmScreen(last, now, hasActive)) return;
      const need = nextAlarmScreenNeed(await alarmScreenEnv());
      if (!need) return;
      AsyncStorage.setItem(ASKED_AT_KEY, String(now)).catch(() => {});
      ask(need);
    })();
  }, [loaded, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const ask = (need: AlarmScreenNeed) => {
    const title = need === 'alarmkit' ? t('알람을 시계 앱처럼 울리려면') : t('잠금 화면에 알람 띄우기');
    const body = need === 'alarmkit'
      ? t('무음·집중 모드에서도 시계 앱처럼 화면 가득 알람이 울리게 하려면 설정 앱에서 "알람 및 타이머"를 켜 주세요.\n\n"설정으로 이동"을 누르면 이 앱의 설정 화면이 열려요. "알람 및 타이머"를 켜고 돌아오면 돼요.')
      : t('알람이 울릴 때 화면이 꺼져 있거나 잠겨 있어도 끄기 화면이 뜨게 하려면 "전체 화면 알림"을 허용해 주세요.\n\n"설정으로 이동"을 누르면 열리는 화면에서 스위치를 켜고 ← 버튼으로 돌아오면 돼요.');
    Alert.alert(title, body, [
      { text: t('나중에'), style: 'cancel' },
      { text: t('설정으로 이동'), onPress: () => { if (need === 'fsi') openFullScreenIntentSettings(); else openAlarmKitPermission().catch(() => {}); } },
    ]);
  };
}
