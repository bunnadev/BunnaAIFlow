import { PARTS } from './parts';
import { pinDirection, routeWires, type RoutedWire } from './route';
import type { CircuitLayout, PlacedPart, Point, Rotation, Wire } from './types';

const FONT = 'Helvetica Neue, Arial, sans-serif';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const WIRE_COLORS: Record<string, [string, string]> = {
  // [màu chính, màu viền tối]
  red: ['#e32b2b', '#8f1414'],
  black: ['#2a2a2e', '#0b0b0d'],
  blue: ['#2f6fe0', '#163a85'],
  yellow: ['#f5cf1d', '#9c7d06'],
  green: ['#2fae4a', '#14662a'],
  orange: ['#f07b22', '#93430a'],
  white: ['#eef1f4', '#9aa1a8'],
  purple: ['#8d4be0', '#4b2185'],
  teal: ['#1fb8a6', '#0d6b60'],
  brown: ['#8a5326', '#4c2a10'],
  gray: ['#9097a0', '#4f555c'],
  pink: ['#f06aa8', '#933b63'],
  // Chân linh kiện hàn thẳng vào nhau (không dùng dây bọc nhựa)
  silver: ['#d5dade', '#80878e'],
};

/** Màu dây do AI ghi có thể là tiếng Việt hoặc tiếng Anh. */
export function normalizeWireColor(c: string): string {
  const s = (c || '').toLowerCase().trim();
  const map: [RegExp, string][] = [
    [/đỏ|do\b|red/, 'red'], [/đen|black/, 'black'], [/xanh ?dương|xanh ?da ?trời|blue/, 'blue'],
    [/vàng|yellow/, 'yellow'], [/xanh ?ngọc|teal|cyan/, 'teal'], [/xanh ?lá|green/, 'green'],
    [/cam|orange/, 'orange'], [/trắng|white/, 'white'], [/tím|purple|violet/, 'purple'],
    [/nâu|brown/, 'brown'], [/xám|gr[ae]y/, 'gray'], [/hồng|pink/, 'pink'], [/bạc|silver|thiếc|tin/, 'silver'],
  ];
  for (const [re, name] of map) if (re.test(s)) return name;
  return WIRE_COLORS[s] ? s : 'red';
}

function rotate(pt: Point, rot: Rotation = 0): Point {
  switch (rot) {
    case 90: return { x: -pt.y, y: pt.x };
    case 180: return { x: -pt.x, y: -pt.y };
    case 270: return { x: pt.y, y: -pt.x };
    default: return pt;
  }
}

export function partBox(p: PlacedPart, withHeatsink = false) {
  const def = PARTS[p.type];
  if (!def) return null;
  // Tản nhiệt TO-3 nằm gọn trong khung sẵn có; TO-220/Pentawatt thì rộng hơn thân ~90px.
  const hs = withHeatsink && p.heatsink && p.type !== 'to3' ? 90 : 0;
  const w0 = (p.type === 'bus' ? (p.length ?? 800) : def.w) + hs;
  const rot = p.rotation ?? 0;
  const [w, h] = rot === 90 || rot === 270 ? [def.h, w0] : [w0, def.h];
  return { x1: p.x - w / 2, y1: p.y - h / 2, x2: p.x + w / 2, y2: p.y + h / 2 };
}

export interface ResolvedEnd { point: Point; part?: PlacedPart; isLead: boolean }

export function resolveEndpoint(layout: CircuitLayout, ref: string): ResolvedEnd | string {
  const at = ref.indexOf('@');
  if (at > 0) {
    const id = ref.slice(0, at).trim();
    const coord = parseFloat(ref.slice(at + 1));
    const part = layout.parts.find((p) => p.id === id);
    if (!part || part.type !== 'bus') return `"${ref}": không có thanh mass "${id}"`;
    if (Number.isNaN(coord)) return `"${ref}": toạ độ sau @ không hợp lệ`;
    const vertical = part.rotation === 90 || part.rotation === 270;
    return { point: vertical ? { x: part.x, y: coord } : { x: coord, y: part.y }, part, isLead: false };
  }
  const busOnly = layout.parts.find((p) => p.id === ref.trim() && p.type === 'bus');
  if (busOnly) return { point: { x: busOnly.x, y: busOnly.y }, part: busOnly, isLead: false };
  const dot = ref.lastIndexOf('.');
  if (dot <= 0) return `"${ref}": sai cú pháp, phải là "Linh_kiện.chân"`;
  const id = ref.slice(0, dot).trim();
  const pin = ref.slice(dot + 1).trim();
  const part = layout.parts.find((p) => p.id === id);
  if (!part) return `"${ref}": không có linh kiện "${id}"`;
  const def = PARTS[part.type];
  if (!def) return `"${ref}": loại linh kiện "${part.type}" chưa có trong thư viện`;
  const local = def.pins[pin];
  if (!local) return `"${ref}": ${id} (${part.type}) không có chân "${pin}" — chỉ có: ${Object.keys(def.pins).join(', ')}`;
  const r = rotate(local, part.rotation ?? 0);
  return { point: { x: part.x + r.x, y: part.y + r.y }, part, isLead: part.type === 'lead' };
}

const insideBox = (pt: Point, b: { x1: number; y1: number; x2: number; y2: number }) =>
  pt.x > b.x1 + 24 && pt.x < b.x2 - 24 && pt.y > b.y1 + 24 && pt.y < b.y2 - 24;

