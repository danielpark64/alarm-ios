// iOS 위젯 데이터 — 앱을 안 열어도 위젯이 혼자 넘겨 그릴 수 있게 지난달~다음 달 근무표와 앞으로의 알람 시각을 만든다.
module.exports = (U, M) => {
  const W = M.iosWidget;
  check('iosWidget 모듈이 있다', !!W);
  if (!W) return;
  const T = (h, m = 0) => ({ hour: h, min: m });
  // 로테이션: 초번 2일 → 말번 2일 → 비번 1일, 시작 2026-10-18
  const pattern = [
    { blockId: 'a', shift: 'early', days: 2, commuteTime: T(5, 40), hasOffwork: true, offworkTime: T(15) },
    { blockId: 'b', shift: 'late', days: 2, commuteTime: T(13), hasOffwork: true, offworkTime: T(22) },
    { blockId: 'c', shift: 'none', days: 1, isRest: true, hasOffwork: false },
  ];
  const base = { label: '', rm: 'pattern', days: [], cd: 2, rd: 1, snd: 'none', vib: 'pulse', sd: '2026-10-18', active: true, pattern, hour: 5, min: 40 };
  const alarms = [
    { ...base, id: 1, typeId: 'commute', groupRole: 'commute' },
    { ...base, id: 2, typeId: 'offwork', groupRole: 'offwork', hour: 15, min: 0 },
  ];
  const sec = (y, mo, d, h, mi = 0) => Math.floor(new Date(y, mo - 1, d, h, mi).getTime() / 1000);
  const build = (iso, a = alarms, ov = {}) => withNow(iso, () => JSON.parse(W.buildIosWidgetData(a, ov, new Date())));
  const at = (p, ds) => {
    const [y, m, d] = ds.split('-').map(Number);
    const [fy, fm, fd] = p.f.split('-').map(Number);
    const i = Math.round((new Date(y, m - 1, d) - new Date(fy, fm - 1, fd)) / 86400000);
    const k = '0123456789abcdefghijklmnopqrstuvwxyz'.indexOf(p.d[i]);
    return k < 0 ? null : { name: p.l[k], color: p.c[k], off: !!p.o[k] };
  };

  // 기간 — 지난달 1일 ~ 다음 달 말일(달력 위젯 ‹ › 범위)
  const p = build('2026-10-20T10:00:00');
  check('시작은 지난달 1일', p.f === '2026-09-01', p.f);
  check('다음 달 말일까지(9~11월 91일)', p.d.length === 91, String(p.d.length));
  const ye = build('2026-12-15T10:00:00');
  check('연말에는 다음 해 1월 말까지', ye.f === '2026-11-01' && ye.d.length === 92, ye.f + ' ' + ye.d.length);

  // 근무표 — 근무조 이름은 칸에 들어가게 짧게
  check('10/20은 말번', at(p, '2026-10-20')?.name === '말번', JSON.stringify(at(p, '2026-10-20')));
  check('10/22는 비번', at(p, '2026-10-22')?.off === true && at(p, '2026-10-22')?.name === '비번', JSON.stringify(at(p, '2026-10-22')));

  // 알람 시각 — 지금 이후만, 시간순, 울린 뒤 다음 알람으로 넘어갈 수 있게 여러 개
  check('가장 가까운 알람이 맨 앞', p.a[0] === sec(2026, 10, 20, 13), String(p.a[0]));
  check('그다음은 같은 날 퇴근', p.a[1] === sec(2026, 10, 20, 22), String(p.a[1]));
  check('시간순으로 정렬된다', p.a.every((v, i) => i === 0 || p.a[i - 1] < v));
  check('이미 지난 알람은 없다', !p.a.includes(sec(2026, 10, 20, 5, 40)));
  check('비번날에는 울리지 않는다', !p.a.some(v => { const d = new Date(v * 1000); return d.getMonth() === 9 && d.getDate() === 22; }));
  check('두 달 뒤까지 이어진다', p.a[p.a.length - 1] >= sec(2026, 11, 25, 0), String(p.a[p.a.length - 1]));
  check('같은 시각에 다시 만들면 내용이 같다(바뀔 때만 위젯을 새로 그린다)',
    withNow('2026-10-20T10:00:00', () => W.buildIosWidgetData(alarms, {}, new Date()) === W.buildIosWidgetData(alarms, {}, new Date())));

  // 자정 넘는 야간 근무 — 퇴근은 근무일 다음 날 아침
  const night = [{ ...base, id: 3, typeId: 'offwork', groupRole: 'offwork', pattern: [{ blockId: 'n', shift: 'night', days: 1, commuteTime: T(22), hasOffwork: true, offworkTime: T(6) }] }];
  check('야간 퇴근은 다음 날 아침', build('2026-10-20T00:30:00', night).a[0] === sec(2026, 10, 20, 6), String(build('2026-10-20T00:30:00', night).a[0]));

  // 하루 근무 변경·이날 끄기·꺼진 알람·한 번 알람
  const ov = { '2026-10-20': { kind: M.constants.OVERRIDE_KINDS.find(k => k.id === 'annual')?.id ?? M.constants.OVERRIDE_KINDS[0].id } };
  const wo = build('2026-10-20T10:00:00', alarms, ov);
  check('연차 날에는 근무 알람이 빠진다', !wo.a.includes(sec(2026, 10, 20, 13)));
  check('연차 날은 쉬는 날로 표시된다', at(wo, '2026-10-20')?.off === true, JSON.stringify(at(wo, '2026-10-20')));
  const skipped = build('2026-10-20T10:00:00', [{ ...alarms[0], skips: ['2026-10-20'] }, alarms[1]]);
  check('이날 끄기한 알람은 빠진다', !skipped.a.includes(sec(2026, 10, 20, 13)));
  check('이날 끄기해도 근무표는 그대로', at(skipped, '2026-10-20')?.name === '말번');
  const off = build('2026-10-20T10:00:00', alarms.map(a => ({ ...a, active: false })));
  check('꺼진 알람은 시각에 넣지 않는다', off.a.length === 0, String(off.a.length));
  const once = build('2026-10-20T10:00:00', [{ ...base, id: 4, typeId: 'etc', rm: 'once', pattern: undefined, sd: '2026-10-21', hour: 7, min: 0 }]);
  check('한 번 알람은 한 번만', once.a.length === 1 && once.a[0] === sec(2026, 10, 21, 7), JSON.stringify(once.a));
  const yearly = build('2026-10-20T10:00:00', [{ ...base, id: 5, typeId: 'etc', rm: 'yearly', pattern: undefined, sd: '2020-03-01', hour: 7, min: 0 }]);
  check('다음 달 말일 밖의 알람은 넣지 않는다', yearly.a.length === 0, JSON.stringify(yearly.a));

  // 알람이 없어도 만들어진다
  check('알람이 없으면 시각이 비어 있다', build('2026-10-20T10:00:00', []).a.length === 0);

  // 공휴일 — 한국어일 때만
  const idx = (q, ds) => { const [y, m, d] = ds.split('-').map(Number); const [fy, fm, fd] = q.f.split('-').map(Number); return Math.round((new Date(y, m - 1, d) - new Date(fy, fm - 1, fd)) / 86400000); };
  check('한국어면 공휴일이 들어간다', p.h.includes(idx(p, '2026-10-03')), JSON.stringify(p.h));
  setLang('en');
  const en = build('2026-10-20T10:00:00');
  check('다른 언어면 한국 공휴일이 없다', en.h.length === 0, JSON.stringify(en.h));
  check('위젯 언어가 함께 간다', en.lang === 'en', String(en.lang));
  check('문구가 번역된다', en.s.days[0] === 'Sun' && !/[가-힣]/.test(en.s.noOff), JSON.stringify(en.s));
  check('새 문구도 번역됐다', !/[가-힣]/.test(en.s.openApp), en.s.openApp);
  check('비번 며칠 후는 {n}을 네이티브가 채운다', en.s.offIn.includes('{n}'), en.s.offIn);
  setLang('ko');

  // 기준 시각을 넘길 수 있어도 기본 동작은 그대로
  withNow('2026-10-20T10:00:00', () => {
    const d = U.getNextFireDate(alarms[0], {});
    check('기준 시각 없으면 지금부터', d.getTime() === sec(2026, 10, 20, 13) * 1000);
    const later = U.getNextFireDate(alarms[0], {}, new Date(2026, 9, 20, 13, 0));
    check('기준 시각 다음 알람', later.getTime() === sec(2026, 10, 21, 13) * 1000, later.toString());
  });
};
