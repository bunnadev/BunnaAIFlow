import type { PlacedPart, Point } from './types';
import { POWER_PARTS } from './powerParts';

/**
 * Thư viện linh kiện vẽ bằng SVG. Mỗi linh kiện vẽ ở toạ độ cục bộ (tâm = 0,0,
 * chưa xoay) và khai báo toạ độ từng chân — bộ vẽ (render.ts) dùng đúng toạ độ
 * này để gắn đầu dây, nên dây luôn chạm đúng chân.
 *
 * Gradient/filter dùng chung (gMetal, gBlack, gSolder…) khai báo 1 lần trong
 * render.ts.
 */

export interface PartDef {
  /** Mô tả ngắn cho AI biết linh kiện này là gì. */
  desc: string;
  /** Khung bao (chưa xoay), tâm ở 0,0. */
  w: number;
  h: number;
  /** Chân → toạ độ cục bộ (chưa xoay). */
  pins: Record<string, Point>;
  /** Hướng dây đi ra ở từng chân (0 phải, 1 xuống, 2 trái, 3 lên — khi chưa xoay). Không có = đoán theo cạnh gần nhất. */
  pinDirs?: Record<string, 0 | 1 | 2 | 3>;
  /** Ghi chú về chân cho AI (VD chiều xoay mặc định). */
  pinNote: string;
  render: (p: PlacedPart) => string;
  /** Chân nằm trong thân (VD jack máy nguồn) nhưng dây phải đi thẳng ra theo pinDirs, không bò trên mặt linh kiện. */
  straightOut?: boolean;
  /** Vẽ phía sau linh kiện (tản nhiệt) — tuỳ chọn. */
  renderBehind?: (p: PlacedPart) => string;
}

/**
 * Chữ in trên thân linh kiện: khi linh kiện xoay 90°/180° thì lật chữ lại để
 * không bị đọc ngược (xoay 90° đọc từ dưới lên, giống chữ in trên linh kiện thật).
 */
const upright = (p: PlacedPart, x: number, y: number, body: string) => {
  const r = p.rotation ?? 0;
  return r === 90 || r === 180 ? `<g transform="rotate(180 ${x} ${y})">${body}</g>` : body;
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Chân linh kiện bằng kim loại mạ thiếc. */
const leg = (x1: number, y1: number, x2: number, y2: number, w = 7) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#7d848c" stroke-width="${w + 2}" stroke-linecap="round"/>` +
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="url(#gLeg)" stroke-width="${w}" stroke-linecap="round"/>`;

// ─── Điện trở: vạch màu tự tính từ giá trị ────────────────────────────────
const BAND = ['#1a1a1a', '#7b3f17', '#d42020', '#f07a12', '#f3d21c', '#2e9b3a', '#2662c7', '#7d3cc2', '#8a8a8a', '#f4f4f4'];

export function parseOhms(value?: string): number | null {
  if (!value) return null;
  const m = value.trim().replace(',', '.').match(/^([\d.]+)\s*([kKmMrRΩ]?)/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (Number.isNaN(n)) return null;
  const unit = m[2];
  if (unit === 'k' || unit === 'K') n *= 1e3;
  else if (unit === 'M') n *= 1e6;
  else if (unit === 'm') n *= 1e6; // "1m" thường là gõ nhầm của 1M
  return n;
}

export function resistorBands(value?: string): string[] {
  const ohms = parseOhms(value);
  if (!ohms || ohms <= 0) return [BAND[1], BAND[0], BAND[2], '#c9a227'];
  let m = Math.floor(Math.log10(ohms)) - 1;
  let sig = Math.round(ohms / Math.pow(10, m));
  if (sig >= 100) { sig = Math.round(sig / 10); m += 1; }
  const d1 = Math.floor(sig / 10);
  const d2 = sig % 10;
  const mult = m >= 0 ? BAND[Math.min(m, 9)] : m === -1 ? '#c9a227' : '#b8b8b8';
  return [BAND[d1], BAND[d2], mult, '#c9a227'];
}

const resistor: PartDef = {
  desc: 'Điện trở (vạch màu tự tính theo value)',
  w: 150, h: 34,
  pins: { '1': { x: -75, y: 0 }, '2': { x: 75, y: 0 } },
  pinNote: 'nằm ngang, chân 1 trái, chân 2 phải',
  render: (p) => {
    const b = resistorBands(p.value);
    return leg(-75, 0, -36, 0, 6) + leg(36, 0, 75, 0, 6) +
      `<rect x="-38" y="-15" width="76" height="30" rx="14" fill="url(#gResistor)" stroke="#a88b5c" stroke-width="1.5"/>` +
      `<rect x="-24" y="-15" width="7" height="30" fill="${b[0]}"/>` +
      `<rect x="-12" y="-13.5" width="7" height="27" fill="${b[1]}"/>` +
      `<rect x="0" y="-13.5" width="7" height="27" fill="${b[2]}"/>` +
      `<rect x="18" y="-15" width="6" height="30" fill="${b[3]}"/>` +
      `<rect x="-36" y="-12" width="72" height="7" rx="3" fill="#fff" opacity="0.28"/>`;
  },
};

const diode: PartDef = {
  desc: 'Diode chỉnh lưu (vạch bạc = Katot)',
  w: 180, h: 44,
  pins: { A: { x: -90, y: 0 }, K: { x: 90, y: 0 } },
  pinNote: 'nằm ngang, A (anot) trái, K (katot, phía vạch bạc) phải',
  render: (p) =>
    leg(-90, 0, -46, 0, 7) + leg(46, 0, 90, 0, 7) +
    `<rect x="-48" y="-21" width="96" height="42" rx="8" fill="url(#gBlack)"/>` +
    `<rect x="26" y="-21" width="11" height="42" fill="url(#gSilver)"/>` +
    `<rect x="-46" y="-18" width="92" height="8" rx="4" fill="#fff" opacity="0.16"/>` +
    (p.marking ? upright(p, -8, 1, `<text x="-8" y="7" font-size="17" font-weight="700" fill="#d9d9d9" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif">${esc(p.marking)}</text>`) : ''),
};