/** Đoạn thẳng a→b có cắt vào hình chữ nhật không (Liang–Barsky). */
function segmentHitsBox(a: Point, b: Point, box: { x1: number; y1: number; x2: number; y2: number }): boolean {
  let t0 = 0, t1 = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  const checks: [number, number][] = [[-dx, a.x - box.x1], [dx, box.x2 - a.x], [-dy, a.y - box.y1], [dy, box.y2 - a.y]];
  for (const [pp, q] of checks) {
    if (pp === 0) { if (q < 0) return false; continue; }
    const r = q / pp;
    if (pp < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return t0 < t1;
}

export interface ValidationResult { errors: string[]; warnings: string[] }

/** Lỗi bố cục đáng để nhờ AI sửa lại (đè, tràn khung, không đi được dây, dây qua thân). */
export function severeIssues(v: ValidationResult): string[] {
  return [...v.errors, ...v.warnings.filter((w) => /đè lên|tràn ra|Không tìm được đường|chạy qua thân/.test(w))];
}

export function validateLayout(layout: CircuitLayout, expectedWireCount?: number, routed?: (RoutedWire | null)[], opts: { frame?: boolean } = {}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const W = layout.width ?? 1080;
  const H = layout.height ?? 1350;

  const ids = new Set<string>();
  for (const p of layout.parts) {
    if (ids.has(p.id)) errors.push(`Trùng ký hiệu linh kiện "${p.id}".`);
    ids.add(p.id);
    if (!PARTS[p.type]) errors.push(`${p.id}: loại "${p.type}" chưa có trong thư viện.`);
  }

  const pinUse = new Map<string, number>();
  layout.wires.forEach((w, i) => {
    for (const end of [w.from, w.to]) {
      const r = resolveEndpoint(layout, end);
      if (typeof r === 'string') errors.push(`Dây ${w.n ?? i + 1}: ${r}`);
      else if (end.includes('.') && !end.includes('@')) pinUse.set(end, (pinUse.get(end) ?? 0) + 1);
    }
  });
  for (const [pin, n] of pinUse) {
    const isLead = layout.parts.find((p) => p.id === pin.slice(0, pin.lastIndexOf('.')))?.type === 'lead';
    if (n > (isLead ? 1 : 2)) warnings.push(`Chân ${pin} có ${n} đầu dây (khó hàn, ảnh rối).`);
  }

  if (expectedWireCount && expectedWireCount !== layout.wires.length) {
    warnings.push(`Bản thiết kế có ${expectedWireCount} dây nhưng bố cục vẽ ${layout.wires.length} dây.`);
  }

  const boxes = layout.parts
    .filter((p) => p.type !== 'lead' && p.type !== 'bus')
    .map((p) => ({ p, b: partBox(p, true) }))
    .filter((x): x is { p: PlacedPart; b: NonNullable<ReturnType<typeof partBox>> } => !!x.b);
  if (opts.frame !== false) {
    for (const { p, b } of boxes) {
      if (b.x1 < 0 || b.y1 < 0 || b.x2 > W || b.y2 > H) warnings.push(`${p.id} tràn ra ngoài khung ảnh.`);
      else if ((layout.titleTop && b.y1 < 125) || (layout.titleBottom && b.y2 > H - 110)) warnings.push(`${p.id} đè lên vùng tiêu đề (giữ linh kiện trong y 150..1190).`);
    }
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].b; const c = boxes[j].b;
      if (a.x1 < c.x2 && c.x1 < a.x2 && a.y1 < c.y2 && c.y1 < a.y2) {
        warnings.push(`${boxes[i].p.id} và ${boxes[j].p.id} đè lên nhau.`);
      }
    }
  }
  // Dây chạy ngang qua thân linh kiện KHÁC (không tính 2 linh kiện mà dây nối vào)
  const bodyBoxes = layout.parts
    .filter((p) => PARTS[p.type] && p.type !== 'lead' && p.type !== 'bus')
    .map((p) => {
      const b = partBox(p, true)!;
      return { p, b: { x1: b.x1 + 6, y1: b.y1 + 6, x2: b.x2 - 6, y2: b.y2 - 6 } };
    });
  const paths = routed ?? (errors.length ? [] : routeWires(layout));
  paths.forEach((rw, i) => {
    if (rw?.failed) warnings.push(`Không tìm được đường đi cho dây ${layout.wires[i].n ?? i + 1} — dời các linh kiện cho thoáng hơn.`);
  });
  layout.wires.forEach((w, i) => {
    const pts = paths[i]?.points;
    if (!pts || w.color === 'contact') return;
    const fromId = w.from.split(/[.@]/)[0];
    const toId = w.to.split(/[.@]/)[0];
    const last = pts.length - 2;
    const hit = new Set<string>();
    for (let k = 0; k <= last; k++) {
      for (const { p, b } of bodyBoxes) {
        let a = pts[k], c = pts[k + 1];
        // Dây vào chân nằm giữa thân (VD B/E của TO-3) được phép đi trên mặt chính linh kiện đó
        const ownInterior = (p.id === fromId && insideBox(pts[0], b)) || (p.id === toId && insideBox(pts[pts.length - 1], b));
        if (ownInterior) continue;
        const touchesOwnPin = (p.id === fromId && k === 0) || (p.id === toId && k === last);
        if (touchesOwnPin) {
          const pin = p.id === fromId && k === 0 ? a : c;
          const inside = pin.x > b.x1 && pin.x < b.x2 && pin.y > b.y1 && pin.y < b.y2;
          // Chân nằm hẳn trong thân (VD B/E của TO-3) thì đoạn đầu buộc phải đi qua thân — bỏ qua
          if (inside) continue;
          // Còn lại: bỏ 20px sát chân rồi mới kiểm tra (đi vào chân từ phía ngoài là hợp lệ)
          const other = pin === a ? c : a;
          const len = Math.hypot(other.x - pin.x, other.y - pin.y) || 1;
          const cut = { x: pin.x + ((other.x - pin.x) / len) * 20, y: pin.y + ((other.y - pin.y) / len) * 20 };
          if (pin === a) a = cut; else c = cut;
        }
        if (segmentHitsBox(a, c, b)) hit.add(p.id);
      }
    }
    if (hit.size) warnings.push(`Dây ${w.n ?? i + 1} chạy qua thân ${[...hit].join(', ')}.`);
  });

  // Hai dây chạy chồng/sát song song trên cùng 1 đoạn → nhìn như 1 dây, không lần theo được
  const segs: { n: number; a: Point; b: Point; ends: string[] }[] = [];
  layout.wires.forEach((w, i) => {
    const pts = paths[i]?.points;
    if (!pts || w.color === 'contact') return;
    for (let k = 0; k < pts.length - 1; k++) segs.push({ n: w.n ?? i + 1, a: pts[k], b: pts[k + 1], ends: [w.from, w.to] });
  });
  const reported = new Set<string>();
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const s1 = segs[i], s2 = segs[j];
      if (s1.n === s2.n) continue;
      // Hai dây cùng nối vào 1 chân thì buộc phải chụm lại ở chân đó — không tính là lỗi
      if (s1.ends.some((e) => s2.ends.includes(e))) continue;
      const key = `${Math.min(s1.n, s2.n)}-${Math.max(s1.n, s2.n)}`;
      if (reported.has(key)) continue;
      const horiz = (s: typeof s1) => Math.abs(s.a.y - s.b.y) < 1;
      const vert = (s: typeof s1) => Math.abs(s.a.x - s.b.x) < 1;
      let overlapLen = 0;
      if (horiz(s1) && horiz(s2) && Math.abs(s1.a.y - s2.a.y) < 18) {
        overlapLen = Math.min(Math.max(s1.a.x, s1.b.x), Math.max(s2.a.x, s2.b.x)) - Math.max(Math.min(s1.a.x, s1.b.x), Math.min(s2.a.x, s2.b.x));
      } else if (vert(s1) && vert(s2) && Math.abs(s1.a.x - s2.a.x) < 18) {
        overlapLen = Math.min(Math.max(s1.a.y, s1.b.y), Math.max(s2.a.y, s2.b.y)) - Math.max(Math.min(s1.a.y, s1.b.y), Math.min(s2.a.y, s2.b.y));
      }
      if (overlapLen > 30) {
        reported.add(key);
        warnings.push(`Dây ${s1.n} và dây ${s2.n} chạy chồng sát nhau (cách nhau < 18px) — tách xa ít nhất 26px.`);
      }
    }
  }
  return { errors, warnings };
}

