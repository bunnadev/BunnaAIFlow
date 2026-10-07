/**
 * Nền bàn vẽ kiểu EveryCircuit: nền đen, chấm nhỏ mỗi 40 đơn vị, ô vuông vừa
 * mỗi 4 chấm (160), ô vuông lớn mỗi 16 chấm (640). Ô lặp = 640 × 640 đơn vị bố cục.
 * Kích thước chấm tính theo pixel màn hình (chia cho zoom) để luôn dễ nhìn;
 * thu nhỏ đến mức chấm dày quá thì bỏ bớt cấp nhỏ.
 */
export const GRID_STEP = 40;
export const GRID_TILE = GRID_STEP * 16;
export const GRID_BG = '#060606';

/** Khoảng cách tối thiểu (px màn hình) giữa 2 chấm còn được vẽ. */
const MIN_GAP_PX = 9;

/** Làm tròn zoom theo bậc (để dựng lại ô lưới ít lần khi lăn phóng/thu). */
export function gridZoomKey(zoom: number): number {
  return Math.round(Math.log2(zoom) * 6) / 6;
}

export function dotGridTileSvg(zoom: number): string {
  const z = 2 ** gridZoomKey(zoom);
  const px = (n: number) => n / z; // n pixel màn hình → đơn vị bố cục
  // cấp còn đủ thưa để hiện (cấp lớn nhất luôn hiện); cấp nhỏ nhất còn hiện vẽ thành chấm nhỏ,
  // các cấp trên thành ô vuông vừa / lớn — thu nhỏ vẫn trông như lúc phóng to
  const shown = [1, 4, 16].filter((every) => every * GRID_STEP * z >= MIN_GAP_PX || every === 16);
  const looks = [{ size: px(3), fill: '#2e2e2e' }, { size: px(9), fill: '#1c1c1c' }, { size: px(20), fill: '#1c1c1c' }];
  const levels = shown.map((every, i) => ({ every, ...looks[i] }));
  let rects = '';
  const n = GRID_TILE / GRID_STEP;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      // cấp lớn nhất mà điểm này thuộc về
      const lv = [...levels].reverse().find((l) => i % l.every === 0 && j % l.every === 0);
      if (!lv) continue;
      const s = lv.size;
      // chấm (0,0) của ô nằm ở góc trên-trái → dịch nửa bước để không bị cắt ở mép ô
      const cx = i * GRID_STEP + GRID_STEP / 2, cy = j * GRID_STEP + GRID_STEP / 2;
      rects += `<rect x="${(cx - s / 2).toFixed(2)}" y="${(cy - s / 2).toFixed(2)}" width="${s.toFixed(2)}" height="${s.toFixed(2)}" fill="${lv.fill}"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${GRID_TILE}" height="${GRID_TILE}" viewBox="0 0 ${GRID_TILE} ${GRID_TILE}" shape-rendering="crispEdges">${rects}</svg>`;
}
