import type { Point } from './types';

/**
 * Sửa đường dây vuông góc. Mọi hàm nhận/trả polyline đầy đủ gồm đoạn ngang/dọc.
 * Điểm đầu và cuối là toạ độ chân: followEnd di chuyển 1 chân, các hàm khác
 * giữ 2 chân đứng yên. Ở giữa là các góc. Kết quả luôn chỉ gồm đoạn ngang/dọc.
 */

export type Orientation = 'h' | 'v' | null;

const snap10 = (v: number) => Math.round(v / 10) * 10;

export function segOrientation(a: Point, b: Point): Orientation {
  if (a.y === b.y && a.x !== b.x) return 'h';
  if (a.x === b.x && a.y !== b.y) return 'v';
  return null;
}

/** Đầu dây trượt được theo đoạn bị kéo (đầu nối vào thanh đồng) thay vì đứng yên. */
export interface SlideEnds { start?: boolean; end?: boolean }

/** Kéo đoạn k (pts[k]→pts[k+1]) đi delta theo phương vuông góc với nó. */
export function moveSegment(pts: Point[], k: number, delta: number, slide: SlideEnds = {}): Point[] {
  const o = segOrientation(pts[k], pts[k + 1]);
  if (!o || delta === 0) return pts.map((p) => ({ ...p }));
  const out = pts.map((p) => ({ ...p }));
  let i = k;
  // Đoạn chạm chân: nhân đôi điểm chân để chân đứng yên, đoạn nối chân thành đoạn vuông góc mới
  if (i === 0 && !slide.start) { out.splice(1, 0, { ...out[0] }); i = 1; }
  if (i + 1 === out.length - 1 && !slide.end) out.splice(out.length - 1, 0, { ...out[out.length - 1] });
  if (o === 'h') { out[i].y += delta; out[i + 1].y += delta; }
  else { out[i].x += delta; out[i + 1].x += delta; }
  return out;
}

/**
 * Độ dời khi kéo đoạn k theo chuột (raw = độ lệch chuột theo phương vuông góc với đoạn).
 * Hút vào toạ độ của điểm khác trên dây (chân linh kiện thường lệch lưới, vd x=563) trong
 * phạm vi `magnet` → kéo thẳng hàng được với đoạn rời chân; không thì bám lưới 10 TUYỆT ĐỐI
 * (không phải bội 10 tính từ chỗ cũ, vì vậy dây lệch lưới không bao giờ thẳng lại được).
 */
export function segmentDelta(pts: Point[], k: number, raw: number, magnet = 6): number {
  const o = segOrientation(pts[k], pts[k + 1]);
  if (!o) return 0;
  const coord = (p: Point) => (o === 'h' ? p.y : p.x);
  const from = coord(pts[k]);
  const target = from + raw;
  let best: number | null = null;
  pts.forEach((p, i) => {
    if (i === k || i === k + 1) return;
    const c = coord(p);
    if (Math.abs(c - target) <= magnet && (best === null || Math.abs(c - target) < Math.abs(best - target))) best = c;
  });
  return (best ?? snap10(target)) - from;
}

/** Tách đoạn k làm 2 tại điểm gần `at` nhất — mỗi nửa kéo được riêng. */
export function addBend(pts: Point[], k: number, at: Point): Point[] {
  const a = pts[k], b = pts[k + 1];
  const o = segOrientation(a, b);
  if (!o) return pts.map((p) => ({ ...p }));
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, Math.min(lo, hi)), Math.max(lo, hi));
  const m = o === 'h' ? { x: clamp(snap10(at.x), a.x, b.x), y: a.y } : { x: a.x, y: clamp(snap10(at.y), a.y, b.y) };
  return [...pts.slice(0, k + 1).map((p) => ({ ...p })), m, { ...m }, ...pts.slice(k + 1).map((p) => ({ ...p }))];
}

