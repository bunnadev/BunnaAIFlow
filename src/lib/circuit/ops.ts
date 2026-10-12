import { endPartId, resolvePoint } from './geometry';
import { busCoord, busEnds, busPoint, busVertical } from './bus';
import { followEnd, simplify } from './wireEdit';
import type { CircuitLayout, PlacedPart, Point, Rotation, Wire } from './types';
import { DIP_SIZES } from './parts';
import { CELL_KINDS, CELLS, cellType, holderType, holderVolts, POWER_TYPES } from './powerParts';

/**
 * Mọi thao tác sửa bố cục của Xưởng vẽ mạch. Hàm thuần: nhận bố cục, trả bố cục
 * mới (không sửa đầu vào) — reducer hoàn tác chỉ việc lưu các bản cũ.
 */

const snap10 = (v: number) => Math.round(v / 10) * 10;

const PREFIX: Record<string, string> = {
  resistor: 'R', cap_elec: 'C', cap_ceramic: 'C', pot: 'VR', trimpot: 'VR', diode: 'D',
  to92: 'Q', to220: 'Q', to3: 'Q', pentawatt: 'U', ...Object.fromEntries(DIP_SIZES.map((n) => [`dip${n}`, 'U'])),
  ir_tx: 'IR', ir_rx: 'IR', ldr: 'LDR', laser: 'LS', buzzer_active: 'BZ', buzzer_passive: 'BZ', sw_push: 'SW', mic_electret: 'MIC', seg7_1: 'DS', seg7_4: 'DS', led_matrix: 'MX',
  led: 'LED', bulb: 'DEN', cob: 'COB', res_cement: 'R', res_power: 'R', probe_red: 'VOM', probe_black: 'VOM', fan: 'FAN', motor: 'M', mini_bulb: 'DEN', sw_rocker2: 'SW', sw_rocker3: 'SW', speaker: 'SP', jack35: 'J', mic: 'MIC', terminal2: 'PWR', lead: 'OUT', psu: 'PSU',
  ...Object.fromEntries(CELL_KINDS.flatMap((k) => [cellType(k), ...[1, 2, 3].map((n) => holderType(k, n))].map((t) => [t, 'BAT']))),
};

// Nhãn xanh in thẳng lên ảnh mạch (khán giả nước ngoài) → luôn TIẾNG ANH, không dấu.
const DEFAULTS: Record<string, Partial<PlacedPart>> = {
  resistor: { value: '1k', label: '1kΩ' },
  led: { marking: 'đỏ' },
  cap_elec: { marking: '100µF', label: '100µF' },
  cap_ceramic: { marking: '104', label: '100nF' },
  pot: { marking: 'B10K', label: '10k' },
  trimpot: { marking: '103', label: '10k' },
  diode: { marking: '1N4007', label: '1N4007' },
  to92: { marking: 'C1815', label: 'C1815' },
  to220: { marking: 'TIP41C', label: 'TIP41C' },
  to3: { marking: '2N3055', label: '2N3055' },
  pentawatt: { marking: 'TDA2003', label: 'TDA2003' },
  dip8: { marking: 'NE555', label: 'NE555' },
  dip14: { marking: 'IC', label: 'IC' },
  dip16: { marking: 'CD4017', label: 'CD4017' },
  dip18: { marking: 'LM3914N-1', label: 'LM3914' },
  dip20: { marking: '74HC245', label: '74HC245' },
  dip24: { marking: 'MAX7219', label: 'MAX7219' },
  dip28: { marking: 'ATMEGA328P', label: 'ATmega328P' },
  dip40: { marking: 'AT89S52', label: 'AT89S52' },
  ir_tx: { label: 'IR Transmitter' },
  ir_rx: { label: 'IR Receiver' },
  ldr: { label: 'LDR' },
  laser: { label: 'Laser 5V' },
  buzzer_active: { label: 'Buzzer 5V' },
  buzzer_passive: { label: 'Buzzer' },
  sw_push: { label: 'SW' },
  mic_electret: { label: 'MIC' },
  seg7_1: { value: '8.', color: 'red', label: '5161AS' },
  seg7_4: { value: '12.34', color: 'red', label: '5641AS' },
  led_matrix: { value: '66FFFFFF7E3C1800', color: 'red', label: '8x8 LED Matrix' },
  terminal2: { label: '12V' },
  lead: { label: 'OUT' },
  mic: { label: 'MIC' },
  bus: { length: 600 },
  psu: { value: '12.00', marking: '1.000' },
  bulb: { value: '12', marking: '5', label: '12V 5W' },
  cob: { value: '12', label: '12V' },
  res_cement: { value: '10', marking: '5', label: '10Ω 5W' },
  res_power: { value: '33', marking: '1', label: '33Ω 1W' },
  sw_rocker2: { label: 'SW' },
  sw_rocker3: { label: 'SW' },
  fan: { value: '12', label: '12V' },
  motor: { value: '12', label: '12V' },
  mini_bulb: { value: '12', marking: '5', color: 'clear', label: '12V 5W' },
  probe_red: { label: '+' },
  probe_black: { label: 'COM' },
  speaker: { view: 'front', value: '8', marking: '50', label: '8Ω 50W' },
  ...Object.fromEntries(CELL_KINDS.map((k) => [cellType(k), { label: `${CELLS[k].volts}V` }])),
  ...Object.fromEntries(CELL_KINDS.flatMap((k) => [1, 2, 3].map((n) => [holderType(k, n), { label: holderVolts(k, n) }]))),
};