/**
 * Tụ hoá loại đứng (radial) — loại người làm DIY hay dùng: 2 chân ra cùng 1 đầu,
 * chân + dài hơn, vạch sáng dọc thân có dấu "−". Trước đây vẽ kiểu nằm ngang
 * 2 chân 2 đầu, thân đen vạch xám → nhìn y hệt diode, người xem dễ nhầm.
 */
const capElec: PartDef = {
  desc: 'Tụ hoá (điện phân) loại đứng — thân trụ xanh, 2 chân ra cùng một đầu',
  w: 70, h: 210,
  pins: { '+': { x: -14, y: 104 }, '-': { x: 14, y: 92 } },
  pinNote: 'thân dựng đứng, 2 chân chĩa XUỐNG ở cùng một đầu: + bên trái (chân dài hơn), − bên phải (phía vạch sáng có dấu −)',
  render: (p) => {
    const minus = [-58, -34, -10, 14].map((y) => `<rect x="17" y="${y}" width="9" height="3" rx="1.5" fill="#1f3354"/>`).join('');
    return leg(-14, 36, -14, 104, 5) + leg(14, 36, 14, 92, 5) +
      // thân + đầu nhôm + đệm cao su
      `<rect x="-34" y="-80" width="68" height="116" rx="10" fill="url(#gCapBlue)"/>` +
      `<rect x="-34" y="-82" width="68" height="12" rx="6" fill="url(#gSilver)" stroke="#7d848c" stroke-width="1"/>` +
      `<rect x="-30" y="32" width="60" height="8" rx="3" fill="#15171a"/>` +
      // vạch âm dọc thân
      `<rect x="12" y="-70" width="20" height="102" fill="#c9d6ea"/>` + minus +
      `<rect x="-31" y="-68" width="8" height="96" rx="4" fill="#fff" opacity="0.22"/>` +
      `<text x="-26" y="84" font-size="15" font-weight="900" fill="#ffb4b4" text-anchor="middle">+</text>` +
      (p.marking ? upright(p, -6, -21, `<text x="0" y="0" font-size="13" font-weight="700" fill="#e8eef8" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" transform="translate(-6 -21) rotate(-90)">${esc(p.marking)}</text>`) : '');
  },
};

