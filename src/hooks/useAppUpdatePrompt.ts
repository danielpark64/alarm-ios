// 새 버전 안내(1.6.3) — 앱을 열 때 뒤에서 스토어 판을 확인하고, 새 판이 있으면 "새 버전이 있어요" 창을 띄운다.
// 규칙(본부/규칙/업데이트-안내.md):
//  - 울리는 중·울림 화면에서는 절대 안 띄운다 — JS 울림 상태(ringing) + Android는 띄우기 직전 네이티브 울림(getCurrentRinging)도 본다.
//  - 시작 안내 창(알림·AlarmKit 시스템 창 → 표시 권한 → 알람 화면 권한 → 첫 실행 따라하기)이 다 끝난 뒤(ready)에만.
//  - 확인은 앱 시작을 기다리게 하지 않는다(뒤에서, 실패는 조용히). [나중에]를 누른 날은 다시 안 묻는다.
// 판정은 utils/appUpdate.ts(순수, logic-tests), 확인은 utils/appUpdateNative.ts. 다른 앱으로 옮길 때 그대로 쓴다.
import { useEffect, useRef, useState, useCallback } from 'react';
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dayKey, shouldShowUpdate, type UpdateInfo } from '../utils/appUpdate';
import { checkForUpdate } from '../utils/appUpdateNative';
import { openStore } from '../utils/storeLink';

const LATER_DAY_KEY = '@appUpdateLaterDay';
const START_DELAY_MS = 2000; // 시작 직후 할 일(알람 재예약 등)과 겹치지 않게 조금 뒤에

/** Android: 네이티브(AlarmService)가 지금 울리는 중인가. 다른 앱은 AlarmModule이 없으면 늘 false */
async function nativeRinging(): Promise<boolean> {
  const m = NativeModules.AlarmModule;
  if (Platform.OS !== 'android' || !m?.getCurrentRinging) return false;
  return !!(await m.getCurrentRinging().catch(() => null));
}

export function useAppUpdatePrompt(o: { loaded: boolean; ready: boolean; ringing: boolean }) {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [laterDay, setLaterDay] = useState<string | null | undefined>(undefined); // undefined = 아직 못 읽음
  const [closed, setClosed] = useState(false);       // 이번 실행에서 닫음
  const [nativeOk, setNativeOk] = useState(false);   // 띄우기 직전 네이티브 울림 확인을 통과
  const started = useRef(false);

  // 뒤에서 확인 — await로 시작을 붙잡지 않는다
  useEffect(() => {
    if (!o.loaded || started.current) return;
    started.current = true;
    AsyncStorage.getItem(LATER_DAY_KEY).then(v => setLaterDay(v), () => setLaterDay(null));
    const timer = setTimeout(() => { checkForUpdate().then(setInfo).catch(() => null); }, START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [o.loaded]);

  const today = dayKey(new Date());
  const want = !closed && o.ready && laterDay !== undefined
    && shouldShowUpdate({ info, laterDay: laterDay ?? null, today, ringing: o.ringing });

  useEffect(() => {
    if (!want || nativeOk) return;
    let alive = true;
    nativeRinging().then(r => { if (alive && !r) setNativeOk(true); }).catch(() => {});
    return () => { alive = false; };
  }, [want, nativeOk]);

  const onUpdate = useCallback(() => {
    openStore();
    if (!info?.required) setClosed(true);
  }, [info]);

  const onLater = useCallback(() => {
    setClosed(true);
    const d = dayKey(new Date());
    setLaterDay(d);
    AsyncStorage.setItem(LATER_DAY_KEY, d).catch(() => {});
  }, []);

  /** 개발용 미리보기(딥링크 updatePreview=1) — 확인 없이 창만 띄운다 */
  const preview = useCallback(() => {
    setClosed(false); setLaterDay(null); setInfo({ storeVersion: 'preview', required: false });
  }, []);

  return { visible: want && nativeOk && !o.ringing, required: !!info?.required, onUpdate, onLater, preview };
}
