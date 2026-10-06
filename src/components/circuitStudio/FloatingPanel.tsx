import React, { useRef, useState } from 'react';

interface Props {
  id: string;
  title: string;
  defaultPos: { x: number; y: number };
  width: number;
  children: React.ReactNode;
  onClose?(): void;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Bảng nổi trên mặt bàn vẽ: kéo bằng thanh tiêu đề (nhớ vị trí), thu gọn được. */
export default function FloatingPanel({ id, title, defaultPos, width, children, onClose }: Props) {
  const key = `circuitStudio.panel.${id}`;
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const s = localStorage.getItem(key);
      if (s) {
        const p = JSON.parse(s);
        return { x: clamp(p.x, 0, window.innerWidth - 80), y: clamp(p.y, 0, window.innerHeight - 40) };
      }
    } catch { /* bỏ qua: localStorage có thể bị chặn */ }
    return defaultPos;
  });
  const [min, setMin] = useState(false);
  const posRef = useRef(pos);
  posRef.current = pos;
  const grab = useRef<{ dx: number; dy: number } | null>(null);

  const onDown = (e: React.PointerEvent) => {
    grab.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!grab.current) return;
    const np = { x: clamp(e.clientX - grab.current.dx, 0, window.innerWidth - 80), y: clamp(e.clientY - grab.current.dy, 0, window.innerHeight - 40) };
    posRef.current = np;
    setPos(np);
  };
  const onUp = () => {
    if (!grab.current) return;
    grab.current = null;
    try { localStorage.setItem(key, JSON.stringify(posRef.current)); } catch { /* bỏ qua */ }
  };

  return (
    <div className="absolute z-20 flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#1b1b1b]/90 text-white shadow-2xl backdrop-blur"
      style={{ left: pos.x, top: pos.y, width, maxHeight: `calc(100vh - ${pos.y + 12}px)` }}>
      <div className="flex cursor-move items-center gap-1 border-b border-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/60"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onLostPointerCapture={onUp}>
        <span className="flex-1 truncate">{title}</span>
        <button className="rounded px-1 hover:bg-white/10" title={min ? 'Mở rộng' : 'Thu gọn'} onPointerDown={(e) => e.stopPropagation()} onClick={() => setMin(!min)}>{min ? '▸' : '▾'}</button>
        {onClose && <button className="rounded px-1 hover:bg-white/10" title="Đóng" onPointerDown={(e) => e.stopPropagation()} onClick={onClose}>✕</button>}
      </div>
      {!min && <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>}
    </div>
  );
}
