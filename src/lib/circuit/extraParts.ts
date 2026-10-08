import type { PartDef } from './parts';
import { resistorBands } from './bands';
import type { PlacedPart } from './types';
import { glow } from './lightParts';

/**
 * Linh kiện bổ sung của Xưởng vẽ mạch: điện trở xi măng, điện trở công suất dạng
 * ống, đèn LED bảng (COB), que đo VOM, loa kiểu thật (mặt trước / mặt sau).
 */

const FONT = 'Helvetica Neue, Arial, sans-serif';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Chân kim loại mạ thiếc (giống parts.ts). */
const leg = (x1: number, y1: number, x2: number, y2: number, w = 7) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#7d848c" stroke-width="${w + 2}" stroke-linecap="round"/>` +
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="url(#gLeg)" stroke-width="${w}" stroke-linecap="round"/>`;

/** Chữ đọc xuôi khi linh kiện xoay 90° / 180°. */
const upright = (p: PlacedPart, x: number, y: number, body: string) => {
  const r = p.rotation ?? 0;
  return r === 90 || r === 180 ? `<g transform="rotate(180 ${x} ${y})">${body}</g>` : body;
};

/** Nhãn tự sinh "33Ω 5W" từ value (Ω) và marking (W); bỏ phần trống. */
export function ohmWattLabel(p: Pick<PlacedPart, 'value' | 'marking'>): string {
  const v = (p.value ?? '').trim(), w = (p.marking ?? '').trim();
  return [v && `${v}Ω`, w && `${w}W`].filter(Boolean).join(' ');
}

const DEFS =
  '<defs>' +
  '<linearGradient id="xp_cement" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="#eeeee6"/><stop offset="1" stop-color="#c9c9be"/></linearGradient>' +
  '<linearGradient id="xp_tube" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3f5f8"/><stop offset="0.35" stop-color="#dfe3e9"/><stop offset="0.75" stop-color="#b9c0c9"/><stop offset="1" stop-color="#8f98a3"/></linearGradient>' +
  '<linearGradient id="xp_board" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e6e7e3"/><stop offset="0.5" stop-color="#fbfbf9"/><stop offset="1" stop-color="#e2e3df"/></linearGradient>' +
  '<radialGradient id="xp_cob_on" cx="0.5" cy="0.5" r="0.6"><stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#fffbe6"/><stop offset="1" stop-color="#fff1a8"/></radialGradient>' +
  '<linearGradient id="xp_probe_red" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a0b10"/><stop offset="0.35" stop-color="#e5252c"/><stop offset="0.6" stop-color="#ff5a5f"/><stop offset="1" stop-color="#8e0e14"/></linearGradient>' +
  '<linearGradient id="xp_probe_black" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#050506"/><stop offset="0.4" stop-color="#2b2d31"/><stop offset="0.6" stop-color="#4a4d52"/><stop offset="1" stop-color="#0b0b0d"/></linearGradient>' +
  '<radialGradient id="xp_cone" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#3a3b40"/><stop offset="0.7" stop-color="#1d1e22"/><stop offset="1" stop-color="#121316"/></radialGradient>' +
  '<radialGradient id="xp_cap" cx="0.38" cy="0.32" r="0.7"><stop offset="0" stop-color="#7c7f86"/><stop offset="0.45" stop-color="#26272b"/><stop offset="1" stop-color="#060607"/></radialGradient>' +
  '</defs>';

// ─── Điện trở xi măng (khối sứ trắng, chữ in) ─────────────────────────────

const resCement: PartDef = {
  desc: 'Điện trở xi măng (khối sứ trắng chữ nhật, công suất lớn) — value = Ω, marking = W',
  w: 250, h: 56,
  pins: { '1': { x: -125, y: 0 }, '2': { x: 125, y: 0 } },
  pinDirs: { '1': 2, '2': 0 },
  pinNote: 'nằm ngang, chân 1 trái, chân 2 phải',
  render: (p) => {
    const txt = `${(p.marking ?? '').trim() ? `${p.marking!.trim()}W ` : ''}${(p.value ?? '').trim()}ΩJ`;
    let s = DEFS + leg(-125, 0, -74, 0, 6) + leg(74, 0, 125, 0, 6);
    s += `<rect x="-78" y="-26" width="156" height="52" rx="4" fill="url(#xp_cement)" stroke="#a9a99c" stroke-width="1.5"/>`;
    // hạt sứ lấm tấm
    for (const [x, y] of [[-60, -14], [-38, 15], [-12, -18], [22, 17], [48, -12], [64, 13], [-66, 8], [8, -6]]) s += `<circle cx="${x}" cy="${y}" r="1.4" fill="#b4b4a8"/>`;
    s += `<rect x="-76" y="-24" width="152" height="8" rx="3" fill="#fff" opacity="0.6"/>`;
    s += upright(p, 0, 0, `<text x="0" y="7" font-family="${FONT}" font-size="19" font-weight="800" fill="#1d1d1d" text-anchor="middle">${esc(txt)}</text>`);
    return s;
  },
};

// ─── Điện trở công suất dạng ống (1–3W, vạch màu) ─────────────────────────

const resPower: PartDef = {
  desc: 'Điện trở công suất 1–3W dạng ống to, vạch màu theo value (Ω)',
  w: 260, h: 56,
  pins: { '1': { x: -130, y: 0 }, '2': { x: 130, y: 0 } },
  pinDirs: { '1': 2, '2': 0 },
  pinNote: 'nằm ngang, chân 1 trái, chân 2 phải',
  render: (p) => {
    const b = resistorBands(p.value);
    let s = DEFS + leg(-130, 0, -76, 0, 6) + leg(76, 0, 130, 0, 6);
    // thân ống phình 2 đầu
    s += `<path d="M -80 -22 Q -84 -26 -76 -26 L -60 -26 Q -54 -22 -48 -22 L 48 -22 Q 54 -22 60 -26 L 76 -26 Q 84 -26 80 -22 L 80 22 Q 84 26 76 26 L 60 26 Q 54 22 48 22 L -48 22 Q -54 22 -60 26 L -76 26 Q -84 26 -80 22 Z" fill="url(#xp_tube)" stroke="#8b939d" stroke-width="1.5"/>`;
    const band = (x: number, w: number, c: string, tall: boolean) =>
      `<rect x="${x}" y="${tall ? -26 : -22}" width="${w}" height="${tall ? 52 : 44}" fill="${c}"/>`;
    s += band(-66, 9, b[0], true) + band(-36, 8, b[1], false) + band(-14, 8, b[2], false) + band(52, 9, b[3], true);
    s += `<rect x="-78" y="-23" width="156" height="8" rx="4" fill="#fff" opacity="0.45"/>`;
    return s;
  },
};

// ─── Đèn LED bảng COB ────────────────────────────────────────────────────

const COB_PAD_Y = 172;

const cob: PartDef = {
  desc: 'Đèn LED bảng COB (bảng nhôm trắng, mảng phốt-pho vàng), 2 pad + / − ở đầu dưới',
  w: 120, h: 420,
  pins: { '+': { x: -28, y: COB_PAD_Y }, '-': { x: 28, y: COB_PAD_Y } },
  pinDirs: { '+': 1, '-': 1 },
  straightOut: true,
  pinNote: 'bảng dựng đứng, 2 pad hàn ở đầu DƯỚI: + trái, − phải',
  render: (p) => {
    const on = !!p.lit;
    let s = DEFS;
    // bảng nhôm, 4 góc khuyết
    s += `<path d="M -52 -210 L 52 -210 L 52 -200 L 60 -196 L 60 196 L 52 200 L 52 210 L -52 210 L -52 200 L -60 196 L -60 -196 L -52 -200 Z" fill="url(#xp_board)" stroke="#bfc1bb" stroke-width="2"/>`;
    // pad trên (trang trí) + pad dưới (chân nối)
    const pads = (y: number) =>
      `<ellipse cx="-28" cy="${y}" rx="11" ry="14" fill="#d5a06a"/><rect x="18" y="${y - 13}" width="20" height="26" rx="2" fill="#d5a06a"/>` +
      `<text x="-10" y="${y + 6}" font-family="${FONT}" font-size="15" font-weight="900" fill="#222">+</text>` +
      `<text x="6" y="${y + 6}" font-family="${FONT}" font-size="15" font-weight="900" fill="#222">−</text>`;
    s += pads(-186) + pads(COB_PAD_Y);
    // 2 điện trở dán
    const smd = (y: number, t: string) =>
      `<rect x="-24" y="${y - 9}" width="48" height="18" rx="2" fill="#2a2b2e"/><rect x="-24" y="${y - 9}" width="8" height="18" fill="#c9ced3"/><rect x="16" y="${y - 9}" width="8" height="18" fill="#c9ced3"/>` +
      `<text x="0" y="${y + 5}" font-family="${FONT}" font-size="11" font-weight="700" fill="#e8e8e8" text-anchor="middle">${t}</text>`;
    s += smd(-150, '305') + smd(140, '201');
    // mảng phốt-pho
    s += `<rect x="-42" y="-128" width="84" height="250" rx="8" fill="#ece9da" stroke="#d4d0bd" stroke-width="2"/>`;
    s += on
      ? `<rect x="-36" y="-122" width="72" height="238" rx="5" fill="url(#xp_cob_on)"/>`
      : `<rect x="-36" y="-122" width="72" height="238" rx="5" fill="#efe23f"/>` +
        Array.from({ length: 8 }, (_, i) => `<rect x="-6" y="${-110 + i * 30}" width="12" height="6" rx="1" fill="#d8c92c"/>`).join('');
    s += `<text x="52" y="0" font-family="${FONT}" font-size="12" font-weight="800" fill="#333" text-anchor="middle" transform="rotate(-90 52 0)">COB LED ${esc((p.value ?? '').trim() || '12')}V</text>`;
    return s;
  },
  renderGlow: (p) => (p.lit ? glow('#fff3c4', 0, -6, 330, 0.9) : ''),
};

// ─── Que đo VOM ──────────────────────────────────────────────────────────

const PROBE_TIP = 230;

function probe(color: 'red' | 'black'): PartDef {
  return {
    desc: `Que đo đồng hồ VOM màu ${color === 'red' ? 'đỏ (+)' : 'đen (COM)'} — đầu kim chạm vào chân cần đo`,
    w: 64, h: 460,
    pins: { tip: { x: 0, y: PROBE_TIP } },
    pinDirs: { tip: 1 },
    pinNote: 'dựng đứng, đầu kim chĩa XUỐNG (chân "tip"), dây cáp ra phía trên',
    render: () => {
      const g = `url(#xp_probe_${color})`;
      const cable = color === 'red' ? ['#8f1414', '#e32b2b'] : ['#000', '#2a2a2e'];
      let s = DEFS;
      // dây cáp lượn ra phía trên
      s += `<path d="M 0 -120 C 0 -170 -22 -190 -14 -230" fill="none" stroke="${cable[0]}" stroke-width="15" stroke-linecap="round"/>`;
      s += `<path d="M 0 -120 C 0 -170 -22 -190 -14 -230" fill="none" stroke="${cable[1]}" stroke-width="11" stroke-linecap="round"/>`;
      // đuôi chống gập + thân cầm có khía + gờ chặn ngón
      s += `<path d="M -9 -150 L 9 -150 L 13 -100 L -13 -100 Z" fill="${g}"/>`;
      s += `<rect x="-20" y="-104" width="40" height="190" rx="16" fill="${g}" stroke="#00000055" stroke-width="1"/>`;
      for (let y = -80; y <= 40; y += 14) s += `<rect x="-20" y="${y}" width="40" height="4" fill="#000" opacity="0.18"/>`;
      s += `<ellipse cx="0" cy="92" rx="30" ry="9" fill="${g}" stroke="#00000055" stroke-width="1"/>`;
      s += `<path d="M -14 96 L 14 96 L 8 128 L -8 128 Z" fill="${g}"/>`;
      s += `<rect x="-14" y="-100" width="6" height="180" rx="3" fill="#fff" opacity="0.25"/>`;
      // kim đo
      s += `<path d="M -4 126 L 4 126 L 3 ${PROBE_TIP - 14} L 0 ${PROBE_TIP} L -3 ${PROBE_TIP - 14} Z" fill="url(#gLeg)" stroke="#6f767d" stroke-width="1.2"/>`;
      return s;
    },
  };
}

