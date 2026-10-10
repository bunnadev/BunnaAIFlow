import type { PartDef } from './parts';
import { glow } from './lightParts';

/**
 * Cảm biến & linh kiện báo của Xưởng vẽ mạch: LED phát / thu hồng ngoại, quang
 * trở (LDR), module laser, còi báo (chủ động / thụ động), công tắc nút nhấn,
 * micro electret (cảm biến âm thanh) nhìn chéo kiểu thật.
 */

const FONT = 'Helvetica Neue, Arial, sans-serif';

/** Chân kim loại mạ thiếc (giống parts.ts). */
const leg = (x1: number, y1: number, x2: number, y2: number, w = 7) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#7d848c" stroke-width="${w + 2}" stroke-linecap="round"/>` +
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="url(#gLeg)" stroke-width="${w}" stroke-linecap="round"/>`;

const DEFS =
  '<defs>' +
  '<linearGradient id="sn_irBlack" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#050507"/><stop offset="0.3" stop-color="#2a2a33"/><stop offset="0.45" stop-color="#4a4a58"/><stop offset="0.7" stop-color="#141419"/><stop offset="1" stop-color="#030304"/></linearGradient>' +
  '<linearGradient id="sn_clear" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c9d3de"/><stop offset="0.35" stop-color="#f4f7fb"/><stop offset="0.7" stop-color="#e3e9f0"/><stop offset="1" stop-color="#b3becb"/></linearGradient>' +
  '<linearGradient id="sn_brass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a5418"/><stop offset="0.3" stop-color="#d9a945"/><stop offset="0.5" stop-color="#f6d98a"/><stop offset="0.75" stop-color="#b9862d"/><stop offset="1" stop-color="#6b4712"/></linearGradient>' +
  '<linearGradient id="sn_buzz" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#060607"/><stop offset="0.35" stop-color="#26272b"/><stop offset="0.55" stop-color="#3a3c41"/><stop offset="1" stop-color="#08080a"/></linearGradient>' +
  '<linearGradient id="sn_alu" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9aa1a8"/><stop offset="0.3" stop-color="#e9ecef"/><stop offset="0.55" stop-color="#ffffff"/><stop offset="0.8" stop-color="#c3c8cd"/><stop offset="1" stop-color="#8a9097"/></linearGradient>' +
  '<linearGradient id="sn_ceramic" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f1ea"/><stop offset="1" stop-color="#cfc8ba"/></linearGradient>' +
  '<pattern id="sn_felt" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#141414"/><circle cx="1.5" cy="1.5" r="0.8" fill="#2c2c2c"/><circle cx="4" cy="3.8" r="0.6" fill="#262626"/></pattern>' +
  '</defs>';

const sym = (x: number, y: number, t: '+' | '−', size = 18) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="900" fill="${t === '+' ? '#ff5a5a' : '#7fb2ff'}" text-anchor="middle">${t}</text>`;

const IR_GLOW = '#b37bff'; // tia hồng ngoại không thấy bằng mắt — vẽ tím nhạt như qua camera điện thoại

// ─── LED phát / thu hồng ngoại 5mm ─────────────────────────────────────