/** Lấy JSON bố cục từ câu trả lời của AI (có thể bọc trong ```json). */
export function parseLayout(raw: string): CircuitLayout {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1];
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('AI không trả về JSON bố cục.');
  const obj = JSON.parse(s.slice(start, end + 1));
  if (!Array.isArray(obj.parts) || !Array.isArray(obj.wires)) throw new Error('JSON bố cục thiếu "parts" hoặc "wires".');
  return obj as CircuitLayout;
}

/** Đếm số dây trong bản thiết kế ("Tổng: N dây"). */
export function expectedWireCountFromDesign(design: string): number | undefined {
  const m = design.match(/Tổng\s*:?\s*(\d+)\s*dây/i);
  return m ? parseInt(m[1], 10) : undefined;
}

// ─── Vẽ ───────────────────────────────────────────────────────────────────

function roundedPath(pts: Point[], radius = 26): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
    const d1 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const d2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const r = Math.min(radius, d1 / 2, d2 / 2);
    const a = { x: p1.x + ((p0.x - p1.x) / (d1 || 1)) * r, y: p1.y + ((p0.y - p1.y) / (d1 || 1)) * r };
    const b = { x: p1.x + ((p2.x - p1.x) / (d2 || 1)) * r, y: p1.y + ((p2.y - p1.y) / (d2 || 1)) * r };
    d += ` L ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${p1.x} ${p1.y} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  return d + ` L ${last.x} ${last.y}`;
}

function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export function woodBackground(W: number, H: number, vignette = true): string {
  const rnd = seeded(1337);
  const lines: string[] = [];
  for (let i = 0; i < 70; i++) {
    const y = rnd() * H;
    const amp = 6 + rnd() * 22;
    const len = W + 200;
    const seg = 6;
    let d = `M -100 ${y.toFixed(1)}`;
    for (let k = 1; k <= seg; k++) {
      const x = -100 + (len / seg) * k;
      const yy = y + Math.sin(k * 1.3 + i) * amp;
      d += ` Q ${(x - len / seg / 2).toFixed(1)} ${(yy + amp * (rnd() - 0.5)).toFixed(1)} ${x.toFixed(1)} ${yy.toFixed(1)}`;
    }
    const dark = rnd() > 0.35;
    lines.push(`<path d="${d}" fill="none" stroke="${dark ? '#2a1408' : '#c08a55'}" stroke-opacity="${(dark ? 0.18 : 0.12) + rnd() * 0.12}" stroke-width="${(1 + rnd() * 3.5).toFixed(1)}"/>`);
  }
  return `<rect width="${W}" height="${H}" fill="url(#gWood)"/>` + lines.join('') +
    (vignette ? `<rect width="${W}" height="${H}" fill="url(#gVignette)"/>` : '');
}

const DEFS = `
<defs>
  <linearGradient id="gWood" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#6b3d1f"/><stop offset="0.45" stop-color="#5a3018"/><stop offset="1" stop-color="#3f200e"/>
  </linearGradient>
  <radialGradient id="gVignette" cx="0.5" cy="0.45" r="0.75">
    <stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/>
  </radialGradient>
  <linearGradient id="gMetal" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f4f6f8"/><stop offset="0.45" stop-color="#c3c9cf"/><stop offset="0.7" stop-color="#dfe3e7"/><stop offset="1" stop-color="#9aa1a8"/>
  </linearGradient>
  <linearGradient id="gSilver" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#9ea5ad"/><stop offset="0.5" stop-color="#f2f4f6"/><stop offset="1" stop-color="#8f969e"/>
  </linearGradient>
  <linearGradient id="gLeg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#e9ecef"/><stop offset="1" stop-color="#aeb5bc"/>
  </linearGradient>
  <linearGradient id="gBlack" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#3a3d42"/><stop offset="0.5" stop-color="#1c1e21"/><stop offset="1" stop-color="#0c0d0e"/>
  </linearGradient>
  <linearGradient id="gResistor" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f3dfb6"/><stop offset="0.6" stop-color="#ddbf8b"/><stop offset="1" stop-color="#b8965e"/>
  </linearGradient>
  <linearGradient id="gCapBody" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#3c4250"/><stop offset="0.5" stop-color="#1b1f27"/><stop offset="1" stop-color="#0d0f13"/>
  </linearGradient>
  <linearGradient id="gCapBlue" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#1b2f57"/><stop offset="0.35" stop-color="#2f4f8f"/><stop offset="1" stop-color="#14223f"/>
  </linearGradient>
  <radialGradient id="gCeramic" cx="0.4" cy="0.35" r="0.7">
    <stop offset="0" stop-color="#ffc35a"/><stop offset="1" stop-color="#d9861f"/>
  </radialGradient>
  <linearGradient id="gPcbBrown" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#b56a3a"/><stop offset="1" stop-color="#7a3f1d"/>
  </linearGradient>
  <radialGradient id="gKnob" cx="0.4" cy="0.35" r="0.75">
    <stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#cfd4d9"/><stop offset="1" stop-color="#9ba2a9"/>
  </radialGradient>
  <radialGradient id="gScrew" cx="0.4" cy="0.35" r="0.7">
    <stop offset="0" stop-color="#f7f8f9"/><stop offset="1" stop-color="#9aa1a8"/>
  </radialGradient>
  <linearGradient id="gCopper" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f3c58e"/><stop offset="1" stop-color="#b9783a"/>
  </linearGradient>
  <linearGradient id="gCopperBar" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f6c79a"/><stop offset="0.5" stop-color="#cf8a52"/><stop offset="1" stop-color="#9b5a2c"/>
  </linearGradient>
  <linearGradient id="gGold" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#a77d22"/><stop offset="0.5" stop-color="#f6d77a"/><stop offset="1" stop-color="#9a7020"/>
  </linearGradient>
  <linearGradient id="gGreenBlock" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#2f9b4c"/><stop offset="0.5" stop-color="#38b25a"/><stop offset="1" stop-color="#22743a"/>
  </linearGradient>
  <linearGradient id="gFin" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#3a3e44"/><stop offset="0.5" stop-color="#5a6068"/><stop offset="1" stop-color="#202327"/>
  </linearGradient>
  <radialGradient id="gCone" cx="0.45" cy="0.4" r="0.7">
    <stop offset="0" stop-color="#3a3a3e"/><stop offset="1" stop-color="#0c0c0e"/>
  </radialGradient>
  <radialGradient id="gDust" cx="0.4" cy="0.35" r="0.7">
    <stop offset="0" stop-color="#55575c"/><stop offset="1" stop-color="#151517"/>
  </radialGradient>
  <radialGradient id="gSolder" cx="0.35" cy="0.3" r="0.75">
    <stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="#c9ced3"/><stop offset="1" stop-color="#7d848b"/>
  </radialGradient>
  <filter id="fShadow" filterUnits="userSpaceOnUse" x="-3000" y="-3000" width="6000" height="6000">
    <feDropShadow dx="5" dy="8" stdDeviation="6" flood-color="#000" flood-opacity="0.5"/>
  </filter>
  <filter id="fWireShadow" filterUnits="userSpaceOnUse" x="-3000" y="-3000" width="6000" height="6000">
    <feDropShadow dx="3" dy="5" stdDeviation="3" flood-color="#000" flood-opacity="0.45"/>
  </filter>
