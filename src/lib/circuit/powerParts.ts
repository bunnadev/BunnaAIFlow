import type { PartDef } from './parts';
import type { PlacedPart } from './types';

/**
 * Nguồn cho Xưởng vẽ mạch: pin rời (AA, AAA, 18650), đế pin 1–3 viên (nối tiếp /
 * song song) và máy cấp nguồn để bàn. Vẽ bằng SVG như các linh kiện khác.
 *
 * Đế pin: mỗi số viên là 1 loại riêng (kích thước cố định theo loại) nhưng chân
 * luôn tên "+" / "−" — đổi số viên trong cột chỉnh sửa chỉ đổi loại, dây không đứt.
 */

export type CellKind = 'aa' | 'aaa' | '18650';
export type HolderWiring = 'series' | 'parallel';

interface CellSpec { name: string; L: number; D: number; volts: number; text: string; sub: string }

/** Kích thước theo tỉ lệ thật (≈4 đơn vị / mm), + ở bên PHẢI. */
export const CELLS: Record<CellKind, CellSpec> = {
  aa: { name: 'AA', L: 200, D: 56, volts: 1.5, text: 'AA 1.5V', sub: 'Alkaline Battery' },
  aaa: { name: 'AAA', L: 178, D: 42, volts: 1.5, text: 'AAA 1.5V', sub: 'Alkaline' },
  '18650': { name: '18650', L: 260, D: 72, volts: 3.7, text: '18650 3.7V', sub: 'Li-ion' },
};
export const CELL_KINDS: CellKind[] = ['aa', 'aaa', '18650'];

const FONT = 'Helvetica Neue, Arial, sans-serif';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Gradient riêng của nhóm nguồn (khai báo kèm từng linh kiện; id trùng thì nội dung y hệt nhau). */
const DEFS =
  '<defs>' +
  '<linearGradient id="pw_gCellGreen" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" stop-color="#c4fa98"/><stop offset="0.28" stop-color="#8ee35c"/><stop offset="0.7" stop-color="#55bd31"/><stop offset="1" stop-color="#2d7a1b"/></linearGradient>' +
  '<linearGradient id="pw_gCellMetal" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" stop-color="#f4f6f8"/><stop offset="0.45" stop-color="#b9bfc5"/><stop offset="0.6" stop-color="#8d949b"/><stop offset="1" stop-color="#d7dbdf"/></linearGradient>' +
  '<linearGradient id="pw_gCellBand" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" stop-color="#4a4d52"/><stop offset="0.35" stop-color="#1d1f22"/><stop offset="1" stop-color="#050506"/></linearGradient>' +
  '<linearGradient id="pw_gHolder" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" stop-color="#3a3d42"/><stop offset="1" stop-color="#16181b"/></linearGradient>' +
  '<linearGradient id="pw_gPsuBody" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" stop-color="#868b92"/><stop offset="0.5" stop-color="#686d74"/><stop offset="1" stop-color="#4c5056"/></linearGradient>' +
  '<radialGradient id="pw_gKnob" cx="0.4" cy="0.35" r="0.7">' +
  '<stop offset="0" stop-color="#4a4d52"/><stop offset="0.7" stop-color="#1c1d20"/><stop offset="1" stop-color="#0c0c0e"/></radialGradient>' +
  '<radialGradient id="pw_gJackRed" cx="0.35" cy="0.3" r="0.75">' +
  '<stop offset="0" stop-color="#ff6b6b"/><stop offset="0.55" stop-color="#d0181f"/><stop offset="1" stop-color="#6e070b"/></radialGradient>' +
  '<radialGradient id="pw_gJackBlack" cx="0.35" cy="0.3" r="0.75">' +
  '<stop offset="0" stop-color="#5d6066"/><stop offset="0.55" stop-color="#1e1f22"/><stop offset="1" stop-color="#050506"/></radialGradient>' +
  '</defs>';

// ─── Pin rời ──────────────────────────────────────────────────────────────

