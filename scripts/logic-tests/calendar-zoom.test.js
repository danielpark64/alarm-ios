// 달력 화면 확대(사진처럼) — 세이람 lib/calendarKit/zoom.ts와 같은 계산 + 교대알람은 한 달이 한 화면이라 상하좌우로 밀기 (2026-10-20)
module.exports = (U, M) => {
  const Z = M.calendarZoom;
  check('calendarZoom 모듈이 있다', !!Z);
  if (!Z) return;
  const W = 400, H = 600;
  const eq = (a, b) => Math.abs(a - b) < 1e-6;
  check('최대 3배', Z.ZOOM_MAX === 3);
  check('1배면 이동 없음', JSON.stringify(Z.clampZoom({ s: 1, tx: -50, ty: 30 }, W, H)) === JSON.stringify({ s: 1, tx: 0, ty: 0 }));
  check('1배보다 작게 못 줄임', Z.clampZoom({ s: 0.5, tx: 0, ty: 0 }, W, H).s === 1);
  check('3배보다 크게 못 키움', Z.clampZoom({ s: 5, tx: 0, ty: 0 }, W, H).s === 3);
  const c = Z.clampZoom({ s: 2, tx: -900, ty: 100 }, W, H);
  check('화면 밖으로 안 밀림', c.tx === -400 && c.ty === 0, JSON.stringify(c));
  // 두 손가락 가운데가 가리키던 내용이 그 자리에 남는다
  const p = Z.pinchZoom({ s: 1, tx: 0, ty: 0 }, { x: 200, y: 300 }, { x: 200, y: 300 }, 2, W, H);
  check('가운데 기준 2배', p.s === 2 && eq(p.tx, -200) && eq(p.ty, -300), JSON.stringify(p));
  const q = Z.pinchZoom({ s: 1, tx: 0, ty: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, 2, W, H);
  check('왼쪽 위 기준 2배', q.s === 2 && q.tx === 0 && q.ty === 0, JSON.stringify(q));
  // 확대 중 한 손가락으로 상하좌우 밀기
  const m = Z.panZoom({ s: 2, tx: -200, ty: -300 }, 50, -40, W, H);
  check('상하좌우로 민다', eq(m.tx, -150) && eq(m.ty, -340), JSON.stringify(m));
  const m2 = Z.panZoom({ s: 2, tx: -200, ty: -300 }, 999, 999, W, H);
  check('밀어도 가장자리에서 멈춘다', m2.tx === 0 && m2.ty === 0, JSON.stringify(m2));
  // 두 번 탭: 누른 곳을 가운데로 2배
  const d = Z.doubleTapZoom({ x: 100, y: 150 }, W, H);
  check('두 번 탭은 누른 곳 기준 2배', d.s === 2 && eq(d.tx, -100) && eq(d.ty, -150), JSON.stringify(d));
};