</defs>`;

/** Rút ngắn đoạn đầu / cuối của đường dây (chừa chỗ cho đoạn lõi tuốt vỏ ở chân). */
function trimEnds(pts: Point[], a: number, b: number): Point[] {
  const out = pts.map((p) => ({ ...p }));
  const cut = (i: number, j: number, n: number) => {
    const dx = out[j].x - out[i].x, dy = out[j].y - out[i].y, len = Math.hypot(dx, dy);
    const k = Math.min(n, Math.max(0, len - 4)) / (len || 1);
    out[i] = { x: out[i].x + dx * k, y: out[i].y + dy * k };
  };
  if (a) cut(0, 1, a);
  if (b) cut(out.length - 1, out.length - 2, b);
  return out;
}

/** Cục thiếc hàn dạng giọt ở chân, kéo dài theo hướng dây đi ra (toward = điểm kế tiếp trên dây). */
function solderBlob(pt: Point, toward: Point): string {
  const deg = (Math.atan2(toward.y - pt.y, toward.x - pt.x) * 180) / Math.PI;
  return `<g transform="translate(${pt.x} ${pt.y}) rotate(${deg.toFixed(1)})">` +
    `<path d="M -10 0 C -10 -10 4 -11 12 -5 C 18 -2 22 -1 26 0 C 22 1 18 2 12 5 C 4 11 -10 10 -10 0 Z" fill="url(#gBlob)" stroke="#43484e" stroke-width="1.3"/>` +
    `<ellipse cx="-2" cy="-4" rx="3.6" ry="1.9" fill="#fff" opacity="0.9"/>` +
    `</g>`;
}

const STRIP = 18; // đoạn lõi tráng thiếc lộ ra giữa vỏ dây và cục hàn

function renderWire(w: Wire, rw: RoutedWire | null, dashed = false, shadowId = 'fWireShadow', darkBg = false, real = false): { body: string; joints: string } {
  if (!rw || w.color === 'contact') return { body: '', joints: '' };
  const pts = rw.points;
  const colorName = normalizeWireColor(w.color);
  const [main, rim] = WIRE_COLORS[colorName];
  // Nền tối (bàn vẽ lưới chấm): dây đen có viền xám sáng, không thì chìm vào nền
  const dark = darkBg && colorName === 'black' ? '#6a6a72' : rim;
  const d = roundedPath(pts);
  // "silver" = chân linh kiện hàn thẳng vào nhau: vẽ mảnh như chân kim loại, không phải dây bọc nhựa
  if (colorName === 'silver') {
    const legBody =
      `<g filter="url(#${shadowId})">` +
      `<path d="${d}" fill="none" stroke="#7d848c" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="${d}" fill="none" stroke="url(#gLeg)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` +
      `</g>`;
    const joints = real
      ? solderBlob(pts[0], pts[1]) + solderBlob(pts[pts.length - 1], pts[pts.length - 2])
      : [pts[0], pts[pts.length - 1]]
        .map((pt) => `<circle cx="${pt.x}" cy="${pt.y}" r="8" fill="url(#gSolder)" stroke="#6f767d" stroke-width="1.5"/>`).join('');
    return { body: legBody, joints };
  }
  if (real) return realWire(pts, rw, main, dark, dashed, shadowId);
  const body =
    `<g filter="url(#${shadowId})">` +
    `<path d="${d}" fill="none" stroke="${dark}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"${dashed ? ' stroke-dasharray="20 14"' : ''}/>` +
    `<path d="${d}" fill="none" stroke="${main}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"${dashed ? ' stroke-dasharray="20 14"' : ''}/>` +
    `<path d="${d}" fill="none" stroke="#fff" stroke-opacity="0.38" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" transform="translate(-2 -2.5)"${dashed ? ' stroke-dasharray="20 14"' : ''}/>` +
    `</g>`;
  let joints = '';
  const ends: [Point, Point, boolean][] = [
    [pts[0], pts[1], rw.from.isLead],
    [pts[pts.length - 1], pts[pts.length - 2], rw.to.isLead],
  ];
  for (const [pt, next, isLead] of ends) {
    if (isLead) {
      // Đầu dây tuốt vỏ: đoạn lõi đồng ló ra khỏi vỏ dây
      const dx = pt.x - next.x; const dy = pt.y - next.y;
      const len = Math.hypot(dx, dy) || 1;
      const x2 = pt.x + (dx / len) * 30; const y2 = pt.y + (dy / len) * 30;
      joints += `<line x1="${pt.x}" y1="${pt.y}" x2="${x2}" y2="${y2}" stroke="#a8692f" stroke-width="9" stroke-linecap="round"/>` +
        `<line x1="${pt.x}" y1="${pt.y}" x2="${x2}" y2="${y2}" stroke="#f2b97a" stroke-width="5" stroke-linecap="round"/>`;
    } else {
      joints += `<circle cx="${pt.x}" cy="${pt.y}" r="10" fill="url(#gSolder)" stroke="#6f767d" stroke-width="1.5"/>`;
    }
  }
  return { body, joints };
}

