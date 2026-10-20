import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pushOwnShare, readSiblingEvents, siblingShareAvailable } from '../utils/sayramShareNative';
import { shareEnabled, type SiblingEvents } from '../utils/sayramShare';

// 세이람과 일정 공유 스위치(기본 꺼짐)와, 같은 폰의 세이람에서 읽어 온 일정.
// 한쪽 앱 설정만 켜도 공유된다 — 내 스위치가 꺼져 있어도 세이람 쪽이 켜져 있으면 일정을 보여 준다(siblingOn).
// 근무표 쓰기(내 파일)는 알람·하루 근무 변경을 가진 app/index.tsx가 publishOwnShare로 한다.
// 세이람에 넣어 주기는 앱을 떠날 때(background) 여기서 한 번 — 바뀐 게 없으면 세이람을 건드리지 않는다(v3).
const KEY = 'sayram_share_v1';

interface Ctx {
  available: boolean;              // 이 기기에서 자동 공유가 되는가(Android·iOS)
  mine: boolean;                   // 교대알람 쪽 스위치
  mineLoaded: boolean;             // 저장된 스위치를 읽었는가 — 읽기 전에 "꺼짐"을 써 버리지 않게
  siblingOn: boolean;              // 세이람 쪽 스위치
  events: SiblingEvents | null;    // 공유가 꺼져 있으면 null
  setMine: (v: boolean) => void;
}
const Context = createContext<Ctx>({ available: false, mine: false, mineLoaded: false, siblingOn: false, events: null, setMine: () => {} });

export function SayramShareProvider({ children }: { children: React.ReactNode }) {
  const [mine, setMineState] = useState(false);
  const [mineLoaded, setMineLoaded] = useState(!siblingShareAvailable);
  const [siblingOn, setSiblingOn] = useState(false);
  const [events, setEvents] = useState<SiblingEvents | null>(null);
  const lastRaw = useRef<string | null | undefined>(undefined);
  const gen = useRef(0); // 늦게 끝난 앞 읽기가 뒤 읽기 결과를 덮지 않게(스위치를 켰다 바로 끄는 경우 등)
  const mineRef = useRef(mine);
  mineRef.current = mine;

  useEffect(() => {
    if (!siblingShareAvailable) return;
    AsyncStorage.getItem(KEY).then(raw => { if (raw === '1') setMineState(true); }).catch(() => {}).finally(() => setMineLoaded(true));
  }, []);

  const refresh = useCallback(async () => {
    if (!siblingShareAvailable) return;
    const my = ++gen.current;
    const r = await readSiblingEvents(mineRef.current);
    if (my !== gen.current) return;
    setSiblingOn(prev => (prev === r.siblingOn ? prev : r.siblingOn));
    // 읽은 내용이 직전과 같으면 상태를 바꾸지 않는다 — 앱이 앞으로 올 때마다 달력 전체가 다시 그려지지 않게
    if (r.raw === lastRaw.current) return;
    lastRaw.current = r.raw;
    setEvents(r.events);
  }, []);

  // 시작할 때와 스위치를 바꿀 때 읽고, 앱이 앞으로 올 때마다 다시 읽는다(받은 파일만 읽는다 — 주기적으로 읽지 않는다).
  // 떠날 때는 바뀐 것만 세이람에 넣어 준다.
  useEffect(() => { if (mineLoaded) refresh(); }, [mineLoaded, mine, refresh]);
  useEffect(() => {
    if (!siblingShareAvailable) return;
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') refresh();
      else if (s === 'background') pushOwnShare(mineRef.current);
    });
    return () => sub.remove();
  }, [refresh]);

  const setMine = useCallback((v: boolean) => {
    setMineState(v);
    AsyncStorage.setItem(KEY, v ? '1' : '0').catch(() => {});
  }, []);

  return (
    // 그리는 쪽에 넘기기 전에 한 번 더 거른다 — 공유가 꺼져 있으면(양쪽 스위치 모두 꺼짐) 어떤 경우에도 일정을 보이지 않는다
    <Context.Provider value={{ available: siblingShareAvailable, mine, mineLoaded, siblingOn, events: shareEnabled(mine, { share: siblingOn }) ? events : null, setMine }}>
      {children}
    </Context.Provider>
  );
}

export function useSayramShare() { return useContext(Context); }
