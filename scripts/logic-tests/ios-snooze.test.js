// 1.6.4 iOS [5분 후 다시] — 세이람과 문구·간격·버튼 순서를 맞추고, 스누즈 뒷정리(고친버그 30·31번)가 iOS에도 적용되는지.
//  ① 문구: 알림 버튼·AlarmKit 버튼이 세이람(lib/i18n/*.ts '알람 끄기'·'5분 후 다시')과 9개 언어 모두 같다.
//  ② 버튼 구성: iOS는 [알람 끄기, 5분 후 다시] 순서, Android 알림·워치는 [알람 끄기]만(Doze — 네이티브 울림 카드가 스누즈 담당).
//  ③ 원래 발화 시각: 받은 알림의 표시 시각에서 보조 알림 순번×간격을 빼고 분 단위로 내린다.
//  ④ iOS 스누즈 기록 판정: 그룹이면 하나라도 그대로 울리면 유지, 다 바뀌면 취소. 오래된 기록은 정리.
//  ⑤ AlarmKit 카운트다운(다시 울림 대기) 중 일정이 바뀐 알람은 cancelAll의 남길 목록에서 뺀다.
//  ⑥ 자정 넘은 '한 번' 알람 자동 끄기 제외가 여러 스누즈 기록(iOS)도 본다.
module.exports = (U, M) => {
  const S = M.snoozeCheck;
  const R = M.alarmResponse;
  const C = M.ringCard;
  check('snoozeCheck·alarmResponse·ringCard 모듈이 있다', !!S && !!R && !!C);
  if (!S || !R || !C) return;
  const tr = M.translate && M.translate.t;

  // ── ① 세이람 문구(~/dev/sayram/lib/i18n, 2026-11-25) ──
  const SAYRAM = {
    ko: ['알람 끄기', '5분 후 다시'],
    en: ['Stop alarm', 'Snooze 5 min'],
    ja: ['アラームを止める', '5分後にもう一度'],
    'zh-Hans': ['关闭闹钟', '5分钟后再响'],
    'zh-Hant': ['關閉鬧鐘', '5分鐘後再響'],
    es: ['Detener alarma', 'Posponer 5 min'],
    fr: ['Arrêter l’alarme', 'Répéter dans 5 min'],
    de: ['Alarm stoppen', 'In 5 Min. erneut'],
    pt: ['Parar alarme', 'Adiar 5 min'],
  };
  for (const [lang, [stop, snz]] of Object.entries(SAYRAM)) {
    setLang(lang);
    check(`${lang}: 알람 끄기 = 세이람`, tr && tr('알람 끄기') === stop, tr && tr('알람 끄기'));
    check(`${lang}: 5분 후 다시 = 세이람`, C.snoozeLabel() === snz, C.snoozeLabel());
  }
  setLang('ko');

  // ── ② 버튼 구성(순서 = 세이람: 끄기 → 5분 후 다시) ──
  check('카테고리 버튼 함수가 있다', typeof R.alarmCategoryActions === 'function');
  if (typeof R.alarmCategoryActions === 'function') {
    check('iOS: [stop, snooze]', R.alarmCategoryActions('ios', false).join(',') === 'stop,snooze', R.alarmCategoryActions('ios', false).join(','));
    check('Android: [stop]만(Doze — 알림·워치 스누즈는 끔)', R.alarmCategoryActions('android', false).join(',') === 'stop');
    check('Android도 SNOOZE_ENABLED면 예전처럼 둘', R.alarmCategoryActions('android', true).join(',') === 'stop,snooze');
  }
  check('iOS 5분 후 → 스누즈', R.responseAction('ios', 'snooze', false, 'DEF') === 'snooze');

  // ── ③ 원래 발화 시각 ──
  const at = (y, mo, d, h, mi, s = 0, ms = 0) => new Date(y, mo - 1, d, h, mi, s, ms).getTime();
  check('iosSnoozeOrigin 있다', typeof S.iosSnoozeOrigin === 'function');
  if (typeof S.iosSnoozeOrigin === 'function') {
    check('본 알림 07:00:00.4 → 07:00', S.iosSnoozeOrigin(at(2026, 11, 25, 7, 0, 0, 400), undefined, 30) === at(2026, 11, 25, 7, 0));
    check('보조 3번(30초 간격) 07:01:30 → 07:00', S.iosSnoozeOrigin(at(2026, 11, 25, 7, 1, 30, 200), 3, 30) === at(2026, 11, 25, 7, 0));
    check('보조 10번 07:05:00 → 07:00', S.iosSnoozeOrigin(at(2026, 11, 25, 7, 5, 0, 900), 10, 30) === at(2026, 11, 25, 7, 0));
    check('초 단위로 온 표시 시각도 받는다', S.iosSnoozeOrigin(at(2026, 11, 25, 7, 0, 3) / 1000, 0, 30) === at(2026, 11, 25, 7, 0));
  }

  // ── 식별자 ──
  check('iosSnoozeId 있다', typeof S.iosSnoozeId === 'function');
  if (typeof S.iosSnoozeId === 'function') {
    check('묶음 → snooze_grp_7_0', S.iosSnoozeId({ groupKey: '7_0', alarmIds: [10] }) === 'snooze_grp_7_0');
    check('근무표 알람 → snooze_alarm_30', S.iosSnoozeId({ alarmId: 30 }) === 'snooze_alarm_30');
    check('스누즈를 또 미룸 → 같은 id', S.iosSnoozeId({ snoozeId: 'snooze_alarm_30', alarmId: 30 }) === 'snooze_alarm_30');
    check('알람 정보 없음 → null', S.iosSnoozeId({}) === null);
    check('보조 식별자 → 기록 id', S.iosSnoozeBaseId('snooze_grp_7_0_rep4') === 'snooze_grp_7_0' && S.iosSnoozeBaseId('snooze_alarm_30') === 'snooze_alarm_30');
    check('스누즈 식별자 판별', S.isIosSnoozeNotifId('snooze_alarm_30_rep1') === true && S.isIosSnoozeNotifId('alarm_30_date_2026-11-25') === false && S.isIosSnoozeNotifId('grp_7_0_rep1') === false);
  }

  // ── ④ 기록 판정 ──
  const commute = { id: 10, typeId: 'commute', label: '', rm: 'wdcustom', days: [0, 1, 2, 3, 4, 5, 6], cd: 1, rd: 1, snd: 'none', vib: 'pulse', sd: '2026-11-01', active: true, hour: 7, min: 0 };
  const meal = { ...commute, id: 11, typeId: 'meal' };
  check('iosSnoozeTargets·iosSnoozeStillDue 있다', typeof S.iosSnoozeTargets === 'function' && typeof S.iosSnoozeStillDue === 'function');
  if (typeof S.iosSnoozeTargets === 'function' && typeof S.iosSnoozeStillDue === 'function') {
    withNow('2026-11-25T07:02:00', () => {
      const fire = at(2026, 11, 25, 7, 0);
      const tg = S.iosSnoozeTargets([commute, meal], [10, 11, 99], fire, {});
      check('대상: 지운 알람(99)은 뺀다', tg.length === 2 && tg[0].baseAlarmId === 10 && tg[0].workDate === '2026-11-25' && tg[0].fireAt === fire, JSON.stringify(tg));
      const rec = { id: 'snooze_grp_7_0', snoozeAt: at(2026, 11, 25, 7, 7), targets: tg };
      check('그대로(앱만 다시 염) → 유지', S.iosSnoozeStillDue([commute, meal], rec, {}) === true);
      check('하나만 이날 끄기 → 유지(다른 알람이 그대로)', S.iosSnoozeStillDue([{ ...commute, skips: ['2026-11-25'] }, meal], rec, {}) === true);
      check('둘 다 시간 변경 → 취소', S.iosSnoozeStillDue([{ ...commute, min: 30 }, { ...meal, min: 30 }], rec, {}) === false);
      check('둘 다 삭제 → 취소', S.iosSnoozeStillDue([], rec, {}) === false);
      check('출근 하루 근무 변경(연차) + 식사 끔 → 취소', S.iosSnoozeStillDue([commute, { ...meal, active: false }], rec, { '2026-11-25': { kind: 'annual' } }) === false);
      check('대상 없는 기록 → 취소', S.iosSnoozeStillDue([commute], { ...rec, targets: [] }, {}) === false);
      check('울린 지 오래된 기록 → 정리', S.iosSnoozeExpired(rec, at(2026, 11, 25, 7, 20), 6 * 60_000) === true);
      check('아직 울릴 기록 → 정리 안 함', S.iosSnoozeExpired(rec, at(2026, 11, 25, 7, 3), 6 * 60_000) === false);
    });
  }

  // ── ⑤ AlarmKit 카운트다운 ──
  check('alarmKitKeepIds 있다', typeof S.alarmKitKeepIds === 'function');
  if (typeof S.alarmKitKeepIds === 'function') {
    withNow('2026-11-25T07:03:00', () => {
      const now = Date.now();
      const fixed = { alarmId: 10, state: 'countdown', when: at(2026, 11, 25, 7, 0) };
      const keep = (alarms, entries, ov = {}) => S.alarmKitKeepIds(alarms, entries, ov, now).sort().join(',');
      check('카운트다운 그대로 → 남김', keep([commute, meal], [fixed]) === '10,11');
      check('카운트다운 중 이날 끄기 → 그 알람만 뺌', keep([{ ...commute, skips: ['2026-11-25'] }, meal], [fixed]) === '11');
      check('카운트다운 중 시간 변경 → 뺌', keep([{ ...commute, min: 30 }, meal], [fixed]) === '11');
      check('카운트다운 중 하루 근무 변경(연차) → 뺌', keep([commute, meal], [fixed], { '2026-11-25': { kind: 'annual' } }) === '11');
      check('예약 상태(scheduled)는 판정 안 함', keep([{ ...commute, min: 30 }, meal], [{ ...fixed, state: 'scheduled' }]) === '10,11');
      check('울리는 중(alerting)은 그대로 남김', keep([{ ...commute, min: 30 }, meal], [{ ...fixed, state: 'alerting' }]) === '10,11');
      check('요일 반복(weekly 07:00) 카운트다운 그대로 → 남김', keep([commute], [{ alarmId: 10, state: 'countdown', when: 'weekly 07:00' }]) === '10');
      check('요일 반복 카운트다운 중 시간 변경 → 뺌', keep([{ ...commute, min: 30 }], [{ alarmId: 10, state: 'countdown', when: 'weekly 07:00' }]) === '');
      check('꺼진 알람은 원래부터 안 남김', keep([{ ...commute, active: false }, meal], []) === '11');
      check('weekly 시각 → 지난 그 시각', S.alarmKitFireAt('weekly 07:00', now) === at(2026, 11, 25, 7, 0));
      check('weekly 시각이 아직이면 어제', S.alarmKitFireAt('weekly 23:00', now) === at(2026, 11, 24, 23, 0));
    });
  }

  // ── ⑥ 한 번 알람 자동 끄기 제외(여러 기록) ──
  const once = { id: 40, typeId: 'commute', label: '', rm: 'once', days: [], cd: 1, rd: 1, snd: 'none', vib: 'pulse', sd: '2026-11-25', active: true, hour: 23, min: 58 };
  const oz = { baseAlarmId: 40, workDate: '2026-11-25', fireAt: at(2026, 11, 25, 23, 58) };
  check('여러 기록 중 하나라도 이 알람이면 남김', S.keepOnceForSnooze(once, [{ ...oz, baseAlarmId: 7 }, oz]) === true);
  check('여러 기록에 없으면 끔', S.keepOnceForSnooze(once, [{ ...oz, baseAlarmId: 7 }]) === false);
  check('빈 목록이면 끔', S.keepOnceForSnooze(once, []) === false);
};
