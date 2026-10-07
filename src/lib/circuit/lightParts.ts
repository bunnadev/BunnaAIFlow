import type { PartDef } from './parts';
import type { PlacedPart } from './types';

/**
 * Đèn của Xưởng vẽ mạch: màu LED, trạng thái "đang sáng" (quầng sáng) và bóng đèn
 * sợi đốt (V / W). Quầng sáng vẽ ở lớp riêng phía trên dây (renderGlow) để ánh
 * sáng tràn lên dây xung quanh như đèn thật.
 */

const FONT = 'Helvetica Neue, Arial, sans-serif';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export type LedColor = 'red' | 'green' | 'blue' | 'yellow' | 'white';
export const LED_COLORS: { key: LedColor; name: string; hex: string }[] = [
  { key: 'red', name: 'Đỏ', hex: '#ff3b3b' },
  { key: 'green', name: 'Xanh lá', hex: '#36d16a' },
  { key: 'blue', name: 'Xanh dương', hex: '#3b7bff' },
  { key: 'yellow', name: 'Vàng', hex: '#ffd21f' },
  { key: 'white', name: 'Trắng', hex: '#f2f6ff' },
];

/** Pha màu với trắng (t = 0..1) — thân LED đang sáng nhạt và rực hơn. */
export function tint(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.round(((n >> s) & 255) + (255 - ((n >> s) & 255)) * t).toString(16).padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

/** Quầng sáng tròn mờ dần, tâm (cx, cy), bán kính r. id gradient theo màu (trùng id thì nội dung y hệt). */
export function glow(hex: string, cx: number, cy: number, r: number, strength = 0.6): string {
  const id = `lt_glow_${hex.slice(1)}_${Math.round(strength * 100)}`;
  return `<defs><radialGradient id="${id}">` +
    `<stop offset="0" stop-color="${hex}" stop-opacity="${strength}"/>` +
    `<stop offset="0.3" stop-color="${hex}" stop-opacity="${(strength * 0.45).toFixed(3)}"/>` +
    `<stop offset="0.65" stop-color="${hex}" stop-opacity="${(strength * 0.12).toFixed(3)}"/>` +
    `<stop offset="1" stop-color="${hex}" stop-opacity="0"/></radialGradient></defs>` +
    // hoà sáng kiểu "screen": ánh sáng cộng vào nền (gỗ, dây) như đèn thật, không phủ đục
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id})" style="mix-blend-mode:screen"/>`;
}

/** Thân LED đang sáng: bóng nhạt màu, lõi trắng rực, chân như cũ. */
export function litLedBody(c: string, leg: string): string {
  const id = `lt_core_${c.slice(1)}`;
  return leg +
    `<defs><radialGradient id="${id}" cx="0.5" cy="0.55" r="0.5">` +
    `<stop offset="0" stop-color="#ffffff"/><stop offset="0.35" stop-color="${tint(c, 0.75)}"/><stop offset="1" stop-color="${tint(c, 0.1)}"/></radialGradient></defs>` +
    `<rect x="-30" y="-6" width="60" height="12" rx="3" fill="${tint(c, 0.15)}"/>` +
    `<path d="M -26 0 L -26 -40 A 26 26 0 0 1 26 -40 L 26 0 Z" fill="url(#${id})"/>` +
    `<ellipse cx="-11" cy="-50" rx="5" ry="9" fill="#fff" opacity="0.75"/>`;
}

// ─── Bóng đèn sợi đốt ────────────────────────────────────────────────────

/** Nhãn tự sinh của bóng đèn: "12V 5W" (bỏ W nếu để trống). */
export function bulbLabel(p: Pick<PlacedPart, 'value' | 'marking'>): string {
  const v = (p.value ?? '').trim(), w = (p.marking ?? '').trim();
  return [v && `${v}V`, w && `${w}W`].filter(Boolean).join(' ');
}

const WARM = '#ffc845';

