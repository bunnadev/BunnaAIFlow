import { useEffect, useRef, useState } from 'react';
import { PARTS } from '../../lib/circuit/parts';
import { anchorContact } from '../../lib/circuit/contacts';
import { bulbLabel, LED_COLORS } from '../../lib/circuit/lightParts';
import { isProbe, MINI_BULB_COLORS, ohmWattLabel } from '../../lib/circuit/extraParts';
import { ledHex } from '../../lib/circuit/parts';
import { SENSOR_LIT_LABEL, SENSOR_PARTS } from '../../lib/circuit/sensorParts';
import { CELL_KINDS, CELLS, cellType, holderType, holderVolts, parseCellType, parseHolderType, type CellKind, type HolderWiring } from '../../lib/circuit/powerParts';
import { WIRE_COLORS } from '../../lib/circuit/render';
import { deleteWire, duplicateParts, resetWire, rotateParts, trimBacktrack, updatePart, updateWire } from '../../lib/circuit/ops';
import type { CircuitLayout, JointStyle, PlacedPart } from '../../lib/circuit/types';
import { jointOf } from '../../lib/circuit/route';
import { endPartId } from '../../lib/circuit/geometry';
import { clampScale, type Selection } from './StudioCanvas';
import { isBuiltinPart } from '../../lib/circuit/registry';