/**
 * Dây bọc nhựa kiểu thật (Xưởng vẽ): vỏ dây dừng cách chân một đoạn, lộ lõi tráng
 * thiếc, cục hàn dạng giọt ôm chân. Đầu dây tự do giữ kiểu lõi đồng như cũ.
 */
function realWire(pts: Point[], rw: RoutedWire, main: string, dark: string, dashed: boolean, shadowId: string): { body: string; joints: string } {
  const fromLead = rw.from.isLead, toLead = rw.to.isLead;
  const ins = trimEnds(pts, fromLead ? 0 : STRIP, toLead ? 0 : STRIP);
  const d = roundedPath(ins);
  const dash = dashed ? ' stroke-dasharray="20 14"' : '';
  const body =
    `<g filter="url(#${shadowId})">` +
    `<path d="${d}" fill="none" stroke="${dark}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"${dash}/>` +
    `<path d="${d}" fill="none" stroke="${main}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"${dash}/>` +
    `<path d="${d}" fill="none" stroke="#fff" stroke-opacity="0.38" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" transform="translate(-2 -2.5)"${dash}/>` +
    `</g>`;
  let joints = '';
  const ends: [Point, Point, Point, boolean][] = [
    [pts[0], ins[0], pts[1], fromLead],
    [pts[pts.length - 1], ins[ins.length - 1], pts[pts.length - 2], toLead],
  ];
  for (const [pt, cutAt, next, isLead] of ends) {
    if (isLead) {
      const dx = pt.x - next.x, dy = pt.y - next.y, len = Math.hypot(dx, dy) || 1;
      const x2 = pt.x + (dx / len) * 30, y2 = pt.y + (dy / len) * 30;
      joints += `<line x1="${pt.x}" y1="${pt.y}" x2="${x2}" y2="${y2}" stroke="#a8692f" stroke-width="9" stroke-linecap="round"/>` +
        `<line x1="${pt.x}" y1="${pt.y}" x2="${x2}" y2="${y2}" stroke="#f2b97a" stroke-width="5" stroke-linecap="round"/>`;
      continue;
    }
    // lõi tráng thiếc lộ ra + cục hàn
    joints += `<line x1="${pt.x}" y1="${pt.y}" x2="${cutAt.x.toFixed(1)}" y2="${cutAt.y.toFixed(1)}" stroke="#7d848c" stroke-width="8" stroke-linecap="round"/>` +
      `<line x1="${pt.x}" y1="${pt.y}" x2="${cutAt.x.toFixed(1)}" y2="${cutAt.y.toFixed(1)}" stroke="url(#gLeg)" stroke-width="5" stroke-linecap="round"/>` +
      solderBlob(pt, next);
  }
  return { body, joints };
}

function labelText(x: number, y: number, text: string, size: number, anchor: string, fill = '#8cff2e') {
  return `<text x="${x.toFixed(0)}" y="${y.toFixed(0)}" font-family="${FONT}" font-size="${size}" font-weight="900" text-anchor="${anchor}" fill="${fill}" stroke="#0a1a05" stroke-width="7" stroke-linejoin="round" paint-order="stroke">${esc(text)}</text>`;
}