const capCeramic: PartDef = {
  desc: 'Tụ gốm (đĩa cam)',
  w: 70, h: 120,
  pins: { '1': { x: -26, y: 60 }, '2': { x: 26, y: 60 } },
  pinNote: 'đĩa ở trên, 2 chân chĩa xuống: chân 1 trái-dưới, chân 2 phải-dưới',
  render: (p) =>
    leg(-9, 0, -26, 60, 5) + leg(9, 0, 26, 60, 5) +
    `<ellipse cx="0" cy="-22" rx="33" ry="30" fill="url(#gCeramic)" stroke="#a5591a" stroke-width="2"/>` +
    `<ellipse cx="-8" cy="-34" rx="14" ry="8" fill="#fff" opacity="0.3"/>` +
    upright(p, 0, -21, `<text x="0" y="-15" font-size="17" font-weight="700" fill="#5b2a07" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif">${esc(p.marking || '104')}</text>`),
};

const pot: PartDef = {
  desc: 'Chiết áp xoay (3 chân hàn)',
  w: 220, h: 310,
  pins: { '1': { x: -60, y: -155 }, '2': { x: 0, y: -155 }, '3': { x: 60, y: -155 } },
  pinNote: '3 chân hàn chĩa LÊN trên (chân 1 trái, 2 giữa = con trượt, 3 phải), thân tròn ở dưới',
  render: (p) => {
    const lug = (x: number) =>
      `<rect x="${x - 14}" y="-155" width="28" height="70" rx="5" fill="url(#gSilver)" stroke="#8a929b" stroke-width="1.5"/>` +
      `<circle cx="${x}" cy="-130" r="6" fill="#3d3328"/>`;
    return lug(-60) + lug(0) + lug(60) +
      `<rect x="-100" y="-98" width="200" height="72" rx="12" fill="url(#gPcbBrown)"/>` +
      [-60, 0, 60].map((x) => `<circle cx="${x}" cy="-62" r="15" fill="#f1e6d6"/><circle cx="${x}" cy="-62" r="8" fill="#5a3218"/>`).join('') +
      `<circle cx="0" cy="45" r="110" fill="url(#gPcbBrown)"/>` +
      `<circle cx="0" cy="45" r="94" fill="url(#gMetal)" stroke="#9aa2ab" stroke-width="2"/>` +
      `<circle cx="0" cy="38" r="52" fill="url(#gKnob)" stroke="#8d949c" stroke-width="2"/>` +
      `<rect x="-36" y="31" width="72" height="14" rx="7" fill="#40464d" transform="rotate(-28 0 38)"/>` +
      upright(p, 0, 121, `<text x="0" y="128" font-size="22" font-weight="800" fill="#4a2410" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif">${esc(p.marking || 'B10K')}</text>`);
  },
};

function tabPackage(pinXs: number[], bodyHalfW: number) {
  const pins: Record<string, Point> = {};
  pinXs.forEach((x, i) => { pins[String(i + 1)] = { x, y: 135 }; });
  const render = (p: PlacedPart) =>
    pinXs.map((x) => leg(x, 50, x, 135, 9)).join('') +
    `<rect x="${-bodyHalfW}" y="-125" width="${bodyHalfW * 2}" height="95" rx="5" fill="url(#gMetal)" stroke="#8d949c" stroke-width="1.5"/>` +
    `<circle cx="0" cy="-88" r="17" fill="#2b2b2b"/><circle cx="0" cy="-88" r="11" fill="#6b4a2c"/>` +
    `<rect x="${-bodyHalfW}" y="-40" width="${bodyHalfW * 2}" height="92" rx="4" fill="url(#gBlack)"/>` +
    `<rect x="${-bodyHalfW + 3}" y="-37" width="${bodyHalfW * 2 - 6}" height="10" rx="4" fill="#fff" opacity="0.12"/>` +
    (p.marking ? upright(p, 0, 5, `<text x="0" y="12" font-size="${bodyHalfW > 60 ? 22 : 18}" font-weight="800" fill="#e6e6e6" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif">${esc(p.marking)}</text>`) : '');
  const renderBehind = (p: PlacedPart) => p.heatsink ? heatsinkSvg(bodyHalfW + 45, -150, 40) : '';
  return { pins, render, renderBehind };
}

