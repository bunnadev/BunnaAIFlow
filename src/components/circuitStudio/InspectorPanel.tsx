import { useEffect, useState } from 'react';
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
}

/** Ô nhập chỉ ghi khi rời ô / Enter — gõ từng chữ không làm đầy lịch sử hoàn tác. */
function Field({ label, value, onCommit }: { label: string; value: string; onCommit(v: string): void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="mb-2 block">
      <span className="mb-0.5 block text-white/50">{label}</span>
      <input value={v} onChange={(e) => setV(e.target.value)}
        onBlur={() => { if (v !== value) onCommit(v); }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-white outline-none focus:border-[#F1641E]" />
    </label>
  );
}

const btn = 'rounded-md border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10 disabled:opacity-30';

export default function InspectorPanel({ layout, selection, onCommit, onSelect, onError }: Props) {
  const part = selection.parts.length === 1 ? layout.parts.find((p) => p.id === selection.parts[0]) : undefined;
  const wireIdx = selection.wire;
  const wire = wireIdx !== null ? layout.wires[wireIdx] : undefined;

  const set = (patch: Partial<PlacedPart>) => {
    if (!part) return;
    try {
      onCommit(updatePart(layout, part.id, patch));
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
          {part.type === 'resistor' && <Field label="Giá trị (tô vạch màu, VD 4.7k)" value={part.value ?? ''} onCommit={(v) => set({ value: v })} />}
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
                  onCommit={(v) => set({ pinNames: { ...(part.pinNames ?? {}), [pin]: v } })} />
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