// ─── Loa kiểu thật (mặt trước / mặt sau) ─────────────────────────────────

/** Loa vẽ theo ảnh thật; 2 cọc hàn ở mép trên giữ đúng vị trí chân của loa cũ (±40, −170). */
export function speakerReal(p: PlacedPart): string {
  let s = DEFS;
  const holes = [45, 135, 225, 315].map((a) => {
    const r = (a * Math.PI) / 180, x = Math.cos(r) * 128, y = Math.sin(r) * 128;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11" fill="#d9d9d4"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11" fill="none" stroke="#000" stroke-width="2"/>`;
  }).join('');
  // cọc hàn trên mép
  for (const x of [-40, 40]) s += `<rect x="${x - 10}" y="-176" width="20" height="34" rx="3" fill="url(#gSilver)" stroke="#7d848c" stroke-width="1.5"/><circle cx="${x}" cy="-164" r="4" fill="#4a4f55"/>`;
  s += `<circle cx="0" cy="0" r="152" fill="#1b1c1f" stroke="#050506" stroke-width="3"/>`;
  s += `<circle cx="0" cy="0" r="150" fill="none" stroke="#3a3c41" stroke-width="2"/>`;
  s += holes;
  if (p.view === 'back') {
    s += `<circle cx="0" cy="0" r="108" fill="#0c0c0e"/>`;
    s += `<circle cx="0" cy="0" r="94" fill="#1e1f23" stroke="#33353a" stroke-width="3"/>`;
    s += `<circle cx="0" cy="0" r="80" fill="#f4f4f1"/>`;
    s += `<rect x="-46" y="-60" width="92" height="28" rx="2" fill="#d42a2a"/><text x="0" y="-40" font-family="${FONT}" font-size="15" font-weight="900" fill="#fff" text-anchor="middle">SPEAKER</text>`;
    const v = (p.value ?? '').trim(), w = (p.marking ?? '').trim();
    const lines = [v && `IMPEDANCE  ${v}Ω`, w && `POWER  ${w}W`, 'DO NOT BLOCK VENTS'].filter(Boolean) as string[];
    lines.forEach((t, i) => { s += `<text x="0" y="${-6 + i * 20}" font-family="${FONT}" font-size="${i === lines.length - 1 ? 9 : 12}" font-weight="800" fill="#222" text-anchor="middle">${esc(t)}</text>`; });
  } else {
    s += `<circle cx="0" cy="0" r="122" fill="#242529" stroke="#0b0b0d" stroke-width="3"/>`;
    s += `<circle cx="0" cy="0" r="112" fill="url(#xp_cone)"/>`;
    for (const r of [96, 80, 64]) s += `<circle cx="0" cy="0" r="${r}" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="1.5"/>`;
    s += `<circle cx="0" cy="0" r="40" fill="url(#xp_cap)"/>`;
    s += `<ellipse cx="-12" cy="-16" rx="13" ry="8" fill="#fff" opacity="0.55"/>`;
    s += `<path d="M -6 40 L -10 64 M 6 40 L 10 64" stroke="#0a0a0b" stroke-width="5" stroke-linecap="round"/>`;
  }
  s += `<text x="-40" y="-184" font-size="20" font-weight="900" fill="#ff4d4d" text-anchor="middle">+</text>`;
  s += `<text x="40" y="-184" font-size="22" font-weight="900" fill="#cfd6df" text-anchor="middle">−</text>`;
  return s;
}

