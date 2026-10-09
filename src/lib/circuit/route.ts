import { busCenter, busPoint, busVertical } from './bus';
import { PARTS } from './parts';
import type { CircuitLayout, PlacedPart, Point, Rotation, Wire } from './types';

/**
 * Tự đi dây (kiểu phần mềm vẽ mạch): tìm đường A* trên lưới, chỉ đi ngang/dọc,
 * né thân linh kiện, tránh chạy sát dây đã đi trước đó, phạt mỗi lần gấp khúc.
 * AI chỉ cần đặt linh kiện — việc tính đường đi dây (thứ AI làm rất kém) do
 * code lo. Dây nào có sẵn "via" (người dùng tự sửa tay) thì giữ nguyên.
 */

const G = 10; // bước lưới (px)
const MARGIN = 14; // khoảng chừa quanh thân linh kiện
const TOP = 130; // dưới dòng tiêu đề trên
const BOTTOM_PAD = 100; // trên dòng tiêu đề dưới

export type Dir = 0 | 1 | 2 | 3; // phải, xuống, trái, lên
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

function rotate(pt: Point, rot: Rotation = 0): Point {
  switch (rot) {
    case 90: return { x: -pt.y, y: pt.x };
    case 180: return { x: -pt.x, y: -pt.y };
    case 270: return { x: pt.y, y: -pt.x };
    default: return pt;
  }
}

function box(p: PlacedPart) {
  const def = PARTS[p.type];
  const hs = p.heatsink && p.type !== 'to3' ? 90 : 0;
  const w0 = (p.type === 'bus' ? (p.length ?? 800) : def.w) + hs;
  const rot = p.rotation ?? 0;
  const [w, h] = rot === 90 || rot === 270 ? [def.h, w0] : [w0, def.h];
  return { x1: p.x - w / 2, y1: p.y - h / 2, x2: p.x + w / 2, y2: p.y + h / 2 };
}

/** Hướng chân chĩa ra ngoài thân (theo pinDirs nếu có, không thì theo cạnh gần nhất), đã tính xoay. */
function pinDir(p: PlacedPart, local: Point, H: number, pinName?: string): Dir {
  if (p.type === 'lead') return p.y < H / 2 ? 1 : 3;
  const def = PARTS[p.type];
  const steps = ((p.rotation ?? 0) / 90) | 0;
  const fixed = pinName !== undefined ? def.pinDirs?.[pinName] : undefined;
  if (fixed !== undefined) return ((fixed + steps) % 4) as Dir;
  const d = [def.w / 2 - local.x, def.h / 2 - local.y, local.x + def.w / 2, local.y + def.h / 2]; // phải, dưới, trái, trên
  let best: Dir = 1;
  for (let i = 0; i < 4; i++) if (d[i] < d[best]) best = i as Dir;
  return ((best + steps) % 4) as Dir;
}

/** Hướng dây đi ra ở 1 chân của linh kiện đã đặt (null nếu không có chân đó). */
export function pinDirection(part: PlacedPart, pin: string, H = 1350): Dir | null {
  const local = PARTS[part.type]?.pins[pin];
  return local ? pinDir(part, local, H, pin) : null;
}

export interface End {
  point: Point;
  dir: Dir;
  part: PlacedPart;
  isLead: boolean;
  /** Đầu nối vào thanh mass: được phép chọn bất kỳ điểm nào trên thanh. */
  bus?: PlacedPart;
  /** Chân nằm hẳn giữa thân (VD B/E của TO-3): dây được đi trên mặt linh kiện vào chân từ mọi hướng. */
  interior?: boolean;
}

function parseEnd(layout: CircuitLayout, ref: string, H: number): End | null {
  const at = ref.indexOf('@');
  const busId = (at > 0 ? ref.slice(0, at) : ref).trim();
  const busPart = layout.parts.find((p) => p.id === busId && p.type === 'bus');
  if (busPart) {
    const c = at > 0 ? parseFloat(ref.slice(at + 1)) : busCenter(busPart);
    return { point: busPoint(busPart, Number.isNaN(c) ? busCenter(busPart) : c), dir: busVertical(busPart) ? 2 : 3, part: busPart, isLead: false, bus: busPart };
  }
  const dot = ref.lastIndexOf('.');
  if (dot <= 0) return null;
  const part = layout.parts.find((p) => p.id === ref.slice(0, dot).trim());
  if (!part || !PARTS[part.type]) return null;
  const pinName = ref.slice(dot + 1).trim();
  const local = PARTS[part.type].pins[pinName];
  if (!local) return null;
  const r = rotate(local, part.rotation ?? 0);
  const def = PARTS[part.type];
  const interior = part.type !== 'lead' && !def.straightOut && Math.abs(local.x) < def.w / 2 - 30 && Math.abs(local.y) < def.h / 2 - 30;
  return { point: { x: part.x + r.x, y: part.y + r.y }, dir: pinDir(part, local, H, pinName), part, isLead: part.type === 'lead', interior };
}