const bulb: PartDef = {
  desc: 'Bóng đèn sợi đốt trên đế 2 chân (value = điện áp V, marking = công suất W)',
  w: 160, h: 300,
  pins: { '1': { x: -40, y: 150 }, '2': { x: 40, y: 150 } },
  pinDirs: { '1': 1, '2': 1 },
  pinNote: 'bóng ở trên, đế đen ở dưới, 2 chân chĩa XUỐNG: chân 1 trái, chân 2 phải',
  render: (p) => {
    const on = !!p.lit;
    let s = '<defs>' +
      '<linearGradient id="lt_base" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8b9299"/><stop offset="0.35" stop-color="#eef1f4"/><stop offset="0.6" stop-color="#b7bec5"/><stop offset="1" stop-color="#6c737a"/></linearGradient>' +
      '<radialGradient id="lt_glass" cx="0.38" cy="0.32" r="0.75"><stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/><stop offset="0.6" stop-color="#cfe3f0" stop-opacity="0.22"/><stop offset="1" stop-color="#9fb8c8" stop-opacity="0.35"/></radialGradient>' +
      '<radialGradient id="lt_glass_on" cx="0.5" cy="0.45" r="0.7"><stop offset="0" stop-color="#ffffff"/><stop offset="0.35" stop-color="#fff6c8"/><stop offset="1" stop-color="#ffd15a"/></radialGradient>' +
      '</defs>';
    // chân + đế đen 2 cọc vít
    s += `<line x1="-40" y1="118" x2="-40" y2="150" stroke="#7d848c" stroke-width="9" stroke-linecap="round"/><line x1="-40" y1="118" x2="-40" y2="150" stroke="url(#gLeg)" stroke-width="6" stroke-linecap="round"/>`;
    s += `<line x1="40" y1="118" x2="40" y2="150" stroke="#7d848c" stroke-width="9" stroke-linecap="round"/><line x1="40" y1="118" x2="40" y2="150" stroke="url(#gLeg)" stroke-width="6" stroke-linecap="round"/>`;
    s += `<rect x="-72" y="56" width="144" height="66" rx="10" fill="url(#gBlack)" stroke="#000" stroke-width="1.5"/>`;
    s += `<rect x="-68" y="59" width="136" height="9" rx="4" fill="#fff" opacity="0.12"/>`;
    for (const x of [-40, 40]) s += `<circle cx="${x}" cy="94" r="13" fill="url(#gScrew)" stroke="#5b6168" stroke-width="1.5"/><line x1="${x - 8}" y1="89" x2="${x + 8}" y2="99" stroke="#5b6168" stroke-width="3.5"/>`;
    // đuôi xoáy kim loại
    s += `<rect x="-32" y="4" width="64" height="54" rx="6" fill="url(#lt_base)" stroke="#5f666d" stroke-width="1.5"/>`;
    for (const y of [12, 24, 36, 48]) s += `<path d="M -32 ${y} Q 0 ${y + 6} 32 ${y}" fill="none" stroke="#5f666d" stroke-width="2" opacity="0.7"/>`;
    const txt = bulbLabel(p);
    if (txt) s += `<text x="0" y="34" font-family="${FONT}" font-size="11" font-weight="800" fill="#2b2f33" text-anchor="middle">${esc(txt)}</text>`;
    // bóng thuỷ tinh
    const glass = 'M -20 6 L -22 -26 C -64 -44 -78 -96 -60 -132 C -44 -166 44 -166 60 -132 C 78 -96 64 -44 22 -26 L 20 6 Z';
    s += `<path d="${glass}" fill="${on ? 'url(#lt_glass_on)' : 'url(#lt_glass)'}" stroke="${on ? '#ffe27a' : '#e6f0f6'}" stroke-opacity="${on ? 1 : 0.7}" stroke-width="2.5"/>`;
    // dây đỡ + sợi tóc
    const fil = 'M -22 -92 l 5 -7 l 5 7 l 5 -7 l 5 7 l 5 -7 l 5 7 l 5 -7 l 5 7';
    s += `<path d="M -12 4 L -14 -40 L -22 -92 M 12 4 L 14 -40 L 22 -92" fill="none" stroke="${on ? '#d8b25a' : '#8f979e'}" stroke-width="2.5"/>`;
    s += `<path d="M -14 -40 L 0 -54 L 14 -40" fill="none" stroke="#cfd6dc" stroke-opacity="0.6" stroke-width="5"/>`;
    s += on
      ? `<path d="${fil}" fill="none" stroke="#ff9d1c" stroke-width="6" stroke-linejoin="round"/><path d="${fil}" fill="none" stroke="#fffbe8" stroke-width="2.5" stroke-linejoin="round"/>`
      : `<path d="${fil}" fill="none" stroke="#5a4a3c" stroke-width="2.5" stroke-linejoin="round"/>`;
    // bóng sáng trên kính
    s += `<path d="M -42 -120 C -40 -140 -24 -152 -6 -154" fill="none" stroke="#fff" stroke-opacity="${on ? 0.9 : 0.75}" stroke-width="7" stroke-linecap="round"/>`;
    s += `<ellipse cx="38" cy="-80" rx="6" ry="14" fill="#fff" opacity="0.35"/>`;
    return s;
  },
  renderGlow: (p) => (p.lit ? glow(WARM, 0, -92, 280, 0.85) : ''),
};

export const LIGHT_PARTS: Record<string, PartDef> = { bulb };
export const LIGHT_TYPES = new Set(Object.keys(LIGHT_PARTS));