function heatsinkSvg(halfW: number, top: number, bottom: number) {
  const fins: string[] = [];
  for (let x = -halfW + 6; x < halfW - 4; x += 22) {
    fins.push(`<rect x="${x}" y="${top}" width="12" height="${bottom - top}" rx="3" fill="url(#gFin)"/>`);
  }
  return `<rect x="${-halfW}" y="${top + 20}" width="${halfW * 2}" height="${bottom - top - 20}" rx="6" fill="#1b1d20"/>` + fins.join('');
}

const to220 = tabPackage([-34, 0, 34], 56);
const pentawatt = tabPackage([-56, -28, 0, 28, 56], 74);

const to220Part: PartDef = {
  desc: 'Transistor/IC ổn áp vỏ TO-220 (3 chân) — VD TIP41C, 7805, IRFZ44N',
  w: 112, h: 260, pins: to220.pins,
  pinNote: '3 chân chĩa XUỐNG, mặt in chữ hướng lên: chân 1 trái, 2 giữa, 3 phải. heatsink:true để có tản nhiệt',
  render: to220.render, renderBehind: to220.renderBehind,
};

const pentawattPart: PartDef = {
  desc: 'IC công suất vỏ Pentawatt (5 chân) — VD TDA2003, TDA2030, LM2596',
  w: 148, h: 260, pins: pentawatt.pins,
  pinNote: '5 chân chĩa XUỐNG, chân 1 trái → 5 phải',
  render: pentawatt.render, renderBehind: pentawatt.renderBehind,
};

const to92: PartDef = {
  desc: 'Transistor nhỏ vỏ TO-92 (3 chân) — VD BC547, 2N2222, C1815',
  w: 70, h: 140,
  pins: { '1': { x: -24, y: 70 }, '2': { x: 0, y: 70 }, '3': { x: 24, y: 70 } },
  pinNote: 'mặt phẳng có chữ hướng lên, 3 chân chĩa XUỐNG: chân 1 trái, 2 giữa, 3 phải',
  render: (p) =>
    leg(-12, 10, -24, 70, 5) + leg(0, 10, 0, 70, 5) + leg(12, 10, 24, 70, 5) +
    `<path d="M -32 15 L -32 -30 A 32 32 0 0 1 32 -30 L 32 15 Z" fill="url(#gBlack)"/>` +
    (p.marking ? upright(p, 0, -16, `<text x="0" y="-10" font-size="13" font-weight="700" fill="#ddd" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif">${esc(p.marking)}</text>`) : ''),
};

const TO3_OUTLINE = 'M -150 0 Q -150 -38 -112 -48 L -46 -84 Q 0 -104 46 -84 L 112 -48 Q 150 -38 150 0 Q 150 38 112 48 L 46 84 Q 0 104 -46 84 L -112 48 Q -150 38 -150 0 Z';