const SIGNAL_COLORS = ['yellow', 'green', 'orange', 'teal', 'purple', 'white', 'blue', 'pink'];

export function nextPartId(layout: CircuitLayout, type: string, idBase?: string): string {
  const used = new Set(layout.parts.map((p) => p.id));
  if (idBase) {
    if (!used.has(idBase)) return idBase;
    for (let i = 2; ; i++) if (!used.has(`${idBase}${i}`)) return `${idBase}${i}`;
  }
  const pre = PREFIX[type] ?? 'X';
  for (let i = 1; ; i++) if (!used.has(`${pre}${i}`)) return `${pre}${i}`;
}

export function addPart(layout: CircuitLayout, type: string, x: number, y: number, idBase?: string): { layout: CircuitLayout; id: string } {
  const id = nextPartId(layout, type, idBase);
  const part: PlacedPart = { id, type, x: snap10(x), y: snap10(y), ...DEFAULTS[type] };
  return { layout: { ...layout, parts: [...layout.parts, part] }, id };
}

/** Điểm của dây chỉnh tay: [đầu, ...via, cuối]. Dây tự đi thì null (đường do bộ đi dây tính). */
export function wirePoints(layout: CircuitLayout, i: number): Point[] | null {
  const w = layout.wires[i];
  if (!w?.manual || !w.via) return null;
  const a = resolvePoint(layout, w.from), b = resolvePoint(layout, w.to);
  if (!a || !b) return null;
  return [a, ...w.via.map(([x, y]) => ({ x, y })), b];
}

export function movePartsBy(layout: CircuitLayout, ids: string[], dx: number, dy: number): CircuitLayout {
  if (!dx && !dy) return layout;
  const set = new Set(ids);
  // Đầu dây "BUS@x" là toạ độ tuyệt đối → dời thanh thì dời luôn x
  const shiftRef = (ref: string) => {
    const at = ref.indexOf('@');
    if (at < 0 || !set.has(ref.slice(0, at))) return ref;
    const bus = layout.parts.find((p) => p.id === ref.slice(0, at));
    return `${ref.slice(0, at)}@${parseFloat(ref.slice(at + 1)) + (bus && busVertical(bus) ? dy : dx)}`;
  };
  const after: CircuitLayout = {
    ...layout,
    parts: layout.parts.map((p) => (set.has(p.id) ? { ...p, x: p.x + dx, y: p.y + dy } : p)),
    wires: layout.wires.map((w) => ({ ...w, from: shiftRef(w.from), to: shiftRef(w.to) })),
  };
  after.wires = after.wires.map((w, i) => {
    if (!w.manual || !w.via) return w;
    const fa = set.has(endPartId(w.from)), fb = set.has(endPartId(w.to));
    if (!fa && !fb) return w;
    if (fa && fb) return { ...w, via: w.via.map(([x, y]) => [x + dx, y + dy] as [number, number]) };
    const old = wirePoints(layout, i);
    const nu = resolvePoint(after, fa ? w.from : w.to);
    if (!old || !nu) return w;
    const pts = followEnd(old, fa ? 'start' : 'end', nu);
    return { ...w, via: pts.slice(1, -1).map((p) => [p.x, p.y] as [number, number]) };
  });
  return after;
}

