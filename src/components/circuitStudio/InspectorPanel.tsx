import { useEffect, useRef, useState } from 'react';
import { PARTS } from '../../lib/circuit/parts';
import { WIRE_COLORS } from '../../lib/circuit/render';
import { deleteWire, resetWire, rotateParts, updatePart, updateWire } from '../../lib/circuit/ops';
import type { CircuitLayout, PlacedPart } from '../../lib/circuit/types';
import type { Selection } from './StudioCanvas';

interface Props {
  layout: CircuitLayout;
  selection: Selection;
  onCommit(l: CircuitLayout): void;
  onSelect(s: Selection): void;
  onError(msg: string): void;
  /** Bố cục mới nhất (ghi từ ô nhập lúc bảng đang bị gỡ không được dựa vào bố cục cũ). */
  getLayout?(): CircuitLayout;
}

/**
 * Ô nhập chỉ ghi khi rời ô / Enter — gõ từng chữ không làm đầy lịch sử hoàn tác.
 * Bị gỡ khi còn giá trị chưa ghi (WKWebView không bắn blur) thì ghi lúc gỡ.
 */
function Field({ label, value, onCommit }: { label: string; value: string; onCommit(v: string): void }) {
  const [v, setV] = useState(value);
  const latest = useRef({ v, value, onCommit });
  latest.current = { v, value, onCommit };
  const committed = useRef<string | null>(null);
  useEffect(() => { setV(value); committed.current = null; }, [value]);
  const commitPending = () => {
    const { v: cur, value: orig, onCommit: commit } = latest.current;
    if (cur === orig || cur === committed.current) return;
    committed.current = cur;
    commit(cur);
  };
  useEffect(() => () => commitPending(), []);
  return (
    <label className="mb-2 block">
      <span className="mb-0.5 block text-white/50">{label}</span>
      <input value={v} onChange={(e) => setV(e.target.value)}
        onBlur={commitPending}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-white outline-none focus:border-[#F1641E]" />
    </label>
  );
}

/** Nhãn tự sinh từ giá trị điện trở ("1k" → "1kΩ"); nhãn còn đúng dạng này thì đổi theo giá trị. */
const ohms = (v: string | undefined) => (v?.trim() ? `${v.trim()}Ω` : '');

const btn = 'rounded-md border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10 disabled:opacity-30';

export default function InspectorPanel({ layout, selection, onCommit, onSelect, onError, getLayout }: Props) {
  const part = selection.parts.length === 1 ? layout.parts.find((p) => p.id === selection.parts[0]) : undefined;
  const wireIdx = selection.wire;
  const wire = wireIdx !== null ? layout.wires[wireIdx] : undefined;

  /** Sửa linh kiện trên bố cục mới nhất; linh kiện đã bị xoá / hoàn tác mất thì bỏ qua. */
  const set = (patchOrFn: Partial<PlacedPart> | ((live: PlacedPart) => Partial<PlacedPart>)) => {
    if (!part) return;
    const cur = getLayout?.() ?? layout;
    const live = cur.parts.find((p) => p.id === part.id);
    if (!live) return;
    const patch = typeof patchOrFn === 'function' ? patchOrFn(live) : patchOrFn;
    try {
      onCommit(updatePart(cur, part.id, patch));
      if (patch.id) onSelect({ parts: [patch.id.trim()], wire: null });
    } catch (e) {
      onError((e as Error).message);
    }
  };

  return (
    <div className="p-3 text-xs text-white/80">
      {part && (
        <>
          <div className="mb-2 text-white/50">{PARTS[part.type]?.desc ?? part.type}</div>
          <Field label="Ký hiệu" value={part.id} onCommit={(v) => set({ id: v })} />
          {part.type !== 'bus' && part.type !== 'lead' && <Field label="Chữ in trên thân" value={part.marking ?? ''} onCommit={(v) => set({ marking: v })} />}
          {part.type === 'resistor' && <Field label="Giá trị (tô vạch màu, VD 4.7k)" value={part.value ?? ''}
            onCommit={(v) => set((live) => ({ value: v, ...((live.label ?? '') === ohms(live.value) ? { label: ohms(v) } : {}) }))} />}
          <Field label="Nhãn xanh" value={part.label ?? ''} onCommit={(v) => set({ label: v })} />
          {part.labelPos && <button className={`${btn} mb-2`} onClick={() => set({ labelPos: undefined })}>Nhãn tự đặt lại</button>}
          {part.type !== 'bus' && (
            <div className="mb-2 flex items-center gap-2">
              <span className="text-white/50">Xoay</span>
              <button className={btn} onClick={() => onCommit(rotateParts(layout, [part.id], -1))}>⟲</button>
              <button className={btn} onClick={() => onCommit(rotateParts(layout, [part.id], 1))}>⟳</button>
            </div>
          )}
          {['to220', 'to3', 'pentawatt'].includes(part.type) && (
            <label className="mb-2 flex items-center gap-2">
              <input type="checkbox" checked={!!part.heatsink} onChange={(e) => set({ heatsink: e.target.checked })} /> Tản nhiệt
            </label>
          )}
          {part.type !== 'bus' && Object.keys(PARTS[part.type]?.pins ?? {}).length > 0 && (
            <div className="mt-3 border-t border-white/10 pt-2">
              <div className="mb-1 text-white/50">Tên chân thật (VD C1815: 1 = E, 2 = C, 3 = B)</div>
              {Object.keys(PARTS[part.type].pins).map((pin) => (
                <Field key={pin} label={`Chân ${pin}`} value={part.pinNames?.[pin] ?? ''}
                  onCommit={(v) => set((live) => ({ pinNames: { ...(live.pinNames ?? {}), [pin]: v } }))} />
              ))}
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={!!part.showPinNames} onChange={(e) => set({ showPinNames: e.target.checked })} /> In tên chân lên ảnh
              </label>
            </div>
          )}
        </>
      )}

      {wire && wireIdx !== null && (
        <>
          <div className="mb-2 break-all text-white">{wire.from} → {wire.to}</div>
          <div className="mb-1 text-white/50">Màu</div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {Object.entries(WIRE_COLORS).filter(([c]) => c !== 'silver').map(([c, [main]]) => (
              <button key={c} title={c} onClick={() => onCommit(updateWire(layout, wireIdx, { color: c }))}
                className="h-6 w-6 rounded-full border-2" style={{ background: main, borderColor: wire.color === c ? '#F1641E' : 'transparent' }} />
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <button className={btn} disabled={!wire.manual} onClick={() => onCommit(resetWire(layout, wireIdx))}>Tự đi lại dây này</button>
            <button className={`${btn} text-red-400`} onClick={() => { onCommit(deleteWire(layout, wireIdx)); onSelect({ parts: [], wire: null }); }}>Xoá dây</button>
          </div>
          <div className="mt-3 text-white/40">Kéo chấm tròn để dời đoạn dây · bấm đúp lên dây để thêm góc · bấm đúp lên góc để bỏ góc.</div>
        </>
      )}

      {!part && !wire && selection.parts.length > 1 && (
        <div className="text-white/60">Đã chọn {selection.parts.length} linh kiện — dùng các nút căn hàng / chia đều ở thanh trên.</div>
      )}
    </div>
  );
}