// ─── Quạt tản nhiệt (khung vuông, 2 dây ra bên trái) ─────────────────────

/** Một cánh quạt cong quanh tâm, xoay theo góc a (độ). */
const fanBlade = (a: number, fill: string, opacity = 1) =>
  `<path d="M 26 -8 C 40 -30 62 -40 72 -26 C 64 -18 50 -6 36 10 Z" fill="${fill}" stroke="#4a4e55" stroke-width="1.2" opacity="${opacity}" transform="rotate(${a})"/>`;

const fan: PartDef = {
  desc: 'Quạt tản nhiệt DC khung vuông (dây đỏ +, đen −) — value = điện áp V',
  w: 230, h: 170,
  pins: { '+': { x: -115, y: 30 }, '-': { x: -115, y: 52 } },
  pinDirs: { '+': 2, '-': 2 },
  pinNote: 'nhìn thẳng mặt quạt, 2 dây đỏ (+) / đen (−) thò ra cạnh TRÁI',
  render: (p) => {
    const cx = 30; // tâm quạt (khung 170×170 lệch phải, chừa chỗ dây bên trái)
    const on = !!p.lit;
    let s = DEFS;
    // dây ra bên trái
    const lead = (y: number, main: string, dark: string) =>
      `<path d="M -55 ${y} L -100 ${y}" stroke="${dark}" stroke-width="10" stroke-linecap="round"/>` +
      `<path d="M -55 ${y} L -100 ${y}" stroke="${main}" stroke-width="7" stroke-linecap="round"/>` +
      `<path d="M -100 ${y} L -115 ${y}" stroke="#c9ced3" stroke-width="4" stroke-linecap="round"/>`;
    s += lead(30, '#e32b2b', '#8f1414') + lead(52, '#2a2a2e', '#6a6a72');
    // khung
    s += `<rect x="${cx - 85}" y="-85" width="170" height="170" rx="12" fill="#17181b" stroke="#000" stroke-width="2"/>`;
    s += `<rect x="${cx - 82}" y="-82" width="164" height="10" rx="5" fill="#fff" opacity="0.08"/>`;
    for (const [dx, dy] of [[-66, -66], [66, -66], [-66, 66], [66, 66]]) s += `<circle cx="${cx + dx}" cy="${dy}" r="9" fill="#e9e9e6"/><circle cx="${cx + dx}" cy="${dy}" r="9" fill="none" stroke="#000" stroke-width="2"/>`;
    s += `<circle cx="${cx}" cy="0" r="78" fill="#d7dbe0"/><circle cx="${cx}" cy="0" r="76" fill="#0d0e10"/>`;
    // 3 thanh đỡ động cơ
    for (const a of [30, 150, 270]) s += `<rect x="0" y="-3" width="76" height="6" fill="#1d1e21" transform="translate(${cx} 0) rotate(${a})"/>`;
    // cánh quạt
    s += `<g transform="translate(${cx} 0)">`;
    if (on) {
      s += `<circle cx="0" cy="0" r="72" fill="#2a2c30" opacity="0.55"/>`;
      for (let i = 0; i < 9; i++) s += fanBlade(i * 40, '#3a3d42', 0.35) + fanBlade(i * 40 + 14, '#3a3d42', 0.2);
      for (const r of [50, 62]) s += `<path d="M ${r} 0 A ${r} ${r} 0 0 1 ${-r * 0.5} ${r * 0.87}" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="2.5" stroke-linecap="round"/>`;
    } else {
      for (let i = 0; i < 9; i++) s += fanBlade(i * 40, '#2e3136') + `<path d="M 36 -6 C 46 -22 60 -30 68 -24" fill="none" stroke="#fff" stroke-opacity="0.22" stroke-width="2" transform="rotate(${i * 40})"/>`;
    }
    s += `<circle cx="0" cy="0" r="34" fill="#141518" stroke="#2c2e33" stroke-width="2"/><circle cx="-10" cy="-10" r="10" fill="#fff" opacity="0.06"/>`;
    s += `<circle cx="-4" cy="0" r="2.5" fill="#3d4046"/><circle cx="4" cy="2" r="2" fill="#3d4046"/>`;
    s += `</g>`;
    return s;
  },
};

