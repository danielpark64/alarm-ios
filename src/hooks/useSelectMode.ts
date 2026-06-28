import { useState } from 'react';

// 알람 목록 다중선택 모드
export function useSelectMode() {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const toggleSelectMode = () => {
    if (selectMode) { setSelectMode(false); setSelectedIds(new Set()); }
    else setSelectMode(true);
  };

  // 카드 길게 누르기로 선택모드 진입 + 해당 카드 즉시 선택
  const enterSelectMode = (id: number) => {
    setSelectMode(true);
    setSelectedIds(new Set([id]));
  };

  const toggleSelect = (id: number) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectAll = (ids: number[]) => setSelectedIds(new Set(ids));

  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };

  return { selectMode, selectedIds, toggleSelectMode, enterSelectMode, toggleSelect, selectAll, exitSelectMode };
}
