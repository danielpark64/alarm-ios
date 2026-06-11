import { useState } from 'react';

// 알람 목록 다중선택 모드
export function useSelectMode() {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const toggleSelectMode = () => {
    if (selectMode) { setSelectMode(false); setSelectedIds(new Set()); }
    else setSelectMode(true);
  };

  const toggleSelect = (id: number) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectAll = (ids: number[]) => setSelectedIds(new Set(ids));

  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };

  return { selectMode, selectedIds, toggleSelectMode, toggleSelect, selectAll, exitSelectMode };
}