const to3: PartDef = {
  desc: 'Sò công suất vỏ kim loại TO-3 — VD 2N3055, MJ2955. Vỏ kim loại chính là chân C',
  w: 400, h: 210,
  pins: { B: { x: -30, y: 34 }, E: { x: 30, y: 34 }, C: { x: 196, y: 0 } },
  pinNote: '2 lỗ bắt vít nằm ngang (trái/phải). Chân B và E là 2 chân nhỏ ở giữa mặt đế (B trái, E phải). Chân C = cốt hàn dưới con vít bên phải, chĩa sang PHẢI. heatsink:true để có tản nhiệt',
  render: (p) =>
    `<path d="${TO3_OUTLINE}" fill="url(#gMetal)" stroke="#8d949c" stroke-width="2"/>` +
    `<path d="${TO3_OUTLINE}" fill="none" stroke="#fff" stroke-width="2" opacity="0.35" transform="translate(-1.5 -1.5)"/>` +
    [-118, 118].map((x) => `<circle cx="${x}" cy="0" r="17" fill="url(#gScrew)" stroke="#6d747c" stroke-width="2"/><line x1="${x - 10}" y1="-6" x2="${x + 10}" y2="6" stroke="#5b6168" stroke-width="4"/>`).join('') +
    // cốt hàn chân C dưới vít phải
    `<path d="M 118 -22 A 22 22 0 1 1 118 22 L 196 9 L 196 -9 Z" fill="url(#gCopper)" stroke="#9a6a32" stroke-width="2" opacity="0.95"/>` +
    `<circle cx="118" cy="0" r="17" fill="url(#gScrew)" stroke="#6d747c" stroke-width="2"/><line x1="108" y1="-6" x2="128" y2="6" stroke="#5b6168" stroke-width="4"/>` +
    `<ellipse cx="0" cy="-50" rx="62" ry="24" fill="#000" opacity="0.06"/>` +
    (p.marking ? upright(p, 0, -50, `<text x="0" y="-44" font-size="24" font-weight="800" fill="#3b4148" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif">${esc(p.marking)}</text>`) : '') +
    [-30, 30].map((x) => `<circle cx="${x}" cy="34" r="15" fill="#2f4a3a" stroke="#1d2e24" stroke-width="2"/><circle cx="${x}" cy="34" r="7" fill="url(#gSilver)"/>`).join('') +
    `<text x="-30" y="72" font-size="16" font-weight="800" fill="#3b4148" text-anchor="middle">B</text>` +
    `<text x="30" y="72" font-size="16" font-weight="800" fill="#3b4148" text-anchor="middle">E</text>`,
  renderBehind: (p) => p.heatsink ? heatsinkSvg(190, -140, 140) : '',
};

/** Màu bóng LED theo chữ mô tả (tiếng Việt hoặc tiếng Anh). */
function ledColor(text: string): string {
  const t = text.toLowerCase();
  if (/xanh dương|xanh duong|xanh lam|blue/.test(t)) return '#3b7bff';
  if (/xanh lá|xanh la|green|xanh/.test(t)) return '#36d16a';
  if (/vàng|vang|yellow/.test(t)) return '#ffd21f';
  if (/trắng|trang|white/.test(t)) return '#f2f6ff';
  if (/cam|orange/.test(t)) return '#ff8a1f';
  return '#ff3b3b';
}

const led: PartDef = {
  desc: 'Đèn LED 5mm',
  w: 70, h: 150,
  pins: { A: { x: -14, y: 75 }, K: { x: 14, y: 75 } },
  pinNote: 'bóng ở trên, 2 chân chĩa xuống: A (chân dài, dương) trái, K phải. Màu bóng lấy từ marking/value/label (đỏ, xanh lá, xanh dương, vàng, trắng)',
  render: (p) => {
    const c = ledColor(`${p.marking ?? ''} ${p.value ?? ''} ${p.label ?? ''}`);
    return leg(-8, 0, -14, 75, 5) + leg(8, 0, 14, 75, 5) +
      `<rect x="-30" y="-6" width="60" height="12" rx="3" fill="${c}" opacity="0.85"/>` +
      `<path d="M -26 0 L -26 -40 A 26 26 0 0 1 26 -40 L 26 0 Z" fill="${c}" opacity="0.88"/>` +
      `<ellipse cx="-9" cy="-48" rx="7" ry="12" fill="#fff" opacity="0.5"/>`;
  },
};

const speaker: PartDef = {
  desc: 'Loa (2 cực + và −)',
  w: 320, h: 340,
  pins: { '+': { x: -40, y: -170 }, '-': { x: 40, y: -170 } },
  pinNote: '2 cọc hàn ở mép TRÊN: + trái, − phải',
  render: () =>
    `<circle cx="0" cy="0" r="158" fill="url(#gMetal)" stroke="#6f767e" stroke-width="3"/>` +
    `<circle cx="0" cy="0" r="138" fill="url(#gCone)"/>` +
    [110, 85, 60].map((r) => `<circle cx="0" cy="0" r="${r}" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="2"/>`).join('') +
    `<circle cx="0" cy="0" r="46" fill="url(#gDust)"/>` +
    `<ellipse cx="-14" cy="-16" rx="16" ry="10" fill="#fff" opacity="0.15"/>` +
    [-40, 40].map((x) => `<rect x="${x - 11}" y="-176" width="22" height="30" rx="4" fill="url(#gSilver)" stroke="#7d848c"/>`).join('') +
    `<text x="-40" y="-186" font-size="20" font-weight="900" fill="#ff4d4d" text-anchor="middle">+</text>` +
    `<text x="40" y="-186" font-size="22" font-weight="900" fill="#cfd6df" text-anchor="middle">−</text>`,
};

