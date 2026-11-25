// 알람 화면 권한 안내 창(1.6.1, 세이람 0eb9d8b 이식) — 3일에 한 번, 켜진 알람이 있을 때만.
//   Android 14+: "다른 앱 위에 표시"가 켜진 뒤에도 "전체 화면 알림"이 꺼져 있으면 → 허용 화면으로
//   iOS 26+: AlarmKit("알람 및 타이머")을 거부했으면 → 설정 앱의 이 앱 화면으로
// "다른 앱 위에 표시" 안내는 원래 있던 것(app/index.tsx showOverlayPrompt, 앱을 켤 때마다) 그대로 — 여기서 겹쳐 묻지 않는다.
// 무엇을·언제 물을지는 순수 함수(src/utils/alarmScreenAsk.ts, logic-tests)에서 정한다.
// 1.6.2(세이람 1.2.3 App.tsx maybeAskAlarmScreenAfterSave에서 가져옴): 알림 권한이 꺼져 있으면 먼저 묻고('notif'),
//   알람을 저장한 직후에도 꺼진 것('다른 앱 위에 표시' 포함)이 있으면 한 실행에 한 번 묻는다(askAfterSave).
//   배터리 최적화는 묻지 않는다 — 설정 화면 줄에서만(사용자 결정 2026-11-25).
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alarm } from '../constants';
import { useT } from '../i18n';
import { nextAlarmScreenNeed, shouldAskAfterSave, shouldAskAlarmScreen, type AlarmScreenNeed } from '../utils/alarmScreenAsk';
import { alarmScreenEnv, openAlarmKitPermission, openFullScreenIntentSettings, openNotificationSettings } from '../utils/alarmScreenNative';

const ASKED_AT_KEY = '@alarmScreenAskedAt';

/** ready: 시작 때 뜨는 권한 창(알림·AlarmKit 시스템 창, 표시 권한 확인)이 끝났는지 — 창이 겹치지 않게 그 뒤에만.
 *  돌려주는 settled: 이번 실행에서 물을지 정했고 물었다면 창이 닫혔는지 — 뒤이은 새 버전 안내(useAppUpdatePrompt)가 그 뒤에 뜬다. */
/** onOverlay: 저장 직후 '다른 앱 위에 표시'가 꺼져 있을 때 띄울 기존 안내(app/index.tsx showOverlayPrompt — 문구를 하나로) */
export function useAlarmScreenAsk(
  alarms: Alarm[], loaded: boolean, ready: boolean, onOverlay?: () => void,
): { settled: boolean; askAfterSave: (armed: boolean, blocked?: () => boolean) => void } {
  const { t } = useT();
  const done = useRef(false);
  const [settled, setSettled] = useState(false);
  // 이번 실행에서 이미 안내했는지 — 저장 직후 안내는 한 실행에 한 번만(시작 때 물었으면 안 묻는다)
  const askedThisRun = useRef(false);

  useEffect(() => {
    if (done.current || !loaded || !ready) return;
    done.current = true; // 앱을 켤 때 한 번만 본다
    (async () => {
      const hasActive = alarms.some(a => a.active);
      const last = Number(await AsyncStorage.getItem(ASKED_AT_KEY).catch(() => null)) || 0;
      const now = Date.now();
      if (!shouldAskAlarmScreen(last, now, hasActive)) { setSettled(true); return; }
      const need = nextAlarmScreenNeed(await alarmScreenEnv());
      if (!need) { setSettled(true); return; }
      AsyncStorage.setItem(ASKED_AT_KEY, String(now)).catch(() => {});
      ask(need);
    })().catch(() => setSettled(true));
  }, [loaded, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const ask = (need: AlarmScreenNeed) => {
    askedThisRun.current = true;
    if (need === 'overlay') { if (onOverlay) onOverlay(); else setSettled(true); return; }
    const title = need === 'alarmkit' ? t('알람을 시계 앱처럼 울리려면')
      : need === 'notif' ? t('알람 알림을 받으려면')
        : t('잠금 화면에 알람 띄우기');
    const body = need === 'notif'
      ? t('알림이 꺼져 있으면 알람이 울릴 때 알림도 끄기 화면도 뜨지 않아요.\n\n"설정으로 이동"을 누르면 열리는 화면에서 알림을 켜고 돌아오면 돼요.')
      : need === 'alarmkit'
      ? t('무음·집중 모드에서도 시계 앱처럼 화면 가득 알람이 울리게 하려면 설정 앱에서 "알람 및 타이머"를 켜 주세요.\n\n"설정으로 이동"을 누르면 이 앱의 설정 화면이 열려요. "알람 및 타이머"를 켜고 돌아오면 돼요.')
      : t('알람이 울릴 때 화면이 꺼져 있거나 잠겨 있어도 끄기 화면이 뜨게 하려면 "전체 화면 알림"을 허용해 주세요.\n\n"설정으로 이동"을 누르면 열리는 화면에서 스위치를 켜고 ← 버튼으로 돌아오면 돼요.');
    Alert.alert(title, body, [
      { text: t('나중에'), style: 'cancel', onPress: () => setSettled(true) },
      { text: t('설정으로 이동'), onPress: () => {
        setSettled(true);
        if (need === 'notif') openNotificationSettings();
        else if (need === 'fsi') openFullScreenIntentSettings();
        else openAlarmKitPermission().catch(() => {});
      } },
    ]);
  };

  /** 알람을 저장한 직후(armed = 켜진 알람). 저장 화면이 닫힌 뒤 띄우고, 그사이 다른 창이 떴으면(blocked) 이번엔 안 묻는다 */
  const askAfterSave = (armed: boolean, blocked?: () => boolean) => {
    if (!shouldAskAfterSave(armed, askedThisRun.current)) return;
    setTimeout(async () => {
      if (askedThisRun.current || blocked?.()) return;
      const need = nextAlarmScreenNeed(await alarmScreenEnv().catch(() => null) ?? { os: 'none', fullScreenIntent: true, overlay: true, alarmKit: 'unavailable' }, [], { withOverlay: true });
      if (!need || askedThisRun.current || blocked?.()) return;
      AsyncStorage.setItem(ASKED_AT_KEY, String(Date.now())).catch(() => {});
      ask(need);
    }, 700);
  };

  // 시작 때 뜨는 '표시 권한' 안내(app/index.tsx showOverlayPrompt, 앱을 켤 때마다)는 여기 '이번 실행에 물음'에 넣지 않는다 —
  // 넣으면 그 안내를 '취소'한 사람이 알람을 저장해도 다시 안 물어 '저장할 때도 안내'가 사라진다(2026-11-25 지시).
  return { settled, askAfterSave };
}
