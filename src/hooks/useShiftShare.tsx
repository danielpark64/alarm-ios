import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Alert, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { useT } from '../i18n';
import { Alarm, DayOverrides } from '../constants';
import {
  buildShareBody, buildShareLink, buildShareMessage, parseShareLink, decideIncoming, pickAutoColor, nextSeq, newSenderId, dataOf,
  type SharedPerson, type ShiftData,
} from '../utils/shiftShareLink';
import { ShareReceiveModal, type ReceiveDraft } from '../components/Home/ShareReceiveModal';

// 근무표 공유(1.6.0) — 받은 사람 목록(이름·색·근무표 원문만), 전체 창 설정, 보내기·받기.
// ⚠️ 여기 데이터는 [공유] 탭(ShareTab) 표시에만 쓴다 — 내 달력(CalendarView)은 이 훅을 모른다(정적 체크 ④).
// ⚠️ 알람과도 무관: 알람 예약(notifications/*)·useAlarms로 절대 넘기지 않는다(정적 체크 — test-alarm-suite.sh).
// 받기: 1.6.0에서 새로 등록한 앱 주소(alarmappshare://)로 앱이 열리면 "근무표를 받을까요?" 팝업.
const K_PEOPLE = 'shift_share_people_v1';
const K_TOGETHER = 'shift_share_together_v1';
const K_SENDER = 'shift_share_sender_v1';

export type SharedPersonView = SharedPerson & { data: ShiftData | null };

interface Ctx {
  people: SharedPersonView[];
  together: boolean;                 // [다 같이 쉬는 날 보기] — 기본 꺼짐
  setTogether: (v: boolean) => void;
  setVisible: (id: string, v: boolean) => void;
  editPerson: (id: string, patch: { name?: string; color?: string }) => void;
  removePerson: (id: string) => void;
  sendShare: (alarms: Alarm[], overrides: DayOverrides) => Promise<void>;
  incomingSeq: number;               // 공유 링크로 열릴 때마다 +1 — 메인 화면이 [공유] 탭으로 옮긴다
}
const Context = createContext<Ctx>({
  people: [], together: false, setTogether: () => {}, setVisible: () => {}, editPerson: () => {}, removePerson: () => {},
  sendShare: async () => {}, incomingSeq: 0,
});