const jack35: PartDef = {
  desc: 'Jack/phích cắm audio 3.5mm (dây tín hiệu + dây mass đi ra ở đuôi)',
  w: 70, h: 300,
  pins: { T: { x: -12, y: 150 }, S: { x: 12, y: 150 } },
  pinNote: 'mũi cắm hướng LÊN, 2 dây ra ở đuôi phía DƯỚI: T (tín hiệu) trái, S (mass) phải',
  render: () =>
    `<rect x="-13" y="-150" width="26" height="110" rx="12" fill="url(#gGold)"/>` +
    `<rect x="-13" y="-112" width="26" height="6" fill="#222"/><rect x="-13" y="-82" width="26" height="6" fill="#222"/>` +
    [-56, -50, -44].map((y) => `<rect x="-15" y="${y}" width="30" height="4" fill="#a87f2a"/>`).join('') +
    `<path d="M -32 -40 L 32 -40 L 26 130 Q 0 150 -26 130 Z" fill="url(#gBlack)"/>` +
    `<rect x="-24" y="-30" width="10" height="150" rx="5" fill="#fff" opacity="0.1"/>`,
};

const terminal2: PartDef = {
  desc: 'Cọc đấu dây 2 chân (domino xanh) để cắm nguồn',
  w: 110, h: 150,
  pins: { '+': { x: -55, y: -32 }, '-': { x: -55, y: 32 } },
  pinNote: 'dây vào từ cạnh TRÁI: + ở trên, − ở dưới',
  render: () =>
    `<rect x="-50" y="-72" width="100" height="144" rx="8" fill="url(#gGreenBlock)"/>` +
    [-32, 32].map((y) => `<circle cx="0" cy="${y}" r="22" fill="url(#gScrew)" stroke="#6d747c" stroke-width="2"/><line x1="-13" y1="${y - 8}" x2="13" y2="${y + 8}" stroke="#5b6168" stroke-width="5"/>`).join('') +
    `<text x="66" y="-20" font-size="40" font-weight="900" fill="#ff5a5a">+</text>` +
    `<text x="68" y="46" font-size="44" font-weight="900" fill="#7fb2ff">−</text>`,
};

// ─── IC chân cắm DIP (nhìn từ trên, khấc bên TRÁI) ────────────────────────
const DIP_PITCH = 40;

function dipPackage(n: number): PartDef {
  const half = n / 2;
  const span = (half - 1) * DIP_PITCH;
  const bodyW = span + 60;
  const pins: Record<string, Point> = {};
  const xs: number[] = [];
  for (let i = 0; i < half; i++) {
    const x = -span / 2 + i * DIP_PITCH;
    xs.push(x);
    pins[String(i + 1)] = { x, y: 80 }; // hàng dưới: 1 → n/2 từ trái sang phải
    pins[String(n - i)] = { x, y: -80 }; // hàng trên: n → n/2+1 từ trái sang phải
  }
  return {
    desc: `IC chân cắm DIP-${n} (${n} chân) — VD ${n === 8 ? 'NE555, LM358, LM386' : n === 14 ? 'CD4011, LM324, 74HC00' : 'CD4017, CD4060, ULN2003'}`,
    w: bodyW, h: 160,
    pins,
    pinNote: `nằm ngang, khấc chữ U ở cạnh TRÁI. Hàng chân DƯỚI chĩa xuống: chân 1 (trái) → ${half} (phải). Hàng chân TRÊN chĩa lên: chân ${n} (trái) → ${half + 1} (phải). Số chân in sẵn trên thân`,
    render: (p) => {
      const legs = xs.map((x) => leg(x, 40, x, 80, 7) + leg(x, -40, x, -80, 7)).join('');
      const nums = xs.map((x, i) =>
        upright(p, x, 30, `<text x="${x}" y="36" font-size="13" font-weight="700" fill="#cfd3d8" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif">${i + 1}</text>`) +
        upright(p, x, -30, `<text x="${x}" y="-24" font-size="13" font-weight="700" fill="#cfd3d8" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif">${n - i}</text>`)).join('');
      return legs +
        `<rect x="${-bodyW / 2}" y="-48" width="${bodyW}" height="96" rx="6" fill="url(#gBlack)"/>` +
        `<rect x="${-bodyW / 2 + 3}" y="-45" width="${bodyW - 6}" height="10" rx="4" fill="#fff" opacity="0.1"/>` +
        `<path d="M ${-bodyW / 2} -14 A 14 14 0 0 1 ${-bodyW / 2} 14 Z" fill="#111"/>` +
        `<circle cx="${xs[0]}" cy="14" r="5" fill="#111"/>` +
        nums +
        (p.marking ? upright(p, 0, 0, `<text x="0" y="7" font-size="20" font-weight="800" fill="#e6e6e6" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif">${esc(p.marking)}</text>`) : '');
    },
  };
}

