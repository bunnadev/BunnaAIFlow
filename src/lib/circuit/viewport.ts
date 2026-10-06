import type { Point } from './types';

const MIN_ZOOM = 0.1, MAX_ZOOM = 4;

/**
 * Lăn chuột / vuốt trackpad: không giữ Ctrl/Cmd (hoặc chụm 2 ngón — trình duyệt
 * gửi kèm ctrlKey) thì kéo bàn vẽ; giữ thì phóng to/thu nhỏ quanh con trỏ.
 * (cx, cy) = vị trí con trỏ tính từ góc trên-trái của bàn vẽ.
 */
export function wheelView(
  view: { zoom: number; pan: Point },
  e: { deltaX: number; deltaY: number; deltaMode?: number; ctrlKey: boolean; metaKey: boolean },
  cx: number, cy: number,
): { zoom: number; pan: Point } {
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1; // dòng / trang → px
  const dx = e.deltaX * unit, dy = e.deltaY * unit;
  if (e.ctrlKey || e.metaKey) {
    // chặn 1 nấc lăn chuột quá lớn (chuột thường gửi ~100px/nấc) để không nhảy zoom
    const d = Math.max(-50, Math.min(50, dy));
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * Math.exp(-d * 0.01)));
    const px = (cx - view.pan.x) / view.zoom, py = (cy - view.pan.y) / view.zoom;
    return { zoom, pan: { x: cx - px * zoom, y: cy - py * zoom } };
  }
  return { zoom: view.zoom, pan: { x: view.pan.x - dx, y: view.pan.y - dy } };
}