class Heap {
  private a: [number, number][] = [];
  get size() { return this.a.length; }
  push(f: number, v: number) {
    const a = this.a; a.push([f, v]);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop(): number {
    const a = this.a; const top = a[0][1]; const last = a.pop()!;
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}

export interface RoutedWire {
  points: Point[];
  from: End;
  to: End;
  auto: boolean;
  failed?: boolean;
  /** Dây chạm (pin rời chạm đầu nhau): không vẽ, không bắt chuột. */
  hidden?: boolean;
}

/**
 * spread (Xưởng vẽ mạch): phân biệt cắt ngang dây khác (chấp nhận) với chạy chồng /
 * chạy sát song song cùng hướng (phạt nặng) → các dây song song giữ khoảng cách ≥ 20px.
 * Node "Vẽ mạch" cũ không bật → đường dây giữ y như trước.
 */
export function routeWires(layout: CircuitLayout, opts: { titleZones?: boolean; spread?: boolean } = {}): (RoutedWire | null)[] {
  // Mặt bàn vẽ không giới hạn (Xưởng vẽ mạch) không có tiêu đề → chỉ chừa mép 20px
  const top = opts.titleZones === false ? 20 : TOP;
  const bottomPad = opts.titleZones === false ? 20 : BOTTOM_PAD;
  const W = layout.width ?? 1080;
  const H = layout.height ?? 1350;
  const cols = Math.floor(W / G) + 1;
  const rows = Math.floor(H / G) + 1;
  const idx = (c: number, r: number) => r * cols + c;

  // Ô bị chặn (thân linh kiện) và ô "gần thân" (phạt nhẹ để dây có khoảng thở)
  const blocked = new Uint8Array(cols * rows);
  const nearPart = new Uint8Array(cols * rows);
  const parts = layout.parts.filter((p) => PARTS[p.type] && p.type !== 'lead' && p.type !== 'bus');
  parts.forEach((p) => {
    const b = box(p);
    for (let r = Math.max(0, Math.floor((b.y1 - MARGIN - 20) / G)); r <= Math.min(rows - 1, Math.ceil((b.y2 + MARGIN + 20) / G)); r++) {
      for (let c = Math.max(0, Math.floor((b.x1 - MARGIN - 20) / G)); c <= Math.min(cols - 1, Math.ceil((b.x2 + MARGIN + 20) / G)); c++) {
        const x = c * G, y = r * G;
        if (x >= b.x1 - MARGIN && x <= b.x2 + MARGIN && y >= b.y1 - MARGIN && y <= b.y2 + MARGIN) blocked[idx(c, r)] = 1;
        else nearPart[idx(c, r)] = 1;
      }
    }
  });
  // Ô nằm trong vùng chừa quanh thân (không phải chính thân linh kiện, không phải vùng tiêu đề)
  const bodyCell = new Uint8Array(cols * rows);
  parts.forEach((p) => {
    const b = box(p);
    for (let r = Math.max(0, Math.ceil(b.y1 / G)); r <= Math.min(rows - 1, Math.floor(b.y2 / G)); r++)
      for (let c = Math.max(0, Math.ceil(b.x1 / G)); c <= Math.min(cols - 1, Math.floor(b.x2 / G)); c++) bodyCell[idx(c, r)] = 1;
  });
  const softBlocked = (c: number, r: number) => {
    const y = r * G, x = c * G;
    return !bodyCell[idx(c, r)] && y >= top - 30 && y <= H - bottomPad + 50 && x >= 10 && x <= W - 10;
  };
  // Ngoài vùng tiêu đề / mép ảnh
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const y = r * G, x = c * G;
    if (y < top || y > H - bottomPad + 30 || x < 16 || x > W - 16) blocked[idx(c, r)] = 1;
  }
  // Thanh mass: cho phép đi tới (là đích), nhưng không chạy dọc theo nó
  const busCells = new Map<number, PlacedPart>();
  // Ô sát mép thanh: dây chạy ngang ở đây trông như nằm đè lên thanh đồng
  const busEdge = new Uint8Array(cols * rows);
  for (const p of layout.parts.filter((q) => q.type === 'bus')) {
    const half = (p.length ?? 800) / 2;
    if (busVertical(p)) {
      // thanh dựng dọc: 1 cột ô, mép là 2 cột 2 bên
      const c = Math.round(p.x / G);
      for (let r = Math.ceil((p.y - half + 10) / G); r <= Math.floor((p.y + half - 10) / G); r++) {
        if (r >= 0 && r < rows && c >= 0 && c < cols) { busCells.set(idx(c, r), p); blocked[idx(c, r)] = 0; }
        for (const cc of [c - 1, c + 1]) if (r >= 0 && r < rows && cc >= 0 && cc < cols) busEdge[idx(cc, r)] = 1;
      }
      continue;
    }
    const r = Math.round(p.y / G);
    for (let c = Math.ceil((p.x - half + 10) / G); c <= Math.floor((p.x + half - 10) / G); c++) {
      if (r >= 0 && r < rows && c >= 0 && c < cols) { busCells.set(idx(c, r), p); blocked[idx(c, r)] = 0; }
      for (const rr of [r - 1, r + 1]) if (rr >= 0 && rr < rows && c >= 0 && c < cols) busEdge[idx(c, rr)] = 1;
    }
  }

  // Ô đã có dây đi qua (để các dây sau né)
  const wireCell = new Int16Array(cols * rows).fill(-1);
  const wireNear = new Uint8Array(cols * rows);
  // Hướng dây đi qua ô (1 = ngang, 2 = dọc): trên chính ô / ô kề ±1 / ô cách 2
  const onAxis = new Uint8Array(cols * rows);
  const adjAxis = new Uint8Array(cols * rows);
  const nearAxis = new Uint8Array(cols * rows);

  const markWire = (pts: Point[], id: number) => {
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1];
      const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / G;
      const axis = a.y === b.y ? 1 : a.x === b.x ? 2 : 3;
      for (let s = 0; s <= n; s++) {
        const c = Math.round((a.x + ((b.x - a.x) * s) / (n || 1)) / G);
        const r = Math.round((a.y + ((b.y - a.y) * s) / (n || 1)) / G);
        for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
          const cc = c + dc, rr = r + dr;
          if (cc >= 0 && cc < cols && rr >= 0 && rr < rows) {
            wireNear[idx(cc, rr)] = 1;
            const d = Math.max(Math.abs(dr), Math.abs(dc));
            if (d === 1) adjAxis[idx(cc, rr)] |= axis; else if (d === 2) nearAxis[idx(cc, rr)] |= axis;
          }
        }
        if (c >= 0 && c < cols && r >= 0 && r < rows) { wireCell[idx(c, r)] = id; onAxis[idx(c, r)] |= axis; }
      }
    }
  };

  /**
   * Đi thẳng từ chân ra khỏi vùng chừa của CHÍNH linh kiện đó (không bước qua
   * linh kiện khác), rồi thêm 2 ô nữa để các dây từ những chân sát nhau (VD IC
   * 5 chân) kịp tách ra trước khi rẽ.
   */
  const exitPoint = (e: End): Point => {
    let { x, y } = e.point;
    x = Math.round(x / G) * G; y = Math.round(y / G) * G;
    if (e.isLead || e.bus || e.interior) return { x, y };
    const b = box(e.part);
    const inOwn = (px: number, py: number) => px >= b.x1 - MARGIN && px <= b.x2 + MARGIN && py >= b.y1 - MARGIN && py <= b.y2 + MARGIN;
    // Không bao giờ bước lên thanh đồng: chân đặt sát thanh (VD chân LED) mà
    // đoạn ra chân vượt qua thanh thì dây sẽ vẽ cắt ngang thanh đồng trần
    const onBus = (px: number, py: number) => busCells.has(idx(Math.round(px / G), Math.round(py / G)));
    let i = 0;
    while (i < 80 && inOwn(x, y) && !onBus(x + DX[e.dir] * G, y + DY[e.dir] * G)) { x += DX[e.dir] * G; y += DY[e.dir] * G; i++; }
    for (let k = 0; k < 2; k++) {
      const nc = Math.round((x + DX[e.dir] * G) / G), nr = Math.round((y + DY[e.dir] * G) / G);
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows || blocked[idx(nc, nr)] || busCells.has(idx(nc, nr))) break;
      x += DX[e.dir] * G; y += DY[e.dir] * G;
    }
    return { x, y };
  };

  const ends = layout.wires.map((w) => [parseEnd(layout, w.from, H), parseEnd(layout, w.to, H)] as const);
  const out: (RoutedWire | null)[] = layout.wires.map(() => null);

  // Dây chạm (2 cực pin chạm nhau) → nối thẳng, không đi dây, không chiếm ô
  layout.wires.forEach((w, i) => {
    const [a, b] = ends[i];
    if (w.color === 'contact' && a && b) out[i] = { points: [a.point, b.point], from: a, to: b, auto: false, hidden: true };
  });

  // Dây đã có via (sửa tay) → giữ nguyên và đánh dấu trước
  layout.wires.forEach((w, i) => {
    if (out[i]) return;
    const [a, b] = ends[i];
    if (!a || !b || !w.via?.length) return;
    const pts = [a.point, ...w.via.map(([x, y]) => ({ x, y })), b.point];
    out[i] = { points: pts, from: a, to: b, auto: false };
    markWire(pts, i);
  });

  // Dây ngắn đi trước, dây dài đi sau (dây dài có nhiều đường vòng hơn)
  const order = layout.wires.map((_, i) => i)
    .filter((i) => !out[i] && ends[i][0] && ends[i][1])
    .sort((i, j) => {
      const d = (k: number) => Math.abs(ends[k][0]!.point.x - ends[k][1]!.point.x) + Math.abs(ends[k][0]!.point.y - ends[k][1]!.point.y);
      return d(i) - d(j);
    });

  for (const i of order) {
    let [a, b] = ends[i] as [End, End];
    // Đầu nối thanh mass luôn để làm "đích" (nhiều ô đích hợp lệ)
    if (a.bus && !b.bus) [a, b] = [b, a];
    const start = exitPoint(a);
    const sc = Math.round(start.x / G), sr = Math.round(start.y / G);
    const goalBus = b.bus;
    const goal = goalBus ? null : exitPoint(b);
    const gc = goal ? Math.round(goal.x / G) : 0, gr = goal ? Math.round(goal.y / G) : 0;
    const busRow = goalBus ? Math.round(goalBus.y / G) : 0;
    const busCol = goalBus ? Math.round(goalBus.x / G) : 0;
    const busV = !!goalBus && busVertical(goalBus);
    const h = (c: number, r: number) => goal ? Math.abs(c - gc) + Math.abs(r - gr) : busV ? Math.abs(c - busCol) : Math.abs(r - busRow);
    const isGoal = (c: number, r: number) => goal ? (c === gc && r === gr) : busCells.get(idx(c, r)) === goalBus;
    // Ô thuộc thân linh kiện có chân "nằm giữa" → được đi trên mặt nó để vào chân
    const ownBoxes = [a, b].filter((e) => e.interior).map((e) => box(e.part));
    const inOwnInterior = (c: number, r: number) => ownBoxes.some((bx) => c * G >= bx.x1 - MARGIN && c * G <= bx.x2 + MARGIN && r * G >= bx.y1 - MARGIN && r * G <= bx.y2 + MARGIN);

    const N = cols * rows * 4;
    const gScore = new Float32Array(N).fill(Infinity);
    const prev = new Int32Array(N).fill(-1);
    // relaxed = vòng 2 khi vòng 1 không tìm được đường: cho phép đi qua vùng
    // chừa quanh thân linh kiện (không qua chính thân), chấp nhận chạy sát dây.
    const search = (relaxed: boolean) => {
    gScore.fill(Infinity);
    prev.fill(-1);
    const heap = new Heap();
    // Xuất phát được theo cả 4 hướng (hướng chân là rẻ nhất) — tránh kẹt khi
    // phía trước chân bị chặn (VD chân tụ chĩa thẳng vào vùng tiêu đề).
    for (let d0 = 0; d0 < 4; d0++) {
      const s0 = idx(sc, sr) * 4 + d0;
      gScore[s0] = d0 === a.dir ? 0 : 8;
      heap.push(gScore[s0] + h(sc, sr), s0);
    }
    let found = -1;
    let expanded = 0;
    while (heap.size && expanded < 400000) {
      const st = heap.pop();
      expanded++;
      const cell = st >> 2, dir = st & 3;
      const c = cell % cols, r = (cell / cols) | 0;
      if (isGoal(c, r)) { found = st; break; }
      for (let nd = 0; nd < 4; nd++) {
        if (nd === ((dir + 2) & 3)) continue; // không quay đầu
        const nc = c + DX[nd], nr = r + DY[nd];
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
        const ni = idx(nc, nr);
        const goalCell = isGoal(nc, nr);
        if (blocked[ni] && !goalCell && !inOwnInterior(nc, nr) && !(relaxed && softBlocked(nc, nr))) continue;
        // Không cho đi dọc theo thanh mass (chỉ được chạm vào nó)
        if (busCells.has(ni) && !goalCell) continue;
        if (busEdge[ni] && (nd === 0 || nd === 2)) continue;
        const steps = Math.abs(nc - sc) + Math.abs(nr - sr);
        let cost = 1;
        if (nd !== dir) cost += 8;
        if (nearPart[ni]) cost += 1.5;
        if (steps > 2 && (!goal || Math.abs(nc - gc) + Math.abs(nr - gr) > 2)) {
          if (opts.spread) {
            const ax = nd === 0 || nd === 2 ? 1 : 2;
            if (wireCell[ni] >= 0) cost += onAxis[ni] & ax ? 80 : 45; // chồng lên dây khác / cắt ngang
            else if (adjAxis[ni] & ax) cost += 25; // song song cách 10px: 2 dây dính vào nhau
            else if (nearAxis[ni] & ax) cost += 3; // song song cách 20px: sát nhưng còn khe
          } else if (wireCell[ni] >= 0) cost += 12; // cắt ngang dây khác (rẻ hơn đi vòng cả khung)
          else if (wireNear[ni]) cost += 10; // chạy sát dây khác
        }
        const ns = ni * 4 + nd;
        const g = gScore[st] + cost;
        if (g < gScore[ns]) { gScore[ns] = g; prev[ns] = st; heap.push(g + h(nc, nr), ns); }
      }
    }
    return found;
    };
    let found = search(false);
    if (found < 0) found = search(true);

    if (found < 0) {
      // Không tìm được đường → nối thẳng kiểu chữ L, báo lỗi để người dùng dời linh kiện
      const pts = [a.point, { x: a.point.x, y: b.point.y }, b.point];
      out[i] = { points: pts, from: a, to: b, auto: true, failed: true };
      continue;
    }
    const cells: Point[] = [];
    for (let st = found; st >= 0; st = prev[st]) {
      const cell = st >> 2;
      cells.push({ x: (cell % cols) * G, y: ((cell / cols) | 0) * G });
    }
    cells.reverse();
    // Gộp các ô thẳng hàng thành điểm gấp khúc
    const corners: Point[] = [cells[0]];
    for (let k = 1; k < cells.length - 1; k++) {
      const p0 = corners[corners.length - 1], p1 = cells[k], p2 = cells[k + 1];
      const straight = (p0.x === p1.x && p1.x === p2.x) || (p0.y === p1.y && p1.y === p2.y);
      if (!straight) corners.push(p1);
    }
    corners.push(cells[cells.length - 1]);
    const endPoint = goal ? b.point : corners[corners.length - 1];
    const pts = goal ? [a.point, ...corners, b.point] : [a.point, ...corners];
    const toEnd: End = goal ? b : { ...b, point: endPoint };
    alignToPin(pts, a, !goal);
    if (goal) { pts.reverse(); alignToPin(pts, b, false); pts.reverse(); }
    out[i] = { points: dedupe(pts), from: a, to: toEnd, auto: true };
    markWire(pts, i);
  }
  return out;
}

