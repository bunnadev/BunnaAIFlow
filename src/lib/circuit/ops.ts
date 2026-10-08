import { endPartId, resolvePoint } from './geometry';
import { followEnd } from './wireEdit';
import type { CircuitLayout, PlacedPart, Point, Rotation, Wire } from './types';
import { CELL_KINDS, CELLS, cellType, holderType, holderVolts, POWER_TYPES } from './powerParts';

/**
 * Mọi thao tác sửa bố cục của Xưởng vẽ mạch. Hàm thuần: nhận bố cục, trả bố cục
 * mới (không sửa đầu vào) — reducer hoàn tác chỉ việc lưu các bản cũ.
 */

const snap10 = (v: number) => Math.round(v / 10) * 10;

const PREFIX: Record<string, string> = {
  resistor: 'R', cap_elec: 'C', cap_ceramic: 'C', pot: 'VR', diode: 'D',
  to92: 'Q', to220: 'Q', to3: 'Q', pentawatt: 'U', dip8: 'U', dip14: 'U', dip16: 'U',
  led: 'LED', bulb: 'DEN', cob: 'COB', res_cement: 'R', res_power: 'R', probe_red: 'VOM', probe_black: 'VOM', speaker: 'SP', jack35: 'J', mic: 'MIC', terminal2: 'PWR', lead: 'OUT', psu: 'PSU',
  ...Object.fromEntries(CELL_KINDS.flatMap((k) => [cellType(k), ...[1, 2, 3].map((n) => holderType(k, n))].map((t) => [t, 'BAT']))),
};

const DEFAULTS: Record<string, Partial<PlacedPart>> = {
  resistor: { value: '1k', label: '1kΩ' },
  led: { marking: 'đỏ' },
  cap_elec: { marking: '100µF', label: '100µF' },
  cap_ceramic: { marking: '104', label: '100nF' },
  pot: { marking: 'B10K', label: '10k' },
  diode: { marking: '1N4007', label: '1N4007' },
  to92: { marking: 'C1815', label: 'C1815' },
  to220: { marking: 'TIP41C', label: 'TIP41C' },
  to3: { marking: '2N3055', label: '2N3055' },
  pentawatt: { marking: 'TDA2003', label: 'TDA2003' },
  dip8: { marking: 'NE555', label: 'NE555' },
  dip14: { marking: 'IC', label: 'IC' },
  dip16: { marking: 'CD4017', label: 'CD4017' },
  terminal2: { label: '12V' },
  lead: { label: 'OUT' },
  mic: { label: 'MIC' },
  bus: { length: 600 },
  psu: { value: '12.00', marking: '1.000' },
  bulb: { value: '12', marking: '5', label: '12V 5W' },
  cob: { value: '12', label: '12V' },
  res_cement: { value: '10', marking: '5', label: '10Ω 5W' },
  res_power: { value: '33', marking: '1', label: '33Ω 1W' },
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
    return `${ref.slice(0, at)}@${parseFloat(ref.slice(at + 1)) + dx}`;
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
  const set = new Set(layout.parts.filter((p) => ids.includes(p.id) && p.type !== 'bus').map((p) => p.id));
  if (!set.size) return layout;
  return {
    ...layout,
    parts: layout.parts.map((p) => (set.has(p.id) ? { ...p, rotation: ((((p.rotation ?? 0) + dir * 90) % 360 + 360) % 360) as Rotation } : p)),
    // Xoay làm đổi hướng chân → đường chỉnh tay không còn hợp, cho tự đi lại
    wires: layout.wires.map((w) => (set.has(endPartId(w.from)) || set.has(endPartId(w.to)) ? clearManual(w) : w)),
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

export function duplicateParts(layout: CircuitLayout, ids: string[]): { layout: CircuitLayout; newIds: string[] } {
  let out = layout;
  const newIds: string[] = [];
  for (const p of layout.parts.filter((q) => ids.includes(q.id))) {
    const id = nextPartId(out, p.type, p.type === 'bus' ? p.id.replace(/\d+$/, '') : undefined);
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
    return layout.parts.some((q) => q.id === id && q.type === 'bus') ? `${id}@${Math.round(p.x)}` : ref;
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

export function resetWire(layout: CircuitLayout, i: number): CircuitLayout {
  return { ...layout, wires: layout.wires.map((w, k) => (k === i ? clearManual(w) : w)) };
}

export function resetAllWires(layout: CircuitLayout): CircuitLayout {
  return { ...layout, wires: layout.wires.map(clearManual) };
}

/** Kéo 1 đầu thanh đồng (side −1 trái, 1 phải) tới endX. Thanh dài tối thiểu 100px. */
export function resizeBus(layout: CircuitLayout, id: string, side: -1 | 1, endX: number): CircuitLayout {
  const bus = layout.parts.find((p) => p.id === id && p.type === 'bus');
  if (!bus) return layout;
  const half = (bus.length ?? 800) / 2;
  let left = bus.x - half, right = bus.x + half;
  if (side < 0) left = Math.min(snap10(endX), right - 100);
  else right = Math.max(snap10(endX), left + 100);
  // Ảnh khung cố định (node cũ) thì giữ thanh trong khung; mặt bàn không giới hạn thì thôi
  if (layout.width) { left = Math.max(20, left); right = Math.min(layout.width - 20, right); }
  const clampRef = (ref: string) => {
    const at = ref.indexOf('@');
    if (at < 0 || ref.slice(0, at) !== id) return ref;
    const v = parseFloat(ref.slice(at + 1));
    return `${id}@${Math.min(Math.max(v, left + 10), right - 10)}`;
  };

  let after: CircuitLayout = {
    ...layout,
    parts: layout.parts.map((p) => (p.id === id ? { ...p, x: (left + right) / 2, length: right - left } : p)),
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