export function rotateParts(layout: CircuitLayout, ids: string[], dir: 1 | -1): CircuitLayout {
  const set = new Set(layout.parts.filter((p) => ids.includes(p.id)).map((p) => p.id));
  if (!set.size) return layout;
  const rot = (p: PlacedPart) => ((((p.rotation ?? 0) + dir * 90) % 360 + 360) % 360) as Rotation;
  // Thanh đồng xoay quanh tâm: điểm nối "ID@c" xoay theo (ngang ↔ dọc), giữ khoảng cách tới tâm
  const busRef = (ref: string) => {
    const at = ref.indexOf('@');
    if (at < 0 || !set.has(ref.slice(0, at))) return ref;
    const bus = layout.parts.find((p) => p.id === ref.slice(0, at));
    if (!bus || bus.type !== 'bus') return ref;
    const pt = busPoint(bus, parseFloat(ref.slice(at + 1)));
    const ox = pt.x - bus.x, oy = pt.y - bus.y;
    const q = dir === 1 ? { x: bus.x - oy, y: bus.y + ox } : { x: bus.x + oy, y: bus.y - ox };
    return `${bus.id}@${busCoord({ ...bus, rotation: rot(bus) }, q)}`;
  };
  return {
    ...layout,
    parts: layout.parts.map((p) => (set.has(p.id) ? { ...p, rotation: rot(p) } : p)),
    // Xoay làm đổi hướng chân → đường chỉnh tay không còn hợp, cho tự đi lại
    wires: layout.wires.map((w) => {
      const v = { ...w, from: busRef(w.from), to: busRef(w.to) };
      return set.has(endPartId(w.from)) || set.has(endPartId(w.to)) ? clearManual(v) : v;
    }),
  };
}

export function deleteParts(layout: CircuitLayout, ids: string[]): { layout: CircuitLayout; removedWires: number } {
  const set = new Set(ids);
  const wires = layout.wires.filter((w) => !set.has(endPartId(w.from)) && !set.has(endPartId(w.to)));
  return {
    layout: { ...layout, parts: layout.parts.filter((p) => !set.has(p.id)), wires },
    removedWires: layout.wires.length - wires.length,
  };
}

/** Ký hiệu cho bản sao của linh kiện không có tiền tố chuẩn (thanh đồng, dây ra, linh kiện tự thêm): GND → GND2, IN1 → IN2. */
function copyId(layout: CircuitLayout, id: string): string {
  const used = new Set(layout.parts.map((p) => p.id));
  const base = id.replace(/\d+$/, '') || 'X';
  for (let i = base === id ? 2 : 1; ; i++) if (!used.has(`${base}${i}`)) return `${base}${i}`;
}

export function duplicateParts(layout: CircuitLayout, ids: string[]): { layout: CircuitLayout; newIds: string[] } {
  let out = layout;
  const newIds: string[] = [];
  for (const p of layout.parts.filter((q) => ids.includes(q.id))) {
    const id = PREFIX[p.type] && p.type !== 'lead' ? nextPartId(out, p.type) : copyId(out, p.id);
    out = { ...out, parts: [...out.parts, { ...p, id, x: p.x + 40, y: p.y + 40 }] };
    newIds.push(id);
  }
  return { layout: out, newIds };
}

export function updatePart(layout: CircuitLayout, id: string, patch: Partial<PlacedPart>): CircuitLayout {
  const newId = patch.id?.trim();
  if (newId !== undefined && newId !== id) {
    if (!newId) throw new Error('Ký hiệu không được để trống.');
    if (/[.@\s]/.test(newId)) throw new Error('Ký hiệu không được chứa dấu chấm, @ hay khoảng trắng.');
    if (layout.parts.some((p) => p.id === newId)) throw new Error(`Đã có linh kiện "${newId}".`);
  }
  const renamed = newId && newId !== id;
  const rename = (ref: string) => (renamed && endPartId(ref) === id ? newId + ref.slice(id.length) : ref);
  return {
    ...layout,
    parts: layout.parts.map((p) => (p.id === id ? { ...p, ...patch, id: newId || id } : p)),
    wires: renamed ? layout.wires.map((w) => ({ ...w, from: rename(w.from), to: rename(w.to) })) : layout.wires,
  };
}

