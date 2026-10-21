import { allPins, endPartId, resolvePoint } from './geometry';
import { updatePart } from './ops';
import { isProbe } from './extraParts';
import type { CircuitLayout, PlacedPart, Point } from './types';

/**
 * Nối chạm: pin rời đặt sát đầu nhau (cực chạm cực), hoặc đầu que đo VOM đặt lên chân
 * linh kiện, thì tự nối, không cần dây —
 * bố cục giữ 1 "dây chạm" (màu CONTACT) không vẽ ra, để biết 2 cực đang nối.
 * Kéo pin lại gần (≤ SNAP) thì hít cho 2 cực trùng nhau; kéo ra thì dây chạm tự mất.
 */
export const CONTACT = 'contact';
export const SNAP = 24;

const isCell = (type: string) => type.startsWith('cell_');
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

type Kind = 'cell' | 'probe' | 'other';
interface CPin { partId: string; pin: string; x: number; y: number; kind: Kind }

/** Mọi chân kèm loại: pin rời, đầu que đo, hay chân linh kiện thường. */
function contactPins(layout: CircuitLayout): CPin[] {
  const kindOf = new Map(layout.parts.map((p) => [p.id, (isCell(p.type) ? 'cell' : isProbe(p.type) ? 'probe' : 'other') as Kind]));
  // chỉ đầu kim que đo mới chạm; đầu dây cáp là chân nối dây thường
  return allPins(layout).map((p) => {
    const kind = kindOf.get(p.partId) ?? 'other';
    return { ...p, kind: kind === 'probe' && p.pin !== 'tip' ? 'other' : kind };
  });
}

/** Cặp chân được nối chạm: 2 cực pin rời, hoặc đầu que đo với chân bất kỳ (không phải que khác). */
const canTouch = (a: CPin, b: CPin) =>
  a.partId !== b.partId && ((a.kind === 'cell' && b.kind === 'cell') || (a.kind === 'probe') !== (b.kind === 'probe'));

/** Đang kéo các linh kiện `ids` thêm (dx, dy): nếu 1 cực pin rời tới gần cực pin rời khác thì hít vào cho trùng. */
export function contactSnap(layout: CircuitLayout, ids: string[], dx: number, dy: number): { dx: number; dy: number; snapped: boolean } {
  const pins = contactPins(layout);
  const set = new Set(ids);
  const moving = pins.filter((p) => set.has(p.partId));
  const still = pins.filter((p) => !set.has(p.partId));
  let best: { d: number; dx: number; dy: number } | null = null;
  for (const m of moving) {
    if (m.kind === 'other' && !still.some((s) => s.kind === 'probe')) continue;
    const at = { x: m.x + dx, y: m.y + dy };
    for (const s of still) {
      if (!canTouch(m, s)) continue;
      const d = dist(at, s);
      if (d <= SNAP && (!best || d < best.d)) best = { d, dx: dx + s.x - at.x, dy: dy + s.y - at.y };
    }
  }
  return best ? { dx: best.dx, dy: best.dy, snapped: true } : { dx, dy, snapped: false };
}

/** Thêm dây chạm cho các cực pin đang trùng nhau, bỏ dây chạm không còn chạm. Không đổi gì thì trả lại đúng bố cục cũ. */
export function syncContacts(layout: CircuitLayout): CircuitLayout {
  const pins = contactPins(layout);
  const at = new Map(pins.map((p) => [`${p.partId}.${p.pin}`, p as Point]));
  const touching = (ref: string, other: string) => {
    const a = at.get(ref), b = at.get(other);
    return !!a && !!b && dist(a, b) <= 1;
  };
  const kept = layout.wires.filter((w) => w.color !== CONTACT || touching(w.from, w.to));
  const has = new Set(kept.filter((w) => w.color === CONTACT).flatMap((w) => [`${w.from}|${w.to}`, `${w.to}|${w.from}`]));
  const added: CircuitLayout['wires'] = [];
  for (let i = 0; i < pins.length; i++) {
    for (let j = i + 1; j < pins.length; j++) {
      const a = pins[i], b = pins[j];
      if (!canTouch(a, b) || dist(a, b) > 1) continue;
      const ra = `${a.partId}.${a.pin}`, rb = `${b.partId}.${b.pin}`;
      if (has.has(`${ra}|${rb}`)) continue;
      has.add(`${ra}|${rb}`); has.add(`${rb}|${ra}`);
      added.push({ from: ra, to: rb, color: CONTACT });
    }
  }
  if (kept.length === layout.wires.length && !added.length) return layout;
  return { ...layout, wires: [...kept, ...added] };
}

/**
 * Đổi loại pin rời đang chạm pin khác (VD AA → 18650 dài hơn): giữ nguyên chỗ cực đang
 * chạm, dời tâm pin cho phần dài thêm về phía còn lại — không đè lên viên bên cạnh.
 */
export function anchorContact(layout: CircuitLayout, id: string, patch: Partial<PlacedPart>): Partial<PlacedPart> {
  const w = layout.wires.find((x) => x.color === CONTACT && (endPartId(x.from) === id || endPartId(x.to) === id));
  const part = layout.parts.find((p) => p.id === id);
  if (!w || !part) return patch;
  const ref = endPartId(w.from) === id ? w.from : w.to;
  const before = resolvePoint(layout, ref);
  const after = resolvePoint(updatePart(layout, id, patch), ref);
  if (!before || !after) return patch;
  return { ...patch, x: part.x + before.x - after.x, y: part.y + before.y - after.y };
}
