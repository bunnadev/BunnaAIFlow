import { useEffect, useState } from 'react';
import type { CircuitProject, ProjectMeta } from '../../lib/circuit/projectModel';

interface Props {
  projects: ProjectMeta[];
  current: CircuitProject | null;
  onOpen(id: string): void;
  onNew(): void;
  onRename(name: string): void;
  onDuplicate(): void;
  onDelete(): void;
}

export default function ProjectPicker({ projects, current, onOpen, onNew, onRename, onDuplicate, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(current?.name ?? '');
  useEffect(() => setName(current?.name ?? ''), [current?.id, current?.name]);

  return (
    <div className="relative flex items-center gap-1">
      <span className="material-symbols-outlined text-[18px] text-[#F1641E]">electrical_services</span>
      <input value={name} onChange={(e) => setName(e.target.value)}
        onBlur={() => { const n = name.trim(); if (n && n !== current?.name) onRename(n); else setName(current?.name ?? ''); }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="w-[220px] rounded-md border border-transparent bg-transparent px-2 py-1 font-semibold text-white outline-none hover:border-white/10 focus:border-[#F1641E]" />
      <button onClick={() => setOpen(!open)} title="Danh sách mạch" className="rounded-md px-1.5 py-1 text-white/70 hover:bg-white/10">▾</button>
      {open && (
        <div className="absolute left-0 top-9 z-30 w-[320px] rounded-lg border border-white/10 bg-[#1f1f1f] p-2 text-sm text-white shadow-2xl">
          <div className="mb-2 flex gap-1">
            <button className="flex-1 rounded-md bg-[#F1641E]/20 px-2 py-1.5 text-[#F1641E] hover:bg-[#F1641E]/30" onClick={() => { onNew(); setOpen(false); }}>＋ Mạch mới</button>
            <button className="rounded-md bg-white/5 px-2 py-1.5 hover:bg-white/10" onClick={() => { onDuplicate(); setOpen(false); }}>Nhân bản</button>
            <button className="rounded-md bg-white/5 px-2 py-1.5 text-red-400 hover:bg-white/10" onClick={() => { onDelete(); setOpen(false); }}>Xoá</button>
          </div>
          <div className="max-h-[50vh] overflow-y-auto">
            {projects.map((p) => (
              <button key={p.id} onClick={() => { onOpen(p.id); setOpen(false); }}
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
