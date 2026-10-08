/** Vạch màu điện trở tính từ giá trị (dùng chung cho điện trở thường và điện trở công suất). */

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

