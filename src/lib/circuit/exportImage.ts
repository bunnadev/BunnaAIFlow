import { esc, FONT, ID_SIZE, idPlacements, labelPlacements, renderScene, svgDefs, titleSvg } from './render';
import { blackWoodBackground, woodPhotoBackground } from './woodPhoto';
import type { RoutedWire } from './route';
import { endPartId } from './geometry';
import { contentBounds } from './world';
import type { ExportAspect, ExportBackground, WatermarkPos } from './projectModel';
import type { CircuitLayout } from './types';

/** Dựng ảnh xuất: lấy (1 phần) mạch trên bàn vẽ, căn giữa + co vừa khung, thêm nền và tiêu đề. */

export const ASPECT_SIZE: Record<ExportAspect, [number, number]> = { '4:5': [1080, 1350], '1:1': [1080, 1080], '9:16': [1080, 1920] };

const MAX_SCALE = 1.5;
const SIDE = 50;
const PAD = 30;

export interface ExportRenderOptions {
  aspect: ExportAspect;
  background: ExportBackground;
  /** dataURL của ảnh nền khi background.kind = 'image'. */
  backgroundDataUrl?: string;
  titleTop?: string;
  titleBottom?: string;
  /** Chỉ xuất các linh kiện này (không có = tất cả). */
  ids?: string[];
  /** In ký hiệu linh kiện (R1, C2…) lên ảnh. */
  showIds?: boolean;
  /** Tên kênh in mờ lên ảnh (để trống = không có). */
  watermark?: string;
  watermarkPos?: WatermarkPos;
}

/** Cao vùng chừa ở đáy cho watermark góc (đẩy tiêu đề dưới lên, không đè nhau). */
const WM_CORNER_ZONE = 40;

/** Watermark: góc dưới phải (chữ nhỏ rõ) và/hoặc chữ mảnh xoay chéo mờ giữa ảnh (khó cắt bỏ). */
export function watermarkSvg(text: string | undefined, pos: WatermarkPos, W: number, H: number): string {
  const t = text?.trim();
  if (!t) return '';
  let out = '';
  if (pos === 'center' || pos === 'both') {
    // Kiểu Huy chọn: chữ mảnh, trắng ~30%, xoay chéo 50°, dài ~60% bề ngang ảnh
    const size = Math.round(Math.min(90, (W * 0.6) / (t.length * 0.55)));
    out += `<text x="${W / 2}" y="${H / 2}" transform="rotate(-50 ${W / 2} ${H / 2})" font-family="${FONT}" font-size="${size}" font-weight="400" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" fill-opacity="0.3">${esc(t)}</text>`;
  }
  if (pos === 'corner' || pos === 'both') {
    out += `<text x="${W - 24}" y="${H - 18}" font-family="${FONT}" font-size="30" font-weight="800" text-anchor="end" fill="#ffffff" fill-opacity="0.85" stroke="#000" stroke-opacity="0.6" stroke-width="6" stroke-linejoin="round" paint-order="stroke">${esc(t)}</text>`;
  }
  return out;
}

export function subsetLayout(layout: CircuitLayout, ids: string[]): { layout: CircuitLayout; wireIndex: number[] } {
  const set = new Set(ids);
  const wireIndex = layout.wires.map((_, i) => i).filter((i) => set.has(endPartId(layout.wires[i].from)) && set.has(endPartId(layout.wires[i].to)));
  return {
    layout: { ...layout, parts: layout.parts.filter((p) => set.has(p.id)), wires: wireIndex.map((i) => layout.wires[i]) },
    wireIndex,
  };
}

export function renderExportSvg(
  layout: CircuitLayout,
  routed: (RoutedWire | null)[],
  opts: ExportRenderOptions,
): { svg: string; width: number; height: number; scale: number } | null {
  const [W, H] = ASPECT_SIZE[opts.aspect];
  const { layout: sub, wireIndex } = opts.ids ? subsetLayout(layout, opts.ids) : { layout, wireIndex: layout.wires.map((_, i) => i) };
  if (!sub.parts.length) return null;
  const subRouted = wireIndex.map((i) => routed[i] ?? null);
  const ids = new Set(sub.parts.map((p) => p.id));
  // Nhãn giữ đúng chỗ như trên bàn vẽ (tính trên cả mạch rồi lọc)
  const labels = labelPlacements(layout, routed, null).filter((l) => ids.has(l.partId));

  const idsPlaced = opts.showIds ? idPlacements(sub, labels, ID_SIZE.print, subRouted) : [];

  const b = contentBounds(sub, subRouted)!;
  for (const l of [...labels, ...idsPlaced]) {
    b.x1 = Math.min(b.x1, l.box.x1); b.y1 = Math.min(b.y1, l.box.y1);
    b.x2 = Math.max(b.x2, l.box.x2); b.y2 = Math.max(b.y2, l.box.y2);
  }
  const bw = b.x2 - b.x1 + PAD * 2, bh = b.y2 - b.y1 + PAD * 2;
  const topZone = opts.titleTop?.trim() ? 150 : SIDE;
  const wmPos = opts.watermarkPos ?? 'corner';
  const wmCorner = !!opts.watermark?.trim() && wmPos !== 'center' ? WM_CORNER_ZONE : 0;
  const bottomZone = (opts.titleBottom?.trim() ? 130 : SIDE) + wmCorner;
  const availW = W - SIDE * 2, availH = H - topZone - bottomZone;
  const scale = Math.min(availW / bw, availH / bh, MAX_SCALE);
  const tx = SIDE + (availW - bw * scale) / 2 - (b.x1 - PAD) * scale;
  const ty = topZone + (availH - bh * scale) / 2 - (b.y1 - PAD) * scale;

  const bg = opts.background.kind === 'color'
    ? `<rect width="${W}" height="${H}" fill="${opts.background.color}"/>`
    : opts.background.kind === 'image' && opts.backgroundDataUrl
      ? `<image href="${opts.backgroundDataUrl}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`
      : opts.background.kind === 'wood' ? woodPhotoBackground(W, H) : blackWoodBackground(W, H);
  const scene = renderScene(sub, { routed: subRouted, frame: null, labels, ...(opts.showIds ? { partIds: 'print' as const, idPlacements: idsPlaced } : {}) });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    svgDefs() + bg +
    `<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(4)})">${scene}</g>` +
    titleSvg(opts.titleTop?.trim(), 92, W) + titleSvg(opts.titleBottom?.trim(), H - 40 - wmCorner, W) +
    watermarkSvg(opts.watermark, wmPos, W, H) +
    `</svg>`;
  return { svg, width: W, height: H, scale };
}
