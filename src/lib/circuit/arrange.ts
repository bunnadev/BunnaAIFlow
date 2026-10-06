import { allPins } from './geometry';
import { movePartsBy } from './ops';
import { partBox } from './render';
import type { CircuitLayout, PlacedPart } from './types';

/** Căn hàng, chia đều, đường gióng khi kéo — đều đi qua movePartsBy để dây chỉnh tay bám theo. */

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';
export interface Guide { axis: 'x' | 'y'; at: number }

function boxesOf(layout: CircuitLayout, ids: string[]) {
  return layout.parts
    .filter((p) => ids.includes(p.id))
    .map((p) => ({ p, b: partBox(p) }))
    .filter((o): o is { p: PlacedPart; b: NonNullable<ReturnType<typeof partBox>> } => !!o.b);
}

export function alignParts(layout: CircuitLayout, ids: string[], mode: AlignMode): CircuitLayout {
  const boxes = boxesOf(layout, ids);
  if (boxes.length < 2) return layout;
  const x1 = Math.min(...boxes.map((o) => o.b.x1)), x2 = Math.max(...boxes.map((o) => o.b.x2));
  const y1 = Math.min(...boxes.map((o) => o.b.y1)), y2 = Math.max(...boxes.map((o) => o.b.y2));
  let out = layout;
  for (const { p, b } of boxes) {
    let dx = 0, dy = 0;
    switch (mode) {
      case 'left': dx = x1 - b.x1; break;
      case 'right': dx = x2 - b.x2; break;
      case 'hcenter': dx = (x1 + x2) / 2 - p.x; break;
      case 'top': dy = y1 - b.y1; break;
      case 'bottom': dy = y2 - b.y2; break;
      case 'vcenter': dy = (y1 + y2) / 2 - p.y; break;
    }
    out = movePartsBy(out, [p.id], dx, dy);
  }
  return out;
}

export function distributeParts(layout: CircuitLayout, ids: string[], axis: 'x' | 'y'): CircuitLayout {
  const parts = layout.parts.filter((p) => ids.includes(p.id)).sort((a, b) => a[axis] - b[axis]);
  if (parts.length < 3) return layout;
  const first = parts[0][axis], step = (parts[parts.length - 1][axis] - first) / (parts.length - 1);
  let out = layout;
  parts.forEach((p, i) => {
    const d = first + step * i - p[axis];
    out = movePartsBy(out, [p.id], axis === 'x' ? d : 0, axis === 'y' ? d : 0);
  });
  return out;
}

/** Đặc trưng để gióng: mép + tâm khung, và toạ độ các chân. */
function features(layout: CircuitLayout, parts: PlacedPart[], ox: number, oy: number) {
  const xs: number[] = [], ys: number[] = [];
  for (const p of parts) {
    const b = partBox(p);
    if (!b) continue;
    xs.push(b.x1 + ox, (b.x1 + b.x2) / 2 + ox, b.x2 + ox);
    ys.push(b.y1 + oy, (b.y1 + b.y2) / 2 + oy, b.y2 + oy);
  }
  for (const pin of allPins({ ...layout, parts })) { xs.push(pin.x + ox); ys.push(pin.y + oy); }
  return { xs, ys };
}

export function snapDelta(layout: CircuitLayout, ids: string[], dx: number, dy: number, threshold = 8): { dx: number; dy: number; guides: Guide[] } {
  const moving = layout.parts.filter((p) => ids.includes(p.id));
  const others = layout.parts.filter((p) => !ids.includes(p.id) && p.type !== 'lead');
  if (!moving.length || !others.length) return { dx, dy, guides: [] };
  const m = features(layout, moving, dx, dy);
  const t = features(layout, others, 0, 0);
  const best = (ms: number[], ts: number[]) => {
    let bd = Infinity, at = 0, off = 0;
    for (const a of ms) for (const b of ts) {
      const d = Math.abs(a - b);
      if (d < bd) { bd = d; at = b; off = b - a; }
    }
    return bd <= threshold ? { at, off } : null;
  };
  const bx = best(m.xs, t.xs), by = best(m.ys, t.ys);
  const guides: Guide[] = [];
  if (bx) { dx += bx.off; guides.push({ axis: 'x', at: bx.at }); }
  if (by) { dy += by.off; guides.push({ axis: 'y', at: by.at }); }
  return { dx, dy, guides };
}