// ─── Motor DC (kiểu 775: vỏ bạc, trục 2 đầu, 2 cọc hàn) ─────────────────

const motor: PartDef = {
  desc: 'Motor DC vỏ bạc (kiểu 775), trục 2 đầu, 2 cọc hàn ở đầu sau — value = điện áp V',
  w: 280, h: 190,
  pins: { '+': { x: 70, y: -95 }, '-': { x: 70, y: 95 } },
  pinDirs: { '+': 3, '-': 1 },
  pinNote: 'nằm ngang, trục chính bên TRÁI; 2 cọc hàn ở đầu sau bên phải: + chĩa LÊN, − chĩa XUỐNG',
  render: (p) => {
    const on = !!p.lit;
    let s = DEFS + '<defs><linearGradient id="xp_can" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef1f4"/><stop offset="0.3" stop-color="#c6ccd2"/><stop offset="0.55" stop-color="#e3e7eb"/><stop offset="1" stop-color="#8d959d"/></linearGradient></defs>';
    // trục trước + bạc đạn
    s += `<rect x="-140" y="-7" width="46" height="14" rx="4" fill="url(#gLeg)" stroke="#6f767d" stroke-width="1.2"/>`;
    s += `<rect x="-106" y="-22" width="12" height="44" rx="4" fill="url(#xp_can)" stroke="#7d848c" stroke-width="1.2"/>`;
    // vỏ chính + vỏ sau
    s += `<rect x="-96" y="-70" width="18" height="140" rx="8" fill="url(#xp_can)" stroke="#7d848c" stroke-width="1.5"/>`;
    s += `<rect x="-84" y="-70" width="100" height="140" fill="url(#xp_can)" stroke="#7d848c" stroke-width="1.5"/>`;
    s += `<rect x="14" y="-66" width="76" height="132" rx="6" fill="url(#xp_can)" stroke="#7d848c" stroke-width="1.5"/>`;
    // khe thông gió thấy chổi than / cổ góp đồng
    s += `<rect x="36" y="-26" width="26" height="52" rx="6" fill="#2b2420"/><rect x="40" y="-20" width="18" height="40" rx="3" fill="#b8733a"/><rect x="44" y="-20" width="4" height="40" fill="#e1a066"/>`;
    s += `<rect x="40" y="-62" width="22" height="10" rx="3" fill="#3a332e"/>`;
    // nắp sau + trục sau
    s += `<rect x="88" y="-30" width="24" height="60" rx="10" fill="url(#xp_can)" stroke="#7d848c" stroke-width="1.5"/>`;
    s += `<rect x="110" y="-7" width="30" height="14" rx="4" fill="url(#gLeg)" stroke="#6f767d" stroke-width="1.2"/>`;
    // cọc hàn (đồng thau)
    const tab = (y1: number, y2: number) => `<rect x="64" y="${Math.min(y1, y2)}" width="12" height="${Math.abs(y2 - y1)}" rx="2" fill="#d9b35a" stroke="#8a6a24" stroke-width="1.2"/>`;
    s += tab(-66, -95) + tab(66, 95);
    s += `<rect x="-82" y="-64" width="96" height="10" rx="4" fill="#fff" opacity="0.5"/>`;
    s += `<text x="70" y="-108" font-family="${FONT}" font-size="20" font-weight="900" fill="#ff5a5a" text-anchor="middle">+</text>`;
    s += `<text x="88" y="112" font-family="${FONT}" font-size="22" font-weight="900" fill="#9fb8d8" text-anchor="middle">−</text>`;
    if (on) for (const r of [22, 32]) s += `<path d="M -124 ${-r} A ${r} ${r} 0 0 0 -124 ${r}" fill="none" stroke="#ffd34d" stroke-opacity="0.8" stroke-width="3" stroke-linecap="round" stroke-dasharray="8 6"/>`;
    return s;
  },
};