/** Màu gợi ý: chạm + nguồn → đỏ, chạm − / mass → đen, còn lại xoay vòng màu tín hiệu. */
export function suggestWireColor(layout: CircuitLayout, from: string, to: string): string {
  const role = (ref: string): 'pos' | 'neg' | null => {
    const p = layout.parts.find((q) => q.id === endPartId(ref));
    if (!p) return null;
    if (p.type === 'bus') return /GND|MASS/i.test(p.id) ? 'neg' : 'pos';
    // Cọc nguồn, máy nguồn, pin, đế pin: chân + → đỏ, chân − → đen
    if (p.type === 'terminal2' || POWER_TYPES.has(p.type)) return ref.endsWith('.+') ? 'pos' : ref.endsWith('.-') ? 'neg' : null;
    return null;
  };
  const roles = [role(from), role(to)];
  if (roles.includes('pos')) return 'red';
  if (roles.includes('neg')) return 'black';
  const n = layout.wires.filter((w) => w.color !== 'red' && w.color !== 'black').length;
  return SIGNAL_COLORS[n % SIGNAL_COLORS.length];
}

export function addWire(layout: CircuitLayout, from: string, to: string, color?: string): CircuitLayout {
  if (from === to) return layout;
  const dup = layout.wires.some((w) => (w.from === from && w.to === to) || (w.from === to && w.to === from));
  if (dup) return layout;
  return { ...layout, wires: [...layout.wires, { from, to, color: color ?? suggestWireColor(layout, from, to) }] };
}

export function updateWire(layout: CircuitLayout, i: number, patch: Partial<Wire>): CircuitLayout {
  return { ...layout, wires: layout.wires.map((w, k) => (k === i ? { ...w, ...patch } : w)) };
}

export function deleteWire(layout: CircuitLayout, i: number): CircuitLayout {
  return { ...layout, wires: layout.wires.filter((_, k) => k !== i) };
}

export function setWirePoints(layout: CircuitLayout, i: number, pts: Point[]): CircuitLayout {
  const w = layout.wires[i];
  const busRef = (ref: string, p: Point) => {
    const id = endPartId(ref);
    const bus = layout.parts.find((q) => q.id === id && q.type === 'bus');
    return bus ? `${id}@${Math.round(busCoord(bus, p))}` : ref;
  };
  return updateWire(layout, i, {
    from: busRef(w.from, pts[0]),
    to: busRef(w.to, pts[pts.length - 1]),
    via: pts.slice(1, -1).map((p) => [p.x, p.y] as [number, number]),
    manual: true,
  });
}

function clearManual(w: Wire): Wire {
  const { via: _via, manual: _manual, ...rest } = w;
  return rest;
}

/**
 * Trượt đầu dây nối vào thanh đồng tới toạ độ c dọc thanh (kẹp trong thân thanh).
 * Dây chỉnh tay: góc kề chỉnh theo cho vẫn vuông góc; dây tự đi: bộ đi dây tính lại.
 */
export function moveBusEnd(layout: CircuitLayout, i: number, which: 'from' | 'to', c: number): CircuitLayout {
  const w = layout.wires[i];
  const ref = w?.[which];
  const at = ref?.indexOf('@') ?? -1;
  if (!w || at < 0) return layout;
  const bus = layout.parts.find((p) => p.id === ref.slice(0, at) && p.type === 'bus');
  if (!bus) return layout;
  const [lo, hi] = busEnds(bus);
  const cc = Math.min(Math.max(c, lo + 10), hi - 10);
  const old = wirePoints(layout, i);
  const moved = updateWire(layout, i, { [which]: `${bus.id}@${cc}` });
  if (!old) return moved;
  const np = busPoint(bus, cc);
  const s = simplify(old);
  if (s.length === 2) {
    // Dây thẳng 1 đoạn: gập ở giữa (dây vẫn rời chân thẳng như cũ, không bị bẻ ngang ngay tại chân)
    const pin = which === 'from' ? s[1] : s[0];
    const pts = busVertical(bus)
      ? (() => { const jx = snap10((pin.x + np.x) / 2); return [pin, { x: jx, y: pin.y }, { x: jx, y: np.y }, np]; })()
      : (() => { const jy = snap10((pin.y + np.y) / 2); return [pin, { x: pin.x, y: jy }, { x: np.x, y: jy }, np]; })();
    return setWirePoints(moved, i, which === 'from' ? pts.reverse() : pts);
  }
  return setWirePoints(moved, i, followEnd(old, which === 'from' ? 'start' : 'end', np));
}

