// ─── 달력 화면 확대 계산 (사진처럼 두 손가락으로) ───────────────────────────────────
// 2026-10-20 사용자: "교대알람도 세이람처럼 달력을 확대해서 보는 기능". 계산은 세이람 lib/calendarKit/zoom.ts와 같다.
// 다른 점: 세이람은 달이 위아래로 이어져 확대 중 위아래 한 손가락은 목록 스크롤이지만, 교대알람은 한 달이 한 화면이라
// 확대 중에는 한 손가락으로 상하좌우 어디로든 민다(달 넘기기는 확대 중엔 멈춘다).
// 변환은 왼쪽 위 기준(transformOrigin 'left top'): 화면 위치 = t + s × 내용 위치.

export type Zoom = { s: number; tx: number; ty: number };
export const ZOOM_MAX = 3;
type Pt = { x: number; y: number };

/** 화면 밖으로 밀려나지 않게: tx ∈ [W(1-s), 0], ty ∈ [H(1-s), 0] */
export function clampZoom(z: Zoom, W: number, H: number): Zoom {
  const s = Math.min(ZOOM_MAX, Math.max(1, z.s));
  if (s === 1) return { s: 1, tx: 0, ty: 0 };
  const tx = Math.min(0, Math.max(W * (1 - s), z.tx));
  const ty = Math.min(0, Math.max(H * (1 - s), z.ty));
  return { s, tx: tx === 0 ? 0 : tx, ty: ty === 0 ? 0 : ty };
}

/** 두 손가락: 시작 때 상태·중심(f0) → 지금 중심(f1)과 거리 비율(ratio). 손가락 아래 내용이 그 자리에 남는다 */
export function pinchZoom(start: Zoom, f0: Pt, f1: Pt, ratio: number, W: number, H: number): Zoom {
  const s = Math.min(ZOOM_MAX, Math.max(1, start.s * ratio));
  const qx = (f0.x - start.tx) / start.s;
  const qy = (f0.y - start.ty) / start.s;
  return clampZoom({ s, tx: f1.x - s * qx, ty: f1.y - s * qy }, W, H);
}

/** 확대한 상태에서 한 손가락으로 밀기(상하좌우) */
export function panZoom(start: Zoom, dx: number, dy: number, W: number, H: number): Zoom {
  return clampZoom({ ...start, tx: start.tx + dx, ty: start.ty + dy }, W, H);
}

/** 두 번 탭: 누른 곳(p)이 그 자리에 남도록 2배 */
export function doubleTapZoom(p: Pt, W: number, H: number): Zoom {
  return clampZoom({ s: 2, tx: -p.x, ty: -p.y }, W, H);
}