const mic: PartDef = {
  desc: 'Micro điện dung (electret mic) 2 chân — chân − nối với vỏ nhôm',
  w: 90, h: 160,
  pins: { '+': { x: -16, y: 80 }, '-': { x: 16, y: 80 } },
  pinNote: 'nhìn từ trên xuống mặt lưới, 2 chân chĩa XUỐNG: + trái, − phải (chân − là chân nối vỏ)',
  render: () =>
    leg(-16, 30, -16, 80, 5) + leg(16, 30, 16, 80, 5) +
    `<circle cx="0" cy="-10" r="42" fill="url(#gSilver)" stroke="#8d949c" stroke-width="2"/>` +
    `<circle cx="0" cy="-10" r="32" fill="#1c1c1c"/>` +
    `<circle cx="0" cy="-10" r="32" fill="none" stroke="#3a3a3a" stroke-width="2" stroke-dasharray="2 4"/>` +
    `<ellipse cx="-10" cy="-22" rx="10" ry="6" fill="#fff" opacity="0.12"/>` +
    `<text x="-34" y="66" font-size="20" font-weight="900" fill="#ff5a5a" text-anchor="middle">+</text>` +
    `<text x="34" y="66" font-size="22" font-weight="900" fill="#7fb2ff" text-anchor="middle">−</text>`,
};

const lead: PartDef = {
  desc: 'Đầu dây tự do (đầu vào/ra nguồn), vẽ thành đầu dây tuốt vỏ lộ lõi đồng',
  w: 10, h: 10,
  pins: { p: { x: 0, y: 0 } },
  pinNote: 'chỉ có 1 chân "p" — đặt sát mép ảnh gần dòng tiêu đề; label = chữ ghi cạnh (VD "+", "−", "IN+")',
  render: () => '',
};

const bus: PartDef = {
  desc: 'Thanh đồng làm đường mass chung (nằm ngang)',
  w: 800, h: 16,
  pins: {},
  pinNote: 'nằm ngang, dài theo "length". Dây nối vào thanh dùng cú pháp "<id>@<toạ độ x tuyệt đối>", VD "GND@420"',
  render: (p) => {
    const half = (p.length ?? 800) / 2;
    return `<rect x="${-half}" y="-8" width="${half * 2}" height="16" rx="8" fill="url(#gCopperBar)" stroke="#8a5a2b" stroke-width="1.5"/>` +
      `<rect x="${-half + 4}" y="-6" width="${half * 2 - 8}" height="4" rx="2" fill="#fff" opacity="0.35"/>`;
  },
};

export const PARTS: Record<string, PartDef> = {
  resistor,
  diode,
  cap_elec: capElec,
  cap_ceramic: capCeramic,
  pot,
  to220: to220Part,
  pentawatt: pentawattPart,
  to92,
  to3,
  led,
  speaker,
  jack35,
  dip8: dipPackage(8),
  dip14: dipPackage(14),
  dip16: dipPackage(16),
  mic,
  terminal2,
  lead,
  bus,
  ...POWER_PARTS,
};