function irLed(kind: 'tx' | 'rx'): PartDef {
  const tx = kind === 'tx';
  return {
    desc: tx
      ? 'LED phát hồng ngoại (IR) 5mm — bóng trong suốt, chân dài là A (+)'
      : 'LED thu hồng ngoại (photodiode IR) 5mm — bóng đen, chân dài là A; thường mắc ngược (K lên +) qua điện trở',
    w: 70, h: 160,
    pins: { A: { x: -12, y: 80 }, K: { x: 12, y: 80 } },
    pinDirs: { A: 1, K: 1 },
    pinNote: 'bóng ở trên, 2 chân chĩa XUỐNG: A (chân dài, dương) trái, K (phía mép vát) phải',
    render: (p) => {
      let s = DEFS + leg(-10, 4, -12, 80, 5) + leg(10, 4, 12, 72, 5);
      if (tx) {
        const on = !!p.lit;
        // khung chân bên trong (đe + cột) nhìn xuyên qua nhựa trong
        s += `<path d="M -26 6 L -26 -46 A 26 26 0 0 1 26 -46 L 26 6 Z" fill="url(#sn_clear)" fill-opacity="${on ? 0.85 : 0.6}" stroke="#aab4c0" stroke-width="1.5"/>`;
        s += `<path d="M 4 4 V -18 H 16 V -26 H 2 V -18" fill="#8e969e" opacity="0.75"/>`;
        s += `<path d="M -10 4 V -22 H -4 V -30 H -12 Z" fill="#9aa2aa" opacity="0.7"/>`;
        s += `<path d="M -4 -30 Q 2 -40 6 -26" fill="none" stroke="#c9cfd5" stroke-width="1"/>`;
        if (on) s += `<circle cx="10" cy="-26" r="6" fill="${IR_GLOW}" opacity="0.9"/>`;
        s += `<rect x="-31" y="-2" width="62" height="12" rx="3" fill="url(#sn_clear)" fill-opacity="0.75" stroke="#aab4c0" stroke-width="1.2"/>`;
        s += `<rect x="25" y="-2" width="6" height="12" fill="#9aa4ae" opacity="0.5"/>`; // mép vát phía K
      } else {
        s += `<path d="M -26 6 L -26 -46 A 26 26 0 0 1 26 -46 L 26 6 Z" fill="url(#sn_irBlack)" stroke="#000" stroke-width="1.2"/>`;
        s += `<rect x="-31" y="-2" width="62" height="12" rx="3" fill="url(#sn_irBlack)" stroke="#000" stroke-width="1.2"/>`;
        s += `<rect x="25" y="-2" width="6" height="12" fill="#000" opacity="0.6"/>`;
      }
      s += `<ellipse cx="-11" cy="-50" rx="6" ry="12" fill="#fff" opacity="${tx ? 0.7 : 0.28}"/>`;
      s += `<rect x="-21" y="-38" width="4" height="36" rx="2" fill="#fff" opacity="${tx ? 0.4 : 0.12}"/>`;
      return s;
    },
    renderGlow: tx ? (p) => (p.lit ? glow(IR_GLOW, 0, -36, 130, 0.55) : '') : undefined,
  };
}

// ─── Quang trở LDR (cảm biến ánh sáng) ────────────────────────────────

const ldr: PartDef = {
  desc: 'Quang trở LDR 5mm (cảm biến ánh sáng) — 2 chân không phân cực, sáng thì điện trở giảm',
  w: 80, h: 170,
  pins: { '1': { x: -13, y: 85 }, '2': { x: 13, y: 85 } },
  pinDirs: { '1': 1, '2': 1 },
  pinNote: 'mặt cảm biến hướng lên, 2 chân chĩa XUỐNG: chân 1 trái, chân 2 phải (không phân cực)',
  render: () => {
    let s = DEFS + leg(-13, -6, -13, 85, 4) + leg(13, -6, 13, 85, 4);
    // đế gốm dày (mép dưới) + mặt trước
    s += `<path d="M -36 -38 Q -40 -38 -40 -30 V -6 Q -40 4 -30 6 H 30 Q 40 4 40 -6 V -30 Q 40 -38 36 -38 Z" fill="#b8ad99"/>`;
    s += `<path d="M -32 -76 H 32 Q 40 -76 40 -66 V -18 Q 40 -8 30 -8 H -30 Q -40 -8 -40 -18 V -66 Q -40 -76 -32 -76 Z" fill="url(#sn_ceramic)" stroke="#a89d88" stroke-width="1.2"/>`;
    // lớp CdS cam + đường điện cực răng lược (vệt sáng ngoằn ngoèo)
    s += `<rect x="-30" y="-68" width="60" height="52" rx="6" fill="#e2884a"/>`;
    s += `<rect x="-30" y="-68" width="60" height="52" rx="6" fill="none" stroke="#c4612a" stroke-width="1.5"/>`;
    for (let i = 0; i < 9; i++) {
      const x = -22 + i * 5.5;
      s += `<line x1="${x}" y1="${i % 2 ? -62 : -22}" x2="${x}" y2="${i % 2 ? -26 : -58}" stroke="#f6c89a" stroke-width="2.4"/>`;
    }
    s += `<path d="M -26 -63 H 26 M -26 -21 H 26" stroke="#f6c89a" stroke-width="3"/>`;
    s += `<circle cx="0" cy="-66" r="2.6" fill="#8b8f93"/><circle cx="0" cy="-18" r="2.6" fill="#8b8f93"/>`;
    s += `<rect x="-36" y="-74" width="72" height="5" rx="2.5" fill="#fff" opacity="0.4"/>`;
    return s;
  },
};

