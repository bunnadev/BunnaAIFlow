import { busVertical } from './bus';
import { partBox, type Box } from './render';
import { setWirePoints } from './ops';
import { routeWires, type End, type RoutedWire } from './route';
import type { CircuitLayout, Point } from './types';

/**
 * Mặt bàn vẽ không giới hạn: bộ đi dây cũ làm việc trên lưới từ (0,0) tới
 * (width,height). Dời cả mạch về vùng dương (bội số 10 để không lệch lưới),
 * đi dây, rồi dời kết quả về toạ độ gốc.
 */

const MARGIN = 200;

export function contentBounds(layout: CircuitLayout, routed?: (RoutedWire | null)[]): Box | null {
  let b: Box | null = null;
  const add = (x1: number, y1: number, x2: number, y2: number) => {
    b = b ? { x1: Math.min(b.x1, x1), y1: Math.min(b.y1, y1), x2: Math.max(b.x2, x2), y2: Math.max(b.y2, y2) } : { x1, y1, x2, y2 };
  };
  for (const p of layout.parts) {
    const pb = p.type === 'lead' ? { x1: p.x - 14, y1: p.y - 14, x2: p.x + 14, y2: p.y + 14 } : partBox(p, true);
    if (pb) add(pb.x1, pb.y1, pb.x2, pb.y2);
  }
  for (const rw of routed ?? []) for (const pt of rw?.points ?? []) add(pt.x, pt.y, pt.x, pt.y);
  return b;
}

export function routeWorld(layout: CircuitLayout): (RoutedWire | null)[] {
  const b = contentBounds(layout);
  if (!b) return layout.wires.map(() => null);
  const dx = MARGIN - Math.floor(b.x1 / 10) * 10;
  const dy = MARGIN - Math.floor(b.y1 / 10) * 10;
  const shiftRef = (ref: string) => {
    const at = ref.indexOf('@');
    if (at < 0) return ref;
    const bus = layout.parts.find((p) => p.id === ref.slice(0, at));
    return `${ref.slice(0, at)}@${parseFloat(ref.slice(at + 1)) + (bus && busVertical(bus) ? dy : dx)}`;
  };
  const shifted: CircuitLayout = {
    parts: layout.parts.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
    wires: layout.wires.map((w) => ({
      ...w,
      from: shiftRef(w.from),
      to: shiftRef(w.to),
      via: w.via?.map(([x, y]) => [x + dx, y + dy] as [number, number]),
    })),
    width: Math.ceil((b.x2 + dx + MARGIN) / 10) * 10,
    height: Math.ceil((b.y2 + dy + MARGIN) / 10) * 10,
  };
  const byId = new Map(layout.parts.map((p) => [p.id, p]));
  const back = (p: Point): Point => ({ x: p.x - dx, y: p.y - dy });
  const backEnd = (e: End): End => ({
    ...e,
    point: back(e.point),
    part: byId.get(e.part.id) ?? e.part,
    bus: e.bus ? byId.get(e.bus.id) ?? e.bus : undefined,
  });
  return routeWires(shifted, { titleZones: false, spread: true }).map((rw) => rw && {
    ...rw,
    points: rw.points.map(back),
    from: backEnd(rw.from),
    to: backEnd(rw.to),
  });
}

/**
 * Chữ ký hình học cho bộ đi dây: chỉ gồm những gì làm đổi đường dây (vị trí,
 * xoay, kích thước linh kiện; 2 đầu + điểm gấp của dây; phiên bản thư viện).
 * Sửa nhãn / màu dây / tên chân không đổi chữ ký → không phải đi dây lại.
 */
export function routingSignature(layout: CircuitLayout, partsVersion = 0): string {
  return JSON.stringify([
    partsVersion,
    layout.parts.map((p) => [p.id, p.type, p.x, p.y, p.rotation ?? 0, p.length ?? null, !!p.heatsink, p.scale ?? 1, p.joint ?? null]),
    layout.wires.map((w) => [w.from, w.to, w.via ?? null, !!w.manual, w.joints ?? null]),
  ]);
}

/**
 * Ghim mọi dây đang tự đi vào đúng đường hiện tại (thành dây chỉnh tay). Gọi sau
 * mỗi thao tác của Xưởng vẽ: dây cũ đều đã ghim nên chỉ dây mới nối / dây vừa bấm
 * "tự đi lại" được bộ đi dây tính đường (né các dây đang đứng yên) — nối hay kéo
 * 1 dây không làm các dây khác nhảy. Dây chạm và dây không tìm được đường thì để tự đi.
 */
export function pinAutoWires(layout: CircuitLayout, routed: (RoutedWire | null)[] = routeWorld(layout)): CircuitLayout {
  let out = layout;
  layout.wires.forEach((w, i) => {
    const r = routed[i];
    if (w.manual || w.via?.length || w.color === 'contact' || !r || r.hidden || r.failed) return;
    out = setWirePoints(out, i, r.points);
  });
  return out;
}