// ─── Bóng đèn dây tóc nhỏ (kiểu 1157 / đèn hậu xe máy) ───────────────────

export const MINI_BULB_COLORS: { key: string; name: string; glass: string; glassOn: string; glow: string }[] = [
  { key: 'clear', name: 'Trong', glass: '#e8f1f6', glassOn: '#fff4c4', glow: '#ffd27a' },
  { key: 'amber', name: 'Vàng cam', glass: '#f0901c', glassOn: '#ffb43a', glow: '#ff9a1f' },
  { key: 'red', name: 'Đỏ', glass: '#d62424', glassOn: '#ff4a3a', glow: '#ff3b2b' },
];

const MB_NUB = 24, MB_TIP = 62; // chốt ngàm vỏ / chấm đáy

const miniBulb: PartDef = {
  desc: 'Bóng đèn dây tóc nhỏ (kiểu 1157, đèn hậu xe máy): cực 1 = chấm đáy, cực 2 = vỏ đuôi (2 chốt ngàm 2 bên thông nhau) — value = V, marking = W',
  w: 64, h: 170,
  // "day" = chấm thiếc giữa đáy; "vo_trai" / "vo_phai" = 2 chốt ngàm trên vỏ đuôi (cùng 1 cực)
  pins: { day: { x: 0, y: MB_TIP }, vo_trai: { x: -30, y: MB_NUB }, vo_phai: { x: 30, y: MB_NUB } },
  pinDirs: { day: 1, vo_trai: 2, vo_phai: 0 },
  pinNote: 'bóng ở trên, đuôi kim loại ở dưới: chân "day" ở giữa đáy (dây đi xuống), 2 chốt vỏ "vo_trai" / "vo_phai" ở 2 bên đuôi (dây đi ngang, cùng 1 cực)',
  render: (p) => {
    const on = !!p.lit;
    const c = MINI_BULB_COLORS.find((x) => x.key === p.color) ?? MINI_BULB_COLORS[0];
    const clear = c.key === 'clear';
    let s = DEFS;
    // đuôi kim loại (cực vỏ) + 2 chốt ngàm 2 bên, đáy nhựa đen + chấm thiếc giữa đáy (cực đáy)
    s += `<rect x="-20" y="6" width="40" height="42" rx="3" fill="url(#gSilver)" stroke="#7d848c" stroke-width="1.5"/>`;
    for (const y of [16, 30]) s += `<path d="M -20 ${y} Q 0 ${y + 4} 20 ${y}" fill="none" stroke="#7d848c" stroke-width="1.2" opacity="0.7"/>`;
    for (const sx of [-1, 1]) s += `<rect x="${sx < 0 ? -31 : 19}" y="${MB_NUB - 6}" width="12" height="12" rx="5" fill="url(#gSilver)" stroke="#6f767d" stroke-width="1.3"/>`;
    s += `<rect x="-16" y="46" width="32" height="9" rx="3" fill="#15171a"/>`;
    s += `<ellipse cx="0" cy="${MB_TIP - 4}" rx="9" ry="6" fill="url(#gSolder)" stroke="#6f767d" stroke-width="1.2"/>`;
    // bóng thuỷ tinh dáng giọt
    const glass = 'M -16 8 L -18 -14 C -38 -26 -38 -74 0 -82 C 38 -74 38 -26 18 -14 L 16 8 Z';
    s += `<path d="${glass}" fill="${on ? c.glassOn : c.glass}" fill-opacity="${clear && !on ? 0.35 : 0.85}" stroke="${clear ? '#ffffff' : c.glass}" stroke-opacity="0.8" stroke-width="2"/>`;
    // dây đỡ + sợi tóc
    s += `<path d="M -6 6 L -8 -30 L -14 -50 M 6 6 L 8 -30 L 14 -50" fill="none" stroke="${clear ? '#8f979e' : '#5a3410'}" stroke-opacity="0.85" stroke-width="2"/>`;
    const fil = 'M -14 -50 l 4 -5 l 4 5 l 4 -5 l 4 5 l 4 -5 l 4 5 l 4 -5';
    s += on
      ? `<path d="${fil}" fill="none" stroke="#ff9d1c" stroke-width="5"/><path d="${fil}" fill="none" stroke="#fffbe8" stroke-width="2"/>`
      : `<path d="${fil}" fill="none" stroke="${clear ? '#5a4a3c' : '#4a2a0c'}" stroke-width="2"/>`;
    s += `<path d="M -22 -56 C -22 -68 -12 -76 -2 -77" fill="none" stroke="#fff" stroke-opacity="0.75" stroke-width="5" stroke-linecap="round"/>`;
    return s;
  },
  renderGlow: (p) => {
    if (!p.lit) return '';
    const c = MINI_BULB_COLORS.find((x) => x.key === p.color) ?? MINI_BULB_COLORS[0];
    return glow(c.glow, 0, -48, 150, 0.85);
  },
};