export function ShiftShareProvider({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const [people, setPeople] = useState<SharedPerson[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [together, setTogetherState] = useState(false);
  const senderRef = useRef<string | null>(null);
  const [draft, setDraft] = useState<ReceiveDraft | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [incomingSeq, setIncomingSeq] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [p, tg, sid] = await Promise.all([AsyncStorage.getItem(K_PEOPLE), AsyncStorage.getItem(K_TOGETHER), AsyncStorage.getItem(K_SENDER)]);
        const list = p ? JSON.parse(p) : [];
        if (Array.isArray(list)) setPeople(list.filter((x: any) => x && typeof x.id === 'string' && typeof x.body === 'string'));
        setTogetherState(tg === '1');
        senderRef.current = sid;
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const save = useCallback((next: SharedPerson[]) => {
    setPeople(next);
    AsyncStorage.setItem(K_PEOPLE, JSON.stringify(next)).catch(() => {});
  }, []);
  const peopleRef = useRef(people);
  peopleRef.current = people;

  // 같은 주소를 다시 눌러도(업데이트 뒤 다시 누르기 등) 동작해야 해서 useURL이 아니라 이벤트로 받는다
  useEffect(() => {
    Linking.getInitialURL().then(u => { if (u) setPendingUrl(u); }).catch(() => {});
    const sub = Linking.addEventListener('url', e => setPendingUrl(e.url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!loaded || !pendingUrl) return;
    const url = pendingUrl;
    setPendingUrl(null);
    const r = parseShareLink(url);
    if (!r.ok) {
      if (r.reason === 'notShare') return; // 개발 딥링크·위젯 등 다른 주소
      setIncomingSeq(n => n + 1);
      const msg = r.reason === 'version' ? t('새 형식의 근무표예요. 앱을 최신 버전으로 업데이트한 뒤 링크를 다시 눌러 주세요.')
        : r.reason === 'expired' ? t('기간이 다 지난 근무표예요. 새로 보내 달라고 해 주세요.')
        : r.reason === 'tooLong' ? t('링크가 너무 길어서 읽을 수 없어요.')
        : t('근무표 링크를 읽을 수 없어요. 링크가 잘렸는지 확인해 주세요.');
      Alert.alert(t('근무표 받기'), msg);
      return;
    }
    setIncomingSeq(n => n + 1); // 받기 팝업은 [공유] 탭 위에서
    const d = decideIncoming(peopleRef.current, r.sender, r.data.sentAt!, senderRef.current ?? undefined);
    if (d.kind === 'self') { Alert.alert(t('근무표 받기'), t('내가 보낸 근무표예요.')); return; }
    if (d.kind === 'same') { Alert.alert(t('근무표 받기'), t('이미 받은 근무표예요.')); return; }
    setDraft({
      sender: r.sender, body: r.body, data: r.data,
      update: d.kind === 'update' ? d.person : null,
      seq: d.kind === 'update' ? d.person.seq : nextSeq(peopleRef.current),
      color: d.kind === 'update' ? d.person.color : pickAutoColor(peopleRef.current.map(p => p.color)),
    });
  }, [loaded, pendingUrl, t]);

  const accept = useCallback((name: string, color: string) => {
    if (!draft) return;
    const cur = peopleRef.current;
    const now = Date.now();
    if (draft.update) {
      save(cur.map(p => p.id === draft.sender ? { ...p, body: draft.body, receivedAt: now } : p));
    } else {
      save([...cur, { id: draft.sender, name: name.trim().slice(0, 20), seq: draft.seq, color, visible: true, receivedAt: now, body: draft.body }]);
    }
    setDraft(null);
  }, [draft, save]);

  const setTogether = useCallback((v: boolean) => {
    setTogetherState(v);
    AsyncStorage.setItem(K_TOGETHER, v ? '1' : '0').catch(() => {});
  }, []);
  const setVisible = useCallback((id: string, v: boolean) => save(peopleRef.current.map(p => p.id === id ? { ...p, visible: v } : p)), [save]);
  const editPerson = useCallback((id: string, patch: { name?: string; color?: string }) =>
    save(peopleRef.current.map(p => p.id === id ? { ...p, ...(patch.name != null ? { name: patch.name.trim().slice(0, 20) } : {}), ...(patch.color ? { color: patch.color } : {}) } : p)), [save]);
  const removePerson = useCallback((id: string) => save(peopleRef.current.filter(p => p.id !== id)), [save]);

  const sendShare = useCallback(async (alarms: Alarm[], overrides: DayOverrides) => {
    let sid = senderRef.current;
    if (!sid) {
      sid = newSenderId();
      senderRef.current = sid;
      AsyncStorage.setItem(K_SENDER, sid).catch(() => {});
    }
    const body = buildShareBody(alarms, overrides, new Date());
    const link = buildShareLink(body, sid);
    try {
      // 요약 줄 + 빈 줄 + '눌러서 교대알람에서 보기 ▶ 링크'(세이람 보내기 글과 같은 모양). 데이터는 링크 # 뒤 — 서버로 가지 않는다
      await Share.share({ message: buildShareMessage(body, link) });
    } catch {}
  }, [t]); // t가 바뀌면(언어 변경) 새로 — 글은 utils의 t(현재 언어)로 만든다

  // 근무표는 원문으로만 저장하고 읽을 때 한 번 편다(사람이 바뀔 때만)
  const views = useMemo(() => people.map(p => ({ ...p, data: dataOf(p) })), [people]);

  return (
    <Context.Provider value={{ people: views, together, setTogether, setVisible, editPerson, removePerson, sendShare, incomingSeq }}>
      {children}
      <ShareReceiveModal draft={draft} onCancel={() => setDraft(null)} onAccept={accept} />
    </Context.Provider>
  );
}

export function useShiftShare() { return useContext(Context); }

/** 창에 보일 이름 — 지은 이름이 없으면 받은 순서대로 공유1·공유2… */
export function personName(p: { name: string; seq: number }, t: (k: string, v?: Record<string, string | number>) => string): string {
  return p.name || t('공유{n}', { n: p.seq });
}