/**
 * Chân linh kiện thường không nằm đúng lưới 10px → đoạn rời chân bị lệch vài px
 * thành đường xiên. Dời cả đoạn thẳng đầu tiên cho khớp đúng toạ độ chân.
 */
function alignToPin(pts: Point[], e: End, lastIsBus: boolean) {
  if (pts.length < 2) return;
  const vertical = e.dir === 1 || e.dir === 3;
  const pin = pts[0];
  // Điểm cuối là thanh mass thì cũng dời theo được (chạm thanh ở đâu cũng đúng)
  const limit = lastIsBus ? pts.length : pts.length - 1;
  if (vertical) {
    const old = pts[1].x;
    for (let k = 1; k < limit && pts[k].x === old; k++) pts[k] = { x: pin.x, y: pts[k].y };
  } else {
    const old = pts[1].y;
    for (let k = 1; k < limit && pts[k].y === old; k++) pts[k] = { x: pts[k].x, y: pin.y };
  }
}

/** Bỏ điểm trùng / thẳng hàng thừa. */
function dedupe(pts: Point[]): Point[] {
  const a = pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y);
  const out: Point[] = [a[0]];
  for (let i = 1; i < a.length - 1; i++) {
    const p0 = out[out.length - 1], p1 = a[i], p2 = a[i + 1];
    const straight = (p0.x === p1.x && p1.x === p2.x) || (p0.y === p1.y && p1.y === p2.y);
    if (!straight) out.push(p1);
  }
  if (a.length > 1) out.push(a[a.length - 1]);
  return out;
}

export type { Wire };