// ─── Module laser 5V (ống đồng, 2 dây đỏ / xanh) ─────────────────────────

const LASER_PIN_Y = 110;

const laser: PartDef = {
  desc: 'Module laser đỏ 5V (ống đồng 6mm, dây đỏ = +, dây xanh = −)',
  w: 70, h: LASER_PIN_Y * 2,
  pins: { '+': { x: -14, y: LASER_PIN_Y }, '-': { x: 14, y: LASER_PIN_Y } },
  pinDirs: { '+': 1, '-': 1 },
  pinNote: 'đầu phát tia hướng LÊN, 2 dây ra ở đuôi phía DƯỚI: + (dây đỏ) trái, − (dây xanh) phải',
  render: (p) => {
    const on = !!p.lit;
    const wire = (x: number, main: string, dark: string, bend: number) => {
      const d = `M ${x / 3} 34 C ${x / 3} 56 ${x + bend} 64 ${x} ${LASER_PIN_Y - 14}`;
      return `<path d="${d}" fill="none" stroke="${dark}" stroke-width="9" stroke-linecap="round"/>` +
        `<path d="${d}" fill="none" stroke="${main}" stroke-width="6.5" stroke-linecap="round"/>` +
        `<line x1="${x}" y1="${LASER_PIN_Y - 14}" x2="${x}" y2="${LASER_PIN_Y}" stroke="url(#gTinnedCore)" stroke-width="4" stroke-linecap="round"/>`;
    };
    let s = DEFS + wire(-14, '#e0262c', '#7a0b10', -8) + wire(14, '#2747c9', '#0f1f6b', 8);
    // keo / mạch nhỏ ở đuôi
    s += `<rect x="-17" y="24" width="34" height="14" rx="3" fill="#2c6e3c" stroke="#174024" stroke-width="1"/>`;
    s += `<circle cx="-5" cy="31" r="3" fill="url(#gSolder)"/><circle cx="5" cy="31" r="3" fill="url(#gSolder)"/>`;
    // ống đồng: thân + 2 rãnh + vành đầu
    s += `<rect x="-22" y="-86" width="44" height="114" rx="4" fill="url(#sn_brass)" stroke="#6b4712" stroke-width="1.2"/>`;
    for (const y of [-40, 0]) s += `<rect x="-22" y="${y}" width="44" height="4" fill="#6b4712" opacity="0.55"/>`;
    s += `<rect x="-17" y="-80" width="5" height="100" rx="2.5" fill="#fff" opacity="0.35"/>`;
    // mặt đầu nhìn chéo: vành + thấu kính
    s += `<ellipse cx="0" cy="-86" rx="22" ry="8" fill="#e6c068" stroke="#6b4712" stroke-width="1.2"/>`;
    s += `<ellipse cx="0" cy="-86" rx="11" ry="4" fill="${on ? '#ff2a2a' : '#1a0f0a'}"/>`;
    s += `<ellipse cx="-3" cy="-87" rx="4" ry="1.4" fill="#fff" opacity="${on ? 0.9 : 0.35}"/>`;
    if (on) s += `<path d="M -3 -88 L -3 -200 L 3 -200 L 3 -88 Z" fill="#ff2a2a" opacity="0.55"/>`;
    s += sym(-28, LASER_PIN_Y - 18, '+', 16) + sym(28, LASER_PIN_Y - 18, '−', 18);
    return s;
  },
  renderGlow: (p) => (p.lit ? glow('#ff2a2a', 0, -88, 90, 0.9) : ''),
};

// ─── Còi báo (buzzer) chủ động / thụ động ──────────────────────────────

const BUZ_PIN_Y = 100;