/** Thân 1 viên pin nằm ngang, tâm tại (cx, cy), + quay sang phải (flip = + sang trái). */
function cellBody(kind: CellKind, cx: number, cy: number, flip = false, p?: PlacedPart): string {
  const { L, D, text, sub } = CELLS[kind];
  const r = D / 2;
  const nubW = kind === '18650' ? 5 : 9;
  const nubH = kind === '18650' ? D * 0.5 : D * 0.36;
  const capW = 6;
  const x0 = -L / 2, x1 = L / 2 - nubW; // thân (kể cả nắp kim loại) từ x0 → x1
  let g = '';
  // đáy (−): đĩa kim loại phẳng
  g += `<rect x="${x0}" y="${-r * 0.86}" width="7" height="${D * 0.86}" rx="3" fill="url(#pw_gCellMetal)"/>`;
  // nắp (+): núm nhô ra
  g += `<rect x="${x1 - 2}" y="${-nubH / 2}" width="${nubW + 2}" height="${nubH}" rx="3" fill="url(#pw_gCellMetal)" stroke="#7d848c" stroke-width="1"/>`;
  g += `<rect x="${x1 - capW}" y="${-r * 0.9}" width="${capW}" height="${D * 0.9}" rx="2" fill="url(#pw_gCellMetal)"/>`;
  // vỏ xanh
  g += `<rect x="${x0 + 4}" y="${-r}" width="${x1 - capW - x0 - 3}" height="${D}" rx="${r * 0.28}" fill="url(#pw_gCellGreen)" stroke="#2a6d18" stroke-width="1.2"/>`;
  if (kind === '18650') {
    // vòng cách điện đen ở đầu + (như pin 18650 thật)
    g += `<rect x="${x1 - capW - 34}" y="${-r}" width="34" height="${D}" rx="${r * 0.2}" fill="url(#pw_gCellBand)"/>`;
    g += `<rect x="${x1 - capW - 34}" y="${-r}" width="5" height="${D}" fill="#000" opacity="0.5"/>`;
  }
  // bóng sáng dọc thân
  g += `<rect x="${x0 + 10}" y="${-r + D * 0.12}" width="${x1 - x0 - 30}" height="${D * 0.14}" rx="${D * 0.07}" fill="#fff" opacity="0.32"/>`;
  // dấu cực (lật theo thân pin)
  const px = x1 - capW - (kind === '18650' ? 50 : 18), mx = x0 + 22, sr = D * 0.13, sl = D * 0.08;
  g += `<g fill="none" stroke="#1a2a12" stroke-width="2"><circle cx="${px}" cy="0" r="${sr}"/><circle cx="${mx}" cy="0" r="${sr}"/></g>` +
    `<g stroke="#1a2a12" stroke-width="2.2"><line x1="${px - sl}" y1="0" x2="${px + sl}" y2="0"/><line x1="${px}" y1="${-sl}" x2="${px}" y2="${sl}"/><line x1="${mx - sl}" y1="0" x2="${mx + sl}" y2="0"/></g>`;
  // chữ: không lật theo thân — luôn đọc xuôi (xoay 90°/180° thì quay chữ 180°)
  const fs = Math.round(D * (kind === '18650' ? 0.3 : 0.34));
  const tx = (kind === '18650' ? -18 : -4) * (flip ? -1 : 1);
  const words =
    `<text x="${tx}" y="${kind === 'aaa' ? fs * 0.38 : -fs * 0.05}" font-family="${FONT}" font-size="${fs}" font-weight="900" font-style="italic" fill="#0f1a0b" text-anchor="middle">${esc(text)}</text>` +
    (kind === 'aaa' ? '' : `<text x="${tx}" y="${fs * 0.95}" font-family="${FONT}" font-size="${Math.round(fs * 0.5)}" font-weight="700" font-style="italic" fill="#1d3313" text-anchor="middle">${esc(sub)}</text>`);
  const rot = p?.rotation ?? 0;
  const label = rot === 90 || rot === 180 ? `<g transform="rotate(180 ${tx} 0)">${words}</g>` : words;
  return `<g transform="translate(${cx} ${cy})"><g${flip ? ' transform="scale(-1 1)"' : ''}>${g}</g>${label}</g>`;
}

function cellPart(kind: CellKind): PartDef {
  const { L, D, name } = CELLS[kind];
  return {
    desc: `Pin ${name} rời (${CELLS[kind].volts}V) — nằm ngang, + bên phải`,
    w: L, h: D,
    pins: { '-': { x: -L / 2, y: 0 }, '+': { x: L / 2, y: 0 } },
    pinDirs: { '-': 2, '+': 0 },
    pinNote: 'nằm ngang: − bên trái (đáy phẳng), + bên phải (núm nhô)',
    render: (p) => DEFS + cellBody(kind, 0, 0, false, p),
  };
}

// ─── Đế pin ───────────────────────────────────────────────────────────────