export function resetWire(layout: CircuitLayout, i: number): CircuitLayout {
  return { ...layout, wires: layout.wires.map((w, k) => (k === i ? clearManual(w) : w)) };
}

export function resetAllWires(layout: CircuitLayout): CircuitLayout {
  return { ...layout, wires: layout.wires.map(clearManual) };
}

/** Kéo 1 đầu thanh đồng (side −1 đầu trái/trên, 1 phải/dưới) tới toạ độ endX dọc trục thanh. Thanh dài tối thiểu 100px. */
export function resizeBus(layout: CircuitLayout, id: string, side: -1 | 1, endX: number): CircuitLayout {
  const bus = layout.parts.find((p) => p.id === id && p.type === 'bus');
  if (!bus) return layout;
  const vertical = busVertical(bus);
  let [left, right] = busEnds(bus);
  if (side < 0) left = Math.min(snap10(endX), right - 100);
  else right = Math.max(snap10(endX), left + 100);
  // Ảnh khung cố định (node cũ) thì giữ thanh trong khung; mặt bàn không giới hạn thì thôi
  const limit = vertical ? layout.height : layout.width;
  if (limit) { left = Math.max(20, left); right = Math.min(limit - 20, right); }
  const clampRef = (ref: string) => {
    const at = ref.indexOf('@');
    if (at < 0 || ref.slice(0, at) !== id) return ref;
    const v = parseFloat(ref.slice(at + 1));
    return `${id}@${Math.min(Math.max(v, left + 10), right - 10)}`;
  };

  let after: CircuitLayout = {
    ...layout,
    parts: layout.parts.map((p) => (p.id === id ? { ...p, [vertical ? 'y' : 'x']: (left + right) / 2, length: right - left } : p)),
    wires: layout.wires.map((w) => ({ ...w, from: clampRef(w.from), to: clampRef(w.to) })),
  };

  // Recompute via for manual wires whose bus endpoint was clamped
  after.wires = after.wires.map((w, i) => {
    if (!w.manual || !w.via) return w;
    const oldW = layout.wires[i];
    const fromChanged = oldW.from !== w.from;
    const toChanged = oldW.to !== w.to;
    if (!fromChanged && !toChanged) return w;

    const old = wirePoints(layout, i);
    const nu = resolvePoint(after, fromChanged ? w.from : w.to);
    if (!old || !nu) return w;
    const pts = followEnd(old, fromChanged ? 'start' : 'end', nu);
    return { ...w, via: pts.slice(1, -1).map((p) => [p.x, p.y] as [number, number]) };
  });

  return after;
}

/**
 * Dây sửa tay: bỏ đoạn "chuôi" ở 1 đầu — dây đi thẳng ra theo hướng chân rồi quay ngược lại
 * trên cùng đường (cần cho mối hàn dài, thừa khi đổi sang mối hàn tròn).
 */
export function trimBacktrack(layout: CircuitLayout, i: number, which: 'from' | 'to'): CircuitLayout {
  const w = layout.wires[i];
  if (!w?.via?.length) return layout;
  const a = resolvePoint(layout, w.from), b = resolvePoint(layout, w.to);
  if (!a || !b) return layout;
  let pts: Point[] = [a, ...w.via.map(([x, y]) => ({ x, y })), b];
  if (which === 'to') pts = pts.reverse();
  // pts[1] là góc ngay sau chân: bỏ nếu pts[0], pts[1], pts[2] thẳng hàng và pts[1] không nằm giữa (= đi ra rồi quay lại)
  const backtracks = (p0: Point, p1: Point, p2: Point) => {
    const cross = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
    const dot = (p1.x - p0.x) * (p2.x - p1.x) + (p1.y - p0.y) * (p2.y - p1.y);
    return Math.abs(cross) < 1e-6 && dot < 0;
  };
  let changed = false;
  while (pts.length > 2 && backtracks(pts[0], pts[1], pts[2])) { pts.splice(1, 1); changed = true; }
  if (!changed) return layout;
  if (which === 'to') pts = pts.reverse();
  const via = pts.slice(1, -1).map((p) => [p.x, p.y] as [number, number]);
  return { ...layout, wires: layout.wires.map((x, k) => (k === i ? { ...x, via: via.length ? via : undefined, manual: via.length ? x.manual : undefined } : x)) };
}