function buzzer(active: boolean): PartDef {
  return {
    desc: active
      ? 'Còi báo chủ động (active buzzer) 5V — cấp điện là kêu, có dấu + trên đỉnh, chân + dài hơn'
      : 'Còi báo thụ động (passive buzzer) — cần xung (VD từ NE555 / Arduino) mới kêu, đáy hở lộ mạch xanh',
    w: 130, h: BUZ_PIN_Y * 2,
    pins: { '+': { x: -20, y: BUZ_PIN_Y }, '-': { x: 20, y: BUZ_PIN_Y } },
    pinDirs: { '+': 1, '-': 1 },
    pinNote: 'nhìn chéo từ trên, 2 chân chĩa XUỐNG: + trái, − phải',
    render: (p) => {
      let s = DEFS + leg(-20, 30, -20, BUZ_PIN_Y, 5) + leg(20, 30, 20, BUZ_PIN_Y - 10, 5);
      // thân trụ đen
      s += `<path d="M -56 -46 V 26 A 56 16 0 0 0 56 26 V -46 Z" fill="url(#sn_buzz)" stroke="#000" stroke-width="1.2"/>`;
      if (active) {
        s += `<path d="M -56 2 A 56 16 0 0 0 56 2" fill="none" stroke="#000" stroke-width="2.5"/>`;
        s += `<path d="M -56 6 A 56 16 0 0 0 56 6" fill="none" stroke="#4a4c52" stroke-width="1"/>`;
      } else {
        // đáy hở: viền mạch xanh lộ ra dưới thân
        s += `<path d="M -56 18 A 56 16 0 0 0 56 18 V 26 A 56 16 0 0 1 -56 26 Z" fill="#1f7a46" stroke="#0e3d22" stroke-width="1"/>`;
      }
      s += `<rect x="-50" y="-40" width="7" height="58" rx="3.5" fill="#fff" opacity="0.1"/>`;
      // mặt trên + lỗ giữa
      s += `<ellipse cx="0" cy="-46" rx="56" ry="16" fill="#1d1e22" stroke="#000" stroke-width="1.2"/>`;
      s += `<ellipse cx="-14" cy="-50" rx="26" ry="5" fill="#fff" opacity="0.07"/>`;
      s += `<ellipse cx="0" cy="-46" rx="11" ry="4.5" fill="#000"/>`;
      if (active) {
        s += `<g transform="translate(32 -45) scale(1 0.32)"><circle r="12" fill="none" stroke="#5a5c62" stroke-width="2.4"/>` +
          `<path d="M -6 0 H 6 M 0 -6 V 6" stroke="#5a5c62" stroke-width="2.6"/></g>`;
      }
      s += sym(-36, BUZ_PIN_Y - 6, '+', 16) + sym(36, BUZ_PIN_Y - 6, '−', 18);
      // đang kêu: sóng âm phát ra từ lỗ
      if (p.lit) {
        s += [22, 38, 54].map((r, i) =>
          `<path d="M ${-r} ${-62 - r * 0.25} Q 0 ${-62 - r * 1.15} ${r} ${-62 - r * 0.25}" fill="none" stroke="#ffd21f" stroke-width="${4 - i}" stroke-linecap="round" opacity="${0.9 - i * 0.22}"/>`).join('');
      }
      return s;
    },
  };
}

// ─── Công tắc nút nhấn (nhấn giữ / nhấn nhả), 2 chân lá 2 bên ─────────────

const PUSH_PIN_X = 92;