export interface Box { x1: number; y1: number; x2: number; y2: number }

/** Khoảng cách gần nhất giữa 2 khung chữ nhật (0 nếu chạm/đè nhau). */
function rectGap(a: Box, b: Box) {
  const dx = Math.max(0, Math.max(a.x1, b.x1) - Math.min(a.x2, b.x2));
  const dy = Math.max(0, Math.max(a.y1, b.y1) - Math.min(a.y2, b.y2));
  return Math.hypot(dx, dy);
}

/** Khung chữ + vị trí vẽ cho nhãn đặt ở 1 phía của linh kiện. */
function labelPlacement(p: PlacedPart, side: string, b: Box, size: number) {
  const gap = p.type === 'lead' ? 14 : 18;
  const w = p.label!.length * size * 0.7;
  const h = size;
  switch (side) {
    case 'left': return { x: b.x1 - gap, y: p.y + size * 0.35, anchor: 'end', box: { x1: b.x1 - gap - w, y1: p.y - h / 2, x2: b.x1 - gap, y2: p.y + h / 2 } };
    case 'top': return { x: p.x, y: b.y1 - gap, anchor: 'middle', box: { x1: p.x - w / 2, y1: b.y1 - gap - h * 0.8, x2: p.x + w / 2, y2: b.y1 - gap + h * 0.2 } };
    case 'bottom': return { x: p.x, y: b.y2 + gap + size * 0.8, anchor: 'middle', box: { x1: p.x - w / 2, y1: b.y2 + gap, x2: p.x + w / 2, y2: b.y2 + gap + h } };
    default: return { x: b.x2 + gap, y: p.y + size * 0.35, anchor: 'start', box: { x1: b.x2 + gap, y1: p.y - h / 2, x2: b.x2 + gap + w, y2: p.y + h / 2 } };
  }
}

export interface LabelPlacement { partId: string; text: string; x: number; y: number; anchor: string; size: number; fill: string; box: Box }

/**
 * Đặt nhãn: nhãn đã kéo tay (labelPos) giữ đúng chỗ và đặt trước; nhãn còn lại
 * thử 8 vị trí quanh linh kiện (4 cạnh + 4 góc), chấm điểm theo mức đè lên linh
 * kiện khác / nhãn khác / dây / tràn khung, ưu tiên phía AI/người dùng chọn.
 */
function placeLabels(parts: PlacedPart[], frame: { W: number; H: number } | null, wireSegs: Box[]): LabelPlacement[] {
  const partBoxes = parts.filter((p) => p.type !== 'lead' && p.type !== 'bus')
    .map((p) => ({ id: p.id, b: partBox(p, true)! })).filter((x) => x.b);
  const taken: Box[] = [];
  const res: LabelPlacement[] = [];
  const area = (a: Box, b: Box) => Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)) * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const ordered = [...parts.filter((p) => p.labelPos), ...parts.filter((p) => !p.labelPos)];
  for (const p of ordered) {
    if (!p.label) continue;
    const b = partBox(p, true);
    if (!b) continue;
    const size = p.type === 'lead' ? 40 : 34;
    const fill = p.type === 'lead' ? '#ffffff' : '#8cff2e';
    const w = p.label.length * size * 0.7;
    if (p.labelPos) {
      const cx = p.x + p.labelPos.dx, cy = p.y + p.labelPos.dy;
      const box = { x1: cx - w / 2, y1: cy - size / 2, x2: cx + w / 2, y2: cy + size / 2 };
      taken.push(box);
      res.push({ partId: p.id, text: p.label, x: cx, y: cy + size * 0.35, anchor: 'middle', size, fill, box });
      continue;
    }
    const preferred = p.labelSide ?? (p.type === 'lead' ? 'top' : 'right');
    const cands = ['right', 'left', 'top', 'bottom'].map((side) => labelPlacement(p, side, b, size));
    // Góc: nhãn đặt chéo trên-phải / dưới-phải / trên-trái / dưới-trái
    const corner = (x: number, y: number, anchor: string, bx: Box) => ({ x, y, anchor, box: bx });
    cands.push(
      corner(b.x2 + 10, b.y1 - 6, 'start', { x1: b.x2 + 10, y1: b.y1 - 6 - size * 0.8, x2: b.x2 + 10 + w, y2: b.y1 - 6 + size * 0.2 }),
      corner(b.x2 + 10, b.y2 + size * 0.8, 'start', { x1: b.x2 + 10, y1: b.y2, x2: b.x2 + 10 + w, y2: b.y2 + size }),
      corner(b.x1 - 10, b.y1 - 6, 'end', { x1: b.x1 - 10 - w, y1: b.y1 - 6 - size * 0.8, x2: b.x1 - 10, y2: b.y1 - 6 + size * 0.2 }),
      corner(b.x1 - 10, b.y2 + size * 0.8, 'end', { x1: b.x1 - 10 - w, y1: b.y2, x2: b.x1 - 10, y2: b.y2 + size }),
    );
    const prefIdx = ['right', 'left', 'top', 'bottom'].indexOf(preferred);
    let best = cands[0]; let bestScore = Infinity;
    cands.forEach((c, i) => {
      const bx = c.box;
      let score = i === prefIdx ? 0 : 40 + i * 2;
      if (frame && (bx.x1 < 8 || bx.x2 > frame.W - 8 || bx.y1 < 118 || bx.y2 > frame.H - 105)) score += 100000;
      for (const t of taken) score += area(t, bx) * 50;
      for (const pb of partBoxes) if (pb.id !== p.id) score += area(pb.b, bx) * 20;
      for (const ws of wireSegs) score += area(ws, bx) * 3;
      // Nhãn phải nằm gần linh kiện của nó hơn mọi linh kiện khác — nếu không
      // người xem sẽ gán nhầm (VD chữ "GREEN" nằm dưới bóng LED xanh dương)
      const own = rectGap(bx, b);
      for (const pb of partBoxes) if (pb.id !== p.id && rectGap(bx, pb.b) < own) score += 20000;
      if (score < bestScore) { bestScore = score; best = c; }
    });
    // Chỗ nào cũng gần linh kiện khác hơn → bỏ nhãn còn hơn để người xem gán nhầm
    if (bestScore >= 20000) continue;
    taken.push(best.box);
    res.push({ partId: p.id, text: p.label, x: best.x, y: best.y, anchor: best.anchor, size, fill, box: best.box });
  }
  return res;
}

