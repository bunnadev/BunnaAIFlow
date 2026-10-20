import { useEffect, useRef, useState } from 'react';
import type { CircuitProject, ProjectMeta } from '../../lib/circuit/projectModel';
import { noFocusMouseDown } from './noFocus';

interface Props {
  projects: ProjectMeta[];
  current: CircuitProject | null;
  onOpen(id: string): void;
  onNew(): void;
  onRename(name: string): void;
  onDuplicate(): void;
  onDelete(): void;
  /** Đọc lại danh sách mạch từ ổ đĩa (mạch mới do skill Claude Code ghi vào). */
  onRefresh(silent?: boolean): Promise<unknown>;
}

export default function ProjectPicker({ projects, current, onOpen, onNew, onRename, onDuplicate, onDelete, onRefresh }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  };
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(current?.name ?? '');
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => setName(current?.name ?? ''), [current?.id, current?.name]);

  // Danh sách mạch: đóng khi bấm ra ngoài hoặc nhấn Esc (pha capture: bàn vẽ chặn lan truyền phím)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey, true); };
  }, [open]);

  return (
    <div ref={boxRef} className="relative flex items-center gap-1">
      <span className="material-symbols-outlined text-[18px] text-[#F1641E]">electrical_services</span>
      <input value={name} onChange={(e) => setName(e.target.value)}
        onBlur={() => { const n = name.trim(); if (n && n !== current?.name) onRename(n); else setName(current?.name ?? ''); }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="w-[220px] rounded-md border border-transparent bg-transparent px-2 py-1 font-semibold text-white outline-none hover:border-white/10 focus:border-[#F1641E]" />
      <button onMouseDown={noFocusMouseDown} onClick={() => { if (!open) void onRefresh(true); setOpen(!open); }} title="Danh sách mạch" className="rounded-md px-1.5 py-1 text-white/70 hover:bg-white/10">▾</button>
      <button onMouseDown={noFocusMouseDown} onClick={refresh} disabled={refreshing} title="Làm mới danh sách mạch (mạch mới tạo bởi skill)"
        className="flex items-center rounded-md px-1 py-1 text-white/70 hover:bg-white/10 disabled:opacity-50">
        <span className={`material-symbols-outlined text-[18px] ${refreshing ? 'animate-spin' : ''}`}>refresh</span>
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-30 w-[320px] rounded-lg border border-white/10 bg-[#1f1f1f] p-2 text-sm text-white shadow-2xl">
          <div className="mb-2 flex gap-1">
            <button onMouseDown={noFocusMouseDown} className="flex-1 rounded-md bg-[#F1641E]/20 px-2 py-1.5 text-[#F1641E] hover:bg-[#F1641E]/30" onClick={() => { onNew(); setOpen(false); }}>＋ Mạch mới</button>
            <button onMouseDown={noFocusMouseDown} className="rounded-md bg-white/5 px-2 py-1.5 hover:bg-white/10" onClick={() => { onDuplicate(); setOpen(false); }}>Nhân bản</button>
            <button onMouseDown={noFocusMouseDown} className="rounded-md bg-white/5 px-2 py-1.5 text-red-400 hover:bg-white/10" onClick={() => { onDelete(); setOpen(false); }}>Xoá</button>
          </div>
          <div className="max-h-[50vh] overflow-y-auto">
            {projects.map((p) => (
              <button onMouseDown={noFocusMouseDown} key={p.id} onClick={() => { onOpen(p.id); setOpen(false); }}
                className={`block w-full rounded-md px-2 py-1.5 text-left hover:bg-white/10 ${p.id === current?.id ? 'text-[#F1641E]' : ''}`}>
                {p.name}
                <span className="ml-2 text-xs text-white/40">{new Date(p.updatedAt).toLocaleString('vi-VN')}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