export const holderType = (kind: CellKind, n: number) => `bh_${kind}_${n}`;

export function parseHolderType(type: string): { kind: CellKind; n: number } | null {
  const m = type.match(/^bh_(aa|aaa|18650)_([123])$/);
  return m ? { kind: m[1] as CellKind, n: Number(m[2]) } : null;
}

export const cellType = (kind: CellKind) => `cell_${kind}`;

export function parseCellType(type: string): CellKind | null {
  const m = type.match(/^cell_(aa|aaa|18650)$/);
  return m ? (m[1] as CellKind) : null;
}

/** Điện áp ra của đế pin, VD "4.5V" (3×AA nối tiếp), "3.7V" (2×18650 song song). */
export function holderVolts(kind: CellKind, n: number, wiring: HolderWiring = 'series'): string {
  const v = wiring === 'parallel' || n === 1 ? CELLS[kind].volts : CELLS[kind].volts * n;
  return `${Math.round(v * 10) / 10}V`;
}

const LEAD = 80; // dây đỏ/đen thò ra khỏi đế

function holderGeom(kind: CellKind, n: number) {
  const { L, D } = CELLS[kind];
  const pitch = D + 16;
  const W = L + 74; // thân đế
  const H = n * pitch + 26;
  const totalW = W + LEAD;
  const bx0 = -totalW / 2, bx1 = bx0 + W; // mép trái / phải thân đế
  const bcx = (bx0 + bx1) / 2;
  const ys = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * pitch);
  const yNegTrack = H / 2 - 8;
  return { L, D, pitch, W, H, totalW, bx0, bx1, bcx, ys, yNegTrack };
}

/** Vị trí 2 chân của đế (không phụ thuộc cách mắc, để đổi nối tiếp ↔ song song không đứt dây). */
function holderPins(kind: CellKind, n: number) {
  const g = holderGeom(kind, n);
  return { '+': { x: g.totalW / 2, y: g.ys[0] }, '-': { x: g.totalW / 2, y: g.yNegTrack } };
}

/** Lò xo (đầu −) nằm ngang từ x1 đến x2. */
const spring = (x1: number, x2: number, y: number, h: number) => {
  const turns = 5, step = (x2 - x1) / turns;
  let d = `M ${x1} ${y}`;
  for (let i = 0; i < turns; i++) d += ` L ${x1 + step * (i + 0.5)} ${y - h / 2} L ${x1 + step * (i + 1)} ${y + h / 2}`;
  return `<path d="${d}" fill="none" stroke="#5f666d" stroke-width="5" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#e1e5e8" stroke-width="2.5" stroke-linejoin="round"/>`;
};
const strap = (x: number, y1: number, y2: number) =>
  `<rect x="${x - 4}" y="${Math.min(y1, y2) - 4}" width="8" height="${Math.abs(y2 - y1) + 8}" rx="3" fill="url(#pw_gCellMetal)" stroke="#6d747b" stroke-width="1"/>`;
const track = (pts: [number, number][]) =>
  `<path d="M ${pts.map((p) => p.join(' ')).join(' L ')}" fill="none" stroke="#6d747b" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>` +
  `<path d="M ${pts.map((p) => p.join(' ')).join(' L ')}" fill="none" stroke="#d6dadd" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>`;