const swPush: PartDef = {
  desc: 'Công tắc nút nhấn 2 chân (thân đen, nút tròn, 2 chân lá có lỗ ở 2 bên)',
  w: PUSH_PIN_X * 2, h: 110,
  pins: { '1': { x: -PUSH_PIN_X, y: 18 }, '2': { x: PUSH_PIN_X, y: 18 } },
  pinDirs: { '1': 2, '2': 0 },
  pinNote: 'nút nhấn hướng LÊN, 2 chân lá chĩa ra 2 bên: chân 1 trái, chân 2 phải',
  render: (p) => {
    const down = p.lit ? 8 : 0;
    const tab = (dir: -1 | 1) => {
      const x0 = dir * 44, x1 = dir * PUSH_PIN_X;
      const l = Math.min(x0, x1), w = Math.abs(x1 - x0);
      return `<rect x="${l}" y="8" width="${w}" height="20" rx="3" fill="url(#gSilver)" stroke="#6f767d" stroke-width="1"/>` +
        `<circle cx="${dir * 70}" cy="18" r="5" fill="#3a3d42"/>` +
        `<rect x="${l + 2}" y="10" width="${w - 4}" height="4" rx="2" fill="#fff" opacity="0.4"/>`;
    };
    let s = DEFS + tab(-1) + tab(1);
    // thân đen: 2 bậc khía ở 2 bên
    s += `<path d="M -50 -18 H -44 V -24 H 44 V -18 H 50 V 46 Q 50 52 44 52 H -44 Q -50 52 -50 46 Z" fill="url(#gBlack)" stroke="#000" stroke-width="1.2"/>`;
    s += `<path d="M -50 8 H -44 V 30 H -50 M 50 8 H 44 V 30 H 50" fill="none" stroke="#000" stroke-width="1.5" opacity="0.7"/>`;
    s += `<rect x="-44" y="-22" width="88" height="6" rx="3" fill="#fff" opacity="0.1"/>`;
    // vai + nút tròn to (như ảnh thật)
    s += `<rect x="-32" y="-34" width="64" height="12" rx="4" fill="#202125" stroke="#000" stroke-width="1"/>`;
    s += `<path d="M -22 -32 V ${-62 + down} A 22 8 0 0 1 22 ${-62 + down} V -32 Z" fill="url(#sn_buzz)" stroke="#000" stroke-width="1"/>`;
    s += `<ellipse cx="0" cy="${-62 + down}" rx="22" ry="8" fill="#2e2f34" stroke="#000" stroke-width="1"/>`;
    s += `<ellipse cx="-6" cy="${-64 + down}" rx="9" ry="2.5" fill="#fff" opacity="0.12"/>`;
    s += `<rect x="-17" y="${-58 + down}" width="5" height="${22 - down}" rx="2.5" fill="#fff" opacity="0.15"/>`;
    return s;
  },
};

// ─── Micro electret (cảm biến âm thanh) nhìn chéo kiểu thật ──────────────

const MIC_PIN_Y = 90;

const micElectret: PartDef = {
  desc: 'Micro electret (cảm biến âm thanh) — vỏ nhôm, mặt lưới nỉ đen, 2 chân; chân − nối vỏ',
  w: 90, h: MIC_PIN_Y * 2,
  pins: { '+': { x: -13, y: MIC_PIN_Y }, '-': { x: 13, y: MIC_PIN_Y } },
  pinDirs: { '+': 1, '-': 1 },
  pinNote: 'mặt nỉ hướng LÊN (nhìn chéo), 2 chân chĩa XUỐNG: + trái, − phải (chân − nối vỏ nhôm)',
  render: () => {
    let s = DEFS + leg(-13, 20, -13, MIC_PIN_Y, 4) + leg(13, 20, 13, MIC_PIN_Y, 4);
    // thân trụ nhôm + mặt trên
    s += `<path d="M -38 -40 V 18 A 38 13 0 0 0 38 18 V -40 Z" fill="url(#sn_alu)" stroke="#7d848c" stroke-width="1.2"/>`;
    s += `<ellipse cx="0" cy="-40" rx="38" ry="13" fill="#d3d7db" stroke="#7d848c" stroke-width="1.2"/>`;
    s += `<ellipse cx="0" cy="-40" rx="32" ry="10.5" fill="url(#sn_felt)" stroke="#0a0a0a" stroke-width="1"/>`;
    s += `<path d="M -35 -36 A 38 13 0 0 0 35 -36" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.6"/>`;
    // vạch chân − (nối vỏ)
    s += `<line x1="13" y1="20" x2="22" y2="12" stroke="#7d848c" stroke-width="2.5" stroke-linecap="round"/>`;
    s += sym(-30, MIC_PIN_Y - 10, '+', 16) + sym(30, MIC_PIN_Y - 10, '−', 18);
    return s;
  },
};

export const SENSOR_PARTS: Record<string, PartDef> = {
  ir_tx: irLed('tx'),
  ir_rx: irLed('rx'),
  ldr,
  laser,
  buzzer_active: buzzer(true),
  buzzer_passive: buzzer(false),
  sw_push: swPush,
  mic_electret: micElectret,
};

/** Linh kiện có ô "đang chạy / đang bật" trong cột chỉnh sửa → chữ hiện cạnh ô đó. */
export const SENSOR_LIT_LABEL: Record<string, string> = {
  ir_tx: 'Đang phát (tia IR vẽ tím như qua camera)',
  laser: 'Đang phát tia',
  buzzer_active: 'Đang kêu',
  buzzer_passive: 'Đang kêu',
  sw_push: 'Đang nhấn',
};