function wireSegBoxes(routed: (RoutedWire | null)[]): Box[] {
  const segs: Box[] = [];
  for (const rw of routed) {
    if (!rw) continue;
    for (let k = 0; k < rw.points.length - 1; k++) {
      const a = rw.points[k], c = rw.points[k + 1];
      segs.push({ x1: Math.min(a.x, c.x) - 8, y1: Math.min(a.y, c.y) - 8, x2: Math.max(a.x, c.x) + 8, y2: Math.max(a.y, c.y) + 8 });
    }
  }
  return segs;
}

/** Vị trí các nhãn — editor dùng để bắt chuột khi kéo nhãn. frame = null: mặt bàn không giới hạn. */
export function labelPlacements(
  layout: CircuitLayout,
  routed: (RoutedWire | null)[] = routeWires(layout),
  frame: { W: number; H: number } | null = { W: layout.width ?? 1080, H: layout.height ?? 1350 },
): LabelPlacement[] {
  const known = layout.parts.filter((p) => PARTS[p.type]);
  return placeLabels(known, frame, wireSegBoxes(routed));
}

/** Tên chân thật (pinNames) in cạnh chân, khi bật showPinNames. */
function renderPinNames(layout: CircuitLayout, H: number): string {
  let out = '';
  for (const p of layout.parts) {
    if (!p.showPinNames || !p.pinNames || !PARTS[p.type]) continue;
    for (const [pin, name] of Object.entries(p.pinNames)) {
      if (!name.trim()) continue;
      const r = resolveEndpoint(layout, `${p.id}.${pin}`);
      if (typeof r === 'string') continue;
      const dir = pinDirection(p, pin, H) ?? 1;
      // Chữ lùi về phía thân linh kiện (dây đi ra theo hướng chân, không đè lên dây)
      const [dx, dy] = dir === 1 ? [0, -30] : dir === 3 ? [0, 44] : [0, -16];
      out += `<text x="${(r.point.x + dx).toFixed(0)}" y="${(r.point.y + dy).toFixed(0)}" font-family="${FONT}" font-size="22" font-weight="900" text-anchor="middle" fill="#ffffff" stroke="#000" stroke-width="5" stroke-linejoin="round" paint-order="stroke">${esc(name)}</text>`;
    }
  }
  return out;
}

export interface RenderOptions {
  /** Đường dây đã tính sẵn (editor tính 1 lần rồi dùng chung cho vẽ + bắt chuột). */
  routed?: (RoutedWire | null)[];
  /** Chỉ số dây vẽ nét đứt (dây đang tạm nối thẳng khi kéo linh kiện). */
  dashed?: Set<number>;
  /** Vẽ trên nền tối (bàn vẽ): dây đen có viền sáng. Không ảnh hưởng ảnh xuất. */
  darkBg?: boolean;
}

export interface SceneOptions extends RenderOptions {
  /** Khung ảnh cố định (nhãn không được tràn ra ngoài); null = mặt bàn không giới hạn. Mặc định: khung theo layout.width/height. */
  frame?: { W: number; H: number } | null;
  /** Vị trí nhãn tính sẵn (xuất 1 phần mạch giữ đúng chỗ nhãn như trên bàn vẽ). */
  labels?: LabelPlacement[];
}

/** Nội dung mạch (linh kiện, dây, tên chân, nhãn) — không nền, không tiêu đề, toạ độ gốc của bố cục. */
/** Vùng lọc bóng mặc định (khung cố định) — mạch nằm gọn trong ±3000px. */
const LEGACY_FILTER_REGION: Box = { x1: -3000, y1: -3000, x2: 3000, y2: 3000 };

/**
 * Vùng lọc bóng cho mặt bàn không giới hạn: phủ cả mạch (linh kiện + dây) và
 * không nhỏ hơn vùng mặc định ±3000, làm tròn bội số 1000 để kéo nhẹ không
 * đổi id liên tục. Ngoài vùng lọc, bóng (và cả hình vẽ) bị cắt mất.
 */
export function sceneFilterRegion(layout: CircuitLayout, routed: (RoutedWire | null)[]): Box {
  const b = { ...LEGACY_FILTER_REGION };
  const add = (x1: number, y1: number, x2: number, y2: number) => {
    b.x1 = Math.min(b.x1, x1); b.y1 = Math.min(b.y1, y1); b.x2 = Math.max(b.x2, x2); b.y2 = Math.max(b.y2, y2);
  };
  for (const p of layout.parts) { const pb = partBox(p, true); if (pb) add(pb.x1, pb.y1, pb.x2, pb.y2); }
  for (const rw of routed) for (const pt of rw?.points ?? []) add(pt.x, pt.y, pt.x, pt.y);
  const PAD = 500; // chừa chỗ cho nhãn, đầu dây tuốt vỏ, bóng đổ
  return {
    x1: Math.floor((b.x1 - PAD) / 1000) * 1000, y1: Math.floor((b.y1 - PAD) / 1000) * 1000,
    x2: Math.ceil((b.x2 + PAD) / 1000) * 1000, y2: Math.ceil((b.y2 + PAD) / 1000) * 1000,
  };
}

