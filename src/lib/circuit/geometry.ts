import { PARTS } from './parts';
import { partBox, resolveEndpoint } from './render';
import type { End, RoutedWire } from './route';
import type { CircuitLayout, PlacedPart, Point } from './types';

/** Hình học cho editor: chân, bắt chuột, đích thả dây, dây xem trước khi đang kéo. */

export interface PinRef { partId: string; pin: string; x: number; y: number }

const snap10 = (v: number) => Math.round(v / 10) * 10;

export function endPartId(ref: string): string {
  return ref.split(/[.@]/)[0].trim();
}

export function resolvePoint(layout: CircuitLayout, ref: string): Point | null {
  const r = resolveEndpoint(layout, ref);
  return typeof r === 'string' ? null : r.point;
}

export function allPins(layout: CircuitLayout): PinRef[] {
  const out: PinRef[] = [];
  for (const p of layout.parts) {
    const def = PARTS[p.type];
    if (!def || p.type === 'bus') continue;
    for (const pin of Object.keys(def.pins)) {
      const pt = resolvePoint(layout, `${p.id}.${pin}`);
      if (pt) out.push({ partId: p.id, pin, x: pt.x, y: pt.y });
    }
  }
  return out;
}

export function hitPin(layout: CircuitLayout, pt: Point, radius = 14): PinRef | null {
  let best: PinRef | null = null;
  let bestD = radius;
  for (const p of allPins(layout)) {
    const d = Math.hypot(p.x - pt.x, p.y - pt.y);
    if (d <= bestD) { bestD = d; best = p; }
  }
  return best;
}

export function hitPart(layout: CircuitLayout, pt: Point): PlacedPart | null {
  for (let i = layout.parts.length - 1; i >= 0; i--) {
    const p = layout.parts[i];
    const b = p.type === 'lead' ? { x1: p.x - 14, y1: p.y - 14, x2: p.x + 14, y2: p.y + 14 } : partBox(p, true);
    if (b && pt.x >= b.x1 && pt.x <= b.x2 && pt.y >= b.y1 && pt.y <= b.y2) return p;
  }
  return null;
}

function distToSegment(pt: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(pt.x - (a.x + t * dx), pt.y - (a.y + t * dy));
}

export function hitWire(routed: (RoutedWire | null)[], pt: Point, tol = 9): number | null {
  for (let i = routed.length - 1; i >= 0; i--) {
    const pts = routed[i]?.points;
    if (!pts) continue;
    for (let k = 0; k < pts.length - 1; k++) if (distToSegment(pt, pts[k], pts[k + 1]) <= tol) return i;
  }
  return null;
}

export function wiresOfPart(layout: CircuitLayout, id: string): number[] {
  const out: number[] = [];
  layout.wires.forEach((w, i) => { if (endPartId(w.from) === id || endPartId(w.to) === id) out.push(i); });
  return out;
}

/** Thả đầu dây ở đâu: chân gần nhất, không thì thanh đồng dưới con trỏ. */
export function dropTarget(layout: CircuitLayout, pt: Point): string | null {
  const pin = hitPin(layout, pt);
  if (pin) return `${pin.partId}.${pin.pin}`;
  const part = hitPart(layout, pt);
  if (part?.type !== 'bus') return null;
  const half = (part.length ?? 800) / 2;
  const x = Math.min(Math.max(snap10(pt.x), part.x - half + 10), part.x + half - 10);
  return `${part.id}@${x}`;
}

/** Tay cầm ở giữa từng đoạn dây đủ dài (đoạn dài 0 sinh ra khi thêm góc thì bỏ qua). */
export function segmentHandles(pts: Point[]): { k: number; x: number; y: number }[] {
  const out: { k: number; x: number; y: number }[] = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k], b = pts[k + 1];
    if (Math.hypot(b.x - a.x, b.y - a.y) < 24) continue;
    out.push({ k, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  }
  return out;
}

export function nearestSegment(pts: Point[], pt: Point, tol: number): number {
  let best = -1, bestD = tol;
  for (let k = 0; k < pts.length - 1; k++) {
    if (pts[k].x === pts[k + 1].x && pts[k].y === pts[k + 1].y) continue;
    const d = distToSegment(pt, pts[k], pts[k + 1]);
    if (d <= bestD) { bestD = d; best = k; }
  }
  return best;
}

/**
 * Trong lúc kéo: dây nối vào linh kiện đang kéo vẽ tạm (dây tự đi → đường thẳng,
 * dây chỉnh tay → theo via), dây khác giữ đường đã tính — không chạy A* mỗi lần rê chuột.
 */
export function previewRouted(prev: (RoutedWire | null)[], layout: CircuitLayout, affected: Set<number>): (RoutedWire | null)[] {
  return layout.wires.map((w, i) => {
    if (!affected.has(i)) return prev[i] ?? null;
    const a = resolveEndpoint(layout, w.from);
    const b = resolveEndpoint(layout, w.to);
    if (typeof a === 'string' || typeof b === 'string' || !a.part || !b.part) return null;
    const via = w.manual && w.via ? w.via.map(([x, y]) => ({ x, y })) : [];
    const end = (r: typeof a): End => ({ point: r.point, dir: 1, part: r.part!, isLead: r.isLead });
    return { points: [a.point, ...via, b.point], from: end(a), to: end(b), auto: !w.manual };
  });
}