function holderPart(kind: CellKind, n: number): PartDef {
  const g = holderGeom(kind, n);
  const pins = holderPins(kind, n);
  return {
    desc: `Đế pin ${n} viên ${CELLS[kind].name} (chọn nối tiếp / song song), 2 dây ra đỏ (+) / đen (−) bên phải`,
    w: g.totalW, h: g.H,
    pins,
    pinDirs: { '+': 0, '-': 0 },
    pinNote: 'dây đỏ (+) và đen (−) thò ra ở cạnh PHẢI',
    render: (p) => {
      const wiring: HolderWiring = p.wiring === 'parallel' ? 'parallel' : 'series';
      const { L, D, ys, bx0, bx1, bcx, H, yNegTrack } = g;
      const inL = bcx - L / 2, inR = bcx + L / 2; // 2 đầu pin
      const wallL = bx0 + 12, wallR = bx1 - 12;
      let s = DEFS;
      // thân đế + rãnh
      s += `<rect x="${bx0}" y="${-H / 2}" width="${g.W}" height="${H}" rx="10" fill="url(#pw_gHolder)" stroke="#0b0c0d" stroke-width="2"/>`;
      s += `<rect x="${bx0 + 3}" y="${-H / 2 + 3}" width="${g.W - 6}" height="8" rx="4" fill="#fff" opacity="0.08"/>`;
      for (const y of ys) s += `<rect x="${bx0 + 8}" y="${y - D / 2 - 4}" width="${g.W - 16}" height="${D + 8}" rx="${D / 2 + 4}" fill="#0e0f11"/>`;
      // pin trong rãnh: nối tiếp thì đảo chiều xen kẽ, song song thì cùng chiều
      const plusRight = ys.map((_, i) => wiring === 'parallel' || i % 2 === 0);
      ys.forEach((y, i) => {
        const pr = plusRight[i];
        // lò xo ở đầu −, lá đồng ở đầu +
        s += pr ? spring(wallL, inL, y, D * 0.5) : spring(inR, wallR, y, D * 0.5);
        s += `<rect x="${pr ? inR - 1 : wallL - 2}" y="${y - D * 0.32}" width="${pr ? wallR - inR + 3 : inL - wallL + 3}" height="${D * 0.64}" rx="2" fill="url(#pw_gCellMetal)" opacity="0.9"/>`;
        s += cellBody(kind, bcx, y, !pr, p);
      });
      // lá đồng nối giữa các viên
      if (wiring === 'series') {
        for (let i = 0; i < ys.length - 1; i++) s += strap(plusRight[i] ? wallL : wallR, ys[i], ys[i + 1]);
      } else if (ys.length > 1) {
        s += strap(wallR, ys[0], ys[ys.length - 1]) + strap(wallL, ys[0], ys[ys.length - 1]);
      }
      // cực − ra ngoài: đầu − của viên cuối (song song: thanh − bên trái) chạy dọc đáy sang mép phải
      const last = ys.length - 1;
      const negOnRight = wiring === 'series' && !plusRight[last];
      const negPts: [number, number][] = negOnRight
        ? [[wallR, ys[last]], [wallR + 6, ys[last]], [wallR + 6, yNegTrack], [bx1, yNegTrack]]
        : [[wallL, ys[last]], [wallL, yNegTrack], [bx1, yNegTrack]];
      s += track(negPts);
      s += track([[wallR, ys[0]], [bx1, ys[0]]]);
      // dây đỏ / đen ra ngoài, đầu tuốt vỏ lộ lõi
      const wire = (y: number, main: string, dark: string) =>
        `<path d="M ${bx1 - 4} ${y} L ${bx1 + LEAD - 16} ${y}" stroke="${dark}" stroke-width="13" stroke-linecap="round"/>` +
        `<path d="M ${bx1 - 4} ${y} L ${bx1 + LEAD - 16} ${y}" stroke="${main}" stroke-width="9" stroke-linecap="round"/>` +
        `<path d="M ${bx1} ${y - 2} L ${bx1 + LEAD - 18} ${y - 2}" stroke="#fff" stroke-opacity="0.35" stroke-width="2.5" stroke-linecap="round"/>` +
        `<path d="M ${bx1 + LEAD - 16} ${y} L ${bx1 + LEAD} ${y}" stroke="#b8732f" stroke-width="5" stroke-linecap="round"/>`;
      s += wire(pins['+'].y, '#e32b2b', '#8f1414') + wire(pins['-'].y, '#2a2a2e', '#6a6a72');
      s += `<text x="${bx1 + LEAD - 34}" y="${pins['+'].y - 12}" font-family="${FONT}" font-size="20" font-weight="900" fill="#ff6b6b" text-anchor="middle">+</text>`;
      s += `<text x="${bx1 + LEAD - 34}" y="${pins['-'].y + 26}" font-family="${FONT}" font-size="22" font-weight="900" fill="#9fb8d8" text-anchor="middle">−</text>`;
      return s;
    },
  };
}

// ─── Máy cấp nguồn để bàn ────────────────────────────────────────────────