/** Bộ lọc bóng riêng cho mặt bàn không giới hạn; id gắn theo vùng nên trùng id ⇔ trùng nội dung. */
function studioFilterDefs(r: Box): { defs: string; shadow: string; wireShadow: string } {
  const tag = `${r.x1}_${r.y1}_${r.x2}_${r.y2}`.replace(/-/g, 'm');
  const shadow = `fShadowW_${tag}`, wireShadow = `fWireShadowW_${tag}`;
  const region = `filterUnits="userSpaceOnUse" x="${r.x1}" y="${r.y1}" width="${r.x2 - r.x1}" height="${r.y2 - r.y1}"`;
  const defs = `<defs>` +
    `<filter id="${shadow}" ${region}><feDropShadow dx="5" dy="8" stdDeviation="6" flood-color="#000" flood-opacity="0.5"/></filter>` +
    `<filter id="${wireShadow}" ${region}><feDropShadow dx="3" dy="5" stdDeviation="3" flood-color="#000" flood-opacity="0.45"/></filter>` +
    // thiếc hàn: xám bạc bóng, mép tối (cục hàn dạng giọt của Xưởng vẽ)
    `<radialGradient id="gBlob" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#f3f5f7"/><stop offset="0.35" stop-color="#b8bec4"/><stop offset="0.8" stop-color="#7a8188"/><stop offset="1" stop-color="#4c5258"/></radialGradient>` +
    `</defs>`;
  return { defs, shadow, wireShadow };
}

export function renderScene(layout: CircuitLayout, opts: SceneOptions = {}): string {
  const frame = opts.frame === undefined ? { W: layout.width ?? 1080, H: layout.height ?? 1350 } : opts.frame;
  const tf = (p: PlacedPart) => `translate(${p.x} ${p.y}) rotate(${p.rotation ?? 0})`;
  const known = layout.parts.filter((p) => PARTS[p.type]);
  const buses = known.filter((p) => p.type === 'bus');
  const others = known.filter((p) => p.type !== 'bus' && p.type !== 'lead');
  const routed = opts.routed ?? routeWires(layout);
  // Khung cố định: dùng bộ lọc chung trong DEFS (giữ ảnh y hệt cũ); mặt bàn không giới hạn: bộ lọc phủ cả mạch
  const studio = frame === null ? studioFilterDefs(sceneFilterRegion(layout, routed)) : null;
  const fShadow = studio ? studio.shadow : 'fShadow';
  const fWire = studio ? studio.wireShadow : 'fWireShadow';
  const behind = others.map((p) => {
    const s = PARTS[p.type].renderBehind?.(p);
    return s ? `<g transform="${tf(p)}" filter="url(#${fShadow})">${s}</g>` : '';
  }).join('');
  const busSvg = buses.map((p) => `<g transform="${tf(p)}" filter="url(#${fWire})">${PARTS.bus.render(p)}</g>`).join('');
  const partsSvg = others.map((p) => `<g transform="${tf(p)}" filter="url(#${fShadow})">${PARTS[p.type].render(p)}</g>`).join('');
  const wires = layout.wires.map((w, i) => renderWire(w, routed[i], opts.dashed?.has(i), fWire, opts.darkBg, frame === null));
  // Quầng sáng đèn đang sáng: trên lớp dây (ánh sáng tràn lên dây quanh đèn), dưới nhãn
  const glows = others.map((p) => {
    const s = PARTS[p.type].renderGlow?.(p);
    return s ? `<g transform="${tf(p)}">${s}</g>` : '';
  }).join('');
  const labels = (opts.labels ?? placeLabels(known, frame, wireSegBoxes(routed)))
    .map((l) => labelText(l.x, l.y, l.text, l.size, l.anchor, l.fill)).join('');
  return (studio?.defs ?? '') + behind + busSvg + partsSvg +
    wires.map((w) => w.body).join('') + wires.map((w) => w.joints).join('') + glows +
    renderPinNames(layout, frame?.H ?? layout.height ?? 1350) + labels;
}

export function titleSvg(text: string | undefined, y: number, W: number): string {
  return text
    ? `<text x="${W / 2}" y="${y}" font-family="${FONT}" font-size="76" font-weight="900" text-anchor="middle" fill="#ffffff" stroke="#000" stroke-opacity="0.85" stroke-width="10" stroke-linejoin="round" paint-order="stroke">${esc(text)}</text>`
    : '';
}

export function svgDefs(): string {
  return DEFS;
}

/** Ô nền gỗ không viền tối — editor lát kín mặt bàn vẽ. */
export function woodTileSvg(W = 1080, H = 1350): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${DEFS}${woodBackground(W, H, false)}</svg>`;
}

/**
 * Ảnh mạch khung cố định (node "Vẽ mạch"): nền + mạch + tiêu đề. Nền mặc định là gỗ vẽ
 * bằng code; app truyền `background` = ảnh ván gỗ thật (woodPhoto.ts).
 */
export function renderCircuitSvg(layout: CircuitLayout, opts: RenderOptions & { background?: (W: number, H: number) => string } = {}): string {
  const W = layout.width ?? 1080;
  const H = layout.height ?? 1350;
  const { background, ...sceneOpts } = opts;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    DEFS + (background ? background(W, H) : woodBackground(W, H)) + renderScene(layout, { ...sceneOpts, frame: { W, H } }) +
    titleSvg(layout.titleTop, 92, W) + titleSvg(layout.titleBottom, H - 40, W) +
    `</svg>`;
}

/** Ảnh nhỏ 1 linh kiện cho thư viện (SVG độc lập, nền trong suốt). */
export function partPreviewSvg(type: string, size = 96): string {
  const def = PARTS[type];
  if (!def) return '';
  const p: PlacedPart = { id: 'preview', type, x: 0, y: 0, length: 300, marking: type.startsWith('dip') ? 'IC' : undefined };
  const w = type === 'bus' ? 300 : def.w;
  const h = def.h;
  const pad = 12;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-w / 2 - pad} ${-h / 2 - pad} ${w + pad * 2} ${h + pad * 2}">` +
    DEFS + (def.renderBehind?.(p) ?? '') + def.render(p) + `</svg>`;
}
