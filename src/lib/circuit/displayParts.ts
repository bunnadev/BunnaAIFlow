import type { PartDef } from './parts';
import type { PlacedPart } from './types';
import { glow, LED_COLORS, tint } from './lightParts';

/**
 * LED 7 đoạn 0.56" của Xưởng vẽ mạch, nhìn thẳng từ trên xuống: loại 1 số (10 chân,
 * VD 5161AS) và 4 số (12 chân, VD 5641AS). Chân thật nằm dưới thân — ở đây vẽ chĩa ra
 * mép trên / dưới (như ảnh breadboard) để nối dây, đúng thứ tự chân của linh kiện thật.
 * Thêm LED ma trận 8×8 (1088AS, 16 chân): value = mẫu chấm sáng (16 ký tự hex).
 *
 * - value: số / chữ hiện khi đang sáng (VD "8.", "12.34"); dấu chấm bật đoạn dp của ký tự trước.
 * - color: màu đoạn sáng (như LED); common: âm chung (CC, mặc định) / dương chung (CA).
 */

const FONT = 'Helvetica Neue, Arial, sans-serif';
const PITCH = 40; // 2.54mm
const BODY_H = 300; // 19mm
const PIN_Y = 185;
const DIGIT_PITCH = 200; // 12.7mm

/** Chân kim loại mạ thiếc (giống parts.ts). */
const leg = (x1: number, y1: number, x2: number, y2: number, w = 7) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#7d848c" stroke-width="${w + 2}" stroke-linecap="round"/>` +
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="url(#gLeg)" stroke-width="${w}" stroke-linecap="round"/>`;

const upright = (p: PlacedPart, x: number, y: number, body: string) => {
  const r = p.rotation ?? 0;
  return r === 90 || r === 180 ? `<g transform="rotate(180 ${x} ${y})">${body}</g>` : body;
};

type Seg = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';

/** Ký tự → các đoạn sáng. Không có trong bảng = để tắt. */
const GLYPHS: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg',
  A: 'abcefg', b: 'cdefg', C: 'adef', c: 'deg', d: 'bcdeg', E: 'adefg', F: 'aefg', G: 'acdef', H: 'bcefg', h: 'cefg',
  I: 'ef', J: 'bcde', L: 'def', n: 'ceg', o: 'cdeg', P: 'abefg', r: 'eg', S: 'acdfg', t: 'defg', U: 'bcdef', u: 'cde', y: 'bcdfg',
  '-': 'g', '_': 'd', ' ': '',
};

function glyph(ch: string): string {
  return GLYPHS[ch] ?? GLYPHS[ch.toUpperCase()] ?? GLYPHS[ch.toLowerCase()] ?? '';
}

export interface Seg7Digit { segs: Set<Seg>; dp: boolean }

/** Chuỗi hiển thị → từng ô số (canh phải như máy tính). "12.34" trên 4 số → 1, 2 + chấm, 3, 4. */
export function seg7Digits(text: string, n: number): Seg7Digit[] {
  const out: Seg7Digit[] = [];
  for (const ch of text) {
    if (ch === '.' || ch === ',') {
      const last = out[out.length - 1];
      if (last && !last.dp) last.dp = true;
      else out.push({ segs: new Set(), dp: true });
    } else {
      out.push({ segs: new Set(glyph(ch).split('') as Seg[]), dp: false });
    }
  }
  const shown = out.slice(0, n);
  while (shown.length < n) shown.unshift({ segs: new Set(), dp: false });
  return shown;
}

export type Seg7Common = 'cathode' | 'anode';

/** Mã linh kiện thật in làm nhãn: A = âm chung (CC), B = dương chung (CA). */
export function seg7Label(type: string, common: Seg7Common | undefined): string {
  const base = type === 'seg7_4' ? '5641' : '5161';
  return `${base}${common === 'anode' ? 'BS' : 'AS'}`;
}

export const seg7Hex = (p: PlacedPart) => (LED_COLORS.find((c) => c.key === p.color) ?? LED_COLORS[0]).hex;

// ─── Hình 1 ô số ──────────────────────────────────────────────────────

const DW = 112, DH = 220, T = 22, GAP = 3;
const SKEW = -8; // nghiêng như LED thật

/** Đoạn lục giác dọc trục ngang / dọc, từ (x0,y0) tới (x1,y1). */
function hexSeg(x0: number, y0: number, x1: number, y1: number): string {
  const h = T / 2;
  if (y0 === y1) {
    const a = x0 + GAP, b = x1 - GAP;
    return `M ${a} ${y0} L ${a + h} ${y0 - h} L ${b - h} ${y0 - h} L ${b} ${y0} L ${b - h} ${y0 + h} L ${a + h} ${y0 + h} Z`;
  }
  const a = y0 + GAP, b = y1 - GAP;
  return `M ${x0} ${a} L ${x0 + h} ${a + h} L ${x0 + h} ${b - h} L ${x0} ${b} L ${x0 - h} ${b - h} L ${x0 - h} ${a + h} Z`;
}

const L = -DW / 2 + T / 2, R = DW / 2 - T / 2, TOP = -DH / 2 + T / 2, BOT = DH / 2 - T / 2;
const SEG_PATHS: Record<Seg, string> = {
  a: hexSeg(L, TOP, R, TOP),
  g: hexSeg(L, 0, R, 0),
  d: hexSeg(L, BOT, R, BOT),
  f: hexSeg(L, TOP, L, 0),
  b: hexSeg(R, TOP, R, 0),
  e: hexSeg(L, 0, L, BOT),
  c: hexSeg(R, 0, R, BOT),
};
const DP = { x: DW / 2 + 14, y: BOT, r: 12 };

function digitSvg(cx: number, d: Seg7Digit | null, hex: string): string {
  const on = (lit: boolean) => lit
    ? `fill="${hex}" stroke="${tint(hex, 0.6)}" stroke-width="2"`
    : 'fill="#b9b4ab" fill-opacity="0.5" stroke="#6e6a64" stroke-width="1"'; // đoạn tắt: xám mờ trên mặt đen
  let s = `<g transform="translate(${cx} 0) skewX(${SKEW})">`;
  for (const k of Object.keys(SEG_PATHS) as Seg[]) s += `<path d="${SEG_PATHS[k]}" ${on(!!d?.segs.has(k))}/>`;
  s += `<circle cx="${DP.x}" cy="${DP.y}" r="${DP.r}" ${on(!!d?.dp)}/>`;
  return s + '</g>';
}

// ─── Linh kiện ────────────────────────────────────────────────────────

interface Layout { n: number; bodyW: number; top: string[]; bottom: string[] }

function seg7(layout: Layout): PartDef {
  const { n, bodyW, top, bottom } = layout;
  const span = (bottom.length - 1) * PITCH;
  const xs = bottom.map((_, i) => -span / 2 + i * PITCH);
  const pins: PartDef['pins'] = {};
  const pinDirs: NonNullable<PartDef['pinDirs']> = {};
  xs.forEach((x, i) => {
    pins[bottom[i]] = { x, y: PIN_Y }; pinDirs[bottom[i]] = 1;
    pins[top[i]] = { x, y: -PIN_Y }; pinDirs[top[i]] = 3;
  });
  const digitXs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * DIGIT_PITCH - 8);
  const total = bottom.length * 2;
  return {
    desc: n === 1
      ? 'LED 7 đoạn 1 số 0.56" (10 chân, VD 5161AS âm chung / 5161BS dương chung) — mỗi đoạn a–g, dp cần 1 điện trở riêng'
      : 'LED 7 đoạn 4 số 0.56" (12 chân, VD 5641AS âm chung / 5641BS dương chung) — quét từng số qua chân D1–D4',
    w: bodyW, h: PIN_Y * 2,
    pins, pinDirs,
    pinNote: `mặt số hướng lên người xem, dấu chấm ở góc dưới-phải. Hàng chân DƯỚI chĩa xuống, trái → phải (chân 1 → ${bottom.length}): ${bottom.join(', ')}. Hàng chân TRÊN chĩa lên, trái → phải (chân ${total} → ${bottom.length + 1}): ${top.join(', ')}`,
    render: (p) => {
      const hex = seg7Hex(p);
      const digits = p.lit ? seg7Digits(p.value ?? '', n) : null;
      const half = BODY_H / 2;
      let s = xs.map((x) => leg(x, half - 4, x, PIN_Y) + leg(x, -half + 4, x, -PIN_Y)).join('');
      // thân: viền nhựa xám + mặt đen
      s += `<rect x="${-bodyW / 2}" y="${-half}" width="${bodyW}" height="${BODY_H}" rx="5" fill="#3a3b40" stroke="#1a1b1e" stroke-width="1.5"/>`;
      s += `<rect x="${-bodyW / 2 + 7}" y="${-half + 7}" width="${bodyW - 14}" height="${BODY_H - 14}" rx="3" fill="url(#gBlack)"/>`;
      s += digitXs.map((cx, i) => digitSvg(cx, digits ? digits[i] : null, hex)).join('');
      // tên chân in mờ sát mép, ngay trên chân (giúp người mới nối dây)
      const pinText = (x: number, y: number, t: string) =>
        upright(p, x, y - 5, `<text x="${x}" y="${y}" font-family="${FONT}" font-size="13" font-weight="700" fill="#9aa0a7" text-anchor="middle">${t}</text>`);
      s += xs.map((x, i) => pinText(x, half - 13, bottom[i]) + pinText(x, -half + 26, top[i])).join('');
      return s;
    },
    renderGlow: (p) => {
      if (!p.lit) return '';
      const hex = seg7Hex(p);
      return seg7Digits(p.value ?? '', n)
        .map((d, i) => (d.segs.size || d.dp ? glow(hex, digitXs[i], 0, 150, 0.5) : ''))
        .join('');
    },
  };
}

// ─── LED ma trận 8×8 (1088AS, 32×32mm, 16 chân) ───────────────────────────

/** Mẫu 8×8 lưu trong value: 16 ký tự hex = 8 hàng từ trên xuống, bit cao = cột 1 (trái). */
export const MATRIX_PRESETS: { key: string; name: string; value: string }[] = [
  { key: 'heart', name: 'Trái tim', value: '66FFFFFF7E3C1800' },
  { key: 'smile', name: 'Mặt cười', value: '3C42A581A599423C' },
  { key: 'arrow', name: 'Mũi tên', value: '183C7EFF18181818' },
  { key: 'check', name: 'Dấu tích', value: '0001030686CC7830' },
  { key: 'all', name: 'Sáng hết', value: 'FFFFFFFFFFFFFFFF' },
  { key: 'none', name: 'Xoá', value: '0000000000000000' },
];

/** value → lưới 8×8 (true = sáng). Thiếu / sai ký tự thì coi là tắt. */
export function matrixGrid(value: string | undefined): boolean[][] {
  const hex = (value ?? '').replace(/[^0-9a-f]/gi, '').padEnd(16, '0').slice(0, 16);
  return Array.from({ length: 8 }, (_, r) => {
    const byte = parseInt(hex.slice(r * 2, r * 2 + 2), 16);
    return Array.from({ length: 8 }, (_, c) => !!(byte & (0x80 >> c)));
  });
}

/** Lưới 8×8 → value (16 ký tự hex). */
export function matrixValue(grid: boolean[][]): string {
  return grid.map((row) => row.reduce((b, on, c) => b | (on ? 0x80 >> c : 0), 0).toString(16).toUpperCase().padStart(2, '0')).join('');
}

const MX_BODY = 504; // 32mm
const MX_PIN_Y = 287;
const DOT_PITCH = 56; // ~4mm, chừa mép in tên chân
const DOT_R = 20; // chấm 3mm
const dotXY = (i: number) => (i - 3.5) * DOT_PITCH;

// Sơ đồ chân 1088AS phổ biến (theo bài Row-Column Scanning của Arduino):
// chân 1–8 hàng DƯỚI trái → phải, chân 16–9 hàng TRÊN trái → phải.
const MX_BOTTOM = ['R5', 'R7', 'C2', 'C3', 'R8', 'C5', 'R6', 'R3'];
const MX_TOP = ['C8', 'C7', 'R2', 'C1', 'R4', 'C6', 'C4', 'R1'];

const ledMatrix: PartDef = (() => {
  const xs = MX_BOTTOM.map((_, i) => (i - 3.5) * PITCH);
  const pins: PartDef['pins'] = {};
  const pinDirs: NonNullable<PartDef['pinDirs']> = {};
  xs.forEach((x, i) => {
    pins[MX_BOTTOM[i]] = { x, y: MX_PIN_Y }; pinDirs[MX_BOTTOM[i]] = 1;
    pins[MX_TOP[i]] = { x, y: -MX_PIN_Y }; pinDirs[MX_TOP[i]] = 3;
  });
  return {
    desc: 'LED ma trận 8×8 chấm 3mm (VD 1088AS, 16 chân) — R1–R8 là 8 hàng, C1–C8 là 8 cột; quét từng hàng (hoặc dùng IC MAX7219)',
    w: MX_BODY, h: MX_PIN_Y * 2,
    pins, pinDirs,
    pinNote: `mặt chấm hướng lên người xem. Hàng chân DƯỚI chĩa xuống, trái → phải (chân 1 → 8): ${MX_BOTTOM.join(', ')}. Hàng chân TRÊN chĩa lên, trái → phải (chân 16 → 9): ${MX_TOP.join(', ')}. R = hàng (R1 trên cùng), C = cột (C1 bên trái)`,
    render: (p) => {
      const hex = seg7Hex(p);
      const grid = p.lit ? matrixGrid(p.value) : null;
      const half = MX_BODY / 2;
      let s = xs.map((x) => leg(x, half - 4, x, MX_PIN_Y) + leg(x, -half + 4, x, -MX_PIN_Y)).join('');
      s += `<rect x="${-half}" y="${-half}" width="${MX_BODY}" height="${MX_BODY}" rx="5" fill="#3a3b40" stroke="#1a1b1e" stroke-width="1.5"/>`;
      s += `<rect x="${-half + 7}" y="${-half + 7}" width="${MX_BODY - 14}" height="${MX_BODY - 14}" rx="3" fill="url(#gBlack)"/>`;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const on = !!grid?.[r][c];
          const cx = dotXY(c), cy = dotXY(r);
          s += on
            ? `<circle cx="${cx}" cy="${cy}" r="${DOT_R}" fill="${hex}" stroke="${tint(hex, 0.6)}" stroke-width="2"/>` +
              `<circle cx="${cx - 6}" cy="${cy - 6}" r="7" fill="#fff" opacity="0.45"/>`
            : `<circle cx="${cx}" cy="${cy}" r="${DOT_R}" fill="#b9b4ab" fill-opacity="0.4" stroke="#6e6a64" stroke-width="1"/>`;
        }
      }
      // tên chân in mờ sát mép trên / dưới, giữa các hàng chấm và mép thân
      const pinText = (x: number, y: number, t: string) =>
        upright(p, x, y - 5, `<text x="${x}" y="${y}" font-family="${FONT}" font-size="13" font-weight="700" fill="#9aa0a7" text-anchor="middle">${t}</text>`);
      s += xs.map((x, i) => pinText(x, half - 11, MX_BOTTOM[i]) + pinText(x, -half + 24, MX_TOP[i])).join('');
      return s;
    },
    renderGlow: (p) => {
      if (!p.lit) return '';
      const hex = seg7Hex(p);
      const grid = matrixGrid(p.value);
      const spots: string[] = [];
      grid.forEach((row, r) => row.forEach((on, c) => { if (on) spots.push(`${dotXY(c)} ${dotXY(r)}`); }));
      if (!spots.length) return '';
      // 1 gradient dùng chung cho mọi chấm (glow() sinh defs + chấm đầu tiên)
      const [first, ...rest] = spots.map((xy) => xy.split(' ').map(Number));
      const id = `lt_glow_${hex.slice(1)}_45`;
      return glow(hex, first[0], first[1], 70, 0.45) +
        rest.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="70" fill="url(#${id})" style="mix-blend-mode:screen"/>`).join('');
    },
  };
})();

export const DISPLAY_PARTS: Record<string, PartDef> = {
  // 5161AS: chân 1–5 dưới (e d COM c dp), chân 10–6 trên (g f COM a b) — 2 chân COM thông nhau
  seg7_1: seg7({ n: 1, bodyW: 200, bottom: ['e', 'd', 'COM1', 'c', 'dp'], top: ['g', 'f', 'COM2', 'a', 'b'] }),
  // 5641AS: chân 1–6 dưới (e d dp c g D4), chân 12–7 trên (D1 a f D2 D3 b)
  seg7_4: seg7({ n: 4, bodyW: 794, bottom: ['e', 'd', 'dp', 'c', 'g', 'D4'], top: ['D1', 'a', 'f', 'D2', 'D3', 'b'] }),
  led_matrix: ledMatrix,
};
export const SEG7_TYPES = new Set(['seg7_1', 'seg7_4']);