// ─── Công tắc bập bênh KCD11 (2 chân / 3 chân) ──────────────────────────

const SW_PIN_Y = 78;

function rocker(n: 2 | 3): PartDef {
  const xs = n === 2 ? [-16, 16] : [-22, 0, 22];
  const pins: Record<string, { x: number; y: number }> = {};
  xs.forEach((x, i) => { pins[String(i + 1)] = { x, y: SW_PIN_Y }; });
  return {
    desc: n === 2
      ? 'Công tắc bập bênh KCD11 2 chân (bật/tắt), nút đỏ I/O'
      : 'Công tắc bập bênh KCD11 3 chân (chân 2 ở giữa là chân chung), nút đỏ I/O',
    w: 90, h: 156,
    pins,
    pinDirs: Object.fromEntries(Object.keys(pins).map((k) => [k, 1])) as Record<string, 1>,
    pinNote: n === 2 ? 'nhìn thẳng mặt nút, 2 chân lá chĩa XUỐNG: chân 1 trái, chân 2 phải' : 'nhìn thẳng mặt nút, 3 chân lá chĩa XUỐNG: chân 1 trái, chân 2 giữa (chung), chân 3 phải',
    render: (p) => {
      const on = !!p.lit;
      let s = DEFS;
      // chân lá dẹt
      for (const x of xs) s += `<rect x="${x - 4}" y="28" width="8" height="${SW_PIN_Y - 28}" rx="1.5" fill="url(#gSilver)" stroke="#6f767d" stroke-width="1"/><circle cx="${x}" cy="${SW_PIN_Y - 16}" r="2" fill="#6f767d"/>`;
      // thân + chữ in
      s += `<rect x="-34" y="-14" width="68" height="44" rx="3" fill="url(#gBlack)" stroke="#000" stroke-width="1"/>`;
      s += `<text x="0" y="4" font-family="${FONT}" font-size="10" font-weight="700" fill="#9aa0a6" text-anchor="middle">KCD11</text>`;
      s += `<text x="0" y="18" font-family="${FONT}" font-size="9" font-weight="700" fill="#9aa0a6" text-anchor="middle">3A 250V AC</text>`;
      // viền khung + lỗ
      s += `<rect x="-42" y="-74" width="84" height="64" rx="5" fill="#18191c" stroke="#000" stroke-width="1.5"/>`;
      s += `<rect x="-40" y="-72" width="80" height="6" rx="3" fill="#fff" opacity="0.08"/>`;
      s += `<rect x="-34" y="-66" width="68" height="48" rx="3" fill="#060607"/>`;
      // nút bập bênh: nửa bị nhấn tối hơn, nửa nhô sáng hơn
      const pressedI = on;
      const half = (x: number, raised: boolean) =>
        `<rect x="${x}" y="${raised ? -66 : -64}" width="33" height="${raised ? 48 : 44}" rx="3" fill="${raised ? '#e0362f' : '#a51d18'}"/>` +
        (raised ? `<rect x="${x + 3}" y="-63" width="27" height="7" rx="3" fill="#fff" opacity="0.28"/>` : '');
      s += half(-34, !pressedI) + half(1, pressedI);
      s += `<line x1="0.5" y1="-66" x2="0.5" y2="-18" stroke="#5c0d0a" stroke-width="2"/>`;
      s += `<line x1="-17" y1="-50" x2="-17" y2="-34" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.9"/>`;
      s += `<circle cx="17" cy="-42" r="7" fill="none" stroke="#fff" stroke-width="2.6" opacity="0.9"/>`;
      return s;
    },
  };
}

export const EXTRA_PARTS: Record<string, PartDef> = {
  res_cement: resCement,
  res_power: resPower,
  cob,
  probe_red: probe('red'),
  probe_black: probe('black'),
  fan,
  motor,
  mini_bulb: miniBulb,
  sw_rocker2: rocker(2),
  sw_rocker3: rocker(3),
};
export const EXTRA_TYPES = new Set(Object.keys(EXTRA_PARTS));
export const isProbe = (type: string) => type === 'probe_red' || type === 'probe_black';