/** Bỏ góc i: 2 điểm kề thẳng hàng thì gộp; không thì lật góc sang phía đối diện. */
export function removeCorner(pts: Point[], i: number): Point[] {
  if (i <= 0 || i >= pts.length - 1) return pts.map((p) => ({ ...p }));
  const a = pts[i - 1], c = pts[i], b = pts[i + 1];
  if (a.x === b.x || a.y === b.y) return simplify([...pts.slice(0, i), ...pts.slice(i + 1)]);
  const flip = c.x === a.x ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
  return simplify([...pts.slice(0, i), flip, ...pts.slice(i + 1)]);
}

/** Linh kiện ở 1 đầu dây di chuyển: đặt đầu đó vào p, chỉnh góc kề cho vẫn vuông góc. */
export function followEnd(pts: Point[], which: 'start' | 'end', p: Point): Point[] {
  let out = simplify(pts).map((q) => ({ ...q }));
  if (which === 'end') out.reverse();
  const old = out[0];
  if (out.length === 2) {
    const other = out[1];
    const elbow = old.x === other.x ? { x: p.x, y: other.y } : { x: other.x, y: p.y };
    out = [{ ...p }, elbow, other];
  } else {
    const o = segOrientation(old, out[1]);
    if (o === 'v') out[1].x = p.x;
    else if (o === 'h') out[1].y = p.y;
    out[0] = { ...p };
  }
  if (which === 'end') out.reverse();
  return simplify(out);
}

/** Bỏ điểm trùng liên tiếp và điểm nằm giữa 2 điểm thẳng hàng. */
export function simplify(pts: Point[]): Point[] {
  const a = pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y);
  const out: Point[] = [{ ...a[0] }];
  for (let i = 1; i < a.length - 1; i++) {
    const p0 = out[out.length - 1], p1 = a[i], p2 = a[i + 1];
    const straight = (p0.x === p1.x && p1.x === p2.x) || (p0.y === p1.y && p1.y === p2.y);
    if (!straight) out.push({ ...p1 });
  }
  if (a.length > 1) out.push({ ...a[a.length - 1] });
  return out;
}

/** Hướng chân: 0 phải, 1 xuống, 2 trái, 3 lên (giống bộ đi dây). */
const DIRV = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];

/** Đoạn rời chân tối thiểu: đủ chỗ cho mối hàn + lõi trần + 1 khúc vỏ thẳng trước khi rẽ. */
export const LEAD_OUT = 40;

/**
 * Dây rời chân đúng hướng chân và đi thẳng ≥ LEAD_OUT trước khi rẽ? dir = null: không
 * ràng buộc (thanh đồng, dây ra, chân nằm giữa thân).
 */
export function leadOutOk(pts: Point[], startDir: number | null, endDir: number | null, min = LEAD_OUT): boolean {
  const check = (q: Point[], dir: number | null) => {
    if (dir === null) return true;
    const a = q[0];
    const b = q.find((p) => p.x !== a.x || p.y !== a.y);
    if (!b) return true;
    const v = DIRV[dir];
    const along = (b.x - a.x) * v.x + (b.y - a.y) * v.y;
    const side = Math.abs((b.x - a.x) * v.y - (b.y - a.y) * v.x);
    return side === 0 && along >= min;
  };
  return check(pts, startDir) && check([...pts].reverse(), endDir);
}

/**
 * Kéo đoạn nhưng không cho phá đoạn rời chân: lùi delta về 0 (từng bước 10px) tới khi hợp lệ.
 * Đường gốc vốn đã sai (dây cũ) thì không chặn.
 */
export function moveSegmentKeepLeads(pts: Point[], k: number, delta: number, startDir: number | null, endDir: number | null, slide: SlideEnds = {}): { pts: Point[]; delta: number } {
  if (!leadOutOk(pts, startDir, endDir)) return { pts: moveSegment(pts, k, delta, slide), delta };
  const step = delta > 0 ? -10 : 10;
  for (let d = delta; d !== 0 && Math.sign(d) === Math.sign(delta); d += step) {
    const out = moveSegment(pts, k, d, slide);
    if (leadOutOk(simplify(out), startDir, endDir)) return { pts: out, delta: d };
  }
  return { pts: moveSegment(pts, k, 0), delta: 0 };
}