interface Props {
  layout: CircuitLayout;
  selection: Selection;
  onCommit(l: CircuitLayout): void;
  onSelect(s: Selection): void;
  onError(msg: string): void;
  /** Bố cục mới nhất (ghi từ ô nhập lúc bảng đang bị gỡ không được dựa vào bố cục cũ). */
  getLayout?(): CircuitLayout;
  /** Mở cửa sổ sửa linh kiện tự thêm (đổi ảnh, chấm lại chân, cỡ gốc). */
  onEditCustomPart?(type: string): void;
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

/** Nhãn tự sinh của pin rời / đế pin (VD "1.5V", "4.5V"); nhãn còn đúng dạng này thì đổi theo khi đổi loại / số viên / cách mắc. */
function batteryLabel(type: string, wiring?: HolderWiring): string | null {
  const h = parseHolderType(type);
  if (h) return holderVolts(h.kind, h.n, wiring);
  const c = parseCellType(type);
  return c ? `${CELLS[c].volts}V` : null;
}

/** Linh kiện có ô nhập riêng (không dùng ô "Chữ in trên thân" chung). */
const OWN_FIELDS = new Set(['res_cement', 'res_power', 'cob', 'probe_red', 'probe_black', 'fan', 'motor', 'mini_bulb', 'sw_rocker2', 'sw_rocker3', ...Object.keys(SENSOR_PARTS)]);

const btn = 'rounded-md border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10 disabled:opacity-30';

export default function InspectorPanel({ layout, selection, onCommit, onSelect, onError, getLayout, onEditCustomPart }: Props) {
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

  // Pin rời / đế pin: đổi loại, số viên, cách mắc (đổi loại linh kiện — chân vẫn tên +/− nên dây không đứt)
  const holder = part ? parseHolderType(part.type) : null;
  const cellKind = part ? parseCellType(part.type) : null;
  const battery = holder ? { kind: holder.kind, n: holder.n as number | null } : cellKind ? { kind: cellKind, n: null as number | null } : null;
  const setBattery = (ch: { kind?: CellKind; n?: number; wiring?: HolderWiring }) => set((live) => {
    const h = parseHolderType(live.type), c = parseCellType(live.type);
    const kind = ch.kind ?? h?.kind ?? c!;
    const type = h ? holderType(kind, ch.n ?? h.n) : cellType(kind);
    const wiring = h ? (ch.wiring ?? live.wiring ?? 'series') : undefined;
    const autoNow = batteryLabel(live.type, live.wiring);
    const patch = { type, wiring, ...((live.label ?? '') === autoNow ? { label: batteryLabel(type, wiring) ?? live.label } : {}) };
    return anchorContact(getLayout?.() ?? layout, live.id, patch);
  });
  /** Nhân bản linh kiện đang chọn (lệch 40px, không kèm dây) rồi chọn bản sao — bấm tiếp sẽ ra thêm bản nữa. */
  const duplicate = () => {
    const r = duplicateParts(getLayout?.() ?? layout, selection.parts);
    if (!r.newIds.length) return;
    onCommit(r.layout);
    onSelect({ parts: r.newIds, wire: null });
  };
  // Nút đang chọn: tô cam (style trực tiếp — lớp viền / nền của btn đè mất lớp Tailwind thêm vào)
  const pick = (on: boolean) => ({ className: btn, style: on ? { borderColor: '#F1641E', background: 'rgba(241,100,30,0.28)', color: '#fff' } : undefined });

  return (
    <div className="p-3 text-xs text-white/80">
      {part && (
        <>
          <div className="mb-2 text-white/50">{PARTS[part.type]?.desc ?? part.type}</div>
          <Field label="Ký hiệu" value={part.id} onCommit={(v) => set({ id: v })} />
          {part.type !== 'bus' && part.type !== 'lead' && part.type !== 'psu' && part.type !== 'led' && part.type !== 'bulb' && !OWN_FIELDS.has(part.type) && !(part.type === 'speaker' && part.view) && !battery
            && <Field label="Chữ in trên thân" value={part.marking ?? ''} onCommit={(v) => set({ marking: v })} />}
          {part.type === 'led' && (
            <>
              <div className="mb-1 text-white/50">Màu đèn</div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {LED_COLORS.map((c) => (
                  <button key={c.key} title={c.name} onClick={() => set({ color: c.key })}
                    className="h-6 w-6 rounded-full border-2"
                    style={{ background: c.hex, borderColor: ledHex(part) === c.hex ? '#F1641E' : 'rgba(255,255,255,0.15)' }} />
                ))}
              </div>
            </>
          )}
          {part.type === 'mini_bulb' && (
            <>
              <div className="mb-1 text-white/50">Màu kính</div>
              <div className="mb-2 flex gap-1.5">
                {MINI_BULB_COLORS.map((c) => (
                  <button key={c.key} {...pick((part.color ?? 'clear') === c.key)} onClick={() => set({ color: c.key })}>{c.name}</button>
                ))}
              </div>
            </>
          )}
          {part.type === 'mini_bulb' && <div className="mb-2 text-white/40">Nối dây: chấm giữa đáy là 1 cực; 2 chốt ngàm 2 bên vỏ là cực còn lại (thông nhau, nối vào chốt nào cũng được).</div>}
          {(part.type === 'bulb' || part.type === 'mini_bulb') && (
            <>
              <Field label="Điện áp (V)" value={part.value ?? ''}
                onCommit={(v) => set((live) => ({ value: v, ...((live.label ?? '') === bulbLabel(live) ? { label: bulbLabel({ ...live, value: v }) } : {}) }))} />
              <Field label="Công suất (W) — để trống nếu không cần" value={part.marking ?? ''}
                onCommit={(v) => set((live) => ({ marking: v, ...((live.label ?? '') === bulbLabel(live) ? { label: bulbLabel({ ...live, marking: v }) } : {}) }))} />
            </>
          )}
          {(part.type === 'res_cement' || part.type === 'res_power' || (part.type === 'speaker' && part.view)) && (
            <>
              {part.type === 'speaker' && (
                <>
                  <div className="mb-1 text-white/50">Hướng nhìn</div>
                  <div className="mb-2 flex gap-1.5">
                    {([['front', 'Mặt trước'], ['back', 'Mặt sau']] as const).map(([v, t]) => (
                      <button key={v} {...pick(part.view === v)} onClick={() => set({ view: v })}>{t}</button>
                    ))}
                  </div>
                </>
              )}
              <Field label={part.type === 'speaker' ? 'Trở kháng (Ω)' : 'Giá trị (Ω)'} value={part.value ?? ''}
                onCommit={(v) => set((live) => ({ value: v, ...((live.label ?? '') === ohmWattLabel(live) ? { label: ohmWattLabel({ ...live, value: v }) } : {}) }))} />
              <Field label="Công suất (W)" value={part.marking ?? ''}
                onCommit={(v) => set((live) => ({ marking: v, ...((live.label ?? '') === ohmWattLabel(live) ? { label: ohmWattLabel({ ...live, marking: v }) } : {}) }))} />
            </>
          )}
          {(part.type === 'cob' || part.type === 'fan' || part.type === 'motor') && (
            <Field label="Điện áp (V)" value={part.value ?? ''}
              onCommit={(v) => set((live) => ({ value: v, ...((live.label ?? '') === `${(live.value ?? '').trim()}V` ? { label: v.trim() ? `${v.trim()}V` : '' } : {}) }))} />
          )}
          {isProbe(part.type) && <div className="mb-2 text-white/40">Kéo đầu kim lại gần chân linh kiện để que tự chạm vào chân đó.</div>}
          {['led', 'bulb', 'cob', 'mini_bulb', 'fan', 'motor', 'sw_rocker2', 'sw_rocker3'].includes(part.type) && (
            <label className="mb-2 flex items-center gap-2">
              <input type="checkbox" checked={!!part.lit} onChange={(e) => set({ lit: e.target.checked })} />
              {part.type === 'fan' || part.type === 'motor' ? 'Đang chạy' : part.type.startsWith('sw_') ? 'Đang bật (nhấn phía I)' : 'Đèn đang sáng'}
            </label>
          )}
          {SENSOR_LIT_LABEL[part.type] && (
            <label className="mb-2 flex items-center gap-2">
              <input type="checkbox" checked={!!part.lit} onChange={(e) => set({ lit: e.target.checked })} />
              {SENSOR_LIT_LABEL[part.type]}
            </label>
          )}
          {part.type === 'ir_rx' && <div className="mb-2 text-white/40">LED thu thường mắc ngược: chân K (ngắn) về phía +, chân A về phía − qua điện trở kéo.</div>}
          {part.type === 'buzzer_passive' && <div className="mb-2 text-white/40">Còi thụ động cấp điện một chiều sẽ không kêu — cần xung (VD từ NE555 hoặc Arduino).</div>}
          {part.type === 'sw_rocker3' && <div className="mb-2 text-white/40">Chân 2 (giữa) thường là chân chung. Mỗi hãng nối khác nhau — đo lại bằng đồng hồ VOM trên công tắc thật trước khi hàn.</div>}
          {part.type === 'psu' && (
            <>
              <Field label="Màn hình — điện áp (V)" value={part.value ?? ''} onCommit={(v) => set({ value: v })} />
              <Field label="Màn hình — dòng (A)" value={part.marking ?? ''} onCommit={(v) => set({ marking: v })} />
            </>
          )}
          {battery && (
            <>
              <div className="mb-1 text-white/50">Loại pin</div>
              <div className="mb-2 flex gap-1.5">
                {CELL_KINDS.map((k) => <button key={k} {...pick(battery.kind === k)} onClick={() => setBattery({ kind: k })}>{CELLS[k].name}</button>)}
              </div>
              {battery.n !== null && (
                <>
                  <div className="mb-1 text-white/50">Số viên</div>
                  <div className="mb-2 flex gap-1.5">
                    {[1, 2, 3].map((n) => <button key={n} {...pick(battery.n === n)} onClick={() => setBattery({ n })}>{n}</button>)}
                  </div>
                  <div className="mb-1 text-white/50">Cách mắc</div>
                  <div className="mb-2 flex gap-1.5">
                    {([['series', 'Nối tiếp'], ['parallel', 'Song song']] as const).map(([w, t]) => (
                      <button key={w} disabled={battery.n === 1} {...pick(battery.n !== 1 && (part.wiring ?? 'series') === w)} onClick={() => setBattery({ wiring: w })}>{t}</button>
                    ))}
                  </div>
                </>
              )}
              {battery.n === null && <div className="mb-2 text-white/40">Kéo đầu pin chạm vào đầu pin khác để nối thẳng, không cần dây.</div>}
            </>
          )}
          {part.type === 'resistor' && <Field label="Giá trị (tô vạch màu, VD 4.7k)" value={part.value ?? ''}
            onCommit={(v) => set((live) => ({ value: v, ...((live.label ?? '') === ohms(live.value) ? { label: ohms(v) } : {}) }))} />}
          <Field label="Nhãn xanh" value={part.label ?? ''} onCommit={(v) => set({ label: v })} />
          {part.labelPos && <button className={`${btn} mb-2`} onClick={() => set({ labelPos: undefined })}>Nhãn tự đặt lại</button>}
          {(
            <div className="mb-2 flex items-center gap-2">
              <span className="text-white/50">Xoay</span>
              <button className={btn} onClick={() => onCommit(rotateParts(layout, [part.id], -1))}>⟲</button>
              <button className={btn} onClick={() => onCommit(rotateParts(layout, [part.id], 1))}>⟳</button>
              <button className={`${btn} ml-auto`} title="Tạo thêm 1 cái giống hệt (không kèm dây) — phím tắt ⌘D" onClick={duplicate}>Nhân bản</button>
            </div>
          )}
          {part.type !== 'bus' && part.type !== 'lead' && (
            <div className="mb-2 flex items-center gap-2">
              <span className="text-white/50">Cỡ</span>
              <button className={btn} onClick={() => set((live) => { const s = clampScale((live.scale ?? 1) - 0.1); return { scale: s === 1 ? undefined : s }; })}>−</button>
              <span className="w-10 text-center">{Math.round((part.scale ?? 1) * 100)}%</span>
              <button className={btn} onClick={() => set((live) => { const s = clampScale((live.scale ?? 1) + 0.1); return { scale: s === 1 ? undefined : s }; })}>+</button>
              <button className={btn} disabled={!part.scale} onClick={() => set({ scale: undefined })}>Gốc</button>
              <span className="text-white/30" title="Hoặc kéo ô vuông trắng ở góc dưới-phải của linh kiện trên bàn vẽ">↘ kéo góc</span>
            </div>
          )}
          {!isBuiltinPart(part.type) && onEditCustomPart && (
            <button className={`${btn} mb-2 w-full`} title="Đổi ảnh, chấm lại chân, đổi cỡ gốc — áp dụng cho mọi chỗ dùng linh kiện này" onClick={() => onEditCustomPart(part.type)}>✎ Sửa linh kiện (ảnh / chân)</button>
          )}
          {['to220', 'to3', 'pentawatt'].includes(part.type) && (
            <label className="mb-2 flex items-center gap-2">
              <input type="checkbox" checked={!!part.heatsink} onChange={(e) => set({ heatsink: e.target.checked })} /> Tản nhiệt
            </label>
          )}
          {part.type !== 'bus' && part.type !== 'psu' && part.type !== 'mini_bulb' && !battery && !isProbe(part.type) && Object.keys(PARTS[part.type]?.pins ?? {}).length > 0 && (
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
          {(['from', 'to'] as const).map((which) => {
            const ref = wire[which];
            const end = layout.parts.find((p) => p.id === endPartId(ref));
            if (!end || end.type === 'bus' || end.type === 'lead' || ref.includes('@')) return null;
            const cur = jointOf(wire, which, end);
            const setJoint = (j: JointStyle) => {
              const l = updateWire(layout, wireIdx, { joints: { ...wire.joints, [which]: j } });
              onCommit(j === 'round' ? trimBacktrack(l, wireIdx, which) : l);
            };
            return (
              <div key={which} className="mb-2 flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-white/50" title={ref}>Mối hàn {ref}</span>
                <button {...pick(cur === 'long')} title="Chân nằm ngang (điện trở, IC nhìn nghiêng…)" onClick={() => setJoint('long')}>Dài</button>
                <button {...pick(cur === 'round')} title="Nhìn từ trên xuống, chân cắm thẳng (relay, module…) — dây đi ra hướng nào cũng được" onClick={() => setJoint('round')}>Tròn</button>
              </div>
            );
          })}
          <button className={`${btn} mb-3 w-full`}
            style={wire.color === 'silver' ? { borderColor: '#F1641E', background: 'rgba(241,100,30,0.28)', color: '#fff' } : undefined}
            onClick={() => onCommit(updateWire(layout, wireIdx, { color: 'silver' }))}>Chân trần / dây thiếc (hàn thẳng, không vỏ)</button>
          <div className="flex flex-col gap-1.5">
            <button className={btn} disabled={!wire.manual} onClick={() => onCommit(resetWire(layout, wireIdx))}>Tự đi lại dây này</button>
            <button className={`${btn} text-red-400`} onClick={() => { onCommit(deleteWire(layout, wireIdx)); onSelect({ parts: [], wire: null }); }}>Xoá dây</button>
          </div>
          <div className="mt-3 text-white/40">Kéo chấm tròn để dời đoạn dây · bấm đúp lên dây để thêm góc · bấm đúp lên góc để bỏ góc.</div>
        </>
      )}

      {!part && !wire && selection.parts.length > 1 && (
        <>
          <div className="mb-2 text-white/60">Đã chọn {selection.parts.length} linh kiện — dùng các nút căn hàng / chia đều ở thanh trên.</div>
          <button className={`${btn} w-full`} title="Phím tắt ⌘D" onClick={duplicate}>Nhân bản {selection.parts.length} linh kiện (không kèm dây)</button>
        </>
      )}
    </div>
  );
}