/** Số hiển thị trên màn hình máy nguồn: V lấy từ value, A từ marking. */
export function psuReadout(p: PlacedPart): { v: string; a: string; w: string } {
  const num = (s: string | undefined, d: number) => {
    const n = parseFloat((s ?? '').replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : d;
  };
  const v = num(p.value, 12), a = num(p.marking, 1);
  const fmt = (n: number, dp: number) => n.toFixed(dp).slice(0, 5);
  return { v: fmt(v, 2), a: fmt(a, 3), w: fmt(v * a, v * a >= 100 ? 1 : 2) };
}

const PSU_W = 520, PSU_H = 620;
const JACK_Y = 212;

const psu: PartDef = {
  desc: 'Máy cấp nguồn DC để bàn (màn hình V/A/W, 2 núm chỉnh, jack đỏ + / đen −)',
  w: PSU_W, h: PSU_H,
  pins: { '+': { x: -40, y: JACK_Y }, '-': { x: 90, y: JACK_Y } },
  pinDirs: { '+': 1, '-': 1 },
  straightOut: true,
  pinNote: 'đứng thẳng, jack đỏ (+) và đen (−) ở mặt dưới, dây đi xuống',
  render: (p) => {
    const { v, a, w } = psuReadout(p);
    const hw = PSU_W / 2, hh = PSU_H / 2;
    let s = DEFS;
    // vỏ máy
    s += `<rect x="${-hw}" y="${-hh}" width="${PSU_W}" height="${PSU_H}" rx="26" fill="url(#pw_gPsuBody)" stroke="#33363a" stroke-width="3"/>`;
    s += `<rect x="${-hw + 6}" y="${-hh + 6}" width="${PSU_W - 12}" height="14" rx="7" fill="#fff" opacity="0.18"/>`;
    // màn hình
    s += `<rect x="-236" y="-284" width="316" height="268" rx="8" fill="#2a2d31"/>`;
    s += `<rect x="-228" y="-276" width="300" height="252" rx="5" fill="#04070b"/>`;
    s += `<text x="-216" y="-254" font-family="${FONT}" font-size="12" font-weight="700" fill="#7fa3c2" letter-spacing="1">DC POWER SUPPLY</text>`;
    s += `<text x="60" y="-254" font-family="${FONT}" font-size="12" font-weight="700" fill="#7fa3c2" text-anchor="end">30V 5A</text>`;
    const row = (y: number, txt: string, unit: string) =>
      `<text x="20" y="${y}" font-family="Menlo, Consolas, monospace" font-size="62" font-weight="700" fill="#4d8fc2" opacity="0.35" text-anchor="end" letter-spacing="2" transform="translate(1.5 1.5)">${esc(txt)}</text>` +
      `<text x="20" y="${y}" font-family="Menlo, Consolas, monospace" font-size="62" font-weight="700" fill="#eef7ff" text-anchor="end" letter-spacing="2">${esc(txt)}</text>` +
      `<text x="44" y="${y}" font-family="${FONT}" font-size="30" font-weight="800" fill="#45b8ff" text-anchor="middle">${unit}</text>`;
    s += row(-180, v, 'V') + row(-110, a, 'A') + row(-40, w, 'W');
    s += `<circle cx="-212" cy="-196" r="5" fill="#ff8a1e"/><text x="-212" y="-176" font-family="${FONT}" font-size="10" font-weight="700" fill="#c9d6e2" text-anchor="middle">C.V</text>`;
    // 2 núm vặn + vạch chia
    const knob = (cy: number, name: string) =>
      `<path d="M 118 ${cy - 28} A 62 62 0 0 1 222 ${cy - 28}" fill="none" stroke="#d5d9dd" stroke-width="5" stroke-dasharray="3 5"/>` +
      `<circle cx="170" cy="${cy}" r="52" fill="#141517"/>` +
      `<circle cx="170" cy="${cy}" r="48" fill="url(#pw_gKnob)" stroke="#2b2d31" stroke-width="7" stroke-dasharray="4 3"/>` +
      `<circle cx="170" cy="${cy}" r="22" fill="#1d1e21" stroke="#3a3c40" stroke-width="2"/>` +
      `<line x1="170" y1="${cy - 46}" x2="170" y2="${cy - 30}" stroke="#f2f2f2" stroke-width="4" stroke-linecap="round"/>` +
      `<text x="170" y="${cy + 72}" font-family="${FONT}" font-size="13" font-weight="800" fill="#e9ecef" text-anchor="middle" letter-spacing="1">${name}</text>`;
    s += knob(-200, 'VOLTAGE') + knob(-66, 'CURRENT');
    // hàng nút nhớ / chế độ
    const btn = (x: number, fill: string, t: string) =>
      `<text x="${x + 22}" y="-2" font-family="${FONT}" font-size="11" font-weight="800" fill="#e9ecef" text-anchor="middle">${t}</text>` +
      `<rect x="${x}" y="4" width="44" height="30" rx="4" fill="${fill}" stroke="#1d2024" stroke-width="1.5"/>` +
      `<rect x="${x + 3}" y="7" width="38" height="7" rx="3" fill="#fff" opacity="0.2"/>`;
    ['M1', 'M2', 'M3', 'M4'].forEach((t, i) => { s += btn(-232 + i * 48, '#2c6f87', t); });
    ['OCP', 'OCP', 'C.V'].forEach((t, i) => { s += btn(-40 + i * 48, '#b8353a', t); });
    s += `<rect x="120" y="10" width="64" height="26" rx="3" fill="#b8353a" stroke="#1d2024" stroke-width="1.5"/><rect x="152" y="13" width="28" height="20" rx="2" fill="#e8e8e8"/>`;
    // cổng USB
    for (let i = 0; i < 6; i++) {
      const x = -228 + i * 78;
      s += `<rect x="${x}" y="62" width="46" height="24" rx="3" fill="#1c2620" stroke="#0d1210" stroke-width="2"/><rect x="${x + 6}" y="68" width="34" height="9" rx="1" fill="#39c46a"/>`;
    }
    s += `<text x="0" y="106" font-family="${FONT}" font-size="12" font-weight="700" fill="#e1e4e7" text-anchor="middle">Adjustable USB output 0V–30V</text>`;
    // mặt dưới: nút nguồn + 2 jack + 2 cổng USB cam
    s += `<rect x="-244" y="128" width="488" height="164" rx="12" fill="#55595f" stroke="#3b3e43" stroke-width="2"/>`;
    s += `<text x="-200" y="152" font-family="${FONT}" font-size="12" font-weight="800" fill="#e9ecef" text-anchor="middle">POWER</text>`;
    s += `<rect x="-232" y="166" width="64" height="64" rx="14" fill="#cfd2d6" stroke="#8d9298" stroke-width="2"/><rect x="-226" y="170" width="52" height="16" rx="7" fill="#fff" opacity="0.5"/>`;
    const jack = (x: number, grad: string, ring: string) =>
      `<circle cx="${x}" cy="${JACK_Y}" r="34" fill="${ring}"/>` +
      `<circle cx="${x}" cy="${JACK_Y}" r="29" fill="url(#${grad})"/>` +
      `<circle cx="${x}" cy="${JACK_Y}" r="12" fill="#c9a24a" stroke="#6b5420" stroke-width="2"/>` +
      `<circle cx="${x}" cy="${JACK_Y}" r="6" fill="#1a1408"/>`;
    s += `<text x="-40" y="164" font-family="${FONT}" font-size="30" font-weight="900" fill="#ff4d4d" text-anchor="middle">+</text>`;
    s += `<text x="90" y="166" font-family="${FONT}" font-size="34" font-weight="900" fill="#1a1a1a" text-anchor="middle">−</text>`;
    s += jack(-40, 'pw_gJackRed', '#3a0a0c') + jack(90, 'pw_gJackBlack', '#0a0a0b');
    s += `<text x="25" y="280" font-family="${FONT}" font-size="13" font-weight="700" fill="#e1e4e7" text-anchor="middle">0V – 30V</text>`;
    for (const x of [166, 210]) s += `<rect x="${x - 15}" y="196" width="30" height="40" rx="3" fill="#2a1a10"/><rect x="${x - 9}" y="202" width="18" height="28" rx="2" fill="#ff8c2b"/>`;
    s += `<text x="188" y="258" font-family="${FONT}" font-size="10" font-weight="700" fill="#e1e4e7" text-anchor="middle">5V 2A</text>`;
    // chân đế
    s += `<rect x="-200" y="${hh - 4}" width="70" height="14" rx="5" fill="#141517"/><rect x="130" y="${hh - 4}" width="70" height="14" rx="5" fill="#141517"/>`;
    return s;
  },
};

export const POWER_PARTS: Record<string, PartDef> = {
  psu,
  ...Object.fromEntries(CELL_KINDS.map((k) => [cellType(k), cellPart(k)])),
  ...Object.fromEntries(CELL_KINDS.flatMap((k) => [1, 2, 3].map((n) => [holderType(k, n), holderPart(k, n)]))),
};

/** Loại linh kiện thuộc nhóm nguồn (không đưa vào gợi ý cho AI của node "Vẽ mạch" cũ). */
export const POWER_TYPES = new Set(Object.keys(POWER_PARTS));
