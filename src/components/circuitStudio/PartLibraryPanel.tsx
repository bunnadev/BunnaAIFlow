import React, { useMemo, useState } from 'react';
import { partPreviewSvg } from '../../lib/circuit/render';
import { LIBRARY_GROUPS, type LibraryItem } from '../../lib/circuit/libraryCatalog';

interface Props {
  items: LibraryItem[];
  /** Tăng khi thư viện linh kiện tự thêm thay đổi (để vẽ lại ảnh nhỏ). */
  version: number;
  onStartPlace(item: LibraryItem, e: React.PointerEvent): void;
  onAddNew?(): void;
  onItemMenu?(item: LibraryItem, e: React.MouseEvent): void;
}

export default function PartLibraryPanel({ items, version, onStartPlace, onAddNew, onItemMenu }: Props) {
  const [q, setQ] = useState('');
  const thumbs = useMemo(() => {
    const m: Record<string, string> = {};
    for (const it of items) m[it.type] ??= 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(partPreviewSvg(it.type, 72));
    return m;
  }, [items, version]);
  const shown = items.filter((it) => it.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="flex flex-col p-2 text-xs text-white/80">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm linh kiện"
        className="mb-2 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-white outline-none focus:border-[#F1641E]" />
      {LIBRARY_GROUPS.map((g) => {
        const list = shown.filter((it) => it.group === g);
        if (!list.length) return null;
        return (
          <div key={g} className="mb-3">
            <div className="mb-1 font-semibold uppercase tracking-wide text-white/40">{g}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {list.map((it) => (
                <div key={`${it.type}-${it.idBase ?? ''}`} title={`Kéo vào bàn vẽ: ${it.name}`}
                  onPointerDown={(e) => { if (e.button === 0) onStartPlace(it, e); }}
                  onContextMenu={(e) => { e.preventDefault(); onItemMenu?.(it, e); }}
                  className="flex cursor-grab flex-col items-center rounded-md border border-white/10 bg-white/[0.03] p-1 hover:border-[#F1641E]/60 hover:bg-white/[0.07]">
                  <img src={thumbs[it.type]} alt="" draggable={false} className="h-[56px] w-[56px] object-contain" />
                  <span className="mt-0.5 text-center leading-tight">{it.name}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {onAddNew && (
        <button onClick={onAddNew} className="mt-1 rounded-md bg-[#F1641E]/15 px-2 py-2 font-semibold text-[#F1641E] hover:bg-[#F1641E]/25">＋ Thêm linh kiện mới</button>
      )}
    </div>
  );
}
